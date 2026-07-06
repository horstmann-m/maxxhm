"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { getDb } from "@/lib/db";
import { flavorWheel } from "@/lib/reference";
import { deriveAffinitiesFromTastings, setAffinity } from "@/lib/store";

const LEVELS = [
  { w: -2, label: "✕", title: "Dislike" },
  { w: 0, label: "·", title: "Neutral" },
  { w: 1, label: "＋", title: "Like" },
  { w: 2, label: "＋＋", title: "Love" },
];

function NodeControl({
  id,
  name,
  color,
  value,
}: {
  id: string;
  name: string;
  color: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1" data-testid={`pref-${id}`}>
      <span className="text-sm" style={{ color: value > 0 ? color : undefined }}>
        {name}
      </span>
      <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
        {LEVELS.map((l) => {
          const active = value === l.w || (l.w === 0 && value === 0);
          return (
            <button
              key={l.w}
              title={l.title}
              onClick={() => setAffinity(id, l.w)}
              className={`px-2 py-1 text-xs w-9 transition-colors ${
                active ? "bg-accent text-accent-fg" : "hover:bg-surface-2"
              }`}
            >
              {l.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PreferencesPage() {
  const prefs = useLiveQuery(() => getDb().preferences.get("me"), []);
  const affinities = prefs?.affinities ?? {};
  const setCount = Object.keys(affinities).length;
  const [learned, setLearned] = useState<number | null>(null);

  return (
    <div className="p-4 md:p-8 max-w-[820px] mx-auto">
      <Link href="/recommend" className="text-sm text-muted hover:text-accent">
        ← Buy now
      </Link>
      <PageHeader
        className="mt-3"
        eyebrow="Your palate"
        title="Taste preferences"
        subtitle={
          <>
            Rate flavour notes to teach the buy recommendations what you love. {setCount} note
            {setCount !== 1 && "s"} rated.
          </>
        }
      />

      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={async () => setLearned(await deriveAffinitiesFromTastings())}
          className="btn btn-primary"
        >
          Learn from my tastings
        </button>
        {learned !== null && (
          <span className="text-sm text-muted">
            {learned === 0
              ? "No tasting descriptors yet — log a cupping first."
              : `Seeded ${learned} note${learned !== 1 ? "s" : ""} from your tastings.`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {flavorWheel.map((cat) => (
          <section key={cat.id}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: cat.color }}>
              {cat.name}
            </h2>
            <div className="divide-y divide-border">
              {cat.children.map((child) => (
                <NodeControl
                  key={child.id}
                  id={child.id}
                  name={child.name}
                  color={child.color}
                  value={affinities[child.id] ?? 0}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
