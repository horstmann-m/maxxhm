"use client";

import { MONTHS, currentMonth } from "@/lib/season";

export function MonthScrubber({
  month,
  onChange,
}: {
  month: number;
  onChange: (m: number) => void;
}) {
  const now = currentMonth();
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {MONTHS.map((label, i) => {
        const m = i + 1;
        const active = m === month;
        const isNow = m === now;
        return (
          <button
            key={label}
            onClick={() => onChange(m)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
              active
                ? "bg-accent text-accent-fg border-accent"
                : "border-border hover:bg-surface-2 text-foreground"
            }`}
            title={isNow ? `${label} (this month)` : label}
          >
            {label}
            {isNow && <span className="ml-1 opacity-70">•</span>}
          </button>
        );
      })}
    </div>
  );
}
