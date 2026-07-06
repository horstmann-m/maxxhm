// Local-first user data (notes, tastings, watchlist, preferences) in Dexie /
// IndexedDB. Phase 1 is purely local. To upgrade to synced Dexie Cloud:
//   1. cd web && npx dexie-cloud create   (gives you a databaseUrl)
//   2. npm install dexie-cloud-addon
//   3. add NEXT_PUBLIC_DEXIE_CLOUD_URL to .env.local
//   4. see the CLOUD block below — uncomment and pass the addon to Dexie,
//      switching the primary keys from "id" to "@id" for global id generation.

import Dexie, { type Table } from "dexie";
import type { Note, PriceEntry, Preferences, Tasting, WatchlistItem } from "./types";

export class CoffeeDB extends Dexie {
  notes!: Table<Note, string>;
  tastings!: Table<Tasting, string>;
  watchlist!: Table<WatchlistItem, string>;
  preferences!: Table<Preferences, string>;
  prices!: Table<PriceEntry, string>;

  constructor() {
    // --- CLOUD: const url = process.env.NEXT_PUBLIC_DEXIE_CLOUD_URL;
    //     super("coffee-second-brain", { addons: url ? [dexieCloud] : [] });
    super("coffee-second-brain");
    this.version(1).stores({
      // multi-entry indexes (*) on tags/links power tag filters and backlinks
      notes: "id, updatedAt, *tags, *links",
      tastings: "id, refEntity, date, createdAt",
      watchlist: "id, &entityKey, entityType, addedAt",
      preferences: "id",
    });
    // v2 (additive): manual price entry for the Phase 3 value factor
    this.version(2).stores({ prices: "id, kind" });
    // --- CLOUD: if (url) this.cloud.configure({ databaseUrl: url, requireAuth: false });
  }
}

// A single shared instance, constructed lazily and only in the browser
// (IndexedDB doesn't exist during SSR / static build).
let _db: CoffeeDB | null = null;

export function getDb(): CoffeeDB {
  if (typeof window === "undefined") {
    throw new Error("getDb() must be called in the browser");
  }
  if (!_db) _db = new CoffeeDB();
  return _db;
}

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
