// Live weather for all regions in one Open-Meteo call (free, no key, CORS-enabled),
// cached in localStorage for 6h, evaluated into a per-region RiskResult map.
// The evaluation is pure (risk.ts); this module is just fetch + cache + glue.

import { regions } from "./reference";
import { evaluateRegion, regionFocusStage, type DailySeries, type RiskResult } from "./risk";
import {
  evaluateAnomaly,
  evaluateFrost,
  type AnomalyResult,
  type FrostResult,
} from "./market";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const PAST_DAYS = 30;
const FORECAST_DAYS = 16;
const CACHE_KEY = "parchment.weather.v1";
const TTL_MS = 6 * 60 * 60 * 1000;

interface RawDaily {
  daily: {
    time: string[];
    precipitation_sum: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
  };
}

interface Cache {
  at: number;
  series: Record<string, DailySeries>;
}

function buildUrl(): string {
  const lat = regions.map((r) => r.lat).join(",");
  const lng = regions.map((r) => r.lng).join(",");
  const q = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    daily: "precipitation_sum,temperature_2m_max,temperature_2m_min",
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
    timezone: "auto",
  });
  return `${ENDPOINT}?${q.toString()}`;
}

function toSeries(raw: RawDaily): DailySeries {
  const time = raw.daily.time;
  const today = new Date().toISOString().slice(0, 10);
  const idx = time.indexOf(today);
  return {
    time,
    precip: raw.daily.precipitation_sum,
    tmax: raw.daily.temperature_2m_max,
    tmin: raw.daily.temperature_2m_min,
    todayIndex: idx >= 0 ? idx : Math.min(PAST_DAYS, time.length - 1),
  };
}

function readCache(): Record<string, DailySeries> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cache;
    if (Date.now() - c.at > TTL_MS) return null;
    return c.series;
  } catch {
    return null;
  }
}

function writeCache(series: Record<string, DailySeries>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), series } satisfies Cache));
  } catch {
    /* quota / private mode — non-fatal, we just refetch next time */
  }
}

async function loadAllSeries(force = false): Promise<Record<string, DailySeries>> {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }
  const res = await fetch(buildUrl());
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  const arr: RawDaily[] = Array.isArray(json) ? json : [json];
  const series: Record<string, DailySeries> = {};
  regions.forEach((r, i) => {
    if (arr[i]?.daily) series[r.id] = toSeries(arr[i]);
  });
  writeCache(series);
  return series;
}

export interface RiskSnapshot {
  byRegion: Map<string, RiskResult>;
  frost: Map<string, FrostResult>;
  anomaly: Map<string, AnomalyResult>;
  series: Record<string, DailySeries>; // raw daily weather per region (for charts)
  updatedAt: number;
}

/** Fetch (or use cached) weather and evaluate every region for the given month. */
export async function loadRiskSnapshot(month: number, force = false): Promise<RiskSnapshot> {
  const series = await loadAllSeries(force);
  const byRegion = new Map<string, RiskResult>();
  const frost = new Map<string, FrostResult>();
  const anomaly = new Map<string, AnomalyResult>();
  for (const r of regions) {
    const s = series[r.id];
    if (!s) continue;
    byRegion.set(r.id, evaluateRegion(r.id, regionFocusStage(r, month), s));
    frost.set(r.id, evaluateFrost(r.id, !!r.frostProne, s));
    anomaly.set(r.id, evaluateAnomaly(r.id, r.originId, s));
  }
  return { byRegion, frost, anomaly, series, updatedAt: Date.now() };
}
