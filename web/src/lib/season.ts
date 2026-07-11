// Seasonality logic: turn a region's harvest windows + today's date into the
// active stages and a single "headline" status that drives the map colours and
// the harvest calendar. This is the heart of the "what's ready now" view.

import type { HarvestWindow, Region, Stage } from "./types";

export const STAGE_ORDER: Stage[] = [
  "flowering",
  "cherry_development",
  "harvest_main",
  "harvest_fly",
  "drying",
  "export",
];

export interface StageMeta {
  label: string;
  short: string;
  color: string;
  buyerNote: string;
}

export const STAGE_META: Record<Stage, StageMeta> = {
  flowering: {
    label: "Flowering",
    short: "Flowering",
    color: "#e46aa7",
    buyerNote: "Next crop is setting — quality is being decided now.",
  },
  cherry_development: {
    label: "Cherry development",
    short: "Developing",
    color: "#4a9d5b",
    buyerNote: "Cherries are filling out; still months from harvest.",
  },
  harvest_main: {
    label: "Main harvest",
    short: "Harvesting",
    color: "#e0533a",
    buyerNote: "Being picked now — fresh crop forms in the coming weeks.",
  },
  harvest_fly: {
    label: "Fly crop",
    short: "Fly crop",
    color: "#e0843a",
    buyerNote: "Secondary harvest underway.",
  },
  drying: {
    label: "Drying",
    short: "Drying",
    color: "#d9b326",
    buyerNote: "On the beds/patios — weather now shapes the final cup.",
  },
  export: {
    label: "Export / arriving",
    short: "Arriving",
    color: "#3f7fd0",
    buyerNote: "Fresh crop is milled and shipping — buying window is open.",
  },
};

export const OFF_SEASON = {
  label: "Off-season",
  short: "Off-season",
  color: "#8a8f98",
  buyerNote: "Between stages — last crop resting, next not yet set.",
};

/** Is `month` (1-12) inside a wrap-aware window? */
export function monthInWindow(month: number, w: HarvestWindow): boolean {
  if (w.start <= w.end) return month >= w.start && month <= w.end;
  return month >= w.start || month <= w.end; // wraps year boundary
}

/** Active stages for a region in a given month, in canonical stage order. */
export function activeStages(region: Region, month: number): Stage[] {
  const active = new Set<Stage>();
  for (const w of region.harvest) {
    if (monthInWindow(month, w)) active.add(w.stage);
  }
  return STAGE_ORDER.filter((s) => active.has(s));
}

// Which active stage a buyer most cares about seeing on the map, in priority
// order: what's shipping > what's being made > what's growing.
const HEADLINE_PRIORITY: Stage[] = [
  "export",
  "harvest_main",
  "drying",
  "harvest_fly",
  "flowering",
  "cherry_development",
];

export interface RegionStatus {
  stage: Stage | null; // null => off-season
  active: Stage[];
  meta: StageMeta | typeof OFF_SEASON;
}

export function regionStatus(region: Region, month: number): RegionStatus {
  const active = activeStages(region, month);
  const headline = HEADLINE_PRIORITY.find((s) => active.includes(s)) ?? null;
  return {
    stage: headline,
    active,
    meta: headline ? STAGE_META[headline] : OFF_SEASON,
  };
}

/**
 * Aggregate status for a whole origin: the highest-priority stage active across
 * any of its regions this month. Lets the world map show one marker per origin
 * without piling overlapping region dots on the same pixel.
 */
export function originStatus(regions: Region[], month: number): RegionStatus {
  const active = new Set<Stage>();
  for (const r of regions) for (const s of activeStages(r, month)) active.add(s);
  const headline = HEADLINE_PRIORITY.find((s) => active.has(s)) ?? null;
  return {
    stage: headline,
    active: STAGE_ORDER.filter((s) => active.has(s)),
    meta: headline ? STAGE_META[headline] : OFF_SEASON,
  };
}

/** Area-weighted-free centroid (simple mean) of an origin's region coordinates. */
export function originCentroid(regions: Region[]): { lat: number; lng: number } {
  const n = regions.length || 1;
  return {
    lat: regions.reduce((a, r) => a + r.lat, 0) / n,
    lng: regions.reduce((a, r) => a + r.lng, 0) / n,
  };
}

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** 1-12 for a Date (defaults to now). */
export const currentMonth = (d = new Date()): number => d.getMonth() + 1;
