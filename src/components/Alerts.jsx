import { colors, fonts, alertColor } from "../theme.js";
import SectionLabel from "./SectionLabel.jsx";

export default function Alerts({ alerts, alertLog }) {
  return (
    <div>
      <SectionLabel>Alert-Protokoll ({alertLog.length} Einträge)</SectionLabel>

      {alerts.length > 0 ? (
        <div style={{ margin: "10px 0 16px", padding: "12px 14px", background: "rgba(255,107,103,0.07)", borderRadius: 8, border: "1px solid rgba(255,107,103,0.18)" }}>
          <div style={{ fontSize: 12, color: colors.red, fontWeight: 600, marginBottom: 8 }}>⚠️ Aktive Alerts</div>
          {alerts.map((a) => (
            <div key={a.key} style={{ fontSize: 12, color: alertColor(a.level), padding: "3px 0" }}>
              {a.icon} {a.msg} <span style={{ color: colors.textTertiary, fontSize: 10 }}>[{a.level === "critical" ? "KRITISCH" : "WARNUNG"}]</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: "center", color: colors.green, fontSize: 13, margin: "10px 0 16px" }}>
          ✅ Keine aktiven Alerts — alles im grünen Bereich!
        </div>
      )}

      {alertLog.length > 0 ? (
        <div style={{ display: "grid", gap: 3 }}>
          {alertLog.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                gap: 10,
                padding: "6px 10px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 4,
                borderLeft: `2px solid ${alertColor(a.level)}55`,
              }}
            >
              <span style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.textMuted, minWidth: 55 }}>{a.time}</span>
              <span style={{ fontSize: 11, color: alertColor(a.level) }}>{a.icon} {a.msg}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: "center", color: colors.textSecondary, fontSize: 12 }}>Noch keine Alerts aufgetreten.</div>
      )}

      <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(139,195,74,0.05)", borderRadius: 6, border: "1px solid rgba(139,195,74,0.12)", fontSize: 11, color: colors.textSecondary, lineHeight: 1.6 }}>
        <strong style={{ color: colors.green }}>Hinweis:</strong> Jede Alert-Bedingung wird nur beim Auftreten (steigende Flanke) protokolliert, nicht bei jedem Poll — ein anhaltender Zustand erzeugt also einen Eintrag, nicht Dutzende.
      </div>
    </div>
  );
}
