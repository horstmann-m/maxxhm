# Smart Garden — ESP32 API Contract

This is the contract the dashboard (`src/lib/api.js`) speaks, and that the firmware
(`firmware/smart_garden_esp32/smart_garden_esp32.ino`) implements. The demo data
generator (`src/lib/demoData.js`) emits the exact same JSON shape from `GET
/api/sensors`, so the dashboard code is identical whether it's talking to demo data or
a real device — only `CONFIG.ESP32_URL` in `src/config.js` changes.

All endpoints are plain HTTP (no auth) on the ESP32's local IP, intended for a
trusted home network. Timeouts on the dashboard side are 4s per request.

## `GET /api/sensors`

Returns the current full sensor snapshot. Polled every `CONFIG.POLL_INTERVAL` (default
5000ms).

```json
{
  "temperature": 23.4,
  "humidity": 61.2,
  "water": { "tds_ppm": 310.4, "ph": 6.32 },
  "plants": {
    "arabica": { "soil_percent": 68.4, "soil_raw": 480, "light_lux": 4200.1 },
    "chili":   { "soil_percent": 55.0, "soil_raw": 520, "light_lux": 14000.2 }
  },
  "actuators": {
    "pump_active": false,
    "light_active": true,
    "last_pump_seconds_ago": 1800
  },
  "auto_water": {
    "arabica": {
      "enabled": true,
      "threshold_percent": 35,
      "pulse_seconds": 3,
      "cooldown_minutes": 30,
      "max_daily_pulses": 4,
      "state": "armed",
      "pulses_today": 1
    },
    "chili": {
      "enabled": false,
      "threshold_percent": 25,
      "pulse_seconds": 4,
      "cooldown_minutes": 30,
      "max_daily_pulses": 4,
      "state": "disarmed",
      "pulses_today": 0
    }
  },
  "meta": {
    "uptime_seconds": 3600,
    "wifi_rssi": -45,
    "ip": "192.168.1.42",
    "timestamp": "2026-07-15 20:34:08"
  }
}
```

Notes:
- `plants` is keyed by plant id (`arabica`, `chili`, ...). Adding a plant is adding a
  key here (and a matching entry in `src/plants/profiles.js` + `auto_water`) — nothing
  else in the schema changes shape.
- `auto_water[plant].state` is one of `"armed" | "cooling-down" | "pumping" |
  "disarmed" | "sensor-fault" | "no-rebound"` — see the state machine below. The
  dashboard displays this string directly (`src/components/AutoWaterPanel.jsx`); it
  does not re-derive it. `"sensor-fault"` and `"no-rebound"` are Round 2 additions —
  see the "Fault states" section below — and both take precedence over
  `enabled`/`disabled`: a faulted plant reports its fault state even while `enabled`
  is `true`.
- All numeric fields may be integers or floats; the dashboard always formats with
  `.toFixed(n)`, never assumes a specific precision from the device.
- If a field is temporarily unreadable (sensor fault), omit it or send `null` rather
  than `0` — the dashboard's gauges/sparklines treat non-numbers as "no data" instead
  of plotting a false zero (see `src/components/Sparkline.jsx`).

## `GET /api/pump?action=on|off`

- `action=on` — start a **single safety-capped pulse** (`maxPulseSeconds`, currently 8s
  hard cap in firmware regardless of what's requested) on the currently-selected plant's
  valve/pump, or a shared pump if there's only one. Manual pulses do not affect
  `auto_water` cooldown/daily-pulse counters — they're logged separately.
- `action=off` — immediately stop the pump if it's running.
- Response: `200 OK`, body `{"ok": true}`. Any non-2xx status is treated as a command
  failure by the dashboard and surfaced as an error toast.

## `GET /api/light?action=on|off|auto`

- `on` / `off` — force the grow light relay.
- `auto` — hand control back to the firmware's own light schedule (06:00–22:00, only
  supplementing when ambient lux falls below ~2000).
- Response: `200 OK`, body `{"ok": true}`.

## `GET /api/config`

Returns the currently stored auto-water rules (and, going forward, any other
persisted device config) so the dashboard can hydrate its UI from the device instead
of overwriting device state with stale local defaults on first connect:

```json
{
  "auto_water": {
    "arabica": { "enabled": true, "threshold_percent": 35, "pulse_seconds": 3, "cooldown_minutes": 30, "max_daily_pulses": 4 },
    "chili":   { "enabled": false, "threshold_percent": 25, "pulse_seconds": 4, "cooldown_minutes": 30, "max_daily_pulses": 4 }
  }
}
```

## `POST /api/config`

Body: same shape as the `GET /api/config` response (a full or partial `auto_water`
object — only the plants/fields present are updated, others are left as-is on the
device). The dashboard sends this whenever a rule is edited or armed/disarmed in the
Steuerung tab. Response: `200 OK`, body `{"ok": true}`; on validation failure, any
non-2xx status with an optional `{"ok": false, "error": "..."}` body.

The firmware should persist this to flash (e.g. `Preferences`/NVS) so rules survive a
reboot.

## Authoritative auto-watering loop (firmware-side, mirrored in `src/lib/health.js`)

The ESP32 is the single source of truth for watering — it keeps enforcing the rule
even when no browser is open. The dashboard's demo mode runs the *identical* decision
function (`shouldWater()` in `src/lib/health.js`) purely to make the simulated pump
loop visible without hardware; it never overrides the device in live mode.

Pseudocode (see the firmware `.ino` for the real implementation):

```
for each plant with an auto_water rule:
  if soil_sensor_fault:                         state = "sensor-fault"; continue   # Round 2
  if no_rebound_fault:                           state = "no-rebound"; continue     # Round 2
  if not rule.enabled:                         state = "disarmed"; continue
  if pump_is_active:                            skip (never overlap pulses)
  if soil_percent >= rule.threshold_percent:    state = "armed"; continue
  if pulses_today >= rule.max_daily_pulses:     state = "armed"; skip (daily cap)
  if minutes_since(last_pump_at) < rule.cooldown_minutes:
                                                 state = "cooling-down"; skip
  # all gates passed:
  fire_pump(min(rule.pulse_seconds, MAX_PULSE_SECONDS))   # hard safety cap
  last_pump_at = now
  pulses_today += 1
  state = "pumping"
  log_watering_event(plant, pulse_seconds, soil_percent_before)
```

Safety gates, all enforced in firmware regardless of what the dashboard requests:
- **`MAX_PULSE_SECONDS` hard cap** (8s) — a stuck-open valve request from a buggy or
  malicious config can never run the pump indefinitely.
- **Cooldown** — a persistently dry reading does not re-fire every loop; the pump only
  fires again after `cooldown_minutes` have elapsed since the last pulse (this is the
  auto-watering equivalent of the dashboard's alert rising-edge dedupe).
- **Daily pulse cap** — bounds total daily water even if cooldown is set very short.
- **No overlap** — a trigger is ignored while `pump_active` is already true.
- **`pulses_today` resets at local midnight** (or on a rolling 24h window if no RTC/NTP
  is available — document whichever is implemented in the `.ino` comments).

## Fault states (Round 2)

Two additional `auto_water[plant].state` values, both of which **disarm auto-watering
for that plant regardless of `rule.enabled`** — a user re-arming from the dashboard
must not silently un-stick a genuinely faulty sensor or an empty reservoir:

- **`"sensor-fault"`** — the firmware rejected the plant's soil reading as untrustworthy:
  either the raw ADC value sat at/near a rail (`raw <= 50` or `raw >= 4045` on the
  12-bit scale — a disconnected or shorted sensor), or it stayed flat-lined (range
  `< 3` raw counts) across `SOIL_FAULT_WINDOW` (6) consecutive reads, which a live
  capacitive sensor's ADC noise never does. `soil_percent` keeps reporting the last
  known-good value (stale, not a fabricated reading) while this is active. Clears
  automatically once the sensor produces plausible, varying readings again.
- **`"no-rebound"`** — a watering pulse fired but the plant's soil moisture didn't rise
  by at least ~3% over the next couple of re-checks after a settle period. Likely
  causes: empty reservoir, a popped/kinked tube, or a seized pump. Firmware disarms
  that plant's auto-water to avoid repeatedly firing the daily cap for zero effect (and
  risking a dry-run pump). This does **not** auto-clear — it persists until the
  underlying hardware issue is fixed and the device is rebooted/power-cycled.

The dashboard's alert engine (`src/lib/alerts.js`) surfaces both as critical alerts
when present in the sensor payload's `auto_water[plant].state`.
