import { colors, fonts } from "../theme.js";

export default function TrendChart({ metrics, selectedKey, onSelect }) {
  const metric = metrics.find((m) => m.key === selectedKey) || metrics[0];
  const clean = (metric?.data || []).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const width = 640;
  const height = 140;
  const pad = 24;

  let pathEl = null;
  let lo = 0;
  let hi = 1;
  if (clean.length >= 2) {
    lo = Math.min(...clean);
    hi = Math.max(...clean);
    const range = hi - lo || 1;
    const pts = clean.map((v, i) => {
      const x = pad + (i / (clean.length - 1)) * (width - pad * 2);
      const y = height - pad - ((v - lo) / range) * (height - pad * 2);
      return `${x},${y}`;
    });
    pathEl = <polyline points={pts.join(" ")} fill="none" stroke={metric.color} strokeWidth="2" strokeLinejoin="round" />;
  }

  return (
    <div style={{ padding: 14, background: colors.bgPanel, borderRadius: 8, border: `1px solid ${colors.borderSubtle}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.textSecondary }}>Verlauf</span>
        <label style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.textSecondary, display: "flex", alignItems: "center", gap: 6 }}>
          Metrik
          <select
            value={metric?.key}
            onChange={(e) => onSelect(e.target.value)}
            className="sg-focusable"
            style={{
              background: "#10140F",
              color: colors.text,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: 4,
              padding: "4px 6px",
              fontFamily: fonts.mono,
              fontSize: 11,
            }}
          >
            {metrics.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {pathEl ? (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Verlaufsdiagramm für ${metric.label}`}>
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke={colors.borderSubtle} />
          {pathEl}
          <text x={pad} y={pad - 8} fontSize="10" fontFamily={fonts.mono} fill={colors.textTertiary}>
            {hi.toFixed(1)}
            {metric.unit}
          </text>
          <text x={pad} y={height - 6} fontSize="10" fontFamily={fonts.mono} fill={colors.textTertiary}>
            {lo.toFixed(1)}
            {metric.unit}
          </text>
        </svg>
      ) : (
        <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: colors.textMuted, fontFamily: fonts.mono }}>
          Sammle Daten…
        </div>
      )}
    </div>
  );
}
