"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RiskDetail } from "@/components/RiskBadge";
import { useRisk } from "@/components/WeatherRiskProvider";
import { getOrigin, getRegion, regions } from "@/lib/reference";
import { STAGE_META } from "@/lib/season";
import { RISK_META, type RiskLevel, type RiskResult } from "@/lib/risk";

const RANK: Record<RiskLevel, number> = { alert: 2, watch: 1, ok: 0 };

function AlertCard({ risk }: { risk: RiskResult }) {
  const region = getRegion(risk.regionId);
  if (!region || risk.stage === null) return null;
  const origin = getOrigin(region.originId);
  const meta = RISK_META[risk.level];
  return (
    <li
      className="rounded-xl border bg-surface p-4"
      style={{ borderColor: meta.color + "55" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/origin/${region.originId}#${region.id}`}
            className="font-medium hover:text-accent"
          >
            {region.name}
          </Link>
          <span className="text-muted text-sm"> · {origin?.name}</span>
          <div className="text-xs text-muted mt-0.5">
            {STAGE_META[risk.stage].label}
          </div>
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: meta.color + "22", color: meta.color }}
        >
          {meta.icon} {meta.label}
        </span>
      </div>
      <RiskDetail risk={risk} />
    </li>
  );
}

export default function WeatherPage() {
  const { byRegion, loading, error, updatedAt, refresh } = useRisk();

  const { alerts, watches, clearCount, noStageCount } = useMemo(() => {
    const evaluated = regions
      .map((r) => byRegion.get(r.id))
      .filter((r): r is RiskResult => !!r);
    const withStage = evaluated.filter((r) => r.stage !== null);
    const sorted = withStage
      .slice()
      .sort(
        (a, b) =>
          RANK[b.level] - RANK[a.level] ||
          (b.metrics[0]?.value ?? 0) - (a.metrics[0]?.value ?? 0)
      );
    return {
      alerts: sorted.filter((r) => r.level === "alert"),
      watches: sorted.filter((r) => r.level === "watch"),
      clearCount: withStage.filter((r) => r.level === "ok").length,
      noStageCount: evaluated.length - withStage.length,
    };
  }, [byRegion]);

  return (
    <div className="p-4 md:p-8 max-w-[900px] mx-auto">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Weather alerts
          </h1>
          <p className="text-muted mt-1 max-w-2xl">
            Live quality risk for every region in a weather-sensitive stage right now,
            from Open-Meteo forecasts compared against each stage&apos;s ideal climate.
          </p>
        </div>
        <button
          onClick={refresh}
          className="shrink-0 px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-surface-2"
        >
          ↻ Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted mb-4">
          Couldn&apos;t reach the weather service ({error}). Risk flags are unavailable;
          everything else in the app works as normal.
        </div>
      )}

      {loading && byRegion.size === 0 && !error && (
        <p className="text-sm text-muted">Loading forecasts…</p>
      )}

      {byRegion.size > 0 && (
        <>
          {updatedAt && (
            <p className="text-xs text-muted mb-3">
              Updated {new Date(updatedAt).toLocaleString()} ·{" "}
              {alerts.length} alert{alerts.length !== 1 && "s"}, {watches.length} watch
            </p>
          )}

          {alerts.length === 0 && watches.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
              No weather risks right now — all regions in a sensitive stage look good. ☀️
            </div>
          )}

          {alerts.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: RISK_META.alert.color }}>
                Alerts
              </h2>
              <ul className="space-y-2">
                {alerts.map((r) => (
                  <AlertCard key={r.regionId} risk={r} />
                ))}
              </ul>
            </section>
          )}

          {watches.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: RISK_META.watch.color }}>
                Watch
              </h2>
              <ul className="space-y-2">
                {watches.map((r) => (
                  <AlertCard key={r.regionId} risk={r} />
                ))}
              </ul>
            </section>
          )}

          <p className="text-xs text-muted">
            {clearCount} region{clearCount !== 1 && "s"} in a sensitive stage look clear ·{" "}
            {noStageCount} not weather-sensitive right now (developing/export/off-season).
          </p>
        </>
      )}
    </div>
  );
}
