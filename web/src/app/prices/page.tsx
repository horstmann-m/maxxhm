"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PriceChart } from "@/components/PriceChart";
import { getDb } from "@/lib/db";
import { origins } from "@/lib/reference";
import { logCPrice, setOriginPrice, setPriceThreshold } from "@/lib/store";
import type { PriceEntry } from "@/lib/types";

function numOrUndef(s: string): number | undefined {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function OriginRow({
  originId,
  name,
  entry,
  cPrice,
}: {
  originId: string;
  name: string;
  entry: PriceEntry | undefined;
  cPrice: number | undefined;
}) {
  const [diff, setDiff] = useState(entry?.differentialUscLb?.toString() ?? "");
  const [target, setTarget] = useState(entry?.targetFobUscLb?.toString() ?? "");
  const d = numOrUndef(diff);
  const fob = cPrice != null && d != null ? cPrice + d : null;
  const commit = () =>
    setOriginPrice(originId, {
      differentialUscLb: numOrUndef(diff),
      targetFobUscLb: numOrUndef(target),
    });
  return (
    <tr className="border-t border-border">
      <td className="py-2 pr-3 text-sm">{name}</td>
      <td className="py-2 px-1">
        <input type="number" value={diff} onChange={(e) => setDiff(e.target.value)} onBlur={commit}
          placeholder="+/−" className="w-20 text-sm rounded-lg border border-border bg-background px-2 py-1" />
      </td>
      <td className="py-2 px-1 text-sm tabular-nums text-muted">
        {fob != null ? `${fob.toFixed(0)}¢` : "—"}
      </td>
      <td className="py-2 px-1">
        <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} onBlur={commit}
          placeholder="target" className="w-20 text-sm rounded-lg border border-border bg-background px-2 py-1" />
      </td>
    </tr>
  );
}

function LogForm() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [price, setPrice] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-muted">
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="block mt-1 text-sm rounded-lg border border-border bg-background px-2 py-1.5" />
      </label>
      <label className="text-xs text-muted">
        C-price ¢/lb
        <input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 320" className="block mt-1 w-28 text-sm rounded-lg border border-border bg-background px-2 py-1.5" />
      </label>
      <button
        onClick={() => {
          const n = numOrUndef(price);
          if (n !== undefined && date) {
            logCPrice(date, n);
            setPrice("");
          }
        }}
        className="btn btn-primary"
      >
        Log
      </button>
    </div>
  );
}

export default function PricesPage() {
  const rows = useLiveQuery(() => getDb().prices.toArray(), []);
  const history = useLiveQuery(() => getDb().priceHistory.orderBy("date").toArray(), []);
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const market = byId.get("market");
  const cPrice = market?.cPriceUscLb;
  const threshold = market?.thresholdUscLb;
  const [thr, setThr] = useState<string | null>(null);
  const thrValue = thr ?? (threshold?.toString() ?? "");

  const trend = useMemo(() => {
    const h = history ?? [];
    if (h.length < 2) return null;
    const latest = h[h.length - 1];
    const latestMs = new Date(latest.date).getTime();
    // nearest point ≥ ~30 days before latest, else the earliest
    let prior = h[0];
    for (let i = h.length - 1; i >= 0; i--) {
      if (latestMs - new Date(h[i].date).getTime() >= 30 * 864e5) {
        prior = h[i];
        break;
      }
    }
    const delta = Math.round((latest.cPriceUscLb - prior.cPriceUscLb) * 10) / 10;
    return { delta, latest: latest.cPriceUscLb };
  }, [history]);

  const breached = threshold != null && cPrice != null && cPrice < threshold;

  return (
    <div className="p-4 md:p-8 max-w-[720px] mx-auto">
      <Link href="/recommend" className="text-sm text-muted hover:text-accent">
        ← Buy now
      </Link>
      <PageHeader
        className="mt-3"
        eyebrow="Value & market"
        title="Prices"
        subtitle={
          <>
            Log the C-price over time to track the trend, and set your differentials to
            power the value factor in recommendations. Estimated FOB = C-price + differential.
            <span className="block text-xs mt-2">
              Manual entry for now — live ICE/KC futures need a licensed feed, which can be
              wired in later without changing the rest of the app.
            </span>
          </>
        }
      />

      {breached && (
        <div className="rounded-xl p-4 mb-5 text-sm" style={{ background: "#4a9d5b22", color: "#2f7d46" }}>
          📉 C-price <b>{cPrice}¢</b> is below your <b>{threshold}¢</b> trigger — a favourable
          cost window. Differentials/quality still apply.
        </div>
      )}

      {/* Market: current price + trend + chart + log + threshold */}
      <div className="card p-4 mb-5">
        <div className="flex items-end justify-between gap-4 mb-3">
          <div>
            <div className="text-xs text-muted">Current C-price</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{cPrice != null ? `${cPrice}¢` : "—"}</span>
              {trend && (
                <span
                  className="text-sm font-medium"
                  style={{ color: trend.delta > 0 ? "#d64545" : trend.delta < 0 ? "#2f7d46" : "var(--muted)" }}
                >
                  {trend.delta > 0 ? "▲" : trend.delta < 0 ? "▼" : "→"} {Math.abs(trend.delta)}¢ / ~30d
                </span>
              )}
            </div>
          </div>
          <LogForm />
        </div>

        <PriceChart points={history ?? []} threshold={threshold} />

        <label className="flex items-center gap-2 mt-4 text-sm">
          <span className="text-muted">Alert me when C drops below</span>
          <input
            type="number"
            value={thrValue}
            onChange={(e) => setThr(e.target.value)}
            onBlur={() => setPriceThreshold(numOrUndef(thrValue))}
            placeholder="¢/lb"
            className="w-24 text-sm rounded-lg border border-border bg-background px-2 py-1"
          />
        </label>
      </div>

      {/* Differentials */}
      <div className="card p-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted text-left">
              <th className="pb-2 font-medium">Origin</th>
              <th className="pb-2 px-1 font-medium">Differential ¢</th>
              <th className="pb-2 px-1 font-medium">Est. FOB</th>
              <th className="pb-2 px-1 font-medium">Your target ¢</th>
            </tr>
          </thead>
          <tbody>
            {origins.map((o) => (
              <OriginRow key={o.id} originId={o.id} name={o.name} entry={byId.get(`origin:${o.id}`)} cPrice={cPrice} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
