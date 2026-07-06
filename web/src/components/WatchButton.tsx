"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { toggleWatch } from "@/lib/store";
import type { EntityType } from "@/lib/types";

export function WatchButton({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const key = `${entityType}:${entityId}`;
  const watched = useLiveQuery(
    () => getDb().watchlist.where("entityKey").equals(key).count(),
    [key]
  );
  const on = (watched ?? 0) > 0;

  return (
    <button
      onClick={() => toggleWatch(entityType, entityId)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
        on
          ? "bg-accent text-accent-fg border-accent"
          : "border-border hover:bg-surface-2"
      }`}
    >
      <span aria-hidden>{on ? "★" : "☆"}</span>
      {on ? "Watching" : "Watch"}
    </button>
  );
}
