/*
 * Smart Garden — ESP32 firmware
 * ==============================
 * Serves the exact sensor/command/config API documented in docs/API.md so
 * the Vite dashboard (src/) can talk to real hardware by pointing
 * CONFIG.ESP32_URL at this device's IP.
 *
 * Sensors:
 *   - DHT22            temperature + humidity            (1-wire, GPIO4)
 *   - 2x capacitive soil moisture (analog)                arabica: GPIO34, chili: GPIO35
 *   - 2x BH1750 lux (I2C)                                 arabica: 0x23, chili: 0x5C
 *   - TDS sensor (analog)                                 GPIO32
 *   - pH sensor (analog)                                  GPIO33
 * Actuators:
 *   - Water pump relay                                    GPIO25
 *   - Grow light relay                                    GPIO26
 *
 * The ESP32 is the AUTHORITATIVE actor for auto-watering: it keeps
 * enforcing each plant's rule (threshold / cooldown / daily cap / max
 * pulse) every loop, independent of whether a browser is connected. The
 * dashboard's demo mode simulates the identical decision logic
 * client-side (src/lib/health.js: shouldWater()) purely so the UI loop is
 * visible without hardware — see docs/API.md for the mirrored pseudocode.
 *
 * Libraries required (Arduino Library Manager):
 *   - DHT sensor library (Adafruit)
 *   - BH1750 (claws/BH1750)
 *   - ArduinoJson v7.x (this sketch uses the v7 JsonDocument / .to<JsonObject>() API)
 *   - WebServer / WiFi (bundled with the ESP32 Arduino core)
 *   - Preferences (bundled with the ESP32 Arduino core) — used for NVS
 *     persistence of auto-water rules across reboots.
 *
 * Not compiled/tested on real hardware as part of this change (out of
 * scope per the project plan) — reviewed for pin conflicts and logic
 * sanity. Treat calibration constants (ADC->% mapping, TDS/pH curve
 * coefficients) as starting points; every capacitive soil sensor and pH
 * probe needs its own dry/wet (and buffer-solution) calibration.
 */

#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>

// ---------------------------------------------------------------------------
//  WIFI
// ---------------------------------------------------------------------------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ---------------------------------------------------------------------------
//  PIN MAP  (see firmware/smart_garden_esp32/README.md for the wiring table)
// ---------------------------------------------------------------------------
#define PIN_DHT22        4
#define PIN_SOIL_ARABICA 34   // ADC1_CH6 — must stay on an ADC1 pin (ADC2 is
#define PIN_SOIL_CHILI   35   // ADC1_CH7    unusable while WiFi is active)
#define PIN_TDS          32   // ADC1_CH4
#define PIN_PH           33   // ADC1_CH5
#define PIN_I2C_SDA      21
#define PIN_I2C_SCL      22
#define PIN_PUMP_RELAY   25
#define PIN_LIGHT_RELAY  26

#define DHTTYPE DHT22

// BH1750 default I2C address is 0x23 (ADDR pin low/floating) and 0x5C when
// ADDR is pulled high. Most breakout boards expose an ADDR pad — tie the
// chili sensor's ADDR pin to 3.3V through a pull-up (or directly, per your
// board's datasheet) so both lux sensors can share the same I2C bus at
// different addresses. If your boards don't expose ADDR, use a second I2C
// bus (Wire1) on different pins instead, or an I2C mux (e.g. TCA9548A).
#define BH1750_ADDR_ARABICA 0x23
#define BH1750_ADDR_CHILI   0x5C

// ---------------------------------------------------------------------------
//  SAFETY CONSTANTS (auto-watering hard limits — see docs/API.md)
// ---------------------------------------------------------------------------
const uint32_t MAX_PULSE_SECONDS = 8;       // absolute cap, regardless of rule.pulse_seconds
const uint32_t SENSOR_INTERVAL_MS = 5000;   // matches the dashboard's default POLL_INTERVAL
const uint32_t AUTO_WATER_CHECK_INTERVAL_MS = 5000;

// ---------------------------------------------------------------------------
//  STATE
// ---------------------------------------------------------------------------
DHT dht(PIN_DHT22, DHTTYPE);
BH1750 luxArabica(BH1750_ADDR_ARABICA);
BH1750 luxChili(BH1750_ADDR_CHILI);
WebServer server(80);
Preferences prefs;

struct AutoWaterRule {
  bool enabled;
  float thresholdPercent;
  uint32_t pulseSeconds;
  uint32_t cooldownMinutes;
  uint32_t maxDailyPulses;
};

struct AutoWaterRuntime {
  String state;            // "armed" | "cooling-down" | "pumping" | "disarmed"
  uint32_t lastPumpAtMs;    // millis() timestamp of last pulse (0 = never)
  uint32_t pulsesToday;
  int lastPulseDay;         // day-of-year, for the midnight reset
};

struct PlantState {
  const char* id;
  int soilPin;
  BH1750* luxSensor;
  AutoWaterRule rule;
  AutoWaterRuntime runtime;
  float lastSoilPercent;
  float lastLux;
};

PlantState plants[2] = {
  { "arabica", PIN_SOIL_ARABICA, &luxArabica, { false, 35.0, 3, 30, 4 }, { "disarmed", 0, 0, -1 }, 0, 0 },
  { "chili",   PIN_SOIL_CHILI,   &luxChili,   { false, 25.0, 4, 30, 4 }, { "disarmed", 0, 0, -1 }, 0, 0 },
};
const int PLANT_COUNT = 2;

bool pumpActive = false;
uint32_t pumpStartedAtMs = 0;
uint32_t pumpRunSeconds = 0;
uint32_t lastPumpFinishedAtMs = 0; // for actuators.last_pump_seconds_ago

// "auto" is the light relay's default mode; on/off are manual overrides
// until the next /api/light?action=auto call.
enum LightMode { LIGHT_AUTO, LIGHT_FORCED_ON, LIGHT_FORCED_OFF };
LightMode lightMode = LIGHT_AUTO;
bool lightActive = false;

float lastTemperature = NAN;
float lastHumidity = NAN;
float lastTdsPpm = NAN;
float lastPh = NAN;

uint32_t lastSensorReadMs = 0;
uint32_t lastAutoWaterCheckMs = 0;

// ---------------------------------------------------------------------------
//  CALIBRATION (placeholders — calibrate per physical sensor)
// ---------------------------------------------------------------------------
// Capacitive soil sensors read HIGH (raw ADC) when dry and LOW when wet.
// Replace these with your sensor's actual dry-air / water-immersion readings.
const int SOIL_RAW_DRY = 3000;
const int SOIL_RAW_WET = 1200;

float soilRawToPercent(int raw) {
  float pct = 100.0 * (float)(SOIL_RAW_DRY - raw) / (float)(SOIL_RAW_DRY - SOIL_RAW_WET);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}

// TDS: classic analog TDS sensor curve (temperature-compensated), adjust the
// coefficients per your module's datasheet.
float readTdsPpm(float temperatureC) {
  int raw = analogRead(PIN_TDS);
  float voltage = raw * (3.3 / 4095.0);
  float compensationCoefficient = 1.0 + 0.02 * (temperatureC - 25.0);
  float compensatedVoltage = voltage / compensationCoefficient;
  float tds = (133.42 * pow(compensatedVoltage, 3) - 255.86 * pow(compensatedVoltage, 2) + 857.39 * compensatedVoltage) * 0.5;
  return tds < 0 ? 0 : tds;
}

// pH: linear approximation from analog probe voltage — calibrate the two
// constants against pH 4.0 / pH 7.0 buffer solutions.
float readPh() {
  int raw = analogRead(PIN_PH);
  float voltage = raw * (3.3 / 4095.0);
  const float PH_SLOPE = -5.70;   // pH units per volt — calibrate!
  const float PH_OFFSET = 21.34;  // calibrate!
  return PH_SLOPE * voltage + PH_OFFSET;
}

// ---------------------------------------------------------------------------
//  PERSISTENCE (auto-water rules survive reboot)
// ---------------------------------------------------------------------------
void saveRuleToPrefs(PlantState& p) {
  String prefix = String(p.id) + "_";
  prefs.putBool((prefix + "en").c_str(), p.rule.enabled);
  prefs.putFloat((prefix + "th").c_str(), p.rule.thresholdPercent);
  prefs.putUInt((prefix + "ps").c_str(), p.rule.pulseSeconds);
  prefs.putUInt((prefix + "cd").c_str(), p.rule.cooldownMinutes);
  prefs.putUInt((prefix + "mx").c_str(), p.rule.maxDailyPulses);
}

void loadRuleFromPrefs(PlantState& p) {
  String prefix = String(p.id) + "_";
  p.rule.enabled = prefs.getBool((prefix + "en").c_str(), p.rule.enabled);
  p.rule.thresholdPercent = prefs.getFloat((prefix + "th").c_str(), p.rule.thresholdPercent);
  p.rule.pulseSeconds = prefs.getUInt((prefix + "ps").c_str(), p.rule.pulseSeconds);
  p.rule.cooldownMinutes = prefs.getUInt((prefix + "cd").c_str(), p.rule.cooldownMinutes);
  p.rule.maxDailyPulses = prefs.getUInt((prefix + "mx").c_str(), p.rule.maxDailyPulses);
}

// ---------------------------------------------------------------------------
//  PUMP / LIGHT CONTROL
// ---------------------------------------------------------------------------
void startPump(uint32_t seconds) {
  if (pumpActive) return; // never overlap a running pulse
  uint32_t capped = seconds > MAX_PULSE_SECONDS ? MAX_PULSE_SECONDS : seconds;
  digitalWrite(PIN_PUMP_RELAY, HIGH);
  pumpActive = true;
  pumpStartedAtMs = millis();
  pumpRunSeconds = capped;
}

void stopPump() {
  if (!pumpActive) return;
  digitalWrite(PIN_PUMP_RELAY, LOW);
  pumpActive = false;
  lastPumpFinishedAtMs = millis();
}

void serviceRunningPump() {
  if (pumpActive && millis() - pumpStartedAtMs >= pumpRunSeconds * 1000UL) {
    stopPump();
  }
}

void setLightRelay(bool on) {
  digitalWrite(PIN_LIGHT_RELAY, on ? HIGH : LOW);
  lightActive = on;
}

// Auto light schedule: on 06:00-22:00, but only supplementing when ambient
// (arabica-zone) lux is already below ~2000 — mirrors the note shown in the
// dashboard's Controls tab.
void serviceLightAutoMode() {
  if (lightMode != LIGHT_AUTO) return;
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  bool withinSchedule = t->tm_hour >= 6 && t->tm_hour < 22;
  bool tooDark = plants[0].lastLux < 2000.0;
  setLightRelay(withinSchedule && tooDark);
}

// ---------------------------------------------------------------------------
//  SENSOR READ
// ---------------------------------------------------------------------------
void readAllSensors() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) lastTemperature = t;
  if (!isnan(h)) lastHumidity = h;

  for (int i = 0; i < PLANT_COUNT; i++) {
    int raw = analogRead(plants[i].soilPin);
    plants[i].lastSoilPercent = soilRawToPercent(raw);
    float lux = plants[i].luxSensor->readLightLevel();
    if (lux >= 0) plants[i].lastLux = lux; // BH1750 returns -1 on read failure
  }

  lastTdsPpm = readTdsPpm(isnan(lastTemperature) ? 25.0 : lastTemperature);
  lastPh = readPh();
}

// ---------------------------------------------------------------------------
//  AUTHORITATIVE AUTO-WATERING LOOP  (mirrors src/lib/health.js shouldWater())
// ---------------------------------------------------------------------------
int currentDayOfYear() {
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  return t->tm_yday;
}

void resetDailyCounterIfNeeded(AutoWaterRuntime& rt) {
  int today = currentDayOfYear();
  if (rt.lastPulseDay != today) {
    rt.pulsesToday = 0;
    rt.lastPulseDay = today;
  }
}

void runAutoWaterLoop() {
  for (int i = 0; i < PLANT_COUNT; i++) {
    PlantState& p = plants[i];
    resetDailyCounterIfNeeded(p.runtime);

    if (!p.rule.enabled) {
      p.runtime.state = "disarmed";
      continue;
    }

    // Never overlap pulses — one shared pump serves all plants here; if
    // your build uses one valve per plant, only gate on that plant's own
    // valve state instead of the global pumpActive flag.
    if (pumpActive) {
      p.runtime.state = "pumping";
      continue;
    }

    if (p.lastSoilPercent >= p.rule.thresholdPercent) {
      p.runtime.state = "armed";
      continue;
    }

    if (p.runtime.pulsesToday >= p.rule.maxDailyPulses) {
      p.runtime.state = "armed"; // gated by daily cap, not truly idle-armed, but not an error
      continue;
    }

    if (p.runtime.lastPumpAtMs != 0) {
      uint32_t elapsedMin = (millis() - p.runtime.lastPumpAtMs) / 60000UL;
      if (elapsedMin < p.rule.cooldownMinutes) {
        p.runtime.state = "cooling-down";
        continue;
      }
    }

    // All gates passed — fire a pulse for this plant.
    startPump(p.rule.pulseSeconds);
    p.runtime.lastPumpAtMs = millis();
    p.runtime.pulsesToday += 1;
    p.runtime.state = "pumping";
    // If your hardware has one valve/pump per plant instead of a shared
    // pump, only start THIS plant's pump/valve pin here.
  }
}

// ---------------------------------------------------------------------------
//  JSON BUILDERS
// ---------------------------------------------------------------------------
void writeSensorsJson(JsonDocument& doc) {
  doc["temperature"] = lastTemperature;
  doc["humidity"] = lastHumidity;
  JsonObject water = doc["water"].to<JsonObject>();
  water["tds_ppm"] = lastTdsPpm;
  water["ph"] = lastPh;

  JsonObject plantsObj = doc["plants"].to<JsonObject>();
  for (int i = 0; i < PLANT_COUNT; i++) {
    JsonObject po = plantsObj[plants[i].id].to<JsonObject>();
    po["soil_percent"] = plants[i].lastSoilPercent;
    po["soil_raw"] = analogRead(plants[i].soilPin);
    po["light_lux"] = plants[i].lastLux;
  }

  JsonObject actuators = doc["actuators"].to<JsonObject>();
  actuators["pump_active"] = pumpActive;
  actuators["light_active"] = lightActive;
  actuators["last_pump_seconds_ago"] = lastPumpFinishedAtMs == 0 ? -1 : (int)((millis() - lastPumpFinishedAtMs) / 1000UL);

  JsonObject autoWater = doc["auto_water"].to<JsonObject>();
  for (int i = 0; i < PLANT_COUNT; i++) {
    JsonObject ao = autoWater[plants[i].id].to<JsonObject>();
    ao["enabled"] = plants[i].rule.enabled;
    ao["threshold_percent"] = plants[i].rule.thresholdPercent;
    ao["pulse_seconds"] = plants[i].rule.pulseSeconds;
    ao["cooldown_minutes"] = plants[i].rule.cooldownMinutes;
    ao["max_daily_pulses"] = plants[i].rule.maxDailyPulses;
    ao["state"] = plants[i].runtime.state;
    ao["pulses_today"] = plants[i].runtime.pulsesToday;
  }

  JsonObject meta = doc["meta"].to<JsonObject>();
  meta["uptime_seconds"] = millis() / 1000UL;
  meta["wifi_rssi"] = WiFi.RSSI();
  meta["ip"] = WiFi.localIP().toString();
  time_t now = time(nullptr);
  char buf[24];
  strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", localtime(&now));
  meta["timestamp"] = buf;
}

// ---------------------------------------------------------------------------
//  HTTP HANDLERS
// ---------------------------------------------------------------------------
void handleSensors() {
  JsonDocument doc;
  writeSensorsJson(doc);
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handlePump() {
  String action = server.arg("action");
  if (action == "on") {
    // Manual pulses use MAX_PULSE_SECONDS (the safety cap) directly rather
    // than any single plant's configured pulse_seconds, since a manual
    // trigger isn't tied to one plant.
    startPump(MAX_PULSE_SECONDS);
    server.send(200, "application/json", "{\"ok\":true}");
  } else if (action == "off") {
    stopPump();
    server.send(200, "application/json", "{\"ok\":true}");
  } else {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"unknown action\"}");
  }
}

void handleLight() {
  String action = server.arg("action");
  if (action == "on") {
    lightMode = LIGHT_FORCED_ON;
    setLightRelay(true);
  } else if (action == "off") {
    lightMode = LIGHT_FORCED_OFF;
    setLightRelay(false);
  } else if (action == "auto") {
    lightMode = LIGHT_AUTO;
    serviceLightAutoMode();
  } else {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"unknown action\"}");
    return;
  }
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleGetConfig() {
  JsonDocument doc;
  JsonObject autoWater = doc["auto_water"].to<JsonObject>();
  for (int i = 0; i < PLANT_COUNT; i++) {
    JsonObject ao = autoWater[plants[i].id].to<JsonObject>();
    ao["enabled"] = plants[i].rule.enabled;
    ao["threshold_percent"] = plants[i].rule.thresholdPercent;
    ao["pulse_seconds"] = plants[i].rule.pulseSeconds;
    ao["cooldown_minutes"] = plants[i].rule.cooldownMinutes;
    ao["max_daily_pulses"] = plants[i].rule.maxDailyPulses;
  }
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handlePostConfig() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"missing body\"}");
    return;
  }
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"invalid json\"}");
    return;
  }
  JsonObject autoWater = doc["auto_water"];
  for (int i = 0; i < PLANT_COUNT; i++) {
    if (!autoWater[plants[i].id].is<JsonObject>()) continue;
    JsonObject ao = autoWater[plants[i].id];
    if (ao["enabled"].is<bool>()) plants[i].rule.enabled = ao["enabled"];
    if (ao["threshold_percent"].is<float>()) plants[i].rule.thresholdPercent = ao["threshold_percent"];
    if (ao["pulse_seconds"].is<int>()) plants[i].rule.pulseSeconds = ao["pulse_seconds"];
    if (ao["cooldown_minutes"].is<int>()) plants[i].rule.cooldownMinutes = ao["cooldown_minutes"];
    if (ao["max_daily_pulses"].is<int>()) plants[i].rule.maxDailyPulses = ao["max_daily_pulses"];
    saveRuleToPrefs(plants[i]);
  }
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleNotFound() {
  server.send(404, "application/json", "{\"ok\":false,\"error\":\"not found\"}");
}

// ---------------------------------------------------------------------------
//  SETUP / LOOP
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);

  pinMode(PIN_PUMP_RELAY, OUTPUT);
  pinMode(PIN_LIGHT_RELAY, OUTPUT);
  digitalWrite(PIN_PUMP_RELAY, LOW);
  digitalWrite(PIN_LIGHT_RELAY, LOW);

  analogReadResolution(12); // 0-4095, matches the voltage math above

  dht.begin();
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  luxArabica.begin();
  luxChili.begin();

  prefs.begin("smartgarden", false);
  for (int i = 0; i < PLANT_COUNT; i++) loadRuleFromPrefs(plants[i]);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // NTP for local-midnight daily-pulse-counter resets and the auto light
  // schedule. Adjust the UTC offset / DST rules for your timezone.
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  server.on("/api/sensors", HTTP_GET, handleSensors);
  server.on("/api/pump", HTTP_GET, handlePump);
  server.on("/api/light", HTTP_GET, handleLight);
  server.on("/api/config", HTTP_GET, handleGetConfig);
  server.on("/api/config", HTTP_POST, handlePostConfig);
  server.onNotFound(handleNotFound);
  server.begin();
}

void loop() {
  server.handleClient();
  serviceRunningPump();

  uint32_t now = millis();
  if (now - lastSensorReadMs >= SENSOR_INTERVAL_MS) {
    lastSensorReadMs = now;
    readAllSensors();
    serviceLightAutoMode();
  }
  if (now - lastAutoWaterCheckMs >= AUTO_WATER_CHECK_INTERVAL_MS) {
    lastAutoWaterCheckMs = now;
    runAutoWaterLoop();
  }
}
