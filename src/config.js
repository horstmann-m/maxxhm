// ============================================================
//  GLOBAL CONFIGURATION
// ============================================================
// Set ESP32_URL to your device's base URL (e.g. "http://192.168.1.42")
// once hardware is on the network. "demo" runs the simulated data
// generator so the dashboard is fully usable without hardware.
export const CONFIG = {
  ESP32_URL: "demo",
  POLL_INTERVAL: 5000, // ms between sensor polls
  MAX_HISTORY: 60, // data points kept per metric for sparklines/charts
  MAX_ALERT_LOG: 50,
  MAX_WATERING_LOG: 50,
};

// API endpoints served by the ESP32 firmware (see docs/API.md).
export const ENDPOINTS = {
  sensors: "/api/sensors",
  pump: "/api/pump",
  light: "/api/light",
  config: "/api/config",
};
