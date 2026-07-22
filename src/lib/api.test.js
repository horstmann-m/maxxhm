import { describe, it, expect } from "vitest";
import { toDeviceConfig, fromDeviceConfig } from "./api.js";

// ============================================================
//  Casing boundary round-trip (Round 2, item 1)
// ============================================================
// The dashboard's rule state is camelCase; the firmware + docs/API.md
// speak snake_case. Before this fix, App.jsx serialized camelCase
// straight onto the device, so `handlePostConfig` on the firmware only
// ever picked up `enabled` (a key with no casing difference) and silently
// dropped every numeric edit (threshold/pulse/cooldown/maxDaily). This
// test asserts the translation is correct in both directions and that a
// full rule survives enabled+edit round trip intact.

const camelRule = {
  enabled: true,
  thresholdPercent: 35,
  pulseSeconds: 3,
  cooldownMinutes: 30,
  maxDailyPulses: 4,
};

// Exact snake_case shape documented in docs/API.md's `GET/POST
// /api/config` example for a single plant's auto_water entry.
const snakeRule = {
  enabled: true,
  threshold_percent: 35,
  pulse_seconds: 3,
  cooldown_minutes: 30,
  max_daily_pulses: 4,
};

describe("toDeviceConfig", () => {
  it("translates a camelCase rule map to the snake_case device config envelope", () => {
    const result = toDeviceConfig({ arabica: camelRule });
    expect(result).toEqual({ auto_water: { arabica: snakeRule } });
  });

  it("translates every numeric field, not just `enabled` (the exact bug this fixes)", () => {
    const result = toDeviceConfig({ arabica: { ...camelRule, thresholdPercent: 50, pulseSeconds: 5 } });
    expect(result.auto_water.arabica.threshold_percent).toBe(50);
    expect(result.auto_water.arabica.pulse_seconds).toBe(5);
  });

  it("handles multiple plants", () => {
    const result = toDeviceConfig({ arabica: camelRule, chili: { ...camelRule, thresholdPercent: 25 } });
    expect(Object.keys(result.auto_water)).toEqual(["arabica", "chili"]);
    expect(result.auto_water.chili.threshold_percent).toBe(25);
  });

  it("omits fields that are undefined on the source rule instead of injecting `undefined`", () => {
    const partial = { thresholdPercent: 40 };
    const result = toDeviceConfig({ arabica: partial });
    expect(result.auto_water.arabica).toEqual({ threshold_percent: 40 });
  });
});

describe("fromDeviceConfig", () => {
  it("translates the full GET /api/config envelope to camelCase per-plant rules", () => {
    const result = fromDeviceConfig({ auto_water: { arabica: snakeRule } });
    expect(result).toEqual({ arabica: camelRule });
  });

  it("also accepts a bare auto_water map (without the envelope wrapper)", () => {
    const result = fromDeviceConfig({ arabica: snakeRule });
    expect(result).toEqual({ arabica: camelRule });
  });

  it("translates every numeric field, not just `enabled`", () => {
    const result = fromDeviceConfig({ auto_water: { arabica: { ...snakeRule, threshold_percent: 60, cooldown_minutes: 45 } } });
    expect(result.arabica.thresholdPercent).toBe(60);
    expect(result.arabica.cooldownMinutes).toBe(45);
  });

  it("returns an empty object for a missing/empty config", () => {
    expect(fromDeviceConfig(null)).toEqual({});
    expect(fromDeviceConfig({})).toEqual({});
  });
});

describe("casing round trip", () => {
  it("camelCase -> device -> camelCase preserves every field exactly", () => {
    const rules = { arabica: camelRule, chili: { ...camelRule, thresholdPercent: 25, pulseSeconds: 4 } };
    const roundTripped = fromDeviceConfig(toDeviceConfig(rules));
    expect(roundTripped).toEqual(rules);
  });

  it("device (snake_case) -> camelCase -> device preserves every key exactly, matching docs/API.md", () => {
    const deviceConfig = { auto_water: { arabica: snakeRule, chili: { ...snakeRule, threshold_percent: 25 } } };
    const roundTripped = toDeviceConfig(fromDeviceConfig(deviceConfig));
    expect(roundTripped).toEqual(deviceConfig);
  });

  it("a partial edit (only threshold changed) still carries every other field through both directions", () => {
    // Simulates: hydrate rules from the device, user edits one field in
    // the UI (AutoWaterPanel), then the edited rule is pushed back.
    const hydrated = fromDeviceConfig({ auto_water: { arabica: snakeRule } });
    const edited = { ...hydrated.arabica, thresholdPercent: 42 };
    const pushed = toDeviceConfig({ arabica: edited });
    expect(pushed.auto_water.arabica).toEqual({
      enabled: true,
      threshold_percent: 42, // the edit survived
      pulse_seconds: 3, // untouched fields survived too — this is the
      cooldown_minutes: 30, // exact regression the round-1 bug caused:
      max_daily_pulses: 4, // only `enabled` used to make it through.
    });
  });
});
