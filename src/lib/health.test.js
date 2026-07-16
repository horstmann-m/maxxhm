import { describe, it, expect } from "vitest";
import { shouldWater, scoreFactor, computeVPD, defaultAutoWaterRule } from "./health.js";

// ============================================================
//  shouldWater() — every safety gate (Round 2, item 2)
// ============================================================
// This is the safety-critical decision function shared by the demo
// simulator and documented for the firmware's authoritative loop
// (docs/API.md). Each gate must independently block watering.

const baseRule = { enabled: true, thresholdPercent: 35, pulseSeconds: 3, cooldownMinutes: 30, maxDailyPulses: 4 };

describe("shouldWater", () => {
  it("blocks when the rule is disabled", () => {
    const result = shouldWater({ soilPercent: 10, pumpActive: false, lastPumpAt: null, pulsesToday: 0, now: 1000 }, { ...baseRule, enabled: false });
    expect(result.water).toBe(false);
    expect(result.reason).toMatch(/deaktiviert/i);
  });

  it("blocks when no rule is passed at all", () => {
    const result = shouldWater({ soilPercent: 10, pumpActive: false, lastPumpAt: null, pulsesToday: 0, now: 1000 }, null);
    expect(result.water).toBe(false);
  });

  it("blocks when the pump is already active (no overlapping pulses)", () => {
    const result = shouldWater({ soilPercent: 10, pumpActive: true, lastPumpAt: null, pulsesToday: 0, now: 1000 }, baseRule);
    expect(result.water).toBe(false);
    expect(result.reason).toMatch(/pumpe/i);
  });

  it("blocks when there is no soil value (undefined/non-number)", () => {
    const result = shouldWater({ soilPercent: undefined, pumpActive: false, lastPumpAt: null, pulsesToday: 0, now: 1000 }, baseRule);
    expect(result.water).toBe(false);
    expect(result.reason).toMatch(/kein bodenwert/i);
  });

  it("blocks when soil is above the threshold", () => {
    const result = shouldWater({ soilPercent: 50, pumpActive: false, lastPumpAt: null, pulsesToday: 0, now: 1000 }, baseRule);
    expect(result.water).toBe(false);
    expect(result.reason).toMatch(/schwelle/i);
  });

  it("blocks at exactly the threshold (>= threshold means 'not dry enough')", () => {
    const result = shouldWater({ soilPercent: 35, pumpActive: false, lastPumpAt: null, pulsesToday: 0, now: 1000 }, baseRule);
    expect(result.water).toBe(false);
  });

  it("blocks when the daily pulse cap has been hit", () => {
    const result = shouldWater({ soilPercent: 10, pumpActive: false, lastPumpAt: null, pulsesToday: 4, now: 1000 }, baseRule);
    expect(result.water).toBe(false);
    expect(result.reason).toMatch(/tageslimit/i);
  });

  it("blocks while cooldown hasn't elapsed since the last pump", () => {
    const now = 1000 * 60 * 60; // arbitrary epoch ms
    const lastPumpAt = now - 5 * 60 * 1000; // 5 minutes ago, cooldown is 30 min
    const result = shouldWater({ soilPercent: 10, pumpActive: false, lastPumpAt, pulsesToday: 1, now }, baseRule);
    expect(result.water).toBe(false);
    expect(result.reason).toMatch(/cooldown/i);
  });

  it("waters once cooldown has fully elapsed", () => {
    const now = 1000 * 60 * 60;
    const lastPumpAt = now - 31 * 60 * 1000; // 31 minutes ago, cooldown is 30 min
    const result = shouldWater({ soilPercent: 10, pumpActive: false, lastPumpAt, pulsesToday: 1, now }, baseRule);
    expect(result.water).toBe(true);
  });

  it("waters when every gate passes (dry soil, armed, no cooldown, under cap)", () => {
    const result = shouldWater({ soilPercent: 20, pumpActive: false, lastPumpAt: null, pulsesToday: 0, now: 1000 }, baseRule);
    expect(result.water).toBe(true);
    expect(result.reason).toMatch(/20% unter schwelle 35%/i);
  });

  // Sanity-check the tests aren't vacuous: deliberately break the daily-cap
  // gate the way a regression might, and confirm this test suite would
  // catch it.
  it("would fail if the daily-cap gate were broken (sanity check)", () => {
    const brokenShouldWater = (context, rule) => {
      // pulsesToday check omitted — the bug this guards against
      if (!rule || !rule.enabled) return { water: false, reason: "Deaktiviert" };
      if (context.pumpActive) return { water: false, reason: "Pumpe bereits aktiv" };
      if (typeof context.soilPercent !== "number") return { water: false, reason: "Kein Bodenwert" };
      if (context.soilPercent >= rule.thresholdPercent) return { water: false, reason: "Boden über Schwelle" };
      return { water: true, reason: "would incorrectly fire" };
    };
    const context = { soilPercent: 10, pumpActive: false, lastPumpAt: null, pulsesToday: 4, now: 1000 };
    expect(shouldWater(context, baseRule).water).toBe(false); // real implementation: capped
    expect(brokenShouldWater(context, baseRule).water).toBe(true); // broken implementation: would over-water
  });
});

describe("defaultAutoWaterRule", () => {
  it("derives defaults from the plant profile's autoWater block", () => {
    const profile = { autoWater: { defaultThresholdPercent: 35, defaultPulseSeconds: 3, defaultCooldownMinutes: 30, defaultMaxDailyPulses: 4 } };
    expect(defaultAutoWaterRule(profile)).toEqual({
      enabled: false,
      thresholdPercent: 35,
      pulseSeconds: 3,
      cooldownMinutes: 30,
      maxDailyPulses: 4,
    });
  });
});

// ============================================================
//  scoreFactor() — boundary taper (Round 2, item 2)
// ============================================================
const t = { idealLow: 20, idealHigh: 30, warnLow: 15, warnHigh: 35, critLow: 10, critHigh: 40 };

describe("scoreFactor", () => {
  it("scores 1.0 anywhere inside the ideal band, including its edges", () => {
    expect(scoreFactor(25, t)).toBe(1);
    expect(scoreFactor(20, t)).toBe(1);
    expect(scoreFactor(30, t)).toBe(1);
  });

  it("scores 0 at or beyond the critical bound (low side)", () => {
    expect(scoreFactor(10, t)).toBe(0);
    expect(scoreFactor(5, t)).toBe(0);
  });

  it("scores 0 at or beyond the critical bound (high side)", () => {
    expect(scoreFactor(40, t)).toBe(0);
    expect(scoreFactor(45, t)).toBe(0);
  });

  it("tapers monotonically through the low warn band", () => {
    const atWarn = scoreFactor(15, t); // warnLow itself: 0.6 + 0.4*0 = 0.6
    const nearIdeal = scoreFactor(19, t); // just below idealLow: close to 1.0
    const atCrit = scoreFactor(10, t); // critLow itself: 0
    expect(atCrit).toBeLessThan(atWarn);
    expect(atWarn).toBeLessThan(nearIdeal);
    expect(nearIdeal).toBeLessThan(1);
  });

  it("tapers monotonically through the high warn band", () => {
    const atWarn = scoreFactor(35, t);
    const nearIdeal = scoreFactor(31, t);
    const atCrit = scoreFactor(40, t);
    expect(atCrit).toBeLessThan(atWarn);
    expect(atWarn).toBeLessThan(nearIdeal);
    expect(nearIdeal).toBeLessThan(1);
  });

  it("returns null for a non-numeric value or missing thresholds", () => {
    expect(scoreFactor(undefined, t)).toBeNull();
    expect(scoreFactor(NaN, t)).toBeNull();
    expect(scoreFactor(25, null)).toBeNull();
  });
});

// ============================================================
//  computeVPD() — sanity check against known reference points
// ============================================================
describe("computeVPD", () => {
  it("returns 0 at 100% relative humidity (no deficit)", () => {
    expect(computeVPD(25, 100)).toBe(0);
  });

  it("returns a positive, larger deficit as humidity drops at fixed temperature", () => {
    const humid = computeVPD(25, 80);
    const dry = computeVPD(25, 30);
    expect(humid).toBeGreaterThan(0);
    expect(dry).toBeGreaterThan(humid);
  });

  it("returns null for non-numeric inputs", () => {
    expect(computeVPD(undefined, 50)).toBeNull();
    expect(computeVPD(25, undefined)).toBeNull();
  });
});
