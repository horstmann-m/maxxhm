// ============================================================
//  LOG EXPORT / IMPORT (CSV + JSON) — client-side only
// ============================================================
// Watering + alert logs live only in localStorage, capped at
// CONFIG.MAX_WATERING_LOG / MAX_ALERT_LOG entries (src/config.js), and
// vanish on cache clear. This gives the user a manual download/upload
// round trip to archive logs externally (spreadsheet, backup file) and
// restore them later — explicitly no backend/database, per the project
// plan (over-engineering for a single-user device on a trusted LAN).

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((c) => csvEscape(row[c])).join(","));
  return [header, ...lines].join("\n");
}

export const WATERING_LOG_COLUMNS = ["id", "time", "plant", "pulseSeconds", "soilBefore", "reason"];
export const ALERT_LOG_COLUMNS = ["id", "time", "key", "level", "msg", "icon"];

const timestampSlug = () => new Date().toISOString().replace(/[:.]/g, "-");

export function exportWateringLogJson(log) {
  downloadFile(`smart-garden-bewaesserung-${timestampSlug()}.json`, JSON.stringify(log, null, 2), "application/json");
}

export function exportWateringLogCsv(log) {
  downloadFile(`smart-garden-bewaesserung-${timestampSlug()}.csv`, toCsv(log, WATERING_LOG_COLUMNS), "text/csv");
}

export function exportAlertLogJson(log) {
  downloadFile(`smart-garden-alerts-${timestampSlug()}.json`, JSON.stringify(log, null, 2), "application/json");
}

export function exportAlertLogCsv(log) {
  downloadFile(`smart-garden-alerts-${timestampSlug()}.csv`, toCsv(log, ALERT_LOG_COLUMNS), "text/csv");
}

// ---- CSV parsing (small hand-rolled parser — quoted fields, escaped
// quotes via "", no external dependency for a handful of simple columns) --
function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

export function parseCsv(text) {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line);
    const row = {};
    header.forEach((col, i) => {
      row[col] = fields[i] ?? "";
    });
    return row;
  });
}

// Reads a File (from an <input type="file">), auto-detecting JSON
// (leading `[`/`{`) vs. CSV (a matching header row from the exports
// above). Resolves to an array of plain-object entries — callers are
// responsible for validating/coercing field types before merging into
// app state (CSV round-trips everything as strings).
export function importLogFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Keine Datei ausgewählt"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const trimmed = text.trim();
        let entries;
        if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
          const parsed = JSON.parse(trimmed);
          entries = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          entries = parseCsv(trimmed);
        }
        if (!Array.isArray(entries)) throw new Error("unerwartetes Format (kein Array)");
        resolve(entries);
      } catch (err) {
        reject(new Error(`Ungültige Datei: ${err.message}`));
      }
    };
    reader.readAsText(file);
  });
}
