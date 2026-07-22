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
 *
 * Round 2 additions (safety hardening, see docs/API.md):
 *   - Soil-sensor fault detection (rail-extreme + flat-lined-variance) —
 *     a disconnected/shorted sensor no longer silently over- or
 *     under-waters; auto_water[plant].state reports "sensor-fault".
 *   - Reservoir-empty / no-rebound verification — a pulse that doesn't
 *     raise soil moisture (empty tank, popped tube, seized pump) disarms
 *     that plant's auto-water and reports state: "no-rebound".
 *   - Pump failsafe: a hardware-timer ISR cuts the relay independent of
 *     loop() cadence, plus the ESP32 task watchdog reboots the board if
 *     loop() itself wedges. Belt-and-suspenders on top of
 *     serviceRunningPump()'s normal MAX_PULSE_SECONDS enforcement.
 *   - WiFi reconnect guard — loop() periodically checks WiFi.status()
 *     and re-attaches after a router drop instead of requiring a
 *     power-cycle (auto-watering keeps running locally either way; this
 *     restores dashboard visibility).
 *   These are reviewed for logic/pin/timing sanity only, same as the
 *   rest of this sketch — not compiled/flashed against real hardware.
 *   The hw_timer_t / esp_task_wdt APIs below target Arduino-ESP32 core
 *   3.x; older core versions (2.x) use different signatures
 *   (`timerBegin(num, prescaler, countUp)`, `esp_task_wdt_init(s, panic)`)
 *   — check against your installed core version before flashing.
 */

#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>
#include <esp_task_wdt.h>
#include <driver/gpio.h>

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

// --- Round 2: soil-sensor fault detection ---
const int SOIL_RAW_RAIL_LOW = 50;     // at/near 0 — shorted or disconnected-to-GND
const int SOIL_RAW_RAIL_HIGH = 4045;  // at/near 4095 (12-bit) — open circuit / disconnected
const int SOIL_FAULT_WINDOW = 6;      // consecutive samples inspected for flat-lining
const int SOIL_FAULT_MIN_RANGE = 3;   // raw ADC counts; a live sensor always jitters at least this much

// --- Round 2: reservoir-empty / no-rebound verification ---
const uint32_t REBOUND_SETTLE_MS = 60000UL;  // wait after a pulse for moisture to redistribute
const uint32_t REBOUND_RECHECK_MS = 30000UL; // spacing between rebound re-checks
const int REBOUND_MAX_SAMPLES = 3;           // give a pulse this many checks (~settle + 2 rechecks) to show a rise
const float REBOUND_MIN_RISE_PERCENT = 3.0;  // must rise by at least this much to count as "the pump worked"

// --- Round 2: pump failsafe (hardware timer ISR + task watchdog) ---
const uint32_t WDT_TIMEOUT_S = 10;                 // reboot if loop() doesn't check in within this window
const uint64_t PUMP_FAILSAFE_TIMER_US = 500000ULL; // ISR cadence, independent of loop()

// --- Round 2: WiFi reconnect guard ---
const uint32_t WIFI_CHECK_INTERVAL_MS = 10000;

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

  // --- Round 2: soil-sensor fault detection (see checkSoilFault()) ---
  int soilRawHistory[SOIL_FAULT_WINDOW];
  int soilRawHistoryIdx;    // ring-buffer write position
  int soilRawHistoryCount;  // caps at SOIL_FAULT_WINDOW once the buffer fills
  bool soilFault;

  // --- Round 2: reservoir-empty / no-rebound verification (see serviceReboundChecks()) ---
  bool reboundCheckPending;
  float reboundSoilBefore;
  uint32_t reboundCheckDueAtMs;
  int reboundSamplesTaken;
  bool noReboundFault;
  // Remaining fields (soilRawHistory[], soilRawHistoryIdx, soilRawHistoryCount,
  // soilFault, reboundCheckPending, reboundSoilBefore, reboundCheckDueAtMs,
  // reboundSamplesTaken, noReboundFault) are intentionally left out of the
  // aggregate initializer below — C++ zero/false-initializes any trailing
  // members not given an explicit value in a positional aggregate init.
};

PlantState plants[2] = {
  { "arabica", PIN_SOIL_ARABICA, &luxArabica, { false, 35.0, 3, 30, 4 }, { "disarmed", 0, 0, -1 }, 0, 0 },
  { "chili",   PIN_SOIL_CHILI,   &luxChili,   { false, 25.0, 4, 30, 4 }, { "disarmed", 0, 0, -1 }, 0, 0 },
};
const int PLANT_COUNT = 2;

// `volatile` because these are also read/written from onPumpFailsafeTimer()
// (a hardware-timer ISR, see below) in addition to the main loop — without
// it the compiler is free to cache stale values in the main-loop context.
volatile bool pumpActive = false;
volatile uint32_t pumpStartedAtMs = 0;
volatile uint32_t pumpRunSeconds = 0;
uint32_t lastPumpFinishedAtMs = 0; // for actuators.last_pump_seconds_ago

// Set by onPumpFailsafeTimer() when it has to cut the relay itself because
// the main loop hasn't reached serviceRunningPump() in time; consumed
// (non-atomically, but only ever cleared right after being read) by
// serviceRunningPump() on the next loop() iteration to finish the
// non-ISR-safe bookkeeping (Serial logging, lastPumpFinishedAtMs).
volatile bool pumpFailsafeTriggeredFlag = false;
hw_timer_t* pumpFailsafeTimer = nullptr;

uint32_t lastWifiCheckMs = 0;

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

// ---------------------------------------------------------------------------
//  PUMP FAILSAFE — hardware-timer ISR (Round 2, item 4)
// ---------------------------------------------------------------------------
// serviceRunningPump() below is the normal enforcement path for
// MAX_PULSE_SECONDS, but it only runs when loop() reaches it each
// iteration. A blocked I2C/DHT read or a stuck server.handleClient() could
// delay that indefinitely, leaving the relay stuck HIGH. This ISR is the
// belt-and-suspenders backstop: it fires on a hardware timer completely
// independent of loop()'s cadence (including while loop() is fully
// wedged) and cuts the relay directly.
//
// Kept intentionally minimal per ESP32 ISR constraints (marked IRAM_ATTR,
// no Serial, no heap allocation, no floating point). gpio_set_level() is a
// direct register write and is safe to call from interrupt context, unlike
// digitalWrite() which is not guaranteed IRAM-resident on every core
// version. A 500ms grace margin over the configured run time avoids racing
// the normal stopPump() path on a healthy loop.
void IRAM_ATTR onPumpFailsafeTimer() {
  if (pumpActive && (millis() - pumpStartedAtMs) >= (pumpRunSeconds * 1000UL + 500UL)) {
    gpio_set_level((gpio_num_t)PIN_PUMP_RELAY, 0);
    pumpFailsafeTriggeredFlag = true;
  }
}

void serviceRunningPump() {
  if (pumpFailsafeTriggeredFlag) {
    // The ISR already dropped the relay; finish the non-ISR-safe
    // bookkeeping here on the main thread.
    pumpFailsafeTriggeredFlag = false;
    if (pumpActive) {
      pumpActive = false;
      lastPumpFinishedAtMs = millis();
      Serial.println("[failsafe] pump cutoff enforced by hardware-timer ISR (loop cadence backstop tripped)");
    }
    return;
  }
  if (pumpActive && millis() - pumpStartedAtMs >= pumpRunSeconds * 1000UL) {
    stopPump();
  }
}

// ---------------------------------------------------------------------------
//  WIFI DIAGNOSTICS
// ---------------------------------------------------------------------------
// Decodes wl_status_t into a human-readable reason so a failed connection
// attempt is actually debuggable from the Serial Monitor instead of just
// printing "." forever with no information.
const char* wifiStatusString(wl_status_t status) {
  switch (status) {
    case WL_IDLE_STATUS:     return "WL_IDLE_STATUS (radio initializing)";
    case WL_NO_SSID_AVAIL:   return "WL_NO_SSID_AVAIL (SSID not found — check spelling, or out of range/wrong band)";
    case WL_SCAN_COMPLETED:  return "WL_SCAN_COMPLETED";
    case WL_CONNECTED:       return "WL_CONNECTED";
    case WL_CONNECT_FAILED:  return "WL_CONNECT_FAILED (wrong password, or router auth mode unsupported — e.g. WPA3-only/PMF-required)";
    case WL_CONNECTION_LOST: return "WL_CONNECTION_LOST";
    case WL_DISCONNECTED:    return "WL_DISCONNECTED";
    default:                 return "unknown status";
  }
}

// ---------------------------------------------------------------------------
//  WIFI RECONNECT GUARD (Round 2, item 6)
// ---------------------------------------------------------------------------
// loop() previously never checked WiFi.status() — a router reboot/drop left
// the device connected to nothing until power-cycled. Auto-watering keeps
// enforcing its rules locally either way (it doesn't depend on WiFi), but
// all dashboard visibility and manual control is lost until this runs.
// WiFi.begin() is non-blocking here (no delay() loop) so a dropped
// connection never stalls the auto-water loop while reconnecting.
void serviceWifiConnection() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println("[wifi] not connected — attempting reconnect");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
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
//  SOIL SENSOR FAULT DETECTION (Round 2, item 3)
// ---------------------------------------------------------------------------
// A disconnected/shorted capacitive soil sensor is dangerous if undetected:
// pegged-low raw (-> soilRawToPercent() reads ~100% "wet") silently starves
// auto-watering while the plant actually dries out and dies of thirst with
// a green-looking dashboard; pegged-high raw (-> reads ~0% "dry") fires
// auto-water up to the daily cap into an already-fine plant
// (overwatering/root rot). Two independent checks:
//   1) Rail-extreme rejection — raw at/near the ADC's 0 or 4095 ends.
//   2) Flat-lined-variance — a live capacitive sensor always shows some ADC
//      jitter even in perfectly stable soil; a raw value that repeats
//      near-identically across SOIL_FAULT_WINDOW consecutive reads (~30s at
//      the default 5s sensor interval) is more consistent with a
//      disconnected/stuck pin than a real analog signal.
bool checkSoilFault(PlantState& p, int raw) {
  if (raw <= SOIL_RAW_RAIL_LOW || raw >= SOIL_RAW_RAIL_HIGH) return true;

  p.soilRawHistory[p.soilRawHistoryIdx] = raw;
  p.soilRawHistoryIdx = (p.soilRawHistoryIdx + 1) % SOIL_FAULT_WINDOW;
  if (p.soilRawHistoryCount < SOIL_FAULT_WINDOW) p.soilRawHistoryCount++;
  if (p.soilRawHistoryCount < SOIL_FAULT_WINDOW) return false; // not enough samples yet

  int lo = p.soilRawHistory[0], hi = p.soilRawHistory[0];
  for (int i = 1; i < SOIL_FAULT_WINDOW; i++) {
    if (p.soilRawHistory[i] < lo) lo = p.soilRawHistory[i];
    if (p.soilRawHistory[i] > hi) hi = p.soilRawHistory[i];
  }
  return (hi - lo) < SOIL_FAULT_MIN_RANGE;
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
    plants[i].soilFault = checkSoilFault(plants[i], raw);
    // On fault, deliberately keep the last known-good lastSoilPercent
    // (stale but plausible) rather than writing a bogus reading — the
    // soilFault flag (surfaced as auto_water[plant].state ==
    // "sensor-fault") is what actually gates auto-water and the UI alert.
    if (!plants[i].soilFault) {
      plants[i].lastSoilPercent = soilRawToPercent(raw);
    }
    float lux = plants[i].luxSensor->readLightLevel();
    if (lux >= 0) plants[i].lastLux = lux; // BH1750 returns -1 on read failure
  }

  lastTdsPpm = readTdsPpm(isnan(lastTemperature) ? 25.0 : lastTemperature);
  lastPh = readPh();
}

// ---------------------------------------------------------------------------
//  RESERVOIR-EMPTY / NO-REBOUND VERIFICATION (Round 2, item 7)
// ---------------------------------------------------------------------------
// runAutoWaterLoop() fires a pulse and, historically, just trusted it
// worked. An empty reservoir, a popped tube, or a seized pump means it
// would fire the daily cap every day for zero effect (and can run a pump
// dry). After a pulse, this waits for the soil to settle
// (REBOUND_SETTLE_MS) and re-samples; if it hasn't risen by at least
// REBOUND_MIN_RISE_PERCENT within REBOUND_MAX_SAMPLES checks, the plant's
// auto-water is disarmed (state: "no-rebound") until a human investigates.
// Called once per sensor-read cycle, right after readAllSensors() updates
// lastSoilPercent — see loop().
void serviceReboundChecks() {
  uint32_t now = millis();
  for (int i = 0; i < PLANT_COUNT; i++) {
    PlantState& p = plants[i];
    if (!p.reboundCheckPending) continue;
    if (p.soilFault) {
      // Can't trust either soilBefore or the current reading — drop this
      // rebound check rather than risk a false "no-rebound" fault (or a
      // false pass) off a bad sensor. The sensor-fault gate in
      // runAutoWaterLoop() already blocks auto-water for this plant.
      p.reboundCheckPending = false;
      continue;
    }
    // Rollover-safe "not due yet" check (millis() wraps after ~49.7 days;
    // a direct now < dueAt comparison would misbehave across that wrap —
    // same subtraction idiom used elsewhere in this file, e.g. serviceRunningPump()).
    if ((int32_t)(now - p.reboundCheckDueAtMs) < 0) continue;

    float rise = p.lastSoilPercent - p.reboundSoilBefore;
    if (rise >= REBOUND_MIN_RISE_PERCENT) {
      p.reboundCheckPending = false;
      continue; // pulse worked — nothing else to do
    }

    p.reboundSamplesTaken++;
    if (p.reboundSamplesTaken >= REBOUND_MAX_SAMPLES) {
      p.noReboundFault = true;
      p.reboundCheckPending = false;
      Serial.printf("[failsafe] %s: no soil moisture rebound after watering pulse — disarming auto-water (reservoir/tube/pump?)\n", p.id);
    } else {
      p.reboundCheckDueAtMs = now + REBOUND_RECHECK_MS; // give it another settle window
    }
  }
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

    // Round 2 fault gates — both take precedence over the rule's own
    // enabled/disabled toggle, since re-arming from the dashboard must not
    // silently un-stick a genuinely faulty sensor or an empty reservoir.
    if (p.soilFault) {
      p.runtime.state = "sensor-fault";
      continue;
    }
    if (p.noReboundFault) {
      p.runtime.state = "no-rebound";
      continue;
    }

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

    // Round 2: schedule a no-rebound check — see serviceReboundChecks().
    p.reboundCheckPending = true;
    p.reboundSoilBefore = p.lastSoilPercent;
    p.reboundCheckDueAtMs = millis() + p.rule.pulseSeconds * 1000UL + REBOUND_SETTLE_MS;
    p.reboundSamplesTaken = 0;
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

  // Retries WiFi.begin() in ~20s attempts, printing the decoded wl_status_t
  // once per second, until connected. Unlike a bare dot-printing loop, this
  // tells you *why* an attempt failed (wrong password vs. SSID not found vs.
  // an auth mode the ESP32's classic WiFi stack can't negotiate, e.g. WPA3).
  const uint32_t WIFI_ATTEMPT_TIMEOUT_MS = 20000;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("Connecting to WiFi...");
  uint32_t attemptStartedMs = millis();
  wl_status_t lastStatus = WL_IDLE_STATUS;
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    lastStatus = WiFi.status();
    Serial.printf("  status=%d  %s\n", (int)lastStatus, wifiStatusString(lastStatus));
    if (millis() - attemptStartedMs >= WIFI_ATTEMPT_TIMEOUT_MS) {
      Serial.printf("Attempt timed out after %lus, last status: %s. Retrying...\n",
                    WIFI_ATTEMPT_TIMEOUT_MS / 1000, wifiStatusString(lastStatus));
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      attemptStartedMs = millis();
    }
  }
  Serial.println("WiFi connected.");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // NTP for local-midnight daily-pulse-counter resets and the auto light
  // schedule. Adjust the UTC offset / DST rules for your timezone.
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  // Round 2: hardware-timer pump failsafe — fires on PUMP_FAILSAFE_TIMER_US
  // cadence completely independent of loop(), see onPumpFailsafeTimer().
  // Arduino-ESP32 core 3.x API (single-arg timerBegin(frequencyHz)); core
  // 2.x uses timerBegin(timerNum, prescaler, countUp) — adjust if needed.
  pumpFailsafeTimer = timerBegin(1000000); // 1 MHz tick
  timerAttachInterrupt(pumpFailsafeTimer, &onPumpFailsafeTimer);
  timerAlarm(pumpFailsafeTimer, PUMP_FAILSAFE_TIMER_US, true, 0);

  // Round 2: task watchdog — reboots the board if loop() doesn't call
  // esp_task_wdt_reset() (see loop()) within WDT_TIMEOUT_S. The relay
  // returns to its LOW boot state (see digitalWrite() calls above) on
  // reboot, so a wedged loop can never leave the pump stuck on
  // indefinitely. Core 3.x config-struct API; core 2.x uses
  // esp_task_wdt_init(timeoutSeconds, panic) instead.
  esp_task_wdt_config_t wdtConfig = {
    .timeout_ms = WDT_TIMEOUT_S * 1000,
    .idle_core_mask = 0,
    .trigger_panic = true,
  };
  esp_task_wdt_init(&wdtConfig);
  esp_task_wdt_add(NULL); // watch the loop() task

  server.on("/api/sensors", HTTP_GET, handleSensors);
  server.on("/api/pump", HTTP_GET, handlePump);
  server.on("/api/light", HTTP_GET, handleLight);
  server.on("/api/config", HTTP_GET, handleGetConfig);
  server.on("/api/config", HTTP_POST, handlePostConfig);
  server.onNotFound(handleNotFound);
  server.begin();
}

void loop() {
  esp_task_wdt_reset(); // Round 2: check in with the task watchdog every iteration

  server.handleClient();
  serviceRunningPump();

  uint32_t now = millis();
  if (now - lastSensorReadMs >= SENSOR_INTERVAL_MS) {
    lastSensorReadMs = now;
    readAllSensors();
    serviceLightAutoMode();
    serviceReboundChecks(); // Round 2: needs the just-refreshed lastSoilPercent
  }
  if (now - lastAutoWaterCheckMs >= AUTO_WATER_CHECK_INTERVAL_MS) {
    lastAutoWaterCheckMs = now;
    runAutoWaterLoop();
  }
  if (now - lastWifiCheckMs >= WIFI_CHECK_INTERVAL_MS) {
    lastWifiCheckMs = now;
    serviceWifiConnection(); // Round 2: reconnect after a router drop
  }
}
