import { colors, fonts } from "../theme.js";

const TAB_DEFS = [
  { id: "live", label: "📊 Sensoren" },
  { id: "controls", label: "⚡ Steuerung" },
  { id: "alerts", label: "🔔 Alerts" },
];

export default function Tabs({ tab, onChange, alertLogCount }) {
  return (
    <nav style={{ padding: "0 16px", borderBottom: `1px solid ${colors.borderSubtle}` }} aria-label="Hauptnavigation">
      <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", gap: 0 }} role="tablist">
        {TAB_DEFS.map((t) => {
          const label = t.id === "alerts" ? `${t.label} (${alertLogCount})` : t.label;
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              id={`tab-${t.id}`}
              aria-controls={`panel-${t.id}`}
              onClick={() => onChange(t.id)}
              className="sg-focusable"
              style={{
                padding: "10px 14px",
                background: "none",
                border: "none",
                borderBottom: selected ? `2px solid ${colors.green}` : "2px solid transparent",
                color: selected ? colors.green : colors.textSecondary,
                fontSize: 11,
                fontFamily: fonts.mono,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
