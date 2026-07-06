import { OFF_SEASON, STAGE_META, STAGE_ORDER } from "@/lib/season";

export function SeasonLegend({ className = "" }: { className?: string }) {
  const items = [
    ...STAGE_ORDER.map((s) => ({ color: STAGE_META[s].color, label: STAGE_META[s].short })),
    { color: OFF_SEASON.color, label: OFF_SEASON.short },
  ];
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 text-xs ${className}`}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full border border-black/10"
            style={{ background: i.color }}
          />
          <span className="text-muted">{i.label}</span>
        </span>
      ))}
    </div>
  );
}
