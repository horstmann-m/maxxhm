// Local-first user data (notes, tastings, watchlist, preferences) in Dexie /
// IndexedDB. Phase 1 is purely local. To upgrade to synced Dexie Cloud:
//   1. cd web && npx dexie-cloud create   (gives you a databaseUrl)
//   2. npm install dexie-cloud-addon
//   3. add NEXT_PUBLIC_DEXIE_CLOUD_URL to .env.local
//   4. see the CLOUD block below — uncomment and pass the addon to Dexie,
//      switching the primary keys from "id" to "@id" for global id generation.

import Dexie, { type Table } from "dexie";
import dexieCloud from "dexie-cloud-addon";
import type {
  Note,
  Origin,
  PriceEntry,
  PricePoint,
  Preferences,
  Region,
  Sample,
  Supplier,
  Tasting,
  WatchlistItem,
} from "./types";

const CLOUD_URL = process.env.NEXT_PUBLIC_DEXIE_CLOUD_URL;
export const cloudEnabled = !!CLOUD_URL;

export class CoffeeDB extends Dexie {
  notes!: Table<Note, string>;
  tastings!: Table<Tasting, string>;
  watchlist!: Table<WatchlistItem, string>;
  preferences!: Table<Preferences, string>;
  prices!: Table<PriceEntry, string>;
  priceHistory!: Table<PricePoint, string>;
  suppliers!: Table<Supplier, string>;
  samples!: Table<Sample, string>;
  customOrigins!: Table<Origin, string>;
  customRegions!: Table<Region, string>;

  constructor() {
    // Dexie Cloud is opt-in: set NEXT_PUBLIC_DEXIE_CLOUD_URL (from
    // `npx dexie-cloud create`) and the addon syncs all tables to your account.
    super("coffee-second-brain", CLOUD_URL ? { addons: [dexieCloud] } : {});
    this.version(1).stores({
      // multi-entry indexes (*) on tags/links power tag filters and backlinks
      notes: "id, updatedAt, *tags, *links",
      tastings: "id, refEntity, date, createdAt",
      watchlist: "id, &entityKey, entityType, addedAt",
      preferences: "id",
    });
    // v2 (additive): manual price entry for the Phase 3 value factor
    this.version(2).stores({ prices: "id, kind" });
    // v3 (additive): dated C-price history for the trend + threshold alert
    this.version(3).stores({ priceHistory: "id, date" });
    // v4 (additive): supplier scorecard
    this.version(4).stores({
      suppliers: "id, name, createdAt",
      samples: "id, supplierId, status, createdAt",
    });
    // v5 (additive): user-added origins/regions (in-app editor)
    this.version(5).stores({
      customOrigins: "id, name",
      customRegions: "id, originId",
    });
    if (CLOUD_URL) {
      this.cloud.configure({
        databaseUrl: CLOUD_URL,
        requireAuth: false, // works offline; sign in from the Sync panel to sync
      });
    }
  }
}

// A single shared instance, constructed lazily and only in the browser
// (IndexedDB doesn't exist during SSR / static build).
let _db: CoffeeDB | null = null;

export function getDb(): CoffeeDB {
  if (typeof window === "undefined") {
    throw new Error("getDb() must be called in the browser");
  }
  if (!_db) {
    _db = new CoffeeDB();
    // If another tab holds an older schema version, an upgrade would block and
    // writes would hang forever. Reload so every tab converges on the new schema.
    _db.on("versionchange", () => {
      _db?.close();
      if (typeof location !== "undefined") location.reload();
    });
    _db.on("blocked", () => {
      console.warn("Parchment DB upgrade is blocked by another open tab — close it.");
    });
    _db.open().catch((e) => console.error("Parchment DB failed to open:", e));
  }
  return _db;
}

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
