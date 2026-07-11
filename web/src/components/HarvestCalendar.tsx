"use client";

import Link from "next/link";
import { origins, regionsForOrigin } from "@/lib/reference";
import {
  MONTHS,
  OFF_SEASON,
  STAGE_META,
  activeStages,
  currentMonth,
  regionStatus,
} from "@/lib/season";
import type { Region } from "@/lib/types";

function Cell({ region, month, isNow }: { region: Region; month: number; isNow: boolean }) {
  const status = regionStatus(region, month);
  const active = activeStages(region, month);
  const color = status.meta.color;
  const label =
    active.length > 0
      ? active.map((s) => STAGE_META[s].label).join(", ")
      : OFF_SEASON.label;
  return (
    <td className="p-0">
      <div
        title={`${region.name} · ${MONTHS[month - 1]}: ${label}`}
        className={`h-6 mx-px rounded-sm ${isNow ? "ring-2 ring-offset-0 ring-foreground/40" : ""}`}
        style={{ background: status.stage ? color : "var(--surface-2)" }}
      />
    </td>
  );
}

export function HarvestCalendar() {
  const now = currentMonth();
  return (
    <div className="scroll-x border border-border rounded-xl bg-surface">
      <table className="w-full border-collapse min-w-[720px]">
        <thead>
          <tr className="text-xs text-muted">
            <th className="text-left font-medium px-3 py-2 sticky left-0 bg-surface z-10">
              Region
            </th>
            {MONTHS.map((m, i) => (
              <th
                key={m}
                className={`px-1 py-2 font-medium text-center ${
                  i + 1 === now ? "text-foreground" : ""
                }`}
              >
                {m}
                {i + 1 === now && <div className="text-[10px] text-accent">now</div>}
              </th>
            ))}
          </tr>
        </thead>
        {origins.map((origin) => {
            const rs = regionsForOrigin(origin.id);
            return (
              <tbody key={origin.id}>
                <tr>
                  <td
                    colSpan={13}
                    className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted sticky left-0 bg-surface"
                  >
                    {origin.name}
                  </td>
                </tr>
                {rs.map((region) => (
                  <tr key={region.id} className="hover:bg-surface-2/40">
                    <td className="px-3 py-0.5 text-sm sticky left-0 bg-surface z-10 whitespace-nowrap">
                      <Link
                        href={`/origin/${origin.id}#${region.id}`}
                        className="hover:text-accent hover:underline"
                      >
                        {region.name}
                      </Link>
                    </td>
                    {MONTHS.map((_, i) => (
                      <Cell
                        key={i}
                        region={region}
                        month={i + 1}
                        isNow={i + 1 === now}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            );
          })}
      </table>
    </div>
  );
}
