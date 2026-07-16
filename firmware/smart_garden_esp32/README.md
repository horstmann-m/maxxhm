# Smart Garden ESP32 Firmware

Firmware sketch for the hardware side of the dashboard in `src/`. Implements the API
contract documented in `docs/API.md` and runs the **authoritative** auto-watering loop
(it keeps enforcing each plant's watering rule even if no browser is connected).

Not compiled/flashed as part of this change (no physical hardware in scope here) — the
sketch has been reviewed for pin conflicts and logic sanity, but budget time for the
usual first-flash debugging (library versions, ADC calibration, I2C addressing) before
relying on it.

## Bill of materials

| Component | Notes |
|---|---|
| ESP32 dev board | Any board with WiFi + enough free ADC1/I2C pins |
| DHT22 | Temperature + humidity, needs a 4.7–10kΩ pull-up on data if your board lacks one |
| 2x capacitive soil moisture sensor | Analog output — capacitive (not resistive) so it doesn't corrode over time |
| 2x BH1750 lux sensor | I2C, 3.3V logic |
| TDS sensor (analog) | e.g. Gravity TDS meter |
| Analog pH sensor + probe | e.g. Gravity/DFRobot pH kit |
| 2-channel relay module (or 2x MOSFET modules) | One channel for the pump, one for the grow light |
| 5V water pump + tubing | Sized to your reservoir/pot setup |
| Grow light (12V/5V, relay- or MOSFET-switched) | |

## Wiring

| Signal | ESP32 pin | Notes |
|---|---|---|
| DHT22 data | GPIO4 | |
| Soil moisture — Arabica | GPIO34 | ADC1_CH6, input-only pin |
| Soil moisture — Chili | GPIO35 | ADC1_CH7, input-only pin |
| TDS sensor | GPIO32 | ADC1_CH4 |
| pH sensor | GPIO33 | ADC1_CH5 |
| I2C SDA (both BH1750s) | GPIO21 | |
| I2C SCL (both BH1750s) | GPIO22 | |
| Pump relay | GPIO25 | Active-HIGH in the sketch; flip logic if your relay board is active-LOW |
| Light relay | GPIO26 | Same polarity note |

**Why GPIO34/35 for soil sensors:** they're ADC1, input-only pins with no other
function — ADC2 pins are unusable for `analogRead()` while WiFi is active on the
ESP32, so keep all analog sensors on ADC1 (GPIO32–39).

**BH1750 shared-I2C-address caveat:** the BH1750 only has two selectable addresses
(`0x23` with ADDR low, `0x5C` with ADDR high). With two lux sensors on one bus, tie
one sensor's ADDR pin high so it takes `0x5C` while the other stays at the default
`0x23` — see the sketch's `BH1750_ADDR_ARABICA` / `BH1750_ADDR_CHILI` constants. If
your specific breakout boards don't expose the ADDR pin, use a second I2C bus
(`Wire1` on different GPIOs) or an I2C multiplexer (e.g. TCA9548A) instead.

## Libraries (Arduino Library Manager)

- `DHT sensor library` (Adafruit) + its `Adafruit Unified Sensor` dependency
- `BH1750` (claws/BH1750)
- `ArduinoJson` **v7.x** — the sketch uses the v7 `JsonDocument` / `.to<JsonObject>()`
  API throughout; v6's `StaticJsonDocument`/`createNestedObject()` API is not a drop-in
  match
- `WiFi`, `WebServer`, `Preferences`, `Wire` — bundled with the ESP32 Arduino core
- `esp_task_wdt` (task watchdog) and `driver/gpio` — bundled with the ESP32 Arduino
  core (esp-idf headers). The task-watchdog and `hw_timer_t` APIs used for the pump
  failsafe (see below) target **Arduino-ESP32 core 3.x**; core 2.x has different
  function signatures (`esp_task_wdt_init(timeoutSeconds, panic)`,
  `timerBegin(timerNum, prescaler, countUp)`) — check your installed core version
  before flashing and adjust the calls in `setup()` if needed.

## Configuration before flashing

1. Set `WIFI_SSID` / `WIFI_PASSWORD` at the top of `smart_garden_esp32.ino`.
2. Calibrate `SOIL_RAW_DRY` / `SOIL_RAW_WET` per physical sensor (read the raw ADC
   value in dry air and fully submerged in water, plug those in).
3. Calibrate the pH probe's `PH_SLOPE` / `PH_OFFSET` against pH 4.0 / 7.0 buffer
   solutions.
4. Adjust `configTime(...)`'s UTC offset for your timezone if you want the auto light
   schedule and the auto-water daily-pulse-counter's midnight reset to use local time
   correctly (currently UTC).
5. Point the dashboard's `CONFIG.ESP32_URL` (`src/config.js`) at the device's IP once
   it's on the network (see Serial output on boot).

## Safety notes (see also docs/API.md)

- The pump's `MAX_PULSE_SECONDS` (8s) is a hard cap enforced in firmware — a
  malformed or malicious `/api/config` POST cannot make the pump run indefinitely.
- Auto-watering never overlaps a running pulse, respects the per-plant cooldown, and
  is capped at `max_daily_pulses` per plant per day.
- **Pump failsafe (Round 2):** the `MAX_PULSE_SECONDS` cap is enforced twice,
  independently — `serviceRunningPump()` on the normal `loop()` cadence, and a
  hardware-timer ISR (`onPumpFailsafeTimer()`) that fires every 500ms regardless of
  whether `loop()` is making progress at all. On top of that, the ESP32 task watchdog
  (`esp_task_wdt`) reboots the board if `loop()` doesn't check in within
  `WDT_TIMEOUT_S` (10s) — since the pump relay pins are driven `LOW` early in
  `setup()`, a reboot can never leave the pump stuck on.
- **Soil-sensor fault detection (Round 2):** a raw ADC reading at/near either rail, or
  one that stays flat-lined across `SOIL_FAULT_WINDOW` consecutive reads, marks that
  plant `state: "sensor-fault"` in `/api/sensors` and blocks its auto-watering until
  the sensor is fixed and produces a plausible, varying reading again.
- **No-rebound / reservoir-empty detection (Round 2):** after firing a pulse, the
  firmware re-checks soil moisture a short while later; if it hasn't risen by
  `REBOUND_MIN_RISE_PERCENT`, that plant is disarmed with `state: "no-rebound"`
  (empty reservoir, popped tube, seized pump) — this persists across a
  disable/re-enable toggle from the dashboard by design, and currently only clears on
  a firmware reboot/power-cycle once the hardware issue is fixed.
- **WiFi reconnect (Round 2):** `loop()` checks `WiFi.status()` every
  `WIFI_CHECK_INTERVAL_MS` (10s) and re-attaches after a drop, non-blocking, so a
  router reboot no longer requires power-cycling the ESP32 to restore dashboard
  visibility. Auto-watering itself never depended on WiFi and keeps running through an
  outage either way.
- If you wire one valve per plant instead of a single shared pump, update
  `startPump()` / `runAutoWaterLoop()` to address the correct valve pin per plant
  instead of the shared `PIN_PUMP_RELAY` — the current sketch assumes one shared pump
  feeding both plants' lines, gated by a single `pumpActive` flag.
- Add a physical fuse/flow-limiting on the pump's power line — firmware safety gates
  are not a substitute for hardware failsafes.
