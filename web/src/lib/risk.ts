// Pure weather-risk evaluator — the browser twin of pipeline/weather/evaluate.py.
// Both interpret the same declarative model (public/data/risk_model.json); a parity
// test (risk.test.ts) pins them to identical output on a shared fixture.

import riskModelJson from "../../public/data/risk_model.json";
import { activeStages } from "./season";
import type { Region, Stage } from "./types";

export type RiskLevel = "ok" | "watch" | "alert";

export interface RiskMetricSpec {
  kind: "rolling_sum" | "sum" | "count_above";
  source: "precip" | "tmax" | "tmin";
  label: string;
  unit: string;
  fromDay: number;
  toDay: number;
  direction: "high" | "low";
  warn: number;
  alert: number;
  reasonWarn: string;
  reasonAlert: string;
  windowDays: number | null;
  threshold: number | null;
}

export interface StageRule {
  stage: Stage;
  metrics: RiskMetricSpec[];
}

export interface DailySeries {
  time: string[];
  precip: (number | null)[];
  tmax: (number | null)[];
  tmin: (number | null)[];
  todayIndex: number;
}

export interface MetricResult {
  label: string;
  unit: string;
  value: number;
  level: RiskLevel;
  warn: number;
  alert: number;
  reason: string | null;
}

export interface RiskResult {
  regionId: string;
  stage: Stage | null;
  level: RiskLevel;
  headline: string;
  metrics: MetricResult[];
}

export const riskModel = riskModelJson as StageRule[];
const metricsByStage = new Map<Stage, RiskMetricSpec[]>(
  riskModel.map((s) => [s.stage, s.metrics])
);

// Most weather-sensitive first — mirrors FOCUS_PRIORITY in evaluate.py.
const FOCUS_PRIORITY: Stage[] = [
  "drying",
  "harvest_main",
  "harvest_fly",
  "flowering",
  "cherry_development",
];

const RANK: Record<RiskLevel, number> = { ok: 0, watch: 1, alert: 2 };

export function focusStage(active: Stage[]): Stage | null {
  return FOCUS_PRIORITY.find((s) => active.includes(s)) ?? null;
}

/** The stage a region's weather is judged against this month (or null). */
export function regionFocusStage(region: Region, month: number): Stage | null {
  return focusStage(activeStages(region, month));
}

function sourceArray(series: DailySeries, name: RiskMetricSpec["source"]) {
  return name === "precip" ? series.precip : name === "tmax" ? series.tmax : series.tmin;
}

function windowValues(
  values: (number | null)[],
  today: number,
  fromDay: number,
  toDay: number
): number[] {
  const lo = Math.max(0, today + fromDay);
  const hi = Math.min(values.length - 1, today + toDay);
  const out: number[] = [];
  for (let i = lo; i <= hi; i++) {
    const v = values[i];
    if (v !== null && v !== undefined) out.push(v);
  }
  return out;
}

function maxRollingSum(vals: number[], window: number): number {
  if (vals.length === 0) return 0;
  if (vals.length <= window) return vals.reduce((a, b) => a + b, 0);
  let run = 0;
  for (let i = 0; i < window; i++) run += vals[i];
  let best = run;
  for (let i = window; i < vals.length; i++) {
    run += vals[i] - vals[i - window];
    if (run > best) best = run;
  }
  return best;
}

function classify(value: number, direction: "high" | "low", warn: number, alert: number): RiskLevel {
  if (direction === "high") {
    if (value >= alert) return "alert";
    if (value >= warn) return "watch";
  } else {
    if (value <= alert) return "alert";
    if (value <= warn) return "watch";
  }
  return "ok";
}

export function evalMetric(m: RiskMetricSpec, series: DailySeries): MetricResult {
  const vals = windowValues(sourceArray(series, m.source), series.todayIndex, m.fromDay, m.toDay);
  let value: number;
  if (m.kind === "rolling_sum") value = maxRollingSum(vals, m.windowDays ?? 1);
  else if (m.kind === "sum") value = vals.reduce((a, b) => a + b, 0);
  else value = vals.filter((v) => v > (m.threshold ?? 0)).length; // count_above

  value = Math.round(value * 10) / 10;
  const level = classify(value, m.direction, m.warn, m.alert);
  const reason = level === "alert" ? m.reasonAlert : level === "watch" ? m.reasonWarn : null;
  return { label: m.label, unit: m.unit, value, level, warn: m.warn, alert: m.alert, reason };
}

export function evaluateRegion(
  regionId: string,
  stage: Stage | null,
  series: DailySeries
): RiskResult {
  const metrics = stage ? metricsByStage.get(stage) : undefined;
  if (!stage || !metrics) {
    return {
      regionId,
      stage: null,
      level: "ok",
      headline: "No weather-sensitive stage right now.",
      metrics: [],
    };
  }
  const results = metrics.map((m) => evalMetric(m, series));
  const worst = results.reduce(
    (a, b) => (RANK[b.level] > RANK[a.level] ? b : a),
    results[0]
  );
  const level = worst?.level ?? "ok";
  const headline =
    level === "ok"
      ? `Conditions look favourable during ${stage.replace(/_/g, " ")}.`
      : worst.reason ?? level;
  return { regionId, stage, level, headline, metrics: results };
}

/** Worst risk among a set of regions (for the origin-level map marker ring). */
export function aggregateLevel(results: (RiskResult | undefined)[]): RiskLevel {
  let worst: RiskLevel = "ok";
  for (const r of results) {
    if (r && RANK[r.level] > RANK[worst]) worst = r.level;
  }
  return worst;
}

export const RISK_META: Record<RiskLevel, { label: string; color: string; icon: string }> = {
  ok: { label: "Good", color: "#4a9d5b", icon: "✓" },
  watch: { label: "Watch", color: "#d9860b", icon: "⚠" },
  alert: { label: "Alert", color: "#d64545", icon: "✕" },
};
