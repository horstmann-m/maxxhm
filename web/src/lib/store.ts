// Mutation + query helpers over the Dexie DB. Keep all writes here so id/
// timestamp bookkeeping lives in one place and components stay declarative.

import { getDb, newId } from "./db";
import { totalScore } from "./scoring";
import type {
  CuppingScores,
  EntityRef,
  EntityType,
  Note,
  PriceEntry,
  Preferences,
  Tasting,
  WatchlistItem,
} from "./types";

// ---- notes ------------------------------------------------------------------

export async function createNote(
  input: Pick<Note, "title" | "body" | "tags" | "links">
): Promise<string> {
  const now = Date.now();
  const note: Note = { id: newId(), createdAt: now, updatedAt: now, ...input };
  await getDb().notes.add(note);
  return note.id;
}

export async function updateNote(
  id: string,
  patch: Partial<Pick<Note, "title" | "body" | "tags" | "links">>
): Promise<void> {
  await getDb().notes.update(id, { ...patch, updatedAt: Date.now() });
}

export const deleteNote = (id: string) => getDb().notes.delete(id);

// ---- tastings ---------------------------------------------------------------

export async function createTasting(
  input: Omit<Tasting, "id" | "createdAt" | "totalScore">
): Promise<string> {
  const tasting: Tasting = {
    ...input,
    id: newId(),
    createdAt: Date.now(),
    totalScore: totalScore(input.scores),
  };
  await getDb().tastings.add(tasting);
  return tasting.id;
}

export async function updateTastingScores(
  id: string,
  scores: CuppingScores
): Promise<void> {
  await getDb().tastings.update(id, { scores, totalScore: totalScore(scores) });
}

export const deleteTasting = (id: string) => getDb().tastings.delete(id);

// ---- watchlist --------------------------------------------------------------

export async function toggleWatch(
  entityType: EntityType,
  entityId: string,
  note = ""
): Promise<boolean> {
  const db = getDb();
  const entityKey: EntityRef = `${entityType}:${entityId}`;
  const existing = await db.watchlist.where("entityKey").equals(entityKey).first();
  if (existing) {
    await db.watchlist.delete(existing.id);
    return false;
  }
  const item: WatchlistItem = {
    id: newId(),
    entityType,
    entityId,
    entityKey,
    note,
    addedAt: Date.now(),
  };
  await db.watchlist.add(item);
  return true;
}

export const removeWatch = (id: string) => getDb().watchlist.delete(id);

// ---- preferences ------------------------------------------------------------

export async function setAffinity(nodeId: string, weight: number): Promise<void> {
  const db = getDb();
  const current = (await db.preferences.get("me")) ?? { id: "me", affinities: {} };
  const affinities = { ...current.affinities };
  if (weight === 0) delete affinities[nodeId];
  else affinities[nodeId] = weight;
  await db.preferences.put({ id: "me", affinities } as Preferences);
}

/** Seed affinities from tasting descriptors, weighted by cupping score band.
 *  Merges into existing affinities; returns how many nodes were set. */
export async function deriveAffinitiesFromTastings(): Promise<number> {
  const db = getDb();
  const tastings = await db.tastings.toArray();
  const votes = new Map<string, number>();
  for (const t of tastings) {
    const w = t.totalScore >= 87 ? 2 : t.totalScore >= 82 ? 1 : t.totalScore >= 78 ? 0 : -1;
    for (const d of t.descriptors) votes.set(d, (votes.get(d) ?? 0) + w);
  }
  const current = (await db.preferences.get("me")) ?? { id: "me", affinities: {} };
  const affinities = { ...current.affinities };
  for (const [node, v] of votes) {
    if (v === 0) continue;
    affinities[node] = Math.max(-2, Math.min(2, v));
  }
  await db.preferences.put({ id: "me", affinities } as Preferences);
  return votes.size;
}

// ---- prices (Phase 3, manual entry) -----------------------------------------

export async function setMarketPrice(cPriceUscLb: number): Promise<void> {
  await getDb().prices.put({ id: "market", kind: "market", cPriceUscLb, at: Date.now() });
}

export async function setOriginPrice(
  originId: string,
  patch: Pick<PriceEntry, "differentialUscLb" | "targetFobUscLb" | "note">
): Promise<void> {
  const db = getDb();
  const id = `origin:${originId}`;
  const current = await db.prices.get(id);
  await db.prices.put({
    id,
    kind: "origin",
    ...current,
    ...patch,
    at: Date.now(),
  });
}
