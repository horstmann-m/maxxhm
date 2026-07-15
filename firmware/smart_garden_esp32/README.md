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
- If you wire one valve per plant instead of a single shared pump, update
  `startPump()` / `runAutoWaterLoop()` to address the correct valve pin per plant
  instead of the shared `PIN_PUMP_RELAY` — the current sketch assumes one shared pump
  feeding both plants' lines, gated by a single `pumpActive` flag.
- Add a physical fuse/flow-limiting on the pump's power line — firmware safety gates
  are not a substitute for hardware failsafes.
