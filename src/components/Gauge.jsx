import { colors, fonts } from "../theme.js";
import Sparkline from "./Sparkline.jsx";

// Status is conveyed by color AND text/icon (not color alone) to satisfy
// the a11y requirement — the label suffix ("niedrig"/"hoch"/"kritisch")
// is the non-color signal.
function statusSuffix(pct) {
  if (pct < 8 || pct > 92) return " — kritisch";
  if (pct < 15 || pct > 85) return " — außerhalb Zielbereich";
  return "";
}

export default function Gauge({ label, value, unit, min, max, decimals = 1, color, icon, sparkData }) {
  const hasValue = typeof value === "number" && !Number.isNaN(value);
  const pct = hasValue ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
  const isLow = pct < 15;
  const isHigh = pct > 85;
  const barColor = hasValue && (isLow || isHigh) ? colors.red : color;

  return (
    <div
      style={{ padding: "12px 14px", background: colors.bgPanel, borderRadius: 8, borderLeft: `3px solid ${barColor}` }}
      role="group"
      aria-label={`${label}: ${hasValue ? value.toFixed(decimals) : "keine Daten"} ${unit}${hasValue ? statusSuffix(pct) : ""}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: colors.textSecondary, fontFamily: fonts.mono }} aria-hidden="true">
          {icon} {label}
        </span>
        <span style={{ fontSize: 18, fontFamily: fonts.mono, fontWeight: 700, color: barColor }} aria-hidden="true">
          {hasValue ? value.toFixed(decimals) : "--"} <span style={{ fontSize: 11, fontWeight: 400, color: colors.textTertiary }}>{unit}</span>
        </span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: barColor,
            borderRadius: 2,
            transition: "width 0.5s ease",
          }}
          className="sg-gauge-fill"
        />
      </div>
      {sparkData && (
        <div style={{ marginTop: 6 }}>
          <Sparkline data={sparkData} color={barColor} min={min} max={max} width={140} height={24} />
        </div>
      )}
    </div>
  );
}
