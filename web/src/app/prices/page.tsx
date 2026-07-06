"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { getDb } from "@/lib/db";
import { origins } from "@/lib/reference";
import { setMarketPrice, setOriginPrice } from "@/lib/store";
import type { PriceEntry } from "@/lib/types";

function numOrUndef(s: string): number | undefined {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function MarketInput({ entry }: { entry: PriceEntry | undefined }) {
  const [val, setVal] = useState(entry?.cPriceUscLb?.toString() ?? "");
  return (
    <label className="flex items-center gap-3">
      <span className="text-sm text-muted w-40">ICE &ldquo;C&rdquo; price (US¢/lb)</span>
      <input
        type="number"
        inputMode="decimal"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          const n = numOrUndef(val);
          if (n !== undefined) setMarketPrice(n);
        }}
        placeholder="e.g. 320"
        className="w-32 text-sm rounded-lg border border-border bg-background px-2 py-1.5"
      />
    </label>
  );
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
        <input
          type="number"
          value={diff}
          onChange={(e) => setDiff(e.target.value)}
          onBlur={commit}
          placeholder="+/−"
          className="w-20 text-sm rounded-lg border border-border bg-background px-2 py-1"
        />
      </td>
      <td className="py-2 px-1 text-sm tabular-nums text-muted">
        {fob != null ? `${fob.toFixed(0)}¢` : "—"}
      </td>
      <td className="py-2 px-1">
        <input
          type="number"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onBlur={commit}
          placeholder="target"
          className="w-20 text-sm rounded-lg border border-border bg-background px-2 py-1"
        />
      </td>
    </tr>
  );
}

export default function PricesPage() {
  const rows = useLiveQuery(() => getDb().prices.toArray(), []);
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const market = byId.get("market");
  const cPrice = market?.cPriceUscLb;

  return (
    <div className="p-4 md:p-8 max-w-[720px] mx-auto">
      <Link href="/recommend" className="text-sm text-muted hover:text-accent">
        ← Buy now
      </Link>
      <header className="mt-3 mb-5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Prices</h1>
        <p className="text-muted mt-1 max-w-2xl">
          Enter today&apos;s market and your differentials to power the value factor in
          recommendations. Estimated FOB = C-price + differential.
        </p>
        <p className="text-xs text-muted mt-2">
          Manual entry for now — live ICE/KC futures need a licensed feed, which can be
          wired in later without changing the rest of the app.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-surface p-4 mb-5">
        <MarketInput entry={market} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 overflow-x-auto">
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
              <OriginRow
                key={o.id}
                originId={o.id}
                name={o.name}
                entry={byId.get(`origin:${o.id}`)}
                cPrice={cPrice}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
