import { describe, expect, it } from "vitest";
import { evaluateAnomaly, evaluateFrost } from "./market";
import type { DailySeries } from "./risk";

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 46-day series (past 30 + forecast 16), today at index 30.
function series(
  centerISO: string,
  opts: { precip?: number; tmin?: number; tminForecastMin?: number } = {}
): DailySeries {
  const { precip = 1, tmin = 15, tminForecastMin = null } = opts as never;
  const start = addDays(centerISO, -30);
  const time: string[] = [];
  const p: number[] = [];
  const mx: number[] = [];
  const mn: number[] = [];
  for (let i = 0; i < 46; i++) {
    time.push(addDays(start, i));
    p.push(precip);
    mx.push(25);
    const off = i - 30;
    mn.push(tminForecastMin != null && off >= 0 && off <= 5 ? tminForecastMin : tmin);
  }
  return { time, precip: p, tmax: mx, tmin: mn, todayIndex: 30 };
}

describe("frost evaluator", () => {
  it("non-frost-prone regions are always ok", () => {
    const r = evaluateFrost("x", false, series("2024-07-15", { tminForecastMin: -2 }));
    expect(r.level).toBe("ok");
    expect(r.minTminC).toBeNull();
  });
  it("forecast low ≤ alert threshold → alert", () => {
    const r = evaluateFrost("x", true, series("2024-07-15", { tmin: 12, tminForecastMin: 0 }));
    expect(r.level).toBe("alert");
    expect(r.minTminC).toBe(0);
    expect(r.headline.toLowerCase()).toContain("frost");
  });
  it("cold-but-not-freezing → watch", () => {
    const r = evaluateFrost("x", true, series("2024-07-15", { tmin: 12, tminForecastMin: 3 }));
    expect(r.level).toBe("watch");
  });
  it("mild nights → ok", () => {
    const r = evaluateFrost("x", true, series("2024-07-15", { tmin: 12 }));
    expect(r.level).toBe("ok");
  });
});

describe("rainfall anomaly evaluator", () => {
  it("far above the seasonal normal → wet alert", () => {
    const r = evaluateAnomaly("x", "brazil", series("2024-07-15", { precip: 6 }));
    expect(r.kind).toBe("wet");
    expect(r.level).toBe("alert");
    expect(r.ratio).toBeGreaterThan(2.2);
  });
  it("bone dry vs a wetter-normal month → dry alert", () => {
    const r = evaluateAnomaly("x", "colombia", series("2024-05-15", { precip: 0 }));
    expect(r.kind).toBe("dry");
    expect(r.level).toBe("alert");
  });
  it("near normal → ok", () => {
    // Brazil July normal ≈ 15mm/month ≈ 0.48mm/day → ~0.5mm/day is roughly typical
    const r = evaluateAnomaly("x", "brazil", series("2024-07-15", { precip: 0.5 }));
    expect(r.level).toBe("ok");
    expect(r.kind).toBe("normal");
  });
  it("origin with no baseline → kind none, ok", () => {
    const r = evaluateAnomaly("x", "panama", series("2024-07-15", { precip: 6 }));
    expect(r.kind).toBe("none");
    expect(r.level).toBe("ok");
    expect(r.ratio).toBeNull();
  });
});
