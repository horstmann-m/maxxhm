// ============================================================
//  LOCALSTORAGE PERSISTENCE
// ============================================================
// Small, defensive wrapper: never throws (private browsing / quota /
// disabled storage should degrade to in-memory behavior, not crash).
const PREFIX = "smartGarden.";

export function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveState(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage unavailable — fail silently, app keeps working in-memory
  }
}

export function clearState(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
