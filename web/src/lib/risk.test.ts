// Parity test: these assertions mirror pipeline/tests/test_evaluate.py exactly, on
// the same recorded fixture. If the TS and Python evaluators ever diverge, this fails.

import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/openmeteo.rainy.json";
import { evaluateRegion, focusStage, type DailySeries } from "./risk";

type Raw = typeof fixture;

function series(raw: Raw = fixture): DailySeries {
  const d = raw.daily;
  return {
    time: d.time,
    precip: d.precipitation_sum,
    tmax: d.temperature_2m_max,
    tmin: d.temperature_2m_min,
    todayIndex: d.time.indexOf("2024-06-15"),
  };
}

describe("risk evaluator (parity with Python)", () => {
  it("locates today and reads source arrays", () => {
    const s = series();
    expect(s.todayIndex).toBe(30);
    expect(s.precip[30]).toBe(8);
  });

  it("drying → alert with 56mm 7-day rain", () => {
    const r = evaluateRegion("yirgacheffe", "drying", series());
    expect(r.level).toBe("alert");
    expect(r.metrics[0].value).toBe(56);
    expect(r.headline.toLowerCase()).toContain("defect risk");
  });

  it("harvest_main → watch (25 ≤ 56 < 60)", () => {
    const r = evaluateRegion("yirgacheffe", "harvest_main", series());
    expect(r.level).toBe("watch");
    expect(r.metrics[0].value).toBe(56);
  });

  it("cherry_development → ok when wet enough and mild", () => {
    const r = evaluateRegion("yirgacheffe", "cherry_development", series());
    expect(r.level).toBe("ok");
  });

  it("flowering → ok under the rain threshold", () => {
    const r = evaluateRegion("yirgacheffe", "flowering", series());
    expect(r.level).toBe("ok");
  });

  it("drought → alert (0mm over 30 days)", () => {
    const raw = structuredClone(fixture);
    raw.daily.precipitation_sum = raw.daily.time.map(() => 0);
    const r = evaluateRegion("yirgacheffe", "cherry_development", series(raw));
    expect(r.level).toBe("alert");
  });

  it("heat stress → alert (≥12 hot days)", () => {
    const raw = structuredClone(fixture);
    for (let i = 24; i < 39; i++) raw.daily.temperature_2m_max[i] = 33;
    const r = evaluateRegion("yirgacheffe", "cherry_development", series(raw));
    expect(r.level).toBe("alert");
  });

  it("no weather-sensitive stage → ok / null", () => {
    const r = evaluateRegion("x", focusStage(["export"]), series());
    expect(r.level).toBe("ok");
    expect(r.stage).toBeNull();
  });

  it("focus priority picks the most sensitive stage", () => {
    expect(focusStage(["cherry_development", "drying"])).toBe("drying");
    expect(focusStage(["export"])).toBeNull();
  });
});
