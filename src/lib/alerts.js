import { PLANT_ORDER } from "../plants/profiles.js";

// ============================================================
//  ALERT ENGINE
// ============================================================
// Profile-driven threshold checks (arabica-tuned, per-plant for soil and
// light) plus rising-edge dedupe so a persistent condition (e.g. dry
// soil sitting below threshold for hours) logs exactly once instead of
// flooding the log every poll — the prototype's bug #1.

function pushIfOutOfBand(alerts, key, value, thresholds, { label, icon, unit = "", decimals = 1 }) {
  if (typeof value !== "number" || Number.isNaN(value) || !thresholds) return;
  const { warnLow, warnHigh, critLow, critHigh } = thresholds;
  if (critLow != null && value < critLow) {
    alerts.push({ key: `${key}.critLow`, level: "critical", msg: `${label} kritisch niedrig: ${value.toFixed(decimals)}${unit}`, icon });
    return;
  }
  if (critHigh != null && value > critHigh) {
    alerts.push({ key: `${key}.critHigh`, level: "critical", msg: `${label} kritisch hoch: ${value.toFixed(decimals)}${unit}`, icon });
    return;
  }
  if (warnLow != null && value < warnLow) {
    alerts.push({ key: `${key}.warnLow`, level: "warning", msg: `${label} niedrig: ${value.toFixed(decimals)}${unit}`, icon });
    return;
  }
  if (warnHigh != null && value > warnHigh) {
    alerts.push({ key: `${key}.warnHigh`, level: "warning", msg: `${label} hoch: ${value.toFixed(decimals)}${unit}`, icon });
  }
}

// `profiles` is a { [plantKey]: profile } map — pass the app's merged
// (defaults + user edits from ProfileEditor) profiles so alerting always
// reflects the currently active thresholds, not just the hardcoded
// defaults.
export function checkAlerts(data, profiles) {
  const alerts = [];
  if (!data || !profiles) return alerts;

  // Shared-environment metrics are checked against the arabica profile —
  // it is the more sensitive plant, so an in-band reading for arabica is
  // the meaningful "is the room okay" signal; one canonical alert per
  // metric instead of one per plant avoids duplicate noise.
  const arabica = profiles.arabica.thresholds;
  const arabicaWater = profiles.arabica.water;
  pushIfOutOfBand(alerts, "global.temperature", data.temperature, arabica.temperature, { label: "Temperatur", icon: "🌡️" });
  pushIfOutOfBand(alerts, "global.humidity", data.humidity, arabica.humidity, { label: "Luftfeuchtigkeit", icon: "💨", decimals: 0, unit: "%" });
  pushIfOutOfBand(alerts, "global.ph", data.water?.ph, arabica.ph, { label: "pH", icon: "⚗️" });
  pushIfOutOfBand(alerts, "global.tds", data.water?.tds_ppm, arabicaWater.tds, { label: "TDS", icon: "🧪", decimals: 0, unit: " ppm" });

  for (const plantKey of PLANT_ORDER) {
    const profile = profiles[plantKey];
    const reading = data.plants?.[plantKey];
    if (!profile || !reading) continue;
    pushIfOutOfBand(alerts, `${plantKey}.soil`, reading.soil_percent, profile.thresholds.soil, {
      label: `${profile.name} Boden`, icon: "🏜️", decimals: 0, unit: "%",
    });
    pushIfOutOfBand(alerts, `${plantKey}.light`, reading.light_lux, profile.thresholds.light, {
      label: `${profile.name} Licht`, icon: "💡", decimals: 0, unit: " lux",
    });
  }

  return alerts;
}

// Given the newly computed alert list and the set of keys that were
// active last poll, returns which alerts are "rising edge" (newly
// appeared — the only ones that should be appended to the log) plus the
// updated active-key set to carry forward to the next poll.
export function dedupeAlerts(newAlerts, previousActiveKeys) {
  const activeKeys = new Set(newAlerts.map((a) => a.key));
  const risingEdge = newAlerts.filter((a) => !previousActiveKeys.has(a.key));
  return { activeKeys, risingEdge };
}
