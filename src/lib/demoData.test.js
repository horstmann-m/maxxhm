import { describe, it, expect } from "vitest";
import { createDemoState, generateDemoData, applyWateringPulse } from "./demoData.js";
import { PLANT_ORDER } from "../plants/profiles.js";

// ============================================================
//  Soil drift + applyWateringPulse (Round 2, item 2)
// ============================================================
describe("generateDemoData soil drift", () => {
  it("dries soil out gradually over repeated ticks", () => {
    const state = createDemoState();
    const startSoil = { ...state.soil };
    // Fix the RNG jitter by sampling many ticks and comparing trend, since
    // each tick also adds +-0.3 random noise on top of the decay.
    for (let i = 0; i < 40; i++) generateDemoData(state, new Date());
    for (const key of PLANT_ORDER) {
      expect(state.soil[key]).toBeLessThan(startSoil[key]);
    }
  });

  it("never drifts soil below the clamp floor (3%) or above the ceiling (98%)", () => {
    const state = createDemoState();
    for (let i = 0; i < 500; i++) generateDemoData(state, new Date());
    for (const key of PLANT_ORDER) {
      expect(state.soil[key]).toBeGreaterThanOrEqual(3);
      expect(state.soil[key]).toBeLessThanOrEqual(98);
    }
  });
});

describe("applyWateringPulse", () => {
  it("raises the named plant's soil by the boost amount (clamped to 98)", () => {
    const state = createDemoState();
    state.soil.arabica = 30;
    applyWateringPulse(state, "arabica", new Date(), 16);
    expect(state.soil.arabica).toBe(46);
  });

  it("clamps the boosted soil value at 98, never exceeding it", () => {
    const state = createDemoState();
    state.soil.arabica = 95;
    applyWateringPulse(state, "arabica", new Date(), 16);
    expect(state.soil.arabica).toBe(98);
  });

  it("does not affect other plants' soil", () => {
    const state = createDemoState();
    const chiliBefore = state.soil.chili;
    applyWateringPulse(state, "arabica", new Date(), 16);
    expect(state.soil.chili).toBe(chiliBefore);
  });

  it("marks the pump as actively pulsing and records the plant/time", () => {
    const state = createDemoState();
    const now = new Date(2026, 0, 1, 12, 0, 0);
    applyWateringPulse(state, "chili", now, 10);
    expect(state.pumpActiveTicks).toBeGreaterThan(0);
    expect(state.lastPumpPlant).toBe("chili");
    expect(state.lastPumpAt).toBe(now.getTime());
  });
});

// ============================================================
//  Contract test: generateDemoData() vs. docs/API.md (Round 2, item 2)
// ============================================================
// So demo and firmware can't silently drift apart. This covers the fields
// generateDemoData() is itself responsible for producing (temperature,
// humidity, water, plants, actuators, meta) — the exact shape documented
// in docs/API.md's `GET /api/sensors` example.
//
// `auto_water` is intentionally NOT asserted here: in demo mode it is
// populated by App.jsx's demo-mode auto-watering simulation (driven by
// user-editable rules held in React component state), not by this
// stateless generator — generateDemoData()'s signature is (state, now)
// with no access to the rules. Extracting that block into a testable pure
// function is tracked as a nice-to-have (round 2 plan item 15) but out of
// scope for this hardening pass; asserting a fabricated auto_water shape
// here would test something the generator doesn't actually produce.
describe("generateDemoData contract vs. docs/API.md", () => {
  const data = generateDemoData(createDemoState(), new Date());

  it("has the top-level sensor-snapshot keys documented in docs/API.md", () => {
    expect(data).toHaveProperty("temperature");
    expect(data).toHaveProperty("humidity");
    expect(data).toHaveProperty("water");
    expect(data).toHaveProperty("plants");
    expect(data).toHaveProperty("actuators");
    expect(data).toHaveProperty("meta");
  });

  it("water has tds_ppm and ph as numbers", () => {
    expect(typeof data.water.tds_ppm).toBe("number");
    expect(typeof data.water.ph).toBe("number");
  });

  it("emits every plant in PLANT_ORDER with soil_percent/soil_raw/light_lux", () => {
    for (const key of PLANT_ORDER) {
      expect(data.plants).toHaveProperty(key);
      expect(typeof data.plants[key].soil_percent).toBe("number");
      expect(typeof data.plants[key].soil_raw).toBe("number");
      expect(typeof data.plants[key].light_lux).toBe("number");
    }
  });

  it("actuators has the documented boolean/numeric fields", () => {
    expect(typeof data.actuators.pump_active).toBe("boolean");
    expect(typeof data.actuators.light_active).toBe("boolean");
    expect(typeof data.actuators.last_pump_seconds_ago).toBe("number");
  });

  it("meta has the documented fields with plausible types", () => {
    expect(typeof data.meta.uptime_seconds).toBe("number");
    expect(typeof data.meta.wifi_rssi).toBe("number");
    expect(typeof data.meta.ip).toBe("string");
    expect(typeof data.meta.timestamp).toBe("string");
  });

  it("soil_percent stays within 0-100 (the range the dashboard's Gauge assumes)", () => {
    for (let i = 0; i < 50; i++) {
      const d = generateDemoData(createDemoState(), new Date());
      for (const key of PLANT_ORDER) {
        expect(d.plants[key].soil_percent).toBeGreaterThanOrEqual(0);
        expect(d.plants[key].soil_percent).toBeLessThanOrEqual(100);
      }
    }
  });
});
