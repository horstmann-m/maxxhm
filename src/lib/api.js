import { ENDPOINTS } from "../config.js";

// ============================================================
//  ESP32 HTTP CLIENT
// ============================================================
// All calls are timeout-guarded and return a {ok, data|error} result
// instead of throwing, so callers (App.jsx) always get a definite
// success/failure signal to drive connection state + toasts — fixing
// the prototype's silent `catch {}` / bare `return`.

// ------------------------------------------------------------------
//  CASING BOUNDARY (Round 2, item 1)
// ------------------------------------------------------------------
// Dashboard/app state is camelCase (thresholdPercent, pulseSeconds,
// cooldownMinutes, maxDailyPulses — see defaultAutoWaterRule() in
// lib/health.js). The firmware + docs/API.md speak snake_case
// (threshold_percent, ...). This is the single translation boundary
// between the two — App.jsx must never serialize/deserialize device
// config JSON itself, only call these.
const RULE_KEY_TO_DEVICE = {
  enabled: "enabled",
  thresholdPercent: "threshold_percent",
  pulseSeconds: "pulse_seconds",
  cooldownMinutes: "cooldown_minutes",
  maxDailyPulses: "max_daily_pulses",
};
const RULE_KEY_FROM_DEVICE = {
  enabled: "enabled",
  threshold_percent: "thresholdPercent",
  pulse_seconds: "pulseSeconds",
  cooldown_minutes: "cooldownMinutes",
  max_daily_pulses: "maxDailyPulses",
};

function mapKeys(obj, keyMap) {
  const out = {};
  if (!obj) return out;
  for (const [from, to] of Object.entries(keyMap)) {
    if (obj[from] !== undefined) out[to] = obj[from];
  }
  return out;
}

// camelCase app rules -> snake_case device config body, e.g.
// { arabica: { thresholdPercent: 35, ... } } ->
// { auto_water: { arabica: { threshold_percent: 35, ... } } }
// Only fields actually present on the source rule are included, so a
// partial rule patch stays partial through the translation (mirrors
// docs/API.md: "only the plants/fields present are updated").
export function toDeviceConfig(rules) {
  const auto_water = {};
  for (const [plantKey, rule] of Object.entries(rules || {})) {
    auto_water[plantKey] = mapKeys(rule, RULE_KEY_TO_DEVICE);
  }
  return { auto_water };
}

// snake_case device config (GET /api/config response, or the
// `auto_water` object it contains) -> camelCase per-plant rule
// patches, e.g.
// { auto_water: { arabica: { threshold_percent: 35, ... } } } ->
// { arabica: { thresholdPercent: 35, ... } }
// Accepts either the full { auto_water: {...} } envelope or the
// bare per-plant map. Only fields present on the device object are
// included — callers should merge the result into existing rule
// state, never replace it wholesale, so a device response missing a
// field (e.g. a firmware that hasn't been updated yet) can't blank
// out a dashboard-known value.
export function fromDeviceConfig(deviceConfig) {
  const autoWater = deviceConfig?.auto_water ?? deviceConfig ?? {};
  const rules = {};
  for (const [plantKey, deviceRule] of Object.entries(autoWater)) {
    rules[plantKey] = mapKeys(deviceRule, RULE_KEY_FROM_DEVICE);
  }
  return rules;
}

async function request(url, { timeoutMs = 4000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, res };
  } catch (err) {
    const message = err.name === "AbortError" ? "Zeitüberschreitung" : err.message || "Netzwerkfehler";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSensors(baseUrl, opts) {
  const result = await request(`${baseUrl}${ENDPOINTS.sensors}`, opts);
  if (!result.ok) return result;
  try {
    const data = await result.res.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Ungültige Antwort" };
  }
}

export async function sendCommand(baseUrl, endpoint, opts) {
  const result = await request(`${baseUrl}${endpoint}`, opts);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function fetchConfig(baseUrl, opts) {
  const result = await request(`${baseUrl}${ENDPOINTS.config}`, opts);
  if (!result.ok) return result;
  try {
    const data = await result.res.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Ungültige Antwort" };
  }
}

export async function postConfig(baseUrl, config, { timeoutMs = 4000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${ENDPOINTS.config}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (err) {
    const message = err.name === "AbortError" ? "Zeitüberschreitung" : err.message || "Netzwerkfehler";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
