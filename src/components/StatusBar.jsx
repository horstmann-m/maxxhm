import { colors, fonts } from "../theme.js";

const CONNECTION_COPY = {
  demo: { icon: "🟡", text: "Demo-Simulation", color: colors.orange },
  live: { icon: "🟢", text: "Live-Verbindung", color: colors.green },
  stale: { icon: "🟠", text: "Verbindung verzögert — letzte Daten werden angezeigt", color: colors.orange },
  disconnected: { icon: "🔴", text: "Getrennt — letzte Daten werden angezeigt", color: colors.red },
};

function agoText(seconds) {
  if (seconds == null) return "—";
  if (seconds < 2) return "gerade eben";
  if (seconds < 60) return `vor ${Math.round(seconds)}s`;
  return `vor ${Math.round(seconds / 60)}m`;
}

export default function StatusBar({ connectionState, secondsSinceUpdate, dataPointCount, timestamp }) {
  const copy = CONNECTION_COPY[connectionState] || CONNECTION_COPY.disconnected;
  return (
    <div
      role="status"
      style={{
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 6,
        fontSize: 10,
        fontFamily: fonts.mono,
        color: copy.color,
        marginTop: 8,
      }}
    >
      <span>
        {copy.icon} {copy.text} · aktualisiert {agoText(secondsSinceUpdate)}
      </span>
      <span style={{ color: colors.textMuted }}>
        {timestamp ? `${timestamp} · ` : ""}
        {dataPointCount} Datenpunkte
      </span>
    </div>
  );
}
