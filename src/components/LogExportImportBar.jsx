import { useRef } from "react";
import { colors, fonts } from "../theme.js";

const btnStyle = {
  fontFamily: fonts.mono,
  fontSize: 10,
  padding: "5px 10px",
  borderRadius: 5,
  cursor: "pointer",
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${colors.borderSubtle}`,
  color: colors.textSecondary,
};

// Small shared export/import control row used by WateringHistory.jsx and
// Alerts.jsx (Round 2, item 8) — client-side CSV/JSON download + upload,
// no backend (see src/lib/exportLog.js).
export default function LogExportImportBar({ label, onExportJson, onExportCsv, onImport }) {
  const fileInputRef = useRef(null);
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button type="button" onClick={onExportJson} className="sg-focusable" style={btnStyle} aria-label={`${label} als JSON exportieren`}>
        ⬇ JSON
      </button>
      <button type="button" onClick={onExportCsv} className="sg-focusable" style={btnStyle} aria-label={`${label} als CSV exportieren`}>
        ⬇ CSV
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="sg-focusable"
        style={btnStyle}
        aria-label={`${label} aus Datei importieren`}
      >
        ⬆ Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
          e.target.value = ""; // allow re-importing the same filename later
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
