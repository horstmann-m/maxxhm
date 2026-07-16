import { describe, it, expect } from "vitest";
import { pushIfOutOfBand, dedupeAlerts, checkAlerts } from "./alerts.js";

// ============================================================
//  pushIfOutOfBand() — crit-over-warn precedence (Round 2, item 2)
// ============================================================
describe("pushIfOutOfBand", () => {
  const thresholds = { warnLow: 15, warnHigh: 35, critLow: 10, critHigh: 40 };

  it("pushes nothing when the value is within all bands", () => {
    const alerts = [];
    pushIfOutOfBand(alerts, "test", 25, thresholds, { label: "Test", icon: "x" });
    expect(alerts).toHaveLength(0);
  });

  it("pushes exactly one 'warning' alert for a warn-band-low value", () => {
    const alerts = [];
    pushIfOutOfBand(alerts, "test", 12, thresholds, { label: "Test", icon: "x" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("warning");
  });

  it("prefers 'critical' over 'warning' when a value is beyond BOTH bounds (crit wins)", () => {
    // 5 is below both warnLow (15) and critLow (10) — must be reported
    // once, as critical, never as a second/duplicate warning alert.
    const alerts = [];
    pushIfOutOfBand(alerts, "test", 5, thresholds, { label: "Test", icon: "x" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("critical");
  });

  it("prefers 'critical' over 'warning' on the high side too", () => {
    const alerts = [];
    pushIfOutOfBand(alerts, "test", 45, thresholds, { label: "Test", icon: "x" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("critical");
  });

  it("ignores non-numeric values instead of throwing", () => {
    const alerts = [];
    pushIfOutOfBand(alerts, "test", undefined, thresholds, { label: "Test", icon: "x" });
    pushIfOutOfBand(alerts, "test", NaN, thresholds, { label: "Test", icon: "x" });
    expect(alerts).toHaveLength(0);
  });

  it("does nothing when thresholds are missing", () => {
    const alerts = [];
    pushIfOutOfBand(alerts, "test", 5, null, { label: "Test", icon: "x" });
    expect(alerts).toHaveLength(0);
  });
});

// ============================================================
//  dedupeAlerts() — rising-edge behavior (Round 2, item 2)
// ============================================================
// This is the fix for round-1 bug #1: an ongoing condition must log once,
// not once per poll.
describe("dedupeAlerts", () => {
  it("treats a first-seen alert as a rising edge", () => {
    const newAlerts = [{ key: "a.warnLow", level: "warning", msg: "x" }];
    const { activeKeys, risingEdge } = dedupeAlerts(newAlerts, new Set());
    expect(risingEdge).toHaveLength(1);
    expect(activeKeys.has("a.warnLow")).toBe(true);
  });

  it("does NOT re-log an alert that was already active last poll", () => {
    const newAlerts = [{ key: "a.warnLow", level: "warning", msg: "x" }];
    const previouslyActive = new Set(["a.warnLow"]);
    const { risingEdge } = dedupeAlerts(newAlerts, previouslyActive);
    expect(risingEdge).toHaveLength(0);
  });

  it("simulates a persistent condition across many polls logging exactly once", () => {
    let active = new Set();
    let logCount = 0;
    for (let poll = 0; poll < 50; poll++) {
      const newAlerts = [{ key: "soil.warnLow", level: "warning", msg: "dry" }];
      const { activeKeys, risingEdge } = dedupeAlerts(newAlerts, active);
      active = activeKeys;
      logCount += risingEdge.length;
    }
    expect(logCount).toBe(1);
  });

  it("logs a new rising edge again after the condition clears and re-triggers", () => {
    let active = new Set(["soil.warnLow"]); // was already active
    // Condition clears this poll (empty alert list).
    let result = dedupeAlerts([], active);
    active = result.activeKeys;
    expect(active.has("soil.warnLow")).toBe(false);
    // Condition re-appears next poll — must log again.
    result = dedupeAlerts([{ key: "soil.warnLow", level: "warning", msg: "dry" }], active);
    expect(result.risingEdge).toHaveLength(1);
  });

  it("treats a level change on the same underlying metric (warnLow -> critLow) as a new rising edge", () => {
    // pushIfOutOfBand keys critical/warning differently (a.critLow vs
    // a.warnLow), so an escalation from warning to critical is itself a
    // rising edge worth logging.
    const active = new Set(["a.warnLow"]);
    const { risingEdge } = dedupeAlerts([{ key: "a.critLow", level: "critical", msg: "x" }], active);
    expect(risingEdge).toHaveLength(1);
    expect(risingEdge[0].key).toBe("a.critLow");
  });
});

// ============================================================
//  checkAlerts() — fault-state surfacing (Round 2, items 3 & 7)
// ============================================================
describe("checkAlerts fault-state surfacing", () => {
  const profiles = {
    arabica: {
      name: "Arabica-Kaffee",
      thresholds: {
        temperature: { idealLow: 21, idealHigh: 27, warnLow: 18, warnHigh: 28, critLow: 15, critHigh: 32 },
        humidity: { idealLow: 60, idealHigh: 70, warnLow: 45, warnHigh: 85, critLow: 30 },
        soil: { idealLow: 40, idealHigh: 75, warnLow: 35, critLow: 20 },
        light: { idealLow: 2000, idealHigh: 10000, warnLow: 1500, warnHigh: 15000 },
        ph: { idealLow: 6.0, idealHigh: 6.5, warnLow: 5.5, warnHigh: 7.0 },
      },
      water: { tds: { warnHigh: 500 } },
    },
    chili: {
      name: "Chili",
      thresholds: {
        temperature: { idealLow: 21, idealHigh: 29, warnLow: 15, warnHigh: 32, critLow: 10, critHigh: 38 },
        humidity: { idealLow: 40, idealHigh: 60, warnLow: 30, warnHigh: 70, critLow: 20 },
        soil: { idealLow: 35, idealHigh: 65, warnLow: 25, critLow: 15 },
        light: { idealLow: 10000, idealHigh: 30000, warnLow: 5000, warnHigh: 35000 },
        ph: { idealLow: 6.0, idealHigh: 6.8, warnLow: 5.5, warnHigh: 7.5 },
      },
      water: { tds: { warnHigh: 800 } },
    },
  };

  const okData = {
    temperature: 24,
    humidity: 65,
    water: { ph: 6.2, tds_ppm: 300 },
    plants: {
      arabica: { soil_percent: 60, light_lux: 4000 },
      chili: { soil_percent: 50, light_lux: 15000 },
    },
  };

  it("raises a critical alert when a plant reports state: 'sensor-fault'", () => {
    const data = { ...okData, auto_water: { arabica: { state: "sensor-fault" } } };
    const alerts = checkAlerts(data, profiles);
    const faultAlert = alerts.find((a) => a.key === "arabica.sensorFault");
    expect(faultAlert).toBeDefined();
    expect(faultAlert.level).toBe("critical");
  });

  it("raises a critical alert when a plant reports state: 'no-rebound'", () => {
    const data = { ...okData, auto_water: { arabica: { state: "no-rebound" } } };
    const alerts = checkAlerts(data, profiles);
    const faultAlert = alerts.find((a) => a.key === "arabica.noRebound");
    expect(faultAlert).toBeDefined();
    expect(faultAlert.level).toBe("critical");
  });

  it("raises no fault alert for normal states (armed/disarmed/etc.)", () => {
    const data = { ...okData, auto_water: { arabica: { state: "armed" } } };
    const alerts = checkAlerts(data, profiles);
    expect(alerts.find((a) => a.key === "arabica.sensorFault")).toBeUndefined();
    expect(alerts.find((a) => a.key === "arabica.noRebound")).toBeUndefined();
  });
});
