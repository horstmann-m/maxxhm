import { colors } from "../theme.js";

// ============================================================
//  PLANT PROFILES
// ============================================================
// Each profile defines ideal/warn/critical bands per metric. Bands are
// used by lib/alerts.js (threshold alerts), lib/health.js (0-100 health
// score + recommendations) and the auto-watering defaults.
//
// idealLow/idealHigh  — the target band (score = 1.0)
// warnLow/warnHigh    — outside this the UI raises a "warning" alert
// critLow/critHigh    — outside this the UI raises a "critical" alert
//                        (omit a bound if the prototype/plan defines no
//                        critical alert on that side)
//
// Arabica numbers are grounded in the approved plan (see plan's "Arabica
// care parameters" section, sourced from Healthy Houseplants / Smart
// Garden Guide / Plant and People coffee-care guides). Chili numbers are
// general pepper-care guidance kept from the original prototype's scope,
// tuned into the same schema so adding further plants is mechanical.

export const PLANTS = {
  arabica: {
    id: "arabica",
    name: "Arabica-Kaffee",
    icon: "☕",
    color: colors.brown,
    care: {
      summary:
        "Schattenliebende Unterholzpflanze — helles Streulicht, gleichmäßig feucht, niemals pralle Sonne.",
    },
    thresholds: {
      temperature: { idealLow: 21, idealHigh: 27, warnLow: 18, warnHigh: 28, critLow: 15, critHigh: 32, unit: "°C" },
      humidity: { idealLow: 60, idealHigh: 70, warnLow: 45, warnHigh: 85, critLow: 30, unit: "%" },
      // VPD (kPa) drives the health-score "humidity" factor; see lib/health.js.
      vpd: { idealLow: 0.8, idealHigh: 1.2, warnLow: 0.4, warnHigh: 1.5, critLow: 0.15, critHigh: 2.2, unit: "kPa" },
      light: { idealLow: 2000, idealHigh: 10000, warnLow: 1500, warnHigh: 15000, unit: "lux" },
      soil: { idealLow: 40, idealHigh: 75, warnLow: 35, critLow: 20, unit: "%" },
      ph: { idealLow: 6.0, idealHigh: 6.5, warnLow: 5.5, warnHigh: 7.0, unit: "" },
    },
    water: {
      tds: { idealHigh: 400, warnHigh: 500, unit: "ppm" },
    },
    dli: { targetMin: 4, targetMax: 8, unit: "mol/m²/d" }, // modest shade-plant target
    autoWater: {
      defaultThresholdPercent: 35,
      defaultPulseSeconds: 3,
      defaultCooldownMinutes: 30,
      defaultMaxDailyPulses: 4,
      maxPulseSeconds: 8,
    },
  },

  chili: {
    id: "chili",
    name: "Chili",
    icon: "🌶️",
    color: colors.orange,
    care: {
      summary: "Vollsonnen-Pflanze — viel direktes Licht, mäßig feucht halten, nicht staunass.",
    },
    thresholds: {
      temperature: { idealLow: 21, idealHigh: 29, warnLow: 15, warnHigh: 32, critLow: 10, critHigh: 38, unit: "°C" },
      humidity: { idealLow: 40, idealHigh: 60, warnLow: 30, warnHigh: 70, critLow: 20, unit: "%" },
      vpd: { idealLow: 0.8, idealHigh: 1.6, warnLow: 0.4, warnHigh: 2.0, critLow: 0.15, critHigh: 2.6, unit: "kPa" },
      light: { idealLow: 10000, idealHigh: 30000, warnLow: 5000, warnHigh: 35000, unit: "lux" },
      soil: { idealLow: 35, idealHigh: 65, warnLow: 25, critLow: 15, unit: "%" },
      ph: { idealLow: 6.0, idealHigh: 6.8, warnLow: 5.5, warnHigh: 7.5, unit: "" },
    },
    water: {
      tds: { idealHigh: 600, warnHigh: 800, unit: "ppm" },
    },
    dli: { targetMin: 10, targetMax: 20, unit: "mol/m²/d" }, // full-sun fruiting plant target
    autoWater: {
      defaultThresholdPercent: 25,
      defaultPulseSeconds: 4,
      defaultCooldownMinutes: 30,
      defaultMaxDailyPulses: 4,
      maxPulseSeconds: 8,
    },
  },
};

// Ordering used across the UI (arabica featured first, per plan).
export const PLANT_ORDER = ["arabica", "chili"];

export function getProfile(plantKey) {
  return PLANTS[plantKey] || null;
}
