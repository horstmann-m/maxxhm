import { colors, fonts } from "../theme.js";

const CONNECTION_BADGE = {
  demo: { icon: "🟡", text: "DEMO", color: colors.orange },
  live: { icon: "🟢", text: "LIVE", color: colors.green },
  stale: { icon: "🟠", text: "VERZÖGERT", color: colors.orange },
  disconnected: { icon: "🔴", text: "GETRENNT", color: colors.red },
};

// Shown on every tab (unlike the detailed StatusBar, which only lives on
// the Sensoren tab) so a dropped connection is never invisible just
// because the user happens to be on Steuerung or Alerts.
function ConnectionBadge({ connectionState }) {
  const badge = CONNECTION_BADGE[connectionState] || CONNECTION_BADGE.disconnected;
  return (
    <span
      role="status"
      style={{ fontSize: 10, fontFamily: fonts.mono, color: badge.color, background: `${badge.color}20`, padding: "3px 8px", borderRadius: 4 }}
    >
      {badge.icon} {badge.text}
    </span>
  );
}

export default function Header({ isDemo, onToggleDemo, alertCount, ip, connectionState }) {
  return (
    <header
      style={{
        padding: "16px 16px 12px",
        borderBottom: `1px solid ${colors.border}`,
        background: "linear-gradient(180deg, rgba(139,195,74,0.07) 0%, transparent 100%)",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 400, margin: 0, color: colors.text }}>🌱 Smart Garden Nursery</h1>
          <div style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.textTertiary, marginTop: 2 }}>
            {isDemo ? "DEMO-MODUS" : `LIVE · ${ip || "—"}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* In demo mode the DEMO/LIVE toggle already says "DEMO" — only
              show this badge when it adds information (live/stale/disconnected). */}
          {connectionState !== "demo" && <ConnectionBadge connectionState={connectionState} />}
          {alertCount > 0 && (
            <span
              style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.red, background: "rgba(255,107,103,0.14)", padding: "3px 8px", borderRadius: 4 }}
              role="status"
            >
              ⚠ {alertCount} ALERT{alertCount > 1 ? "S" : ""}
            </span>
          )}
          <button
            onClick={onToggleDemo}
            aria-pressed={!isDemo}
            aria-label={isDemo ? "Zu Live-Modus wechseln" : "Zu Demo-Modus wechseln"}
            className="sg-focusable"
            style={{
              fontSize: 10,
              fontFamily: fonts.mono,
              padding: "4px 10px",
              borderRadius: 4,
              border: `1px solid ${colors.border}`,
              background: isDemo ? "rgba(255,167,38,0.16)" : "rgba(139,195,74,0.12)",
              color: isDemo ? colors.orange : colors.green,
              cursor: "pointer",
            }}
          >
            {isDemo ? "DEMO" : "LIVE"}
          </button>
        </div>
      </div>
    </header>
  );
}
