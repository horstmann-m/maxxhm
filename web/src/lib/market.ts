// Market-signal evaluators layered on the same Open-Meteo series as the quality
// risk engine: frost (a market-moving event for frost-prone origins) and rainfall
// anomaly vs the seasonal normal. Config + baselines are Python-authored JSON.

import marketModelJson from "../../public/data/market_model.json";
import climateNormalsJson from "../../public/data/climate_normals.json";
import type { DailySeries, RiskLevel } from "./risk";

interface FrostConfig {
  fromDay: number;
  toDay: number;
  tminWatchC: number;
  tminAlertC: number;
}
interface AnomalyConfig {
  fromDay: number;
  toDay: number;
  wetRatioWatch: number;
  wetRatioAlert: number;
  dryRatioWatch: number;
  dryRatioAlert: number;
}

export const marketModel = marketModelJson as { frost: FrostConfig; anomaly: AnomalyConfig };
const normals = climateNormalsJson as Record<string, number[]>; // originId -> 12 monthly mm

/** 12 monthly mean rainfall (mm) for an origin, or null if no baseline. */
export const originNormals = (originId: string): number[] | null => normals[originId] ?? null;

export interface FrostResult {
  regionId: string;
  level: RiskLevel;
  minTminC: number | null;
  headline: string;
}

export type AnomalyKind = "wet" | "dry" | "normal" | "none";
export interface AnomalyResult {
  regionId: string;
  level: RiskLevel;
  kind: AnomalyKind;
  ratio: number | null;
  observedMm: number;
  normalMm: number;
  headline: string;
}

function windowIndices(len: number, today: number, fromDay: number, toDay: number) {
  const lo = Math.max(0, today + fromDay);
  const hi = Math.min(len - 1, today + toDay);
  return { lo, hi };
}

function daysInMonth(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m, 0).getDate(); // m is 1-based; day 0 of next month = last day
}

export function evaluateFrost(
  regionId: string,
  frostProne: boolean,
  series: DailySeries
): FrostResult {
  const cfg = marketModel.frost;
  if (!frostProne) {
    return { regionId, level: "ok", minTminC: null, headline: "Not a frost-prone region." };
  }
  const { lo, hi } = windowIndices(series.tmin.length, series.todayIndex, cfg.fromDay, cfg.toDay);
  let min = Infinity;
  for (let i = lo; i <= hi; i++) {
    const v = series.tmin[i];
    if (v !== null && v !== undefined && v < min) min = v;
  }
  if (!isFinite(min)) {
    return { regionId, level: "ok", minTminC: null, headline: "No forecast low available." };
  }
  const minR = Math.round(min * 10) / 10;
  let level: RiskLevel = "ok";
  let headline = `No frost expected — forecast low ${minR}°C.`;
  if (min <= cfg.tminAlertC) {
    level = "alert";
    headline = `Frost forecast — low of ${minR}°C. Crop-damage and C-market-spike risk.`;
  } else if (min <= cfg.tminWatchC) {
    level = "watch";
    headline = `Cold nights ahead — forecast low ${minR}°C.`;
  }
  return { regionId, level, minTminC: minR, headline };
}

export function evaluateAnomaly(
  regionId: string,
  originId: string,
  series: DailySeries
): AnomalyResult {
  const cfg = marketModel.anomaly;
  const base = { regionId, ratio: null, observedMm: 0, normalMm: 0 } as const;
  const normal = normals[originId];
  if (!normal) {
    return { ...base, level: "ok", kind: "none", headline: "No rainfall baseline for this origin." };
  }
  const { lo, hi } = windowIndices(series.precip.length, series.todayIndex, cfg.fromDay, cfg.toDay);
  let observed = 0;
  let expected = 0;
  for (let i = lo; i <= hi; i++) {
    const p = series.precip[i];
    if (p !== null && p !== undefined) observed += p;
    const iso = series.time[i];
    if (iso) {
      const month = Number(iso.slice(5, 7)) - 1; // 0-based
      expected += normal[month] / daysInMonth(iso);
    }
  }
  observed = Math.round(observed);
  expected = Math.round(expected);
  if (expected <= 0) {
    return { ...base, level: "ok", kind: "none", observedMm: observed, headline: "Baseline unavailable." };
  }
  const ratio = Math.round((observed / expected) * 100) / 100;
  let level: RiskLevel = "ok";
  let kind: AnomalyKind = "normal";
  let headline = `Rainfall near normal (${observed}mm vs ~${expected}mm typical).`;
  if (ratio >= cfg.wetRatioAlert) {
    level = "alert"; kind = "wet";
  } else if (ratio >= cfg.wetRatioWatch) {
    level = "watch"; kind = "wet";
  } else if (ratio <= cfg.dryRatioAlert) {
    level = "alert"; kind = "dry";
  } else if (ratio <= cfg.dryRatioWatch) {
    level = "watch"; kind = "dry";
  }
  if (kind === "wet") {
    headline = `${Math.round((ratio - 1) * 100)}% wetter than normal (${observed}mm vs ~${expected}mm).`;
  } else if (kind === "dry") {
    headline = `${Math.round((1 - ratio) * 100)}% drier than normal (${observed}mm vs ~${expected}mm).`;
  }
  return { regionId, level, kind, ratio, observedMm: observed, normalMm: expected, headline };
}
