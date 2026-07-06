"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getDb } from "@/lib/db";
import {
  getOrigin,
  origins,
  processes,
  regions,
  varietals,
} from "@/lib/reference";

interface Hit {
  label: string;
  sub: string;
  href: string | null;
  kind: string;
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const notes = useLiveQuery(() => getDb().notes.toArray(), []);
  const tastings = useLiveQuery(() => getDb().tastings.toArray(), []);

  const query = q.trim().toLowerCase();

  const hits = useMemo<Hit[]>(() => {
    if (!query) return [];
    const has = (...xs: (string | undefined)[]) =>
      xs.some((x) => x?.toLowerCase().includes(query));
    const out: Hit[] = [];

    for (const o of origins) {
      if (has(o.name, o.blurb, o.character))
        out.push({ label: o.name, sub: o.character, href: `/origin/${o.id}`, kind: "Origin" });
    }
    for (const r of regions) {
      if (has(r.name, ...r.flavorTags, ...r.varietals))
        out.push({
          label: r.name,
          sub: `${getOrigin(r.originId)?.name} · ${r.flavorTags.slice(0, 3).join(", ")}`,
          href: `/origin/${r.originId}#${r.id}`,
          kind: "Region",
        });
    }
    for (const v of varietals) {
      if (has(v.name, v.notes, v.lineage ?? undefined))
        out.push({ label: v.name, sub: v.notes, href: null, kind: "Varietal" });
    }
    for (const p of processes) {
      if (has(p.name, p.description))
        out.push({ label: p.name, sub: p.description, href: null, kind: "Process" });
    }
    for (const n of notes ?? []) {
      if (has(n.title, n.body, ...n.tags))
        out.push({
          label: n.title || "Untitled",
          sub: n.tags.map((t) => `#${t}`).join(" ") || "note",
          href: `/notes#${n.id}`,
          kind: "Note",
        });
    }
    for (const t of tastings ?? []) {
      if (has(t.name, t.notes, ...t.descriptors))
        out.push({
          label: t.name,
          sub: `${t.date} · ${t.totalScore.toFixed(2)}`,
          href: `/tastings#${t.id}`,
          kind: "Tasting",
        });
    }
    return out;
  }, [query, notes, tastings]);

  return (
    <div className="p-4 md:p-8 max-w-[800px] mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Search</h1>
        <p className="text-muted mt-1">
          Across the knowledge base and your own notes and tastings.
        </p>
      </header>

      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Try “natural”, “blackcurrant”, “Geisha”, a supplier tag…"
        className="w-full text-base rounded-xl border border-border bg-surface px-4 py-3 mb-5"
      />

      {query && (
        <p className="text-xs text-muted mb-3">
          {hits.length} result{hits.length !== 1 && "s"}
        </p>
      )}

      <ul className="space-y-2">
        {hits.map((h, i) => {
          const inner = (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-muted border border-border rounded px-1.5 py-0.5">
                  {h.kind}
                </span>
                <span className="font-medium">{h.label}</span>
              </div>
              <p className="text-xs text-muted mt-0.5 line-clamp-1">{h.sub}</p>
            </>
          );
          return (
            <li key={i}>
              {h.href ? (
                <Link
                  href={h.href}
                  className="block rounded-xl border border-border bg-surface px-4 py-3 hover:bg-surface-2 transition-colors"
                >
                  {inner}
                </Link>
              ) : (
                <div className="rounded-xl border border-border bg-surface px-4 py-3">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
