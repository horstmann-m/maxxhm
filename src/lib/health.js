// ============================================================
//  PLANT INTELLIGENCE ENGINE
// ============================================================
// Advisory layer: VPD, DLI (labeled estimate), soil-dry forecast, a
// 0-100 health index with plain-language recommendations, and the
// shared shouldWater() decision function used by both the demo
// simulator and documented for the firmware's authoritative loop.

// ---- VPD (vapor pressure deficit) --------------------------------
// SVP = 0.6108 * e^(17.27*T / (T+237.3))  [kPa], Tetens' formula.
// VPD = SVP * (1 - RH/100)
export function computeVPD(tempC, rhPercent) {
  if (typeof tempC !== "number" || typeof rhPercent !== "number") return null;
  const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const vpd = svp * (1 - rhPercent / 100);
  return Math.round(vpd * 100) / 100;
}

export function vpdStatus(vpd, thresholds) {
  if (vpd == null || !thresholds) return null;
  if (vpd < thresholds.critLow || vpd > thresholds.critHigh) return "critical";
  if (vpd < thresholds.warnLow || vpd > thresholds.warnHigh) return "warning";
  return "ideal";
}

// ---- DLI (daily light integral) — labeled estimate ----------------
// PPFD (µmol/m²/s) ≈ lux / 54 for typical daylight-spectrum sources.
// This is a rule-of-thumb conversion, not a spectroradiometer reading —
// always surface it in the UI as "estimated DLI".
export function estimateDLIIncrementMol(luxAvg, intervalSeconds) {
  if (typeof luxAvg !== "number" || luxAvg < 0 || !intervalSeconds) return 0;
  const ppfd = luxAvg / 54;
  return (ppfd * intervalSeconds) / 1e6; // µmol/s * s -> µmol -> mol
}

// ---- Soil-dry forecast ---------------------------------------------
// Linear regression over recent soil-% samples (assumed evenly spaced by
// pollIntervalSeconds) to estimate hours remaining until the plant's
// watering threshold is crossed. Returns null when there isn't enough
// data or soil isn't trending down.
export function forecastSoilDryHours(soilHistory, thresholdPercent, pollIntervalSeconds) {
  if (!Array.isArray(soilHistory) || typeof thresholdPercent !== "number") return null;
  const recent = soilHistory.filter((v) => typeof v === "number" && !Number.isNaN(v)).slice(-12);
  if (recent.length < 4) return null;

  const n = recent.length;
  const xs = recent.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = recent.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (recent[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slopePerSample = den === 0 ? 0 : num / den;
  if (slopePerSample >= -0.01) return null; // flat or rising — no forecast needed

  const current = recent[recent.length - 1];
  if (current <= thresholdPercent) return 0;
  const samplesUntilThreshold = (thresholdPercent - current) / slopePerSample;
  const hours = (samplesUntilThreshold * pollIntervalSeconds) / 3600;
  return Math.round(hours * 10) / 10;
}

// ---- Health index (0-100) -------------------------------------------
// Smooth 0..1 score per factor: 1.0 inside the ideal band, tapering
// through the warn band, hitting 0 at (or beyond) the critical bound.
// Exported for direct unit testing of the boundary taper (Round 2, item 2)
// — otherwise only reachable indirectly through computeHealth().
export function scoreFactor(value, t) {
  if (typeof value !== "number" || Number.isNaN(value) || !t) return null;
  const { idealLow, idealHigh } = t;
  if (value >= idealLow && value <= idealHigh) return 1;

  if (value < idealLow) {
    const warnBound = t.warnLow ?? idealLow;
    const critBound = t.critLow ?? warnBound - (idealHigh - idealLow || 1);
    if (value <= critBound) return 0;
    if (value >= warnBound) {
      const span = idealLow - warnBound || 1;
      return 0.6 + 0.4 * ((value - warnBound) / span);
    }
    const span = warnBound - critBound || 1;
    return 0.6 * ((value - critBound) / span);
  }

  const warnBound = t.warnHigh ?? idealHigh;
  const critBound = t.critHigh ?? warnBound + (idealHigh - idealLow || 1);
  if (value >= critBound) return 0;
  if (value <= warnBound) {
    const span = warnBound - idealHigh || 1;
    return 0.6 + 0.4 * ((warnBound - value) / span);
  }
  const span = critBound - warnBound || 1;
  return 0.6 * ((critBound - value) / span);
}

const FACTOR_WEIGHTS = { temperature: 0.22, humidity: 0.18, light: 0.2, soil: 0.28, ph: 0.12 };

function buildRecommendation(factor, value, t, profile) {
  const unit = t?.unit ?? "";
  const fmt = (v) => (typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : "--");
  switch (factor) {
    case "temperature":
      if (value < t.idealLow)
        return `Temperatur niedrig (${fmt(value)}${unit}) — wärmer stellen, Ziel ${fmt(t.idealLow)}–${fmt(t.idealHigh)}${unit}.`;
      return `Temperatur hoch (${fmt(value)}${unit}) — vor direkter Hitze schützen, Ziel ${fmt(t.idealLow)}–${fmt(t.idealHigh)}${unit}.`;
    case "humidity":
      if (value < t.idealLow)
        return `Luft zu trocken (VPD ${fmt(value)} kPa) — Luftfeuchtigkeit erhöhen, z. B. besprühen oder Untersetzer mit Wasser.`;
      return `Luft zu feucht (VPD ${fmt(value)} kPa) — für Luftzirkulation sorgen, Pilzrisiko senken.`;
    case "light":
      if (value < t.idealLow)
        return `Zu wenig Licht (${fmt(value)} lux) — heller/indirekt platzieren, Ziel ${fmt(t.idealLow)}–${fmt(t.idealHigh)} lux.`;
      return `Zu viel direktes Licht (${fmt(value)} lux) — vor praller Sonne schützen (Verbrennungsgefahr).`;
    case "soil":
      if (value < t.idealLow)
        return `Boden zu trocken (${fmt(value)}%) — bald gießen, Zielbereich ${fmt(t.idealLow)}–${fmt(t.idealHigh)}%.`;
      return `Boden zu nass (${fmt(value)}%) — Bewässerung pausieren, Staunässe vermeiden.`;
    case "ph":
      if (value < t.idealLow) return `pH zu niedrig (${fmt(value)}) — Ziel ${fmt(t.idealLow)}–${fmt(t.idealHigh)}.`;
      return `pH zu hoch (${fmt(value)}) — Ziel ${fmt(t.idealLow)}–${fmt(t.idealHigh)}.`;
    default:
      return `${profile?.name ?? "Pflanze"}: ${factor} außerhalb des Zielbereichs.`;
  }
}

// reading: { temperature, humidity, light_lux, soil_percent, ph }
export function computeHealth(profile, reading) {
  if (!profile || !reading) return { score: null, label: "—", factors: {}, recommendations: [] };
  const t = profile.thresholds;
  const vpd = computeVPD(reading.temperature, reading.humidity);

  const rawFactors = {
    temperature: { value: reading.temperature, thresholds: t.temperature },
    humidity: { value: vpd, thresholds: t.vpd },
    light: { value: reading.light_lux, thresholds: t.light },
    soil: { value: reading.soil_percent, thresholds: t.soil },
    ph: { value: reading.ph, thresholds: t.ph },
  };

  let weightedSum = 0;
  let weightTotal = 0;
  const factors = {};
  const candidates = [];

  for (const [key, { value, thresholds }] of Object.entries(rawFactors)) {
    const score = scoreFactor(value, thresholds);
    factors[key] = { value, score };
    if (score == null) continue;
    weightedSum += score * FACTOR_WEIGHTS[key];
    weightTotal += FACTOR_WEIGHTS[key];
    if (score < 0.85) candidates.push({ key, score, msg: buildRecommendation(key, value, thresholds, profile) });
  }

  const score = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) : null;
  const label = score == null ? "—" : score >= 85 ? "Ausgezeichnet" : score >= 70 ? "Gut" : score >= 50 ? "Mäßig" : "Schlecht";
  candidates.sort((a, b) => a.score - b.score);

  return {
    score,
    label,
    vpd,
    factors,
    recommendations: candidates.slice(0, 2).map((c) => c.msg),
  };
}

// ---- Automated watering: shared decision function --------------------
// This is the single source of truth for "should the pump fire right
// now?" used by the demo simulator. The ESP32 firmware's loop (see
// firmware/smart_garden_esp32/smart_garden_esp32.ino) implements the
// identical gates in C++ so behavior is consistent between demo and
// hardware — see docs/API.md for the mirrored pseudocode.
//
// context: { soilPercent, pumpActive, lastPumpAt (ms epoch|null), pulsesToday, now (ms epoch) }
// rule: { enabled, thresholdPercent, pulseSeconds, cooldownMinutes, maxDailyPulses }
export function shouldWater(context, rule) {
  const { soilPercent, pumpActive, lastPumpAt, pulsesToday = 0, now = Date.now() } = context || {};

  if (!rule || !rule.enabled) return { water: false, reason: "Deaktiviert" };
  if (pumpActive) return { water: false, reason: "Pumpe bereits aktiv" };
  if (typeof soilPercent !== "number") return { water: false, reason: "Kein Bodenwert" };
  if (soilPercent >= rule.thresholdPercent) return { water: false, reason: "Boden über Schwelle" };
  if (pulsesToday >= rule.maxDailyPulses) return { water: false, reason: "Tageslimit erreicht" };
  if (lastPumpAt) {
    const elapsedMin = (now - lastPumpAt) / 60000;
    if (elapsedMin < rule.cooldownMinutes) {
      return { water: false, reason: `Cooldown aktiv (${Math.ceil(rule.cooldownMinutes - elapsedMin)} min verbleibend)` };
    }
  }
  return { water: true, reason: `Boden ${soilPercent.toFixed(0)}% unter Schwelle ${rule.thresholdPercent}%` };
}

export function defaultAutoWaterRule(profile) {
  return {
    enabled: false,
    thresholdPercent: profile.autoWater.defaultThresholdPercent,
    pulseSeconds: profile.autoWater.defaultPulseSeconds,
    cooldownMinutes: profile.autoWater.defaultCooldownMinutes,
    maxDailyPulses: profile.autoWater.defaultMaxDailyPulses,
  };
}
