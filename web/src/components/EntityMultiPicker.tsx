"use client";

import { allEntityRefs, resolveRef } from "@/lib/reference";
import type { EntityRef, EntityType } from "@/lib/types";

const TYPE_LABEL: Record<EntityType, string> = {
  origin: "Origins",
  region: "Regions",
  varietal: "Varietals",
  process: "Processes",
};

/** Multi-select of knowledge entities, rendered as removable chips + an add box. */
export function EntityMultiPicker({
  value,
  onChange,
}: {
  value: EntityRef[];
  onChange: (next: EntityRef[]) => void;
}) {
  const all = allEntityRefs();
  const grouped: Record<EntityType, typeof all> = {
    origin: [],
    region: [],
    varietal: [],
    process: [],
  };
  for (const e of all) grouped[e.type].push(e);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.length === 0 && (
          <span className="text-xs text-muted">No links yet.</span>
        )}
        {value.map((ref) => {
          const r = resolveRef(ref);
          return (
            <span
              key={ref}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/15 text-xs"
            >
              {r?.label ?? ref}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== ref))}
                className="text-muted hover:text-foreground"
                aria-label={`Remove ${r?.label ?? ref}`}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      <select
        value=""
        onChange={(e) => {
          const ref = e.target.value as EntityRef;
          if (ref && !value.includes(ref)) onChange([...value, ref]);
        }}
        className="w-full text-sm rounded-lg border border-border bg-surface px-2 py-1.5"
      >
        <option value="">+ link an origin, region, varietal…</option>
        {(Object.keys(grouped) as EntityType[]).map((type) => (
          <optgroup key={type} label={TYPE_LABEL[type]}>
            {grouped[type].map((e) => (
              <option key={e.ref} value={e.ref} disabled={value.includes(e.ref)}>
                {e.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
