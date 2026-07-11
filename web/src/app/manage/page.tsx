"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { getDb } from "@/lib/db";
import {
  flavorNodeMap,
  flavorWheel,
  origins,
  processes,
  regions,
  varietals,
} from "@/lib/reference";
import { MONTHS, STAGE_ORDER } from "@/lib/season";
import {
  addCustomOrigin,
  addCustomRegion,
  deleteCustomOrigin,
  deleteCustomRegion,
} from "@/lib/store";
import type { HarvestWindow, Origin, Region, Stage } from "@/lib/types";

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function num(s: string): number | null {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const input = "w-full text-sm rounded-lg border border-border bg-background px-2 py-1.5";

function ChipMulti({
  options,
  value,
  onChange,
}: {
  options: { id: string; name: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
              on ? "bg-accent text-accent-fg border-accent" : "border-border hover:bg-surface-2"
            }`}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

function Errors({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="text-xs text-red-600 list-disc pl-4 mt-1 space-y-0.5">
      {items.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

function AddOrigin() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [blurb, setBlurb] = useState("");
  const [character, setCharacter] = useState("");
  const [altMin, setAltMin] = useState("");
  const [altMax, setAltMax] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    const id = slug(name);
    const errs: string[] = [];
    if (!name.trim()) errs.push("Name is required.");
    if (id && origins.some((o) => o.id === id)) errs.push(`An origin "${id}" already exists.`);
    if (!/^[A-Za-z]{2}$/.test(code)) errs.push("Country code must be 2 letters (e.g. SV).");
    const mn = num(altMin);
    const mx = num(altMax);
    if (mn == null || mx == null) errs.push("Altitude min and max are required numbers.");
    else if (mn > mx) errs.push("Altitude min must be ≤ max.");
    setErrors(errs);
    if (errs.length) return;
    const origin: Origin = {
      id,
      name: name.trim(),
      code: code.toUpperCase(),
      blurb: blurb.trim() || `${name.trim()} — added by you.`,
      character: character.trim() || "—",
      altitudeMinM: mn!,
      altitudeMaxM: mx!,
      custom: true,
    };
    addCustomOrigin(origin);
    setName(""); setCode(""); setBlurb(""); setCharacter(""); setAltMin(""); setAltMax(""); setErrors([]);
  }

  return (
    <div className="card p-4 space-y-3">
      <h2 className="font-display text-lg font-semibold">Add an origin</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Name"><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="El Salvador" /></Field>
        <Field label="Country code"><input className={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="SV" maxLength={2} /></Field>
        <Field label="Altitude min (m)"><input className={input} type="number" value={altMin} onChange={(e) => setAltMin(e.target.value)} placeholder="1200" /></Field>
        <Field label="Altitude max (m)"><input className={input} type="number" value={altMax} onChange={(e) => setAltMax(e.target.value)} placeholder="1800" /></Field>
        <Field label="Character"><input className={input} value={character} onChange={(e) => setCharacter(e.target.value)} placeholder="Sweet, creamy, cocoa" /></Field>
      </div>
      <Field label="Blurb"><textarea className={input} value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={2} placeholder="One or two sentences about this origin…" /></Field>
      <Errors items={errors} />
      <button onClick={submit} className="btn btn-primary">+ Add origin</button>
    </div>
  );
}

function AddRegion() {
  const [name, setName] = useState("");
  const [originId, setOriginId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [altMin, setAltMin] = useState("");
  const [altMax, setAltMax] = useState("");
  const [vars, setVars] = useState<string[]>([]);
  const [procs, setProcs] = useState<string[]>([]);
  const [nodes, setNodes] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [frost, setFrost] = useState(false);
  const [harvest, setHarvest] = useState<HarvestWindow[]>([]);
  const [hwStage, setHwStage] = useState<Stage>("harvest_main");
  const [hwStart, setHwStart] = useState("1");
  const [hwEnd, setHwEnd] = useState("3");
  const [errors, setErrors] = useState<string[]>([]);

  const flavorOptions = useMemo(
    () => flavorWheel.flatMap((c) => c.children.map((ch) => ({ id: ch.id, name: ch.name }))),
    []
  );

  function addWindow() {
    setHarvest((h) => [...h, { stage: hwStage, start: Number(hwStart), end: Number(hwEnd) }]);
  }

  function submit() {
    const id = slug(name);
    const errs: string[] = [];
    if (!name.trim()) errs.push("Name is required.");
    if (!originId) errs.push("Pick an origin.");
    if (id && regions.some((r) => r.id === id)) errs.push(`A region "${id}" already exists.`);
    const la = num(lat);
    const lo = num(lng);
    if (la == null || la < -90 || la > 90) errs.push("Latitude must be between -90 and 90.");
    if (lo == null || lo < -180 || lo > 180) errs.push("Longitude must be between -180 and 180.");
    const mn = num(altMin);
    const mx = num(altMax);
    if (mn == null || mx == null) errs.push("Altitude min and max are required.");
    else if (mn > mx) errs.push("Altitude min must be ≤ max.");
    for (const n of nodes) if (!flavorNodeMap.has(n)) errs.push(`Unknown flavour node "${n}".`);
    if (harvest.length === 0) errs.push("Add at least one harvest window.");
    setErrors(errs);
    if (errs.length) return;
    const region: Region = {
      id,
      originId,
      name: name.trim(),
      lat: la!,
      lng: lo!,
      altitudeMinM: mn!,
      altitudeMaxM: mx!,
      varietals: vars,
      processes: procs,
      flavorTags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      flavorNodes: nodes,
      frostProne: frost,
      harvest,
      custom: true,
    };
    addCustomRegion(region);
    setName(""); setLat(""); setLng(""); setAltMin(""); setAltMax("");
    setVars([]); setProcs([]); setNodes([]); setTags(""); setFrost(false); setHarvest([]); setErrors([]);
  }

  return (
    <div className="card p-4 space-y-3">
      <h2 className="font-display text-lg font-semibold">Add a region</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Name"><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Apaneca" /></Field>
        <Field label="Origin">
          <select className={input} value={originId} onChange={(e) => setOriginId(e.target.value)}>
            <option value="">— pick —</option>
            {origins.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label="Frost-prone">
          <label className="flex items-center gap-2 text-sm h-9"><input type="checkbox" checked={frost} onChange={(e) => setFrost(e.target.checked)} /> yes</label>
        </Field>
        <Field label="Latitude"><input className={input} type="number" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="13.86" /></Field>
        <Field label="Longitude"><input className={input} type="number" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-89.79" /></Field>
        <Field label="Altitude min–max (m)">
          <div className="flex gap-2">
            <input className={input} type="number" value={altMin} onChange={(e) => setAltMin(e.target.value)} placeholder="1300" />
            <input className={input} type="number" value={altMax} onChange={(e) => setAltMax(e.target.value)} placeholder="1800" />
          </div>
        </Field>
      </div>

      <Field label="Varietals"><ChipMulti options={varietals} value={vars} onChange={setVars} /></Field>
      <Field label="Processes"><ChipMulti options={processes} value={procs} onChange={setProcs} /></Field>
      <Field label="Flavour notes (wheel)"><ChipMulti options={flavorOptions} value={nodes} onChange={setNodes} /></Field>
      <Field label="Flavour tags (free text, comma-separated)"><input className={input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="caramel, red apple, cocoa" /></Field>

      <div>
        <div className="text-xs text-muted mb-1">Harvest windows</div>
        <div className="flex flex-wrap items-end gap-2">
          <select className="text-sm rounded-lg border border-border bg-background px-2 py-1.5" value={hwStage} onChange={(e) => setHwStage(e.target.value as Stage)}>
            {STAGE_ORDER.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <select className="text-sm rounded-lg border border-border bg-background px-2 py-1.5" value={hwStart} onChange={(e) => setHwStart(e.target.value)}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <span className="text-xs text-muted">→</span>
          <select className="text-sm rounded-lg border border-border bg-background px-2 py-1.5" value={hwEnd} onChange={(e) => setHwEnd(e.target.value)}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <button type="button" onClick={addWindow} className="btn btn-ghost">Add window</button>
        </div>
        {harvest.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mt-2">
            {harvest.map((h, i) => (
              <li key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 text-xs">
                {h.stage.replace(/_/g, " ")} {MONTHS[h.start - 1]}–{MONTHS[h.end - 1]}
                <button onClick={() => setHarvest((hs) => hs.filter((_, j) => j !== i))} className="text-muted hover:text-foreground">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Errors items={errors} />
      <button onClick={submit} className="btn btn-primary">+ Add region</button>
    </div>
  );
}

export default function ManagePage() {
  const customOrigins = useLiveQuery(() => getDb().customOrigins.toArray(), []);
  const customRegions = useLiveQuery(() => getDb().customRegions.toArray(), []);

  return (
    <div className="p-4 md:p-8 max-w-[820px] mx-auto space-y-5">
      <PageHeader
        eyebrow="Data"
        title="Manage origins & regions"
        subtitle="Add your own origins and regions from here — no YAML needed. They merge live with the curated data across the map, calendar, recommendations and more. Stored locally in your browser."
      />

      <AddOrigin />
      <AddRegion />

      <div className="card p-4">
        <h2 className="font-display text-lg font-semibold mb-2">Your custom entries</h2>
        {(customOrigins?.length ?? 0) === 0 && (customRegions?.length ?? 0) === 0 && (
          <p className="text-sm text-muted">Nothing custom yet.</p>
        )}
        {(customOrigins?.length ?? 0) > 0 && (
          <div className="mb-3">
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Origins</div>
            <ul className="space-y-1">
              {customOrigins?.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <span>{o.name} <span className="text-muted">({o.code})</span></span>
                  <button onClick={() => deleteCustomOrigin(o.id)} className="text-xs text-muted hover:text-red-600">Remove (+ its regions)</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(customRegions?.length ?? 0) > 0 && (
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Regions</div>
            <ul className="space-y-1">
              {customRegions?.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span>{r.name} <span className="text-muted">· {r.originId}</span></span>
                  <button onClick={() => deleteCustomRegion(r.id)} className="text-xs text-muted hover:text-red-600">Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
