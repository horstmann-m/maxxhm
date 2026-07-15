import { colors, fonts } from "../theme.js";
import SectionLabel from "./SectionLabel.jsx";

export default function WateringHistory({ log, profiles }) {
  return (
    <div>
      <SectionLabel>Bewässerungsprotokoll ({log.length} Einträge)</SectionLabel>
      {log.length === 0 ? (
        <div style={{ padding: 16, textAlign: "center", color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
          Noch keine automatische Bewässerung ausgelöst.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 3, marginTop: 8 }}>
          {log.map((entry) => {
            const profile = profiles[entry.plant];
            return (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "6px 10px",
                  background: "rgba(79,195,247,0.05)",
                  borderRadius: 4,
                  borderLeft: `2px solid ${colors.blue}55`,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.textMuted, minWidth: 60 }}>{entry.time}</span>
                <span style={{ fontSize: 11, color: colors.blue }}>
                  💧 {profile?.icon ?? ""} {profile?.name ?? entry.plant}: {entry.pulseSeconds}s Puls · Boden vorher {entry.soilBefore.toFixed(0)}%
                </span>
                <span style={{ fontSize: 10, color: colors.textTertiary }}>{entry.reason}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
