// Loaders + lookups for the curated reference data. The small datasets are
// imported directly (bundled, typed, synchronous — no loading states); the big
// world outline is fetched on demand inside the map component.

import originsJson from "../../public/data/origins.json";
import regionsJson from "../../public/data/regions.json";
import varietalsJson from "../../public/data/varietals.json";
import processesJson from "../../public/data/processes.json";
import phenologyJson from "../../public/data/phenology.json";
import flavorWheelJson from "../../public/data/flavor_wheel.json";
import type {
  ClimateBand,
  EntityRef,
  EntityType,
  FlavorNode,
  Origin,
  Process,
  Region,
  Varietal,
} from "./types";

const BASE_ORIGINS = originsJson as Origin[];
const BASE_REGIONS = regionsJson as Region[];
export const varietals = varietalsJson as Varietal[];
export const processes = processesJson as Process[];
export const phenology = phenologyJson as ClimateBand[];
export const flavorWheel = flavorWheelJson as FlavorNode[];

// origins/regions are live bindings: curated base merged with the user's custom
// entries (added via the in-app editor). applyCustomData() rebuilds them; a remount
// keyed on its version (see DataGate) makes consumers pick up changes — no refactor.
export let origins: Origin[] = [...BASE_ORIGINS];
export let regions: Region[] = [...BASE_REGIONS];
let originById = new Map(origins.map((o) => [o.id, o]));
let regionById = new Map(regions.map((r) => [r.id, r]));
const varietalById = new Map(varietals.map((v) => [v.id, v]));
const processById = new Map(processes.map((p) => [p.id, p]));

/** Rebuild origins/regions = curated base + custom. Returns a version signature
 *  that changes only when the custom set changes. */
export function applyCustomData(customOrigins: Origin[], customRegions: Region[]): string {
  origins = [...BASE_ORIGINS, ...customOrigins.map((o) => ({ ...o, custom: true }))];
  regions = [...BASE_REGIONS, ...customRegions.map((r) => ({ ...r, custom: true }))];
  originById = new Map(origins.map((o) => [o.id, o]));
  regionById = new Map(regions.map((r) => [r.id, r]));
  return `${customOrigins.map((o) => o.id).join(",")}|${customRegions.map((r) => r.id).join(",")}`;
}

export const getOrigin = (id: string) => originById.get(id);
export const getRegion = (id: string) => regionById.get(id);
export const getVarietal = (id: string) => varietalById.get(id);
export const getProcess = (id: string) => processById.get(id);

export const regionsForOrigin = (originId: string) =>
  regions.filter((r) => r.originId === originId);

// Flat map of flavor-node id -> {name, color} across both wheel levels.
export const flavorNodeMap: Map<string, { name: string; color: string }> = (() => {
  const m = new Map<string, { name: string; color: string }>();
  for (const cat of flavorWheel) {
    m.set(cat.id, { name: cat.name, color: cat.color });
    for (const child of cat.children) m.set(child.id, { name: child.name, color: child.color });
  }
  return m;
})();

// ---- entity-ref helpers (shared with notes/tastings/watchlist) --------------

export const makeRef = (type: EntityType, id: string): EntityRef => `${type}:${id}`;

export function parseRef(ref: EntityRef): { type: EntityType; id: string } {
  const [type, id] = ref.split(":");
  return { type: type as EntityType, id };
}

/** Human-readable label + href for any entity ref (or null if unknown). */
export function resolveRef(
  ref: EntityRef
): { type: EntityType; id: string; label: string; href: string | null } | null {
  const { type, id } = parseRef(ref);
  switch (type) {
    case "origin": {
      const o = getOrigin(id);
      return o ? { type, id, label: o.name, href: `/origin/${id}` } : null;
    }
    case "region": {
      const r = getRegion(id);
      return r
        ? { type, id, label: r.name, href: `/origin/${r.originId}#${id}` }
        : null;
    }
    case "varietal": {
      const v = getVarietal(id);
      return v ? { type, id, label: v.name, href: null } : null;
    }
    case "process": {
      const p = getProcess(id);
      return p ? { type, id, label: p.name, href: null } : null;
    }
    default:
      return null;
  }
}

// Every ref that can be attached to a note/tasting (for pickers + search).
export function allEntityRefs(): {
  ref: EntityRef;
  label: string;
  type: EntityType;
}[] {
  return [
    ...origins.map((o) => ({ ref: makeRef("origin", o.id), label: o.name, type: "origin" as const })),
    ...regions.map((r) => ({ ref: makeRef("region", r.id), label: r.name, type: "region" as const })),
    ...varietals.map((v) => ({ ref: makeRef("varietal", v.id), label: v.name, type: "varietal" as const })),
    ...processes.map((p) => ({ ref: makeRef("process", p.id), label: p.name, type: "process" as const })),
  ];
}
