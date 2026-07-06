"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RiskDetail } from "@/components/RiskBadge";
import { useRisk } from "@/components/WeatherRiskProvider";
import { getOrigin, getRegion, regions } from "@/lib/reference";
import { STAGE_META } from "@/lib/season";
import { RISK_META, type RiskLevel, type RiskResult } from "@/lib/risk";
import type { AnomalyResult, FrostResult } from "@/lib/market";

const RANK: Record<RiskLevel, number> = { alert: 2, watch: 1, ok: 0 };

function RegionLine({ regionId }: { regionId: string }) {
  const region = getRegion(regionId);
  if (!region) return null;
  return (
    <>
      <Link href={`/origin/${region.originId}#${region.id}`} className="font-medium hover:text-accent">
        {region.name}
      </Link>
      <span className="text-muted text-sm"> · {getOrigin(region.originId)?.name}</span>
    </>
  );
}

function MarketCard({
  regionId,
  level,
  icon,
  badge,
  children,
}: {
  regionId: string;
  level: RiskLevel;
  icon: string;
  badge: string;
  children: ReactNode;
}) {
  const meta = RISK_META[level];
  return (
    <li className="card p-4" style={{ borderColor: meta.color + "55" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <RegionLine regionId={regionId} />
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: meta.color + "22", color: meta.color }}
        >
          {icon} {badge}
        </span>
      </div>
      <p className="text-xs mt-2" style={{ color: meta.color }}>
        {children}
      </p>
    </li>
  );
}

function QualityCard({ risk }: { risk: RiskResult }) {
  const region = getRegion(risk.regionId);
  if (!region || risk.stage === null) return null;
  const meta = RISK_META[risk.level];
  return (
    <li className="card p-4" style={{ borderColor: meta.color + "55" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <RegionLine regionId={risk.regionId} />
          <div className="text-xs text-muted mt-0.5">{STAGE_META[risk.stage].label}</div>
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

function Section({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color }}>
        {title}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

export default function WeatherPage() {
  const { byRegion, frost, anomaly, loading, error, updatedAt, refresh } = useRisk();

  const groups = useMemo(() => {
    const evaluated = regions.map((r) => byRegion.get(r.id)).filter((r): r is RiskResult => !!r);
    const withStage = evaluated.filter((r) => r.stage !== null);
    const bySeverity = <T extends { level: RiskLevel }>(a: T, b: T) => RANK[b.level] - RANK[a.level];

    const frostHits = [...frost.values()]
      .filter((f) => f.level !== "ok")
      .sort((a, b) => bySeverity(a, b) || (a.minTminC ?? 99) - (b.minTminC ?? 99));
    const anomalyHits = [...anomaly.values()]
      .filter((a) => a.level !== "ok" && a.kind !== "none")
      .sort(bySeverity);

    const q = withStage
      .slice()
      .sort((a, b) => bySeverity(a, b) || (b.metrics[0]?.value ?? 0) - (a.metrics[0]?.value ?? 0));
    return {
      frostHits,
      anomalyHits,
      qualityAlerts: q.filter((r) => r.level === "alert"),
      qualityWatches: q.filter((r) => r.level === "watch"),
      clearCount: withStage.filter((r) => r.level === "ok").length,
    };
  }, [byRegion, frost, anomaly]);

  const nothing =
    groups.frostHits.length === 0 &&
    groups.anomalyHits.length === 0 &&
    groups.qualityAlerts.length === 0 &&
    groups.qualityWatches.length === 0;

  return (
    <div className="p-4 md:p-8 max-w-[900px] mx-auto">
      <PageHeader
        eyebrow="Weather & market"
        title="Alerts"
        subtitle="Live signals from Open-Meteo: frost warnings (market-moving), rainfall anomalies vs the seasonal normal, and per-stage quality risk."
        actions={
          <button onClick={refresh} className="btn btn-ghost">
            ↻ Refresh
          </button>
        }
      />

      {error && (
        <div className="card p-4 text-sm text-muted mb-4">
          Couldn&apos;t reach the weather service ({error}). Signals are unavailable;
          everything else in the app works as normal.
        </div>
      )}

      {loading && byRegion.size === 0 && !error && (
        <p className="text-sm text-muted">Loading forecasts…</p>
      )}

      {byRegion.size > 0 && (
        <>
          {updatedAt && (
            <p className="text-xs text-muted mb-4">
              Updated {new Date(updatedAt).toLocaleString()} · {groups.frostHits.length} frost ·{" "}
              {groups.anomalyHits.length} anomaly · {groups.qualityAlerts.length} quality alert
              {groups.qualityAlerts.length !== 1 && "s"}
            </p>
          )}

          {nothing && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
              No active signals right now — no frost, no rainfall anomalies, and every
              region in a sensitive stage looks good. ☀️
            </div>
          )}

          {groups.frostHits.length > 0 && (
            <Section title="❄ Frost watch" color="#2f6fd0">
              {groups.frostHits.map((f: FrostResult) => (
                <MarketCard
                  key={f.regionId}
                  regionId={f.regionId}
                  level={f.level}
                  icon="❄"
                  badge={f.level === "alert" ? "Frost" : "Cold"}
                >
                  {f.headline}
                </MarketCard>
              ))}
            </Section>
          )}

          {groups.anomalyHits.length > 0 && (
            <Section title="Rainfall anomaly" color={RISK_META.watch.color}>
              {groups.anomalyHits.map((a: AnomalyResult) => (
                <MarketCard
                  key={a.regionId}
                  regionId={a.regionId}
                  level={a.level}
                  icon={a.kind === "wet" ? "💧" : "🌵"}
                  badge={a.kind === "wet" ? "Wet" : "Dry"}
                >
                  {a.headline}
                </MarketCard>
              ))}
            </Section>
          )}

          {groups.qualityAlerts.length > 0 && (
            <Section title="Quality risk · alerts" color={RISK_META.alert.color}>
              {groups.qualityAlerts.map((r) => (
                <QualityCard key={r.regionId} risk={r} />
              ))}
            </Section>
          )}

          {groups.qualityWatches.length > 0 && (
            <Section title="Quality risk · watch" color={RISK_META.watch.color}>
              {groups.qualityWatches.map((r) => (
                <QualityCard key={r.regionId} risk={r} />
              ))}
            </Section>
          )}

          <p className="text-xs text-muted">
            {groups.clearCount} region{groups.clearCount !== 1 && "s"} in a sensitive stage look clear.
            Rainfall anomaly covers origins with a climate baseline; frost covers frost-prone regions.
          </p>
        </>
      )}
    </div>
  );
}
