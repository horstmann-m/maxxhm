import { colors, fonts } from "../theme.js";

const STATE_COPY = {
  armed: { icon: "🟢", text: "Scharf — wartet auf trockenen Boden", color: colors.green },
  "cooling-down": { icon: "🕒", text: "Cooldown nach Bewässerung", color: colors.orange },
  pumping: { icon: "💧", text: "Bewässert gerade", color: colors.blue },
  disarmed: { icon: "⚪", text: "Deaktiviert", color: colors.textMuted },
};

const inputStyle = {
  width: 64,
  background: "#10140F",
  color: colors.text,
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 4,
  padding: "4px 6px",
  fontFamily: fonts.mono,
  fontSize: 11,
};

export default function AutoWaterPanel({ profile, rule, status, onChangeRule, onToggleArm }) {
  const copy = STATE_COPY[status.state] || STATE_COPY.disarmed;
  const set = (field) => (e) => {
    const value = Number(e.target.value);
    onChangeRule(profile.id, { [field]: Number.isNaN(value) ? 0 : value });
  };

  return (
    <div style={{ padding: 16, background: "rgba(139,195,74,0.04)", borderRadius: 8, border: `1px solid ${colors.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: colors.green, fontWeight: 600 }}>
          {profile.icon} {profile.name} — Automatische Bewässerung
        </div>
        <button
          onClick={() => onToggleArm(profile.id)}
          aria-pressed={rule.enabled}
          aria-label={rule.enabled ? `Automatische Bewässerung für ${profile.name} deaktivieren` : `Automatische Bewässerung für ${profile.name} aktivieren (scharf schalten)`}
          className="sg-focusable"
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            padding: "6px 14px",
            borderRadius: 6,
            cursor: "pointer",
            background: rule.enabled ? "rgba(139,195,74,0.16)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${rule.enabled ? colors.green + "66" : colors.borderSubtle}`,
            color: rule.enabled ? colors.green : colors.textSecondary,
          }}
        >
          {rule.enabled ? "🔓 Entschärfen" : "🔒 Scharf schalten"}
        </button>
      </div>

      <div role="status" style={{ fontSize: 11, fontFamily: fonts.mono, color: copy.color, marginBottom: 10 }}>
        {copy.icon} {copy.text}
        {status.reason ? ` — ${status.reason}` : ""}
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <label style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.textTertiary, display: "flex", flexDirection: "column", gap: 2 }}>
          Schwelle (%)
          <input type="number" min="0" max="100" value={rule.thresholdPercent} onChange={set("thresholdPercent")} className="sg-focusable" style={inputStyle} aria-label={`Bodenfeuchte-Schwelle für ${profile.name} in Prozent`} />
        </label>
        <label style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.textTertiary, display: "flex", flexDirection: "column", gap: 2 }}>
          Pulsdauer (s)
          <input
            type="number"
            min="1"
            max={profile.autoWater.maxPulseSeconds}
            value={rule.pulseSeconds}
            onChange={set("pulseSeconds")}
            className="sg-focusable"
            style={inputStyle}
            aria-label={`Pumpen-Pulsdauer für ${profile.name} in Sekunden`}
          />
        </label>
        <label style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.textTertiary, display: "flex", flexDirection: "column", gap: 2 }}>
          Cooldown (min)
          <input type="number" min="1" value={rule.cooldownMinutes} onChange={set("cooldownMinutes")} className="sg-focusable" style={inputStyle} aria-label={`Cooldown für ${profile.name} in Minuten`} />
        </label>
        <label style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.textTertiary, display: "flex", flexDirection: "column", gap: 2 }}>
          Max. Pulse / Tag
          <input type="number" min="1" value={rule.maxDailyPulses} onChange={set("maxDailyPulses")} className="sg-focusable" style={inputStyle} aria-label={`Maximale Anzahl täglicher Bewässerungspulse für ${profile.name}`} />
        </label>
      </div>
      <div style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.textMuted, marginTop: 8 }}>
        Heute: {status.pulsesToday}/{rule.maxDailyPulses} Pulse · max. {profile.autoWater.maxPulseSeconds}s pro Aktivierung (Sicherheitsgrenze)
      </div>
    </div>
  );
}
