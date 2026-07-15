import { colors, fonts } from "../theme.js";

function ringColor(score) {
  if (score == null) return colors.textMuted;
  if (score >= 85) return colors.green;
  if (score >= 70) return colors.greenBright;
  if (score >= 50) return colors.orange;
  return colors.red;
}

function ScoreRing({ score }) {
  const size = 68;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = score == null ? 0 : score / 100;
  const color = ringColor(score);
  return (
    <svg width={size} height={size} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontSize="18" fontFamily={fonts.mono} fill={color} fontWeight="700">
        {score ?? "--"}
      </text>
    </svg>
  );
}

function Chip({ label, value }) {
  return (
    <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: `1px solid ${colors.borderSubtle}` }}>
      <div style={{ fontSize: 9, fontFamily: fonts.mono, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 12, fontFamily: fonts.mono, color: colors.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}

export default function PlantHealthCard({ profile, health, dliToday, forecastHours }) {
  const dliLabel =
    typeof dliToday === "number"
      ? `${dliToday.toFixed(1)} ${profile.dli.unit} (geschätzt)`
      : "wird berechnet…";
  const forecastLabel =
    forecastHours == null
      ? "Boden stabil / feucht genug"
      : forecastHours <= 0
      ? "Schwelle erreicht — gießen"
      : `≈${forecastHours}h bis Bewässerung nötig`;
  const vpdLabel = health.vpd != null ? `${health.vpd} kPa` : "—";

  return (
    <section
      aria-label={`Gesundheitsstatus ${profile.name}`}
      style={{
        padding: 16,
        background: "rgba(255,255,255,0.025)",
        borderRadius: 10,
        border: `1px solid ${colors.border}`,
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <ScoreRing score={health.score} />
      <div style={{ flex: "1 1 200px", minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 14, color: colors.text, fontWeight: 600 }}>
            {profile.icon} {profile.name}
          </span>
          <span style={{ fontSize: 11, fontFamily: fonts.mono, color: ringColor(health.score) }}>{health.label}</span>
        </div>
        <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, lineHeight: 1.5 }}>{profile.care.summary}</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Chip label="VPD" value={vpdLabel} />
        <Chip label="DLI (Schätzung)" value={dliLabel} />
        <Chip label="Boden-Prognose" value={forecastLabel} />
      </div>
      {health.recommendations.length > 0 ? (
        <ul style={{ width: "100%", margin: "4px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
          {health.recommendations.map((rec, i) => (
            <li key={i} style={{ fontSize: 12, color: colors.orange, display: "flex", gap: 6 }}>
              <span aria-hidden="true">→</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ width: "100%", fontSize: 12, color: colors.green }}>✓ Alle Werte im Zielbereich.</div>
      )}
    </section>
  );
}
