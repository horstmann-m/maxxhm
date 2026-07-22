import { colors, fonts } from "../theme.js";
import { ENDPOINTS } from "../config.js";
import SectionLabel from "./SectionLabel.jsx";

function CmdButton({ onClick, border, bg, color, children, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="sg-focusable"
      style={{
        padding: "10px 20px",
        borderRadius: 6,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontFamily: fonts.mono,
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function Controls({ isDemo, onCommand }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <SectionLabel>Manuelle Steuerung</SectionLabel>

      <div style={{ padding: 16, background: "rgba(79,195,247,0.05)", borderRadius: 8, border: "1px solid rgba(79,195,247,0.14)" }}>
        <div style={{ fontSize: 13, color: colors.blue, fontWeight: 600, marginBottom: 10 }}>💧 Wasserpumpe</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <CmdButton
            onClick={() => onCommand(`${ENDPOINTS.pump}?action=on`, "Pumpe AN")}
            border="rgba(79,195,247,0.4)"
            bg="rgba(79,195,247,0.14)"
            color={colors.blue}
            ariaLabel="Pumpe manuell einschalten"
          >
            ▶ Pumpe AN (Puls)
          </CmdButton>
          <CmdButton
            onClick={() => onCommand(`${ENDPOINTS.pump}?action=off`, "Pumpe STOP")}
            border="rgba(255,107,103,0.4)"
            bg="rgba(255,107,103,0.1)"
            color={colors.red}
            ariaLabel="Pumpe manuell stoppen"
          >
            ⏹ Pumpe STOP
          </CmdButton>
        </div>
        <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8, lineHeight: 1.5 }}>
          Pumpe läuft maximal 8 Sekunden pro Aktivierung, unabhängig von der Auslösequelle.
          {isDemo && <span style={{ color: colors.orange }}> (Demo-Modus — Befehle werden simuliert, es wird kein Gerät angesprochen)</span>}
        </div>
      </div>

      <div style={{ padding: 16, background: "rgba(255,167,38,0.05)", borderRadius: 8, border: "1px solid rgba(255,167,38,0.14)" }}>
        <div style={{ fontSize: 13, color: colors.orange, fontWeight: 600, marginBottom: 10 }}>💡 Grow-Licht</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <CmdButton
            onClick={() => onCommand(`${ENDPOINTS.light}?action=on`, "Licht AN")}
            border="rgba(255,167,38,0.4)"
            bg="rgba(255,167,38,0.14)"
            color={colors.orange}
            ariaLabel="Grow-Licht einschalten"
          >
            ☀️ Licht AN
          </CmdButton>
          <CmdButton
            onClick={() => onCommand(`${ENDPOINTS.light}?action=off`, "Licht AUS")}
            border="rgba(255,107,103,0.4)"
            bg="rgba(255,107,103,0.1)"
            color={colors.red}
            ariaLabel="Grow-Licht ausschalten"
          >
            🌙 Licht AUS
          </CmdButton>
          <CmdButton
            onClick={() => onCommand(`${ENDPOINTS.light}?action=auto`, "Licht Auto-Modus")}
            border="rgba(139,195,74,0.4)"
            bg="rgba(139,195,74,0.1)"
            color={colors.green}
            ariaLabel="Grow-Licht in Automatikmodus versetzen"
          >
            🔄 Auto-Modus
          </CmdButton>
        </div>
        <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8, lineHeight: 1.5 }}>
          Auto: Licht AN von 06:00–22:00, aber nur wenn natürliches Licht unter 2000 lux fällt.
        </div>
      </div>
    </div>
  );
}
