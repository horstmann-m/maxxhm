import { describe, expect, it } from "vitest";
import { estFob, recoModel, scoreRegion } from "./recommend";
import type { RiskResult } from "./risk";
import type { Region } from "./types";

function region(id: string, flavorNodes: string[]): Region {
  return {
    id,
    originId: "o",
    name: id,
    lat: 0,
    lng: 0,
    altitudeMinM: 1000,
    altitudeMaxM: 1500,
    varietals: [],
    processes: [],
    flavorTags: [],
    flavorNodes,
    harvest: [],
  };
}

const okRisk = (): RiskResult => ({
  regionId: "o",
  stage: "harvest_main",
  level: "ok",
  headline: "fine",
  metrics: [],
});
const alertRisk = (): RiskResult => ({
  regionId: "o",
  stage: "drying",
  level: "alert",
  headline: "rain",
  metrics: [],
});

describe("recommendation scorer", () => {
  it("computes est. FOB from C-price + differential", () => {
    expect(estFob({ cPriceUscLb: 180, differentialUscLb: 120 })).toBe(300);
    expect(estFob({ cPriceUscLb: 180 })).toBeNull();
    expect(estFob(null)).toBeNull();
  });

  it("freshness factor uses the model's per-stage table", () => {
    const r = scoreRegion(region("a", ["citrus"]), "export", undefined, {}, null, false);
    const fresh = r.factors.find((f) => f.key === "freshness")!;
    expect(fresh.score).toBe(recoModel.freshnessByStage.export); // 1.0
  });

  it("neutral fallbacks when taste/price/weather unknown", () => {
    const r = scoreRegion(region("a", ["citrus"]), "cherry_development", undefined, {}, null, false);
    expect(r.factors.find((f) => f.key === "tasteMatch")!.score).toBe(recoModel.neutral.tasteMatch);
    expect(r.factors.find((f) => f.key === "value")!.score).toBe(recoModel.neutral.value);
    expect(r.factors.find((f) => f.key === "weather")!.score).toBe(recoModel.neutral.weather);
    expect(r.estFob).toBeNull();
  });

  it("value: under target scores high, over target scores low", () => {
    const under = scoreRegion(
      region("a", ["citrus"]), "export", undefined, {},
      { cPriceUscLb: 180, differentialUscLb: 120, targetFobUscLb: 340 }, false
    );
    const over = scoreRegion(
      region("a", ["citrus"]), "export", undefined, {},
      { cPriceUscLb: 180, differentialUscLb: 200, targetFobUscLb: 340 }, false
    );
    expect(under.factors.find((f) => f.key === "value")!.score).toBeGreaterThan(0.9);
    expect(over.factors.find((f) => f.key === "value")!.score).toBeLessThan(0.5);
  });

  it("taste match rewards loved notes", () => {
    const loved = scoreRegion(region("a", ["citrus", "jasmine"]), "export", undefined, { citrus: 2, jasmine: 2 }, null, false);
    const disliked = scoreRegion(region("a", ["citrus", "jasmine"]), "export", undefined, { citrus: -2, jasmine: -2 }, null, false);
    expect(loved.factors.find((f) => f.key === "tasteMatch")!.score).toBeGreaterThan(0.9);
    expect(disliked.factors.find((f) => f.key === "tasteMatch")!.score).toBeLessThan(0.1);
    expect(loved.reasons).toContain("Matches your taste");
  });

  it("a fresh, matched, clear region outranks a developing, alert one", () => {
    const good = scoreRegion(region("good", ["citrus"]), "export", okRisk(), { citrus: 2 }, null, true);
    const bad = scoreRegion(region("bad", ["earthy"]), "cherry_development", alertRisk(), { citrus: 2 }, null, false);
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.reasons).toContain("Arriving now");
    expect(bad.reasons).toContain("⚠ Weather risk");
  });
});
