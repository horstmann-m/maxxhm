// Shared types. The reference-data shapes mirror the JSON emitted by the Python
// pipeline (pipeline/build.py); the user-data shapes back the Dexie tables.

export type Stage =
  | "flowering"
  | "cherry_development"
  | "harvest_main"
  | "harvest_fly"
  | "drying"
  | "export";

export interface HarvestWindow {
  stage: Stage;
  start: number; // month 1-12
  end: number; // month 1-12, may wrap (< start)
  note?: string | null;
}

export interface Origin {
  id: string;
  name: string;
  code: string; // ISO 3166-1 alpha-2
  blurb: string;
  altitudeMinM: number;
  altitudeMaxM: number;
  character: string;
}

export interface Region {
  id: string;
  originId: string;
  name: string;
  lat: number;
  lng: number;
  altitudeMinM: number;
  altitudeMaxM: number;
  varietals: string[];
  processes: string[];
  flavorTags: string[];
  harvest: HarvestWindow[];
}

export interface Varietal {
  id: string;
  name: string;
  lineage?: string | null;
  notes: string;
}

export interface Process {
  id: string;
  name: string;
  description: string;
}

export interface ClimateBand {
  stage: Stage;
  label: string;
  ideal: string;
  tempMinC?: number | null;
  tempMaxC?: number | null;
  rainMmMin?: number | null;
  rainMmMax?: number | null;
  riskIfWrong: string;
}

export interface FlavorNode {
  id: string;
  name: string;
  color: string;
  children: FlavorNode[];
}

// ---- user data (Dexie) ------------------------------------------------------

// A reference to any knowledge entity, e.g. "origin:ethiopia", "region:huila".
export type EntityType = "origin" | "region" | "varietal" | "process";
export type EntityRef = string; // `${EntityType}:${id}`

export interface Note {
  id: string;
  title: string;
  body: string; // markdown
  tags: string[];
  links: EntityRef[]; // entities this note references (drives backlinks)
  createdAt: number;
  updatedAt: number;
}

// SCA cupping scores, each 0/6-10 in 0.25 steps; total computed in scoring.ts.
export interface CuppingScores {
  fragrance: number;
  flavor: number;
  aftertaste: number;
  acidity: number;
  body: number;
  balance: number;
  uniformity: number;
  cleanCup: number;
  sweetness: number;
  overall: number;
}

export interface Tasting {
  id: string;
  refEntity: EntityRef | null; // what was tasted (usually an origin/region)
  name: string; // free label, e.g. "Konga washed, 2024 crop"
  date: string; // ISO yyyy-mm-dd
  scores: CuppingScores;
  totalScore: number;
  descriptors: string[]; // flavor-wheel node ids
  notes: string; // markdown
  createdAt: number;
}

export interface WatchlistItem {
  id: string;
  entityType: EntityType;
  entityId: string;
  entityKey: EntityRef; // unique
  note: string;
  addedAt: number;
}

export interface Preferences {
  id: "me";
  // affinity weight (-2..2) per flavor-wheel node id — seeds Phase 3 recs.
  affinities: Record<string, number>;
}
