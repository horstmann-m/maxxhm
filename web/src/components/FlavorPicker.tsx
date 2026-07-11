"use client";

import { flavorWheel } from "@/lib/reference";

/** Toggleable flavor-wheel descriptor chips grouped by category. */
export function FlavorPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="space-y-2.5">
      {flavorWheel.map((cat) => (
        <div key={cat.id} className="flex flex-wrap items-center gap-1.5">
          <span
            className="text-xs font-semibold w-24 shrink-0"
            style={{ color: cat.color }}
          >
            {cat.name}
          </span>
          {cat.children.map((child) => {
            const on = selected.includes(child.id);
            return (
              <button
                key={child.id}
                type="button"
                onClick={() => toggle(child.id)}
                className="px-2 py-0.5 rounded-full text-xs border transition-colors"
                style={
                  on
                    ? { background: child.color, borderColor: child.color, color: "#fff" }
                    : { borderColor: "var(--border)" }
                }
              >
                {child.name}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
