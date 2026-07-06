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

function ScoreSlider({
  name,
  value,
  onChange,
}: {
  name: keyof CuppingScores;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="text-xs w-28 shrink-0 text-muted">{ATTR_LABELS[name]}</span>
      <input
        type="range"
        min={6}
        max={10}
        step={0.25}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--accent)]"
      />
      <span className="text-sm tabular-nums w-10 text-right font-medium">
        {value.toFixed(2)}
      </span>
    </label>
  );
}

export function CuppingForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [refEntity, setRefEntity] = useState<EntityRef | "">("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState<CuppingScores>(defaultScores);
  const [descriptors, setDescriptors] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const total = useMemo(() => totalScore(scores), [scores]);
  const band = scoreBand(total);
  const refs = allEntityRefs();

  const set = (k: keyof CuppingScores) => (v: number) =>
    setScores((s) => ({ ...s, [k]: v }));

  async function save() {
    await createTasting({
      name: name.trim() || "Untitled tasting",
      refEntity: refEntity || null,
      date,
      scores,
      descriptors,
      notes,
    });
    // reset for the next cup
    setName("");
    setRefEntity("");
    setScores(defaultScores());
    setDescriptors([]);
    setNotes("");
    onSaved();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">New cupping</h2>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums" style={{ color: band.color }}>
            {total.toFixed(2)}
          </div>
          <div className="text-xs" style={{ color: band.color }}>
            {band.label}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="sm:col-span-2">
          <span className="text-xs text-muted">Sample</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Konga washed, 2024 crop"
            className="w-full text-sm rounded-lg border border-border bg-background px-2 py-1.5 mt-1"
          />
        </label>
        <label>
          <span className="text-xs text-muted">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full text-sm rounded-lg border border-border bg-background px-2 py-1.5 mt-1"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-muted">Coffee (origin / region)</span>
        <select
          value={refEntity}
          onChange={(e) => setRefEntity(e.target.value as EntityRef)}
          className="w-full text-sm rounded-lg border border-border bg-background px-2 py-1.5 mt-1"
        >
          <option value="">— not linked —</option>
          {["origin", "region"].map((type) => (
            <optgroup key={type} label={type === "origin" ? "Origins" : "Regions"}>
              {refs
                .filter((r) => r.type === type)
                .map((r) => (
                  <option key={r.ref} value={r.ref}>
                    {r.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        {QUALITY_ATTRS.map((a) => (
          <ScoreSlider key={a} name={a} value={scores[a]} onChange={set(a)} />
        ))}
        {FIXED_ATTRS.map((a) => (
          <ScoreSlider key={a} name={a} value={scores[a]} onChange={set(a)} />
        ))}
      </div>

      <div>
        <span className="text-xs text-muted">Flavour descriptors</span>
        <div className="mt-2">
          <FlavorPicker selected={descriptors} onChange={setDescriptors} />
        </div>
      </div>

      <label className="block">
        <span className="text-xs text-muted">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Impressions, brew method, whether you'd buy it…"
          className="w-full text-sm rounded-lg border border-border bg-background p-2 mt-1 min-h-[80px] resize-y"
        />
      </label>

      <button
        onClick={save}
        className="px-4 py-2 rounded-lg bg-accent text-accent-fg text-sm font-medium hover:opacity-90"
      >
        Save cupping
      </button>
    </div>
  );
}
