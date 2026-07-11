"use client";

import { useRisk } from "@/components/WeatherRiskProvider";
import { originNormals } from "@/lib/market";

const W = 560;
const H = 130;
const PAD = { top: 12, right: 10, bottom: 22, left: 30 };

function daysInMonth(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Precip (observed + forecast) vs the seasonal-normal band, and temperature
 *  min–max with the forecast drawn dashed. Answers "why wetter/drier than usual"
 *  and makes the forecast window explicit. */
export function WeatherDetailChart({ regionId, originId }: { regionId: string; originId: string }) {
  const { series } = useRisk();
  const s = series[regionId];
  if (!s) {
    return <p className="text-xs text-muted">Live weather not loaded (or unavailable) right now.</p>;
  }
  const normals = originNormals(originId);
  const n = s.time.length;
  const today = s.todayIndex;
  const pastDays = today;
  const forecastDays = n - 1 - today;
  const innerW = W - PAD.left - PAD.right;
  const px = (i: number) => PAD.left + (i / (n - 1)) * innerW;

  // ---- precipitation ----
  const precip = s.precip.map((v) => v ?? 0);
  const normalDaily = s.time.map((iso) => {
    if (!normals) return null;
    const month = Number(iso.slice(5, 7)) - 1;
    return normals[month] / daysInMonth(iso);
  });
  const bandHi = normalDaily.map((v) => (v == null ? 0 : v * 1.6));
  const pMax = Math.max(1, ...precip, ...bandHi);
  const pyP = (v: number) => PAD.top + (1 - v / pMax) * (H - PAD.top - PAD.bottom);
  const barW = Math.max(1.5, innerW / n - 1);

  const bandArea =
    normals &&
    [
      ...s.time.map((_, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${pyP(normalDaily[i]! * 1.6).toFixed(1)}`),
      ...s.time.map((_, i) => `L${px(n - 1 - i).toFixed(1)} ${pyP(normalDaily[n - 1 - i]! * 0.6).toFixed(1)}`),
      "Z",
    ].join(" ");
  const normalLine =
    normals && s.time.map((_, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${pyP(normalDaily[i]!).toFixed(1)}`).join(" ");

  // ---- temperature ----
  const tmax = s.tmax.map((v) => v ?? 0);
  const tmin = s.tmin.map((v) => v ?? 0);
  const tHi = Math.max(...tmax) + 2;
  const tLo = Math.min(...tmin) - 2;
  const pyT = (v: number) => PAD.top + (1 - (v - tLo) / (tHi - tLo || 1)) * (H - PAD.top - PAD.bottom);

  // line path over an inclusive index range
  const linePath = (arr: number[], from: number, to: number, py: (v: number) => number) =>
    arr
      .slice(from, to + 1)
      .map((v, k) => `${k ? "L" : "M"}${px(from + k).toFixed(1)} ${py(v).toFixed(1)}`)
      .join(" ");

  const tempBand = [
    ...s.time.map((_, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${pyT(tmax[i]).toFixed(1)}`),
    ...s.time.map((_, i) => `L${px(n - 1 - i).toFixed(1)} ${pyT(tmin[n - 1 - i]).toFixed(1)}`),
    "Z",
  ].join(" ");

  // shared chart furniture: forecast shading, today marker, x-date labels
  const furniture = (
    <>
      <rect x={px(today)} y={PAD.top} width={px(n - 1) - px(today)} height={H - PAD.top - PAD.bottom}
        fill="var(--muted)" opacity={0.06} />
      <line x1={px(today)} x2={px(today)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--border)" strokeWidth={1} />
      <text x={px(today)} y={H - 12} fontSize="9" textAnchor="middle" fill="var(--muted)">today</text>
      <text x={px(today) + 3} y={PAD.top + 8} fontSize="8" fill="var(--muted)">forecast →</text>
      <text x={PAD.left} y={H - 3} fontSize="8" textAnchor="start" fill="var(--muted)">{fmtDate(s.time[0])}</text>
      <text x={W - PAD.right} y={H - 3} fontSize="8" textAnchor="end" fill="var(--muted)">{fmtDate(s.time[n - 1])}</text>
    </>
  );

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted">
        Window: <span className="text-foreground">last {pastDays} days</span> +{" "}
        <span className="text-foreground">{forecastDays}-day forecast</span> (shaded).
      </div>

      <div>
        <div className="text-xs text-muted mb-1">Precipitation vs seasonal normal (mm/day)</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {furniture}
          {normals && <path d={bandArea!} fill="#3f7fd0" opacity={0.12} />}
          {normals && <path d={normalLine!} fill="none" stroke="#3f7fd0" strokeWidth={1.5} strokeDasharray="4 3" />}
          {precip.map((v, i) => (
            <rect key={i} x={px(i) - barW / 2} y={pyP(v)} width={barW}
              height={Math.max(0, H - PAD.bottom - pyP(v))} fill="var(--accent)" opacity={i >= today ? 0.4 : 0.85} />
          ))}
          <text x={PAD.left - 4} y={PAD.top + 4} fontSize="9" textAnchor="end" fill="var(--muted)">{Math.round(pMax)}</text>
        </svg>
      </div>

      <div>
        <div className="text-xs text-muted mb-1">
          Temperature °C — <span style={{ color: "#d0533a" }}>max</span> /{" "}
          <span style={{ color: "#3f7fd0" }}>min</span> · solid = observed, dashed = forecast
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {furniture}
          <path d={tempBand} fill="#e0843a" opacity={0.15} />
          {/* observed (solid) */}
          <path d={linePath(tmax, 0, today, pyT)} fill="none" stroke="#d0533a" strokeWidth={1.75} />
          <path d={linePath(tmin, 0, today, pyT)} fill="none" stroke="#3f7fd0" strokeWidth={1.75} />
          {/* forecast (dashed) */}
          <path d={linePath(tmax, today, n - 1, pyT)} fill="none" stroke="#d0533a" strokeWidth={1.75} strokeDasharray="3 3" />
          <path d={linePath(tmin, today, n - 1, pyT)} fill="none" stroke="#3f7fd0" strokeWidth={1.75} strokeDasharray="3 3" />
          <text x={PAD.left - 4} y={PAD.top + 4} fontSize="9" textAnchor="end" fill="var(--muted)">{Math.round(tHi)}</text>
          <text x={PAD.left - 4} y={H - PAD.bottom} fontSize="9" textAnchor="end" fill="var(--muted)">{Math.round(tLo)}</text>
        </svg>
      </div>

      <p className="text-[11px] text-muted">
        Rain bars: solid = observed, faded = forecast. Blue dashed line + band = the seasonal
        normal (±); bars above it → wetter than usual.
        {!normals && " No rainfall baseline for this origin yet."}
      </p>
    </div>
  );
}
