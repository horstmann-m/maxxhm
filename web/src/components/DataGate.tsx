"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Fragment } from "react";
import { getDb } from "@/lib/db";
import { applyCustomData } from "@/lib/reference";
import type { Origin, Region } from "@/lib/types";

// Merges the user's custom origins/regions (Dexie) into the reference module's
// live-binding arrays, then remounts the subtree keyed on a version signature so
// every consumer picks up the change without a per-component refactor. On the
// first (server + hydration) render custom data is empty, matching the server
// output; once Dexie resolves, the key changes and the tree remounts with the
// merged data.
export function DataGate({ children }: { children: React.ReactNode }) {
  const custom = useLiveQuery(async () => {
    const db = getDb();
    const [origins, regions] = await Promise.all([
      db.customOrigins.toArray(),
      db.customRegions.toArray(),
    ]);
    return { origins, regions };
  }, []);

  const version = applyCustomData(
    (custom?.origins ?? []) as Origin[],
    (custom?.regions ?? []) as Region[]
  );

  return <Fragment key={version}>{children}</Fragment>;
}
