"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { CuppingForm } from "@/components/CuppingForm";
import { MarkdownView } from "@/components/MarkdownView";
import { PageHeader } from "@/components/PageHeader";
import { getDb } from "@/lib/db";
import { deleteTasting } from "@/lib/store";
import { flavorNodeMap, resolveRef } from "@/lib/reference";
import { scoreBand } from "@/lib/scoring";

export default function TastingsPage() {
  const tastings = useLiveQuery(
    () => getDb().tastings.orderBy("createdAt").reverse().toArray(),
    []
  );

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <PageHeader
        eyebrow="Second brain"
        title="Tasting journal"
        subtitle="Score cups on the SCA form, tag flavours from the wheel, and link each to its origin. Scores show up as backlinks on the origin profile."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div className="space-y-3">
          {tastings && tastings.length === 0 && (
            <p className="text-sm text-muted">No cuppings yet — score your first one.</p>
          )}
          {tastings?.map((t) => {
            const band = scoreBand(t.totalScore);
            const ref = t.refEntity ? resolveRef(t.refEntity) : null;
            return (
              <article
                key={t.id}
                id={t.id}
                className="scroll-mt-20 rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{t.name}</h3>
                    <p className="text-xs text-muted">
                      {t.date}
                      {ref && (
                        <>
                          {" · "}
                          {ref.href ? (
                            <Link href={ref.href} className="text-accent hover:underline">
                              {ref.label}
                            </Link>
                          ) : (
                            ref.label
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className="text-xl font-bold tabular-nums"
                      style={{ color: band.color }}
                    >
                      {t.totalScore.toFixed(2)}
                    </div>
                    <div className="text-[11px]" style={{ color: band.color }}>
                      {band.label}
                    </div>
                  </div>
                </div>

                {t.descriptors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {t.descriptors.map((d) => {
                      const node = flavorNodeMap.get(d);
                      return (
                        <span
                          key={d}
                          className="px-2 py-0.5 rounded-full text-xs"
                          style={{
                            background: (node?.color ?? "#888") + "22",
                            color: node?.color ?? "var(--muted)",
                          }}
                        >
                          {node?.name ?? d}
                        </span>
                      );
                    })}
                  </div>
                )}

                {t.notes.trim() && (
                  <div className="mt-3 border-t border-border pt-3">
                    <MarkdownView>{t.notes}</MarkdownView>
                  </div>
                )}

                <div className="mt-3">
                  <button
                    onClick={() => deleteTasting(t.id)}
                    className="text-xs text-red-600 hover:bg-red-500/10 px-2 py-1 rounded-md"
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="lg:sticky lg:top-6">
          <CuppingForm onSaved={() => {}} />
        </div>
      </div>
    </div>
  );
}
