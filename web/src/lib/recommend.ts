// "What to buy now" scorer — pure and vitest-tested. Blends freshness (season),
// taste match (your affinities), weather (Phase-2 risk), value (manual price vs your
// target) and watchlist into one 0-100 score with an explainable factor breakdown.
// Weights/config come from the Python-authored public/data/reco_model.json.

import recoModelJson from "../../public/data/reco_model.json";
import type { RiskResult } from "./risk";
import type { Region, Stage } from "./types";

export interface RecoModel {
  weights: {
    freshness: number;
    tasteMatch: number;
    weather: number;
    value: number;
    watchlist: number;
  };
  freshnessByStage: Record<string, number>;
  valueScaleUscLb: number;
  neutral: { tasteMatch: number; weather: number; value: number };
}

export const recoModel = recoModelJson as RecoModel;

export interface PriceInput {
  cPriceUscLb?: number;
  differentialUscLb?: number;
  targetFobUscLb?: number;
}

export interface Factor {
  key: keyof RecoModel["weights"];
  label: string;
  score: number; // 0..1
  weight: number;
  detail: string;
}

export interface RegionScore {
  regionId: string;
  score: number; // 0..100
  factors: Factor[];
  reasons: string[];
  estFob: number | null;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const affinityTo01 = (w: number) => (Math.max(-2, Math.min(2, w)) + 2) / 4;

export function estFob(price: PriceInput | null | undefined): number | null {
  if (!price || price.cPriceUscLb == null || price.differentialUscLb == null) return null;
  return price.cPriceUscLb + price.differentialUscLb;
}

const RISK_TO_SCORE = { ok: 1, watch: 0.6, alert: 0.3 } as const;

export function scoreRegion(
  region: Region,
  stage: Stage | null,
  risk: RiskResult | undefined,
  affinities: Record<string, number>,
  price: PriceInput | null,
  watched: boolean,
  model: RecoModel = recoModel
): RegionScore {
  const w = model.weights;

  // freshness
  const freshKey = stage ?? "off_season";
  const freshness = model.freshnessByStage[freshKey] ?? model.freshnessByStage.off_season ?? 0.3;

  // taste match
  const hasAffinities = Object.keys(affinities).length > 0;
  let taste = model.neutral.tasteMatch;
  let likedCount = 0;
  if (hasAffinities && region.flavorNodes.length > 0) {
    const vals = region.flavorNodes.map((n) => affinities[n] ?? 0);
    taste = vals.reduce((a, v) => a + affinityTo01(v), 0) / vals.length;
    likedCount = vals.filter((v) => v > 0).length;
  }

  // weather (only meaningful when the region is in a weather-sensitive stage)
  const weather =
    risk && risk.stage !== null ? RISK_TO_SCORE[risk.level] : model.neutral.weather;

  // value vs your target FOB
  const fob = estFob(price);
  let value = model.neutral.value;
  let valueDetail = "no price set";
  if (fob !== null && price?.targetFobUscLb != null) {
    value = clamp01(0.5 + (price.targetFobUscLb - fob) / model.valueScaleUscLb);
    valueDetail = `est. FOB ${fob.toFixed(0)}¢ vs target ${price.targetFobUscLb.toFixed(0)}¢`;
  } else if (fob !== null) {
    valueDetail = `est. FOB ${fob.toFixed(0)}¢ (set a target)`;
  }

  const watchlist = watched ? 1 : 0;

  const factors: Factor[] = [
    {
      key: "freshness",
      label: "Freshness",
      score: freshness,
      weight: w.freshness,
      detail: stage ? stage.replace(/_/g, " ") : "off-season",
    },
    {
      key: "tasteMatch",
      label: "Taste match",
      score: taste,
      weight: w.tasteMatch,
      detail: hasAffinities
        ? `${likedCount}/${region.flavorNodes.length} notes you like`
        : "set your taste to improve this",
    },
    {
      key: "weather",
      label: "Weather",
      score: weather,
      weight: w.weather,
      detail: risk && risk.stage !== null ? risk.headline : "not weather-sensitive now",
    },
    { key: "value", label: "Value", score: value, weight: w.value, detail: valueDetail },
    {
      key: "watchlist",
      label: "Watchlist",
      score: watchlist,
      weight: w.watchlist,
      detail: watched ? "on your watchlist" : "not watched",
    },
  ];

  const wsum = factors.reduce((a, f) => a + f.weight, 0);
  const total = factors.reduce((a, f) => a + f.weight * f.score, 0) / wsum;

  return {
    regionId: region.id,
    score: Math.round(total * 100),
    factors,
    reasons: buildReasons(freshness, taste, weather, value, watched, hasAffinities, fob, price),
    estFob: fob,
  };
}

function buildReasons(
  freshness: number,
  taste: number,
  weather: number,
  value: number,
  watched: boolean,
  hasAffinities: boolean,
  fob: number | null,
  price: PriceInput | null
): string[] {
  const out: string[] = [];
  if (freshness >= 0.9) out.push("Arriving now");
  else if (freshness >= 0.5) out.push("In season");
  if (hasAffinities && taste >= 0.7) out.push("Matches your taste");
  if (weather === 1) out.push("Weather clear");
  else if (weather <= 0.4) out.push("⚠ Weather risk");
  if (fob !== null && price?.targetFobUscLb != null) {
    if (value >= 0.65) out.push("Good value vs target");
    else if (value <= 0.35) out.push("Pricey vs target");
  }
  if (watched) out.push("On your watchlist");
  return out;
}

export function scoreBand(score: number): { label: string; color: string } {
  if (score >= 75) return { label: "Strong buy", color: "#059669" };
  if (score >= 60) return { label: "Worth a look", color: "#2563eb" };
  if (score >= 45) return { label: "Marginal", color: "#d97706" };
  return { label: "Not now", color: "#6b7280" };
}
