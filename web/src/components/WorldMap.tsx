"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import { useRisk } from "@/components/WeatherRiskProvider";
import { origins, regionsForOrigin } from "@/lib/reference";
import { originCentroid, originStatus } from "@/lib/season";
import { RISK_META, aggregateLevel, type RiskLevel } from "@/lib/risk";

const W = 960;
const H = 480;

// A single loaded copy of the world outline, shared across mounts.
let landPromise: Promise<Feature<Geometry>[]> | null = null;
function loadLand(): Promise<Feature<Geometry>[]> {
  if (!landPromise) {
    landPromise = fetch("/data/countries-110m.json")
      .then((r) => r.json())
      .then((topo) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fc = feature(topo, topo.objects.countries as any) as any;
        return fc.features as Feature<Geometry>[];
      });
  }
  return landPromise;
}

interface Hover {
  x: number;
  y: number;
  name: string;
  status: string;
  color: string;
  risk: RiskLevel;
}

export function WorldMap({ month, showRisk }: { month: number; showRisk: boolean }) {
  const router = useRouter();
  const { byRegion } = useRisk();
  const [land, setLand] = useState<Feature<Geometry>[] | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ok = true;
    loadLand().then((f) => ok && setLand(f)).catch(() => {});
    return () => {
      ok = false;
    };
  }, []);

  const { path, projection } = useMemo(() => {
    const projection = geoNaturalEarth1();
    projection.fitExtent(
      [
        [8, 8],
        [W - 8, H - 8],
      ],
      { type: "Sphere" }
    );
    return { path: geoPath(projection), projection };
  }, []);

  // One marker per origin (aggregate status), placed at its regions' centroid —
  // avoids piling overlapping region dots on the same pixel at world scale.
  const markers = useMemo(() => {
    return origins
      .map((o) => {
        const rs = regionsForOrigin(o.id);
        const c = originCentroid(rs);
        const p = projection([c.lng, c.lat]);
        if (!p) return null;
        const st = originStatus(rs, month);
        const risk: RiskLevel = aggregateLevel(rs.map((r) => byRegion.get(r.id)));
        return {
          id: o.id,
          originId: o.id,
          name: o.name,
          x: p[0],
          y: p[1],
          color: st.meta.color,
          status: st.meta.label,
          risk,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [projection, month, byRegion]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto rounded-xl bg-surface-2 border border-border"
        role="img"
        aria-label="World map of coffee origins coloured by growing stage"
      >
        {/* Sphere backdrop */}
        <path d={path({ type: "Sphere" }) ?? ""} className="fill-transparent" />
        {/* Land */}
        {land?.map((f, i) => (
          <path
            key={i}
            d={path(f) ?? ""}
            fill="var(--surface)"
            stroke="var(--border)"
            strokeWidth={0.5}
          />
        ))}
        {/* Origin markers (+ weather-risk ring when enabled) */}
        {markers.map((m) => (
          <g key={m.id}>
            {showRisk && m.risk !== "ok" && (
              <circle
                cx={m.x}
                cy={m.y}
                r={10}
                fill="none"
                stroke={RISK_META[m.risk].color}
                strokeWidth={2.5}
                className="pointer-events-none"
              />
            )}
            <circle
              cx={m.x}
              cy={m.y}
              r={hover?.name === m.name ? 8 : 6}
              fill={m.color}
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={1}
              className="cursor-pointer transition-[r]"
              onMouseEnter={() =>
                setHover({ x: m.x, y: m.y, name: m.name, status: m.status, color: m.color, risk: m.risk })
              }
              onMouseLeave={() => setHover(null)}
              onClick={() => router.push(`/origin/${m.originId}`)}
            >
              <title>{`${m.name} — ${m.status}`}</title>
            </circle>
          </g>
        ))}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-foreground text-background px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
          style={{
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
            marginTop: -6,
          }}
        >
          <span className="font-semibold">{hover.name}</span>
          <span className="mx-1.5 opacity-40">·</span>
          <span style={{ color: hover.color }}>●</span> {hover.status}
          {showRisk && hover.risk !== "ok" && (
            <>
              <span className="mx-1.5 opacity-40">·</span>
              <span style={{ color: RISK_META[hover.risk].color }}>
                {RISK_META[hover.risk].icon} {RISK_META[hover.risk].label}
              </span>
            </>
          )}
        </div>
      )}

      {!land && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">
          Loading world…
        </div>
      )}
    </div>
  );
}
