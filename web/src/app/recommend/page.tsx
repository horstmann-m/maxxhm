"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useRisk } from "@/components/WeatherRiskProvider";
import { getDb } from "@/lib/db";
import { getOrigin, regions } from "@/lib/reference";
import { currentMonth, regionStatus } from "@/lib/season";
import {
  scoreBand,
  scoreRegion,
  type Factor,
  type PriceInput,
  type RegionScore,
} from "@/lib/recommend";

const FRESH_STAGES = new Set(["export", "drying", "harvest_main", "harvest_fly"]);

function FactorBars({ factors }: { factors: Factor[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
      {factors.map((f) => (
        <div key={f.key} title={f.detail}>
          <div className="flex justify-between text-[10px] text-muted mb-0.5">
            <span>{f.label}</span>
            <span>{Math.round(f.score * 100)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${f.score * 100}%`, background: "var(--accent)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" aria-hidden>
      <circle cx="29" cy="29" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
      <circle
        cx="29"
        cy="29"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={off}
        transform="rotate(-90 29 29)"
      />
      <text
        x="29"
        y="34"
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        fill={color}
        className="tabular-nums"
      >
        {score}
      </text>
    </svg>
  );
}

function Card({ rank, rec }: { rank: number; rec: RegionScore }) {
  const region = regions.find((r) => r.id === rec.regionId)!;
  const origin = getOrigin(region.originId);
  const band = scoreBand(rec.score);
  return (
    <li className="card p-4">
      <div className="flex items-start gap-4">
        <div className="text-center shrink-0">
          <ScoreGauge score={rec.score} color={band.color} />
          <div className="text-[10px] font-medium mt-0.5" style={{ color: band.color }}>
            {band.label}
          </div>
          <div className="text-[10px] text-muted">#{rank}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <Link
              href={`/origin/${region.originId}#${region.id}`}
              className="font-semibold hover:text-accent"
            >
              {region.name}
              <span className="text-muted font-normal text-sm"> · {origin?.name}</span>
            </Link>
            {rec.estFob != null && (
              <span className="text-xs text-muted shrink-0">est. FOB {rec.estFob.toFixed(0)}¢</span>
            )}
          </div>
          {rec.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {rec.reasons.map((r) => (
                <span
                  key={r}
                  className="px-2 py-0.5 rounded-full text-xs bg-surface-2 text-foreground"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
          <FactorBars factors={rec.factors} />
        </div>
      </div>
    </li>
  );
}

export default function RecommendPage() {
  const { byRegion } = useRisk();
  const prefs = useLiveQuery(() => getDb().preferences.get("me"), []);
  const priceRows = useLiveQuery(() => getDb().prices.toArray(), []);
  const watchRows = useLiveQuery(() => getDb().watchlist.toArray(), []);
  const [freshOnly, setFreshOnly] = useState(false);

  const month = currentMonth();
  const affinities = useMemo(() => prefs?.affinities ?? {}, [prefs]);
  const hasPrefs = Object.keys(affinities).length > 0;

  const priceByOrigin = useMemo(() => {
    const m = new Map<string, { differentialUscLb?: number; targetFobUscLb?: number }>();
    let cPrice: number | undefined;
    for (const r of priceRows ?? []) {
      if (r.id === "market") cPrice = r.cPriceUscLb;
      else if (r.kind === "origin")
        m.set(r.id.replace("origin:", ""), {
          differentialUscLb: r.differentialUscLb,
          targetFobUscLb: r.targetFobUscLb,
        });
    }
    return { cPrice, m };
  }, [priceRows]);
  const hasPrices = priceByOrigin.cPrice != null || priceByOrigin.m.size > 0;

  const watchedKeys = useMemo(
    () => new Set((watchRows ?? []).map((w) => w.entityKey)),
    [watchRows]
  );

  const ranked = useMemo(() => {
    const scored = regions.map((region) => {
      const stage = regionStatus(region, month).stage;
      const op = priceByOrigin.m.get(region.originId);
      const price: PriceInput | null =
        priceByOrigin.cPrice != null || op
          ? { cPriceUscLb: priceByOrigin.cPrice, ...op }
          : null;
      const watched =
        watchedKeys.has(`region:${region.id}`) || watchedKeys.has(`origin:${region.originId}`);
      return { rec: scoreRegion(region, stage, byRegion.get(region.id), affinities, price, watched), stage };
    });
    return scored
      .filter((s) => !freshOnly || (s.stage != null && FRESH_STAGES.has(s.stage)))
      .sort((a, b) => b.rec.score - a.rec.score)
      .map((s) => s.rec);
  }, [byRegion, affinities, priceByOrigin, watchedKeys, month, freshOnly]);

  return (
    <div className="p-4 md:p-8 max-w-[900px] mx-auto">
      <PageHeader
        eyebrow="Recommendations"
        title="Buy now"
        subtitle="Every region ranked by freshness, your taste, weather and value — the synthesis of everything in your second brain."
        actions={
          <>
            <Link href="/preferences" className="btn btn-ghost">Taste</Link>
            <Link href="/prices" className="btn btn-ghost">Prices</Link>
          </>
        }
      />

      {(!hasPrefs || !hasPrices) && (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted mb-4">
          Tip: set your{" "}
          <Link href="/preferences" className="text-accent hover:underline">taste preferences</Link>
          {" "}and{" "}
          <Link href="/prices" className="text-accent hover:underline">prices</Link>{" "}
          to sharpen these rankings. Until then, taste and value use neutral defaults.
        </div>
      )}

      <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
        <input type="checkbox" checked={freshOnly} onChange={(e) => setFreshOnly(e.target.checked)} />
        Only regions in a buying window (harvesting → arriving)
      </label>

      <ul className="space-y-2">
        {ranked.map((rec, i) => (
          <Card key={rec.regionId} rank={i + 1} rec={rec} />
        ))}
        {ranked.length === 0 && (
          <li className="text-sm text-muted">No regions match the current filter.</li>
        )}
      </ul>
    </div>
  );
}
