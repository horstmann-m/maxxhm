import { useState, useEffect } from "react";
import { colors, fonts } from "../theme.js";
import { PLANTS } from "../plants/profiles.js";

const METRIC_LABELS = { temperature: "Temperatur (°C)", humidity: "Luftfeuchtigkeit (%)", light: "Licht (lux)", soil: "Boden (%)", ph: "pH" };
const BOUND_LABELS = { critLow: "Kritisch min", warnLow: "Warn min", idealLow: "Ideal min", idealHigh: "Ideal max", warnHigh: "Warn max", critHigh: "Kritisch max" };
const BOUND_ORDER = ["critLow", "warnLow", "idealLow", "idealHigh", "warnHigh", "critHigh"];

const inputStyle = {
  width: 66,
  background: "#10140F",
  color: colors.text,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: 4,
  padding: "4px 6px",
  fontFamily: fonts.mono,
  fontSize: 11,
};

const btnBase = { fontFamily: fonts.mono, fontSize: 11, padding: "6px 14px", borderRadius: 6, cursor: "pointer" };

// Editable per-plant threshold profile, persisted to localStorage by the
// parent (App.jsx). Replaces the prototype's read-only hardcoded
// THRESHOLDS block (plan bug #8).
export default function ProfileEditor({ plantKey, thresholds, onSave, onReset }) {
  const defaults = PLANTS[plantKey].thresholds;
  const [draft, setDraft] = useState(thresholds);
  useEffect(() => setDraft(thresholds), [plantKey, thresholds]);

  const setField = (metric, bound, value) => {
    setDraft((d) => ({ ...d, [metric]: { ...d[metric], [bound]: value === "" ? undefined : Number(value) } }));
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {Object.keys(METRIC_LABELS).map((metric) => {
        const metricDefaults = defaults[metric];
        if (!metricDefaults) return null;
        return (
          <div key={metric} style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.textSecondary }}>{METRIC_LABELS[metric]}</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {BOUND_ORDER.filter((b) => metricDefaults[b] !== undefined).map((bound) => (
                <label key={bound} style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.textTertiary, display: "flex", flexDirection: "column", gap: 2 }}>
                  {BOUND_LABELS[bound]}
                  <input
                    type="number"
                    step="0.1"
                    value={draft[metric]?.[bound] ?? ""}
                    onChange={(e) => setField(metric, bound, e.target.value)}
                    aria-label={`${METRIC_LABELS[metric]} ${BOUND_LABELS[bound]}`}
                    className="sg-focusable"
                    style={inputStyle}
                  />
                </label>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={() => onSave(plantKey, draft)}
          className="sg-focusable"
          style={{ ...btnBase, background: "rgba(139,195,74,0.14)", border: `1px solid ${colors.green}55`, color: colors.green }}
        >
          💾 Speichern
        </button>
        <button
          onClick={() => onReset(plantKey)}
          className="sg-focusable"
          style={{ ...btnBase, background: "rgba(255,255,255,0.03)", border: `1px solid ${colors.borderSubtle}`, color: colors.textSecondary }}
        >
          ↺ Zurücksetzen
        </button>
      </div>
    </div>
  );
}
