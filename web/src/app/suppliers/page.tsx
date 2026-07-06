"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { getDb } from "@/lib/db";
import { allEntityRefs, resolveRef } from "@/lib/reference";
import {
  createSample,
  createSupplier,
  deleteSample,
  deleteSupplier,
  updateSample,
} from "@/lib/store";
import { SAMPLE_STATUSES, supplierBand, supplierScore } from "@/lib/suppliers";
import type { Sample, Supplier, SupplierType } from "@/lib/types";

const TYPES: SupplierType[] = ["exporter", "importer", "producer", "other"];
const statusMeta = (s: Sample["status"]) => SAMPLE_STATUSES.find((x) => x.value === s)!;

function AddSupplier() {
  const [name, setName] = useState("");
  const [type, setType] = useState<SupplierType>("exporter");
  const [country, setCountry] = useState("");
  return (
    <div className="card p-4 flex flex-wrap items-end gap-2">
      <label className="text-xs text-muted">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cafe Imports"
          className="block mt-1 text-sm rounded-lg border border-border bg-background px-2 py-1.5" />
      </label>
      <label className="text-xs text-muted">
        Type
        <select value={type} onChange={(e) => setType(e.target.value as SupplierType)}
          className="block mt-1 text-sm rounded-lg border border-border bg-background px-2 py-1.5 capitalize">
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted">
        Country
        <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="optional"
          className="block mt-1 w-28 text-sm rounded-lg border border-border bg-background px-2 py-1.5" />
      </label>
      <button
        onClick={() => {
          if (!name.trim()) return;
          createSupplier({ name: name.trim(), type, country: country.trim() || undefined });
          setName(""); setCountry("");
        }}
        className="btn btn-primary"
      >
        + Add supplier
      </button>
    </div>
  );
}

function AddSample({ supplierId }: { supplierId: string }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Sample["status"]>("requested");
  const [cup, setCup] = useState("");
  const [price, setPrice] = useState("");
  const [ref, setRef] = useState("");
  const refs = allEntityRefs().filter((r) => r.type === "origin" || r.type === "region");
  return (
    <div className="flex flex-wrap items-end gap-2 mt-2 border-t border-border pt-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lot / offer name"
        className="text-sm rounded-lg border border-border bg-background px-2 py-1.5 min-w-40" />
      <select value={status} onChange={(e) => setStatus(e.target.value as Sample["status"])}
        className="text-sm rounded-lg border border-border bg-background px-2 py-1.5">
        {SAMPLE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <input type="number" value={cup} onChange={(e) => setCup(e.target.value)} placeholder="cup"
        className="w-16 text-sm rounded-lg border border-border bg-background px-2 py-1.5" />
      <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="¢/lb"
        className="w-20 text-sm rounded-lg border border-border bg-background px-2 py-1.5" />
      <select value={ref} onChange={(e) => setRef(e.target.value)}
        className="text-sm rounded-lg border border-border bg-background px-2 py-1.5 max-w-40">
        <option value="">— origin —</option>
        {refs.map((r) => <option key={r.ref} value={r.ref}>{r.label}</option>)}
      </select>
      <button
        onClick={() => {
          if (!name.trim()) return;
          createSample({
            supplierId, name: name.trim(), status,
            date: new Date().toISOString().slice(0, 10),
            cupScore: cup ? Number(cup) : undefined,
            priceUscLb: price ? Number(price) : undefined,
            originRef: ref || null,
          });
          setName(""); setCup(""); setPrice(""); setRef("");
        }}
        className="btn btn-ghost"
      >
        + Sample
      </button>
    </div>
  );
}

function SupplierCard({ supplier, samples }: { supplier: Supplier; samples: Sample[] }) {
  const [open, setOpen] = useState(false);
  const sc = supplierScore(samples);
  const band = supplierBand(sc.score);
  return (
    <li className="card p-4">
      <div className="flex items-start gap-4">
        <div className="text-center shrink-0 w-14">
          <div className="text-2xl font-bold tabular-nums" style={{ color: band.color }}>{sc.score}</div>
          <div className="text-[10px] font-medium" style={{ color: band.color }}>{band.label}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-semibold">{supplier.name}</span>
              <span className="text-muted text-sm capitalize"> · {supplier.type}{supplier.country ? ` · ${supplier.country}` : ""}</span>
            </div>
            <button onClick={() => deleteSupplier(supplier.id)} className="text-xs text-muted hover:text-red-600">Remove</button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted mt-1">
            <span>{sc.count} sample{sc.count !== 1 && "s"}</span>
            <span>Approval {sc.approvalRate != null ? `${Math.round(sc.approvalRate * 100)}%` : "—"} ({sc.approved}/{sc.decided})</span>
            <span>Avg cup {sc.avgCupScore ?? "—"}</span>
          </div>
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-accent hover:underline mt-2">
            {open ? "Hide" : "Show"} samples
          </button>

          {open && (
            <div className="mt-2">
              <ul className="space-y-1.5">
                {samples.length === 0 && <li className="text-xs text-muted">No samples yet.</li>}
                {samples
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((s) => {
                    const m = statusMeta(s.status);
                    const ref = s.originRef ? resolveRef(s.originRef) : null;
                    return (
                      <li key={s.id} className="flex items-center gap-2 text-sm">
                        <select
                          value={s.status}
                          onChange={(e) => updateSample(s.id, { status: e.target.value as Sample["status"] })}
                          className="text-xs rounded-md border px-1.5 py-1 bg-background"
                          style={{ borderColor: m.color + "88", color: m.color }}
                        >
                          {SAMPLE_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <span className="min-w-0 truncate">{s.name}</span>
                        {ref && <span className="text-xs text-muted">· {ref.label}</span>}
                        {s.cupScore != null && <span className="text-xs text-muted">· {s.cupScore}</span>}
                        {s.priceUscLb != null && <span className="text-xs text-muted">· {s.priceUscLb}¢</span>}
                        <button onClick={() => deleteSample(s.id)} className="ml-auto text-xs text-muted hover:text-red-600">×</button>
                      </li>
                    );
                  })}
              </ul>
              <AddSample supplierId={supplier.id} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default function SuppliersPage() {
  const suppliers = useLiveQuery(() => getDb().suppliers.orderBy("createdAt").reverse().toArray(), []);
  const samples = useLiveQuery(() => getDb().samples.toArray(), []);

  const bySupplier = useMemo(() => {
    const m = new Map<string, Sample[]>();
    for (const s of samples ?? []) {
      const list = m.get(s.supplierId) ?? [];
      list.push(s);
      m.set(s.supplierId, list);
    }
    return m;
  }, [samples]);

  return (
    <div className="p-4 md:p-8 max-w-[820px] mx-auto">
      <PageHeader
        eyebrow="Relationships"
        title="Supplier scorecard"
        subtitle="Track exporters and importers by the samples they send you. Each supplier is scored on approval rate, cup quality, and how established the relationship is."
      />

      <div className="mb-5">
        <AddSupplier />
      </div>

      <ul className="space-y-2">
        {suppliers && suppliers.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
            No suppliers yet — add your first above, then log the samples they send.
          </li>
        )}
        {suppliers?.map((s) => (
          <SupplierCard key={s.id} supplier={s} samples={bySupplier.get(s.id) ?? []} />
        ))}
      </ul>
    </div>
  );
}
