"use client";

import { useRef, useState } from "react";
import type { PricePoint } from "@/lib/types";

// Single-series C-price time series. One hue (brand accent), recessive axes, a
// dashed threshold reference line, and a hover crosshair+tooltip.
const W = 640;
const H = 180;
const PAD = { top: 16, right: 16, bottom: 26, left: 40 };

export function PriceChart({
  points,
  threshold,
}: {
  points: PricePoint[]; // ascending by date
  threshold?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <p className="text-sm text-muted">
        Log the C-price on a few dates to see the trend and threshold alerts.
      </p>
    );
  }

  const xs = points.map((p) => new Date(p.date).getTime());
  const ys = points.map((p) => p.cPriceUscLb);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let yMin = Math.min(...ys, threshold ?? Infinity);
  let yMax = Math.max(...ys, threshold ?? -Infinity);
  const padY = (yMax - yMin) * 0.12 || 5;
  yMin -= padY;
  yMax += padY;

  const px = (t: number) =>
    PAD.left + ((t - x0) / (x1 - x0 || 1)) * (W - PAD.left - PAD.right);
  const py = (v: number) =>
    PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);

  const pts = points.map((p, i) => ({ x: px(xs[i]), y: py(ys[i]), p }));
  const line = pts.map((d, i) => `${i ? "L" : "M"}${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${py(yMin)} L${pts[0].x.toFixed(1)} ${py(yMin)} Z`;

  const yTicks = [yMin + padY, (yMin + yMax) / 2, yMax - padY];
  const last = pts[pts.length - 1];
  const hover = hoverIdx != null ? pts[hoverIdx] : null;

  function onMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    pts.forEach((d, i) => {
      const dist = Math.abs(d.x - vx);
      if (dist < bestD) {
        bestD = dist;
        best = i;
      }
    });
    setHoverIdx(best);
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label="C-price history"
      >
        {/* gridlines + y labels (recessive) */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={py(v)}
              y2={py(v)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text x={PAD.left - 6} y={py(v) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">
              {Math.round(v)}
            </text>
          </g>
        ))}

        {/* threshold reference line */}
        {threshold != null && threshold >= yMin && threshold <= yMax && (
          <g>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={py(threshold)}
              y2={py(threshold)}
              stroke="#d64545"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <text x={W - PAD.right} y={py(threshold) - 4} textAnchor="end" fontSize="10" fill="#d64545">
              trigger {threshold}¢
            </text>
          </g>
        )}

        {/* area + line */}
        <path d={area} fill="var(--accent)" opacity={0.08} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* endpoints: x range labels */}
        <text x={PAD.left} y={H - 8} fontSize="10" fill="var(--muted)">
          {fmtDate(points[0].date)}
        </text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" fontSize="10" fill="var(--muted)">
          {fmtDate(points[points.length - 1].date)}
        </text>

        {/* last-point marker + direct label */}
        <circle cx={last.x} cy={last.y} r={3.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />

        {/* hover crosshair */}
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeWidth={1} opacity={0.5} />
            <circle cx={hover.x} cy={hover.y} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />
          </g>
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-foreground text-background px-2 py-1 text-xs shadow-lg whitespace-nowrap"
          style={{ left: `${(hover.x / W) * 100}%`, top: 0 }}
        >
          <span className="font-semibold">{hover.p.cPriceUscLb}¢</span>
          <span className="opacity-60"> · {fmtDate(hover.p.date)}</span>
        </div>
      )}
    </div>
  );
}
