"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getOrigin, regions } from "@/lib/reference";
import { OFF_SEASON, STAGE_META, regionStatus, type StageMeta } from "@/lib/season";
import type { Stage } from "@/lib/types";

// Buyer-facing ordering: what's shipping / being made first.
const PANEL_ORDER: Stage[] = [
  "export",
  "harvest_main",
  "drying",
  "harvest_fly",
  "flowering",
  "cherry_development",
];

export function InSeasonPanel({ month }: { month: number }) {
  const groups = useMemo(() => {
    const byStage = new Map<Stage | "off", { name: string; originId: string; id: string }[]>();
    for (const r of regions) {
      const st = regionStatus(r, month);
      const key = (st.stage ?? "off") as Stage | "off";
      const list = byStage.get(key) ?? [];
      list.push({ name: r.name, originId: r.originId, id: r.id });
      byStage.set(key, list);
    }
    return byStage;
  }, [month]);

  const orderedKeys: (Stage | "off")[] = [...PANEL_ORDER, "off"];

  return (
    <div className="space-y-4">
      {orderedKeys.map((key) => {
        const list = groups.get(key);
        if (!list || list.length === 0) return null;
        const meta: StageMeta | typeof OFF_SEASON =
          key === "off" ? OFF_SEASON : STAGE_META[key as Stage];
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: meta.color }}
              />
              <h3 className="text-sm font-semibold">{meta.label}</h3>
              <span className="text-xs text-muted">({list.length})</span>
            </div>
            <p className="text-xs text-muted mb-2">{meta.buyerNote}</p>
            <ul className="flex flex-wrap gap-1.5">
              {list.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/origin/${r.originId}#${r.id}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-2 hover:bg-border text-xs transition-colors"
                  >
                    {r.name}
                    <span className="text-muted">· {getOrigin(r.originId)?.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
