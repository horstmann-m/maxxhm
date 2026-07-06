"use client";

import { useMemo, useState } from "react";
import { FlavorPicker } from "@/components/FlavorPicker";
import { allEntityRefs } from "@/lib/reference";
import { createTasting } from "@/lib/store";
import {
  ATTR_LABELS,
  FIXED_ATTRS,
  QUALITY_ATTRS,
  defaultScores,
  scoreBand,
  totalScore,
} from "@/lib/scoring";
import type { CuppingScores, EntityRef } from "@/lib/types";

// 6–10 quality slider, one per full-width row (no cramped 2-col grid).
function QualityRow({
  name,
  value,
  onChange,
}: {
  name: keyof CuppingScores;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-32 shrink-0">{ATTR_LABELS[name]}</span>
      <input
        type="range"
        min={6}
        max={10}
        step={0.25}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-w-0 accent-[var(--accent)]"
      />
      <span className="text-sm tabular-nums w-12 text-right font-medium">{value.toFixed(2)}</span>
    </div>
  );
}

// Per-cup attribute: 5 cups, each worth 2 points (SCA uniformity/clean cup/sweetness).
function CupRow({
  name,
  value,
  onChange,
}: {
  name: keyof CuppingScores;
  value: number;
  onChange: (v: number) => void;
}) {
  const cups = Math.round(value / 2);
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-32 shrink-0">{ATTR_LABELS[name]}</span>
      <div className="flex-1 flex gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => {
          const on = i < cups;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${ATTR_LABELS[name]} cup ${i + 1}`}
              onClick={() => onChange((i + 1 === cups ? i : i + 1) * 2)}
              className="w-6 h-6 rounded-md border transition-colors"
              style={on ? { background: "var(--accent)", borderColor: "var(--accent)" } : { borderColor: "var(--border)" }}
            />
          );
        })}
      </div>
      <span className="text-sm tabular-nums w-12 text-right font-medium">{value.toFixed(0)}</span>
    </div>
  );
}

export function CuppingForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [refEntity, setRefEntity] = useState<EntityRef | "">("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState<CuppingScores>(defaultScores);
  const [taints, setTaints] = useState(0);
  const [faults, setFaults] = useState(0);
  const [descriptors, setDescriptors] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defects = taints * 2 + faults * 4;
  const total = useMemo(() => totalScore(scores) - defects, [scores, defects]);
  const band = scoreBand(total);
  const refs = allEntityRefs();

  const set = (k: keyof CuppingScores) => (v: number) => setScores((s) => ({ ...s, [k]: v }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await createTasting({
        name: name.trim() || "Untitled tasting",
        refEntity: refEntity || null,
        date,
        scores,
        defects,
        descriptors,
        notes,
      });
      setName(""); setRefEntity(""); setScores(defaultScores());
      setTaints(0); setFaults(0); setDescriptors([]); setNotes("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display text-xl font-semibold">New cupping</h2>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums leading-none" style={{ color: band.color }}>
            {total.toFixed(2)}
          </div>
          <div className="text-xs mt-1" style={{ color: band.color }}>{band.label}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="sm:col-span-2 block">
          <span className="text-xs text-muted">Sample</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Konga washed, 2024 crop"
            className="w-full text-sm rounded-lg border border-border bg-background px-2 py-1.5 mt-1" />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full text-sm rounded-lg border border-border bg-background px-2 py-1.5 mt-1" />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-muted">Coffee (origin / region)</span>
        <select value={refEntity} onChange={(e) => setRefEntity(e.target.value as EntityRef)}
          className="w-full text-sm rounded-lg border border-border bg-background px-2 py-1.5 mt-1">
          <option value="">— not linked —</option>
          {(["origin", "region"] as const).map((type) => (
            <optgroup key={type} label={type === "origin" ? "Origins" : "Regions"}>
              {refs.filter((r) => r.type === type).map((r) => (
                <option key={r.ref} value={r.ref}>{r.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="space-y-2.5">
        <div className="text-xs text-muted uppercase tracking-wide">Quality (6–10)</div>
        {QUALITY_ATTRS.map((a) => (
          <QualityRow key={a} name={a} value={scores[a]} onChange={set(a)} />
        ))}
      </div>

      <div className="space-y-2.5">
        <div className="text-xs text-muted uppercase tracking-wide">Per cup (2 pts each, 5 cups)</div>
        {FIXED_ATTRS.map((a) => (
          <CupRow key={a} name={a} value={scores[a]} onChange={set(a)} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="text-xs text-muted uppercase tracking-wide">Defects −</div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Taints ×2</span>
          <input type="number" min={0} value={taints} onChange={(e) => setTaints(Math.max(0, Number(e.target.value)))}
            className="w-16 text-sm rounded-lg border border-border bg-background px-2 py-1" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Faults ×4</span>
          <input type="number" min={0} value={faults} onChange={(e) => setFaults(Math.max(0, Number(e.target.value)))}
            className="w-16 text-sm rounded-lg border border-border bg-background px-2 py-1" />
        </label>
        {defects > 0 && <span className="text-sm text-red-600">−{defects}</span>}
      </div>

      <div>
        <span className="text-xs text-muted uppercase tracking-wide">Flavour descriptors</span>
        <div className="mt-2">
          <FlavorPicker selected={descriptors} onChange={setDescriptors} />
        </div>
      </div>

      <label className="block">
        <span className="text-xs text-muted">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Impressions, brew method, whether you'd buy it…"
          className="w-full text-sm rounded-lg border border-border bg-background p-2 mt-1 min-h-[80px] resize-y" />
      </label>

      {error && <p className="text-sm text-red-600">Couldn&apos;t save: {error}</p>}
      <button onClick={save} disabled={saving} className="btn btn-primary disabled:opacity-60">
        {saving ? "Saving…" : "Save cupping"}
      </button>
    </div>
  );
}
