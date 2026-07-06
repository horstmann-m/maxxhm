"use client";

import { useRisk } from "@/components/WeatherRiskProvider";
import { originNormals } from "@/lib/market";

const W = 560;
const H = 130;
const PAD = { top: 12, right: 10, bottom: 16, left: 30 };

function daysInMonth(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Precip (observed + forecast) vs the seasonal-normal band, and temperature
 *  min–max, for one region. Answers "why is it wetter/drier than usual". */
export function WeatherDetailChart({ regionId, originId }: { regionId: string; originId: string }) {
  const { series } = useRisk();
  const s = series[regionId];
  if (!s) {
    return <p className="text-xs text-muted">Live weather not loaded (or unavailable) right now.</p>;
  }
  const normals = originNormals(originId);
  const n = s.time.length;
  const today = s.todayIndex;
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
  const tempBand =
    [
      ...s.time.map((_, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${pyT(tmax[i]).toFixed(1)}`),
      ...s.time.map((_, i) => `L${px(n - 1 - i).toFixed(1)} ${pyT(tmin[n - 1 - i]).toFixed(1)}`),
      "Z",
    ].join(" ");

  const todayMarker = (
    <>
      <line x1={px(today)} x2={px(today)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--border)" strokeWidth={1} />
      <text x={px(today)} y={H - 4} fontSize="9" textAnchor="middle" fill="var(--muted)">today</text>
    </>
  );

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-muted mb-1">Precipitation vs seasonal normal (mm/day)</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {todayMarker}
          {normals && <path d={bandArea!} fill="#3f7fd0" opacity={0.12} />}
          {normals && <path d={normalLine!} fill="none" stroke="#3f7fd0" strokeWidth={1.5} strokeDasharray="4 3" />}
          {precip.map((v, i) => (
            <rect key={i} x={px(i) - barW / 2} y={pyP(v)} width={barW}
              height={Math.max(0, H - PAD.bottom - pyP(v))} fill="var(--accent)" opacity={i >= today ? 0.45 : 0.85} />
          ))}
          <text x={PAD.left - 4} y={PAD.top + 4} fontSize="9" textAnchor="end" fill="var(--muted)">{Math.round(pMax)}</text>
        </svg>
      </div>

      <div>
        <div className="text-xs text-muted mb-1">Temperature range (°C, min–max)</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {todayMarker}
          <path d={tempBand} fill="#e0843a" opacity={0.18} />
          <path d={s.time.map((_, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${pyT(tmax[i]).toFixed(1)}`).join(" ")}
            fill="none" stroke="#d0533a" strokeWidth={1.5} />
          <path d={s.time.map((_, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${pyT(tmin[i]).toFixed(1)}`).join(" ")}
            fill="none" stroke="#3f7fd0" strokeWidth={1.5} />
          <text x={PAD.left - 4} y={PAD.top + 4} fontSize="9" textAnchor="end" fill="var(--muted)">{Math.round(tHi)}</text>
          <text x={PAD.left - 4} y={H - PAD.bottom} fontSize="9" textAnchor="end" fill="var(--muted)">{Math.round(tLo)}</text>
        </svg>
      </div>

      <p className="text-[11px] text-muted">
        Bars = daily rainfall (solid = observed, faded = forecast). Blue dashed line + band =
        the seasonal normal (±). Bars above the band → wetter than usual.
        {!normals && " No rainfall baseline for this origin yet."}
      </p>
    </div>
  );
}
