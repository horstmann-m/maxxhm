"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { currentMonth } from "@/lib/season";
import { loadRiskSnapshot } from "@/lib/weather";
import type { RiskResult } from "@/lib/risk";

interface RiskContext {
  byRegion: Map<string, RiskResult>;
  updatedAt: number | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const EMPTY = new Map<string, RiskResult>();
const Ctx = createContext<RiskContext>({
  byRegion: EMPTY,
  updatedAt: null,
  loading: true,
  error: null,
  refresh: () => {},
});

export const useRisk = () => useContext(Ctx);

// Weather risk is always evaluated for "now" (a forecast), independent of the
// map's month scrubber. Fetched once, cached 6h in localStorage (see weather.ts).
export function WeatherRiskProvider({ children }: { children: React.ReactNode }) {
  const [byRegion, setByRegion] = useState<Map<string, RiskResult>>(EMPTY);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const force = nonce > 0;

  useEffect(() => {
    let alive = true;
    loadRiskSnapshot(currentMonth(), force)
      .then((snap) => {
        if (!alive) return;
        setByRegion(snap.byRegion);
        setUpdatedAt(snap.updatedAt);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [nonce, force]);

  return (
    <Ctx.Provider
      value={{
        byRegion,
        updatedAt,
        loading,
        error,
        refresh: () => {
          setLoading(true);
          setNonce((n) => n + 1);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
