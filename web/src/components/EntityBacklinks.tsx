"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { scoreBand } from "@/lib/scoring";

/** Notes + tastings the user has linked to any of these entity refs. */
export function EntityBacklinks({ refs }: { refs: string[] }) {
  const notes = useLiveQuery(
    () => getDb().notes.where("links").anyOf(refs).reverse().sortBy("updatedAt"),
    [refs.join(",")]
  );
  const tastings = useLiveQuery(
    () => getDb().tastings.where("refEntity").anyOf(refs).reverse().sortBy("createdAt"),
    [refs.join(",")]
  );

  const hasNotes = notes && notes.length > 0;
  const hasTastings = tastings && tastings.length > 0;

  if (!hasNotes && !hasTastings) {
    return (
      <p className="text-sm text-muted">
        No notes or tastings yet. Add one from the{" "}
        <Link href="/notes" className="text-accent hover:underline">
          Notes
        </Link>{" "}
        or{" "}
        <Link href="/tastings" className="text-accent hover:underline">
          Tastings
        </Link>{" "}
        page and link it here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {hasTastings && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Tastings ({tastings!.length})
          </h4>
          <ul className="space-y-2">
            {tastings!.map((t) => {
              const band = scoreBand(t.totalScore);
              return (
                <li key={t.id}>
                  <Link
                    href={`/tastings#${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 hover:bg-surface-2 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-medium truncate">{t.name}</span>
                      <span className="block text-xs text-muted">{t.date}</span>
                    </span>
                    <span
                      className="text-sm font-semibold tabular-nums shrink-0"
                      style={{ color: band.color }}
                    >
                      {t.totalScore.toFixed(2)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {hasNotes && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Notes ({notes!.length})
          </h4>
          <ul className="space-y-2">
            {notes!.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notes#${n.id}`}
                  className="block rounded-lg border border-border bg-surface px-3 py-2 hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium">{n.title || "Untitled"}</span>
                  {n.tags.length > 0 && (
                    <span className="block text-xs text-muted mt-0.5">
                      {n.tags.map((t) => `#${t}`).join(" ")}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
