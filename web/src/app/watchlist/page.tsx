"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { removeWatch } from "@/lib/store";
import { getRegion, resolveRef } from "@/lib/reference";
import { currentMonth, regionStatus } from "@/lib/season";

export default function WatchlistPage() {
  const items = useLiveQuery(
    () => getDb().watchlist.orderBy("addedAt").reverse().toArray(),
    []
  );
  const now = currentMonth();

  return (
    <div className="p-4 md:p-8 max-w-[900px] mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Watchlist</h1>
        <p className="text-muted mt-1 max-w-2xl">
          Origins and regions you&apos;re tracking to buy. Each shows where it sits in
          the season right now — watch for the buying window to open.
        </p>
      </header>

      {items && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted">
          Nothing watched yet. Open an origin from the{" "}
          <Link href="/" className="text-accent hover:underline">
            map
          </Link>{" "}
          and hit Watch.
        </div>
      )}

      <ul className="space-y-2">
        {items?.map((item) => {
          const ref = resolveRef(item.entityKey);
          const region = item.entityType === "region" ? getRegion(item.entityId) : null;
          const status = region ? regionStatus(region, now) : null;
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted border border-border rounded px-1.5 py-0.5">
                    {item.entityType}
                  </span>
                  {ref?.href ? (
                    <Link href={ref.href} className="font-medium hover:text-accent">
                      {ref.label}
                    </Link>
                  ) : (
                    <span className="font-medium">{ref?.label ?? item.entityKey}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {status && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: status.meta.color + "22", color: status.meta.color }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: status.meta.color }}
                    />
                    {status.meta.short}
                  </span>
                )}
                <button
                  onClick={() => removeWatch(item.id)}
                  className="text-xs text-muted hover:text-red-600"
                  aria-label="Remove from watchlist"
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
