"use client";

import { WatchButton } from "@/components/WatchButton";
import { getProcess, getVarietal } from "@/lib/reference";
import {
  MONTHS,
  OFF_SEASON,
  STAGE_META,
  activeStages,
  currentMonth,
  regionStatus,
} from "@/lib/season";
import type { Region } from "@/lib/types";

function Chip({ label, title }: { label: string; title?: string }) {
  return (
    <span
      title={title}
      className="inline-block px-2 py-0.5 rounded-md bg-surface-2 text-xs cursor-default"
    >
      {label}
    </span>
  );
}

function MiniHarvest({ region }: { region: Region }) {
  const now = currentMonth();
  return (
    <div>
      <div className="flex gap-px">
        {MONTHS.map((m, i) => {
          const month = i + 1;
          const st = regionStatus(region, month);
          const active = activeStages(region, month);
          const label =
            active.length > 0
              ? active.map((s) => STAGE_META[s].label).join(", ")
              : OFF_SEASON.label;
          return (
            <div key={m} className="flex-1 min-w-0">
              <div
                title={`${m}: ${label}`}
                className={`h-5 rounded-sm ${
                  month === now ? "ring-2 ring-foreground/40" : ""
                }`}
                style={{ background: st.stage ? st.meta.color : "var(--surface-2)" }}
              />
              <div className="text-[9px] text-muted text-center mt-0.5">{m[0]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RegionCard({ region }: { region: Region }) {
  const now = currentMonth();
  const status = regionStatus(region, now);
  return (
    <section
      id={region.id}
      className="scroll-mt-20 rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-semibold">{region.name}</h3>
          <p className="text-xs text-muted">
            {region.altitudeMinM.toLocaleString()}–
            {region.altitudeMaxM.toLocaleString()} m · {region.lat.toFixed(2)},{" "}
            {region.lng.toFixed(2)}
          </p>
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: status.meta.color + "22", color: status.meta.color }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: status.meta.color }}
          />
          {status.meta.short}
        </span>
      </div>

      <p className="text-xs text-muted mb-3">{status.meta.buyerNote}</p>

      <MiniHarvest region={region} />

      <div className="mt-4 space-y-2.5">
        <Field label="Varietals">
          {region.varietals.map((id) => {
            const v = getVarietal(id);
            return <Chip key={id} label={v?.name ?? id} title={v?.notes} />;
          })}
        </Field>
        <Field label="Processes">
          {region.processes.map((id) => {
            const p = getProcess(id);
            return <Chip key={id} label={p?.name ?? id} title={p?.description} />;
          })}
        </Field>
        <Field label="Flavour">
          {region.flavorTags.map((t) => (
            <Chip key={t} label={t} />
          ))}
        </Field>
      </div>

      <div className="mt-4">
        <WatchButton entityType="region" entityId={region.id} />
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-xs text-muted w-16 shrink-0 pt-0.5">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
