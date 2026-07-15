import { ENDPOINTS } from "../config.js";

// ============================================================
//  ESP32 HTTP CLIENT
// ============================================================
// All calls are timeout-guarded and return a {ok, data|error} result
// instead of throwing, so callers (App.jsx) always get a definite
// success/failure signal to drive connection state + toasts — fixing
// the prototype's silent `catch {}` / bare `return`.

async function request(url, { timeoutMs = 4000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, res };
  } catch (err) {
    const message = err.name === "AbortError" ? "Zeitüberschreitung" : err.message || "Netzwerkfehler";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSensors(baseUrl, opts) {
  const result = await request(`${baseUrl}${ENDPOINTS.sensors}`, opts);
  if (!result.ok) return result;
  try {
    const data = await result.res.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Ungültige Antwort" };
  }
}

export async function sendCommand(baseUrl, endpoint, opts) {
  const result = await request(`${baseUrl}${endpoint}`, opts);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function fetchConfig(baseUrl, opts) {
  const result = await request(`${baseUrl}${ENDPOINTS.config}`, opts);
  if (!result.ok) return result;
  try {
    const data = await result.res.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Ungültige Antwort" };
  }
}

export async function postConfig(baseUrl, config, { timeoutMs = 4000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${ENDPOINTS.config}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (err) {
    const message = err.name === "AbortError" ? "Zeitüberschreitung" : err.message || "Netzwerkfehler";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
