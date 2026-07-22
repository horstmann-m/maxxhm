import { PLANT_ORDER } from "../plants/profiles.js";

// ============================================================
//  DEMO DATA GENERATOR
// ============================================================
// Emits the exact normalized schema documented in docs/API.md (plant-keyed,
// same shape whether it comes from the ESP32 or this simulator). Soil
// values are simulated as a running, stateful drift so the auto-watering
// loop and its safety gates can be visibly exercised in demo mode: soil
// dries out over time and a watering pulse (applyWateringPulse) bumps it
// back up, exactly mirroring what the firmware/pump would do.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createDemoState() {
  return {
    tick: 0,
    soil: { arabica: 68, chili: 60 },
    pumpActiveTicks: 0,
    lastPumpPlant: null,
  };
}

export function generateDemoData(state, now = new Date()) {
  state.tick += 1;
  const tick = state.tick;
  const t = tick * 0.1;
  const hour = now.getHours() + (now.getMinutes() / 60);
  const lightOn = hour >= 6 && hour < 22;

  // Soil dries out gradually; a watering pulse (see applyWateringPulse)
  // is the only thing that raises it back up.
  for (const key of PLANT_ORDER) {
    const decay = key === "arabica" ? 0.12 : 0.18;
    state.soil[key] = clamp(state.soil[key] - decay + (Math.random() - 0.5) * 0.6, 3, 98);
  }

  const pumpActive = state.pumpActiveTicks > 0;
  if (state.pumpActiveTicks > 0) state.pumpActiveTicks -= 1;

  const plants = {
    arabica: {
      soil_percent: Math.round(state.soil.arabica * 10) / 10,
      soil_raw: Math.round(480 + (100 - state.soil.arabica) * 4),
      light_lux: lightOn ? 4200 + Math.sin(t * 0.4) * 2200 + Math.random() * 400 : 20 + Math.random() * 15,
    },
    chili: {
      soil_percent: Math.round(state.soil.chili * 10) / 10,
      soil_raw: Math.round(520 + (100 - state.soil.chili) * 4),
      light_lux: lightOn ? 14000 + Math.sin(t * 0.5) * 6000 + Math.random() * 800 : 40 + Math.random() * 20,
    },
  };

  return {
    temperature: 23 + Math.sin(t * 0.3) * 2.5 + (Math.random() - 0.5) * 0.5,
    humidity: 58 + Math.sin(t * 0.2) * 12 + (Math.random() - 0.5) * 3,
    water: {
      tds_ppm: 310 + Math.sin(t * 0.1) * 40 + Math.random() * 15,
      ph: 6.3 + Math.sin(t * 0.15) * 0.4 + (Math.random() - 0.5) * 0.1,
    },
    plants,
    actuators: {
      pump_active: pumpActive,
      light_active: lightOn,
      last_pump_seconds_ago: state.lastPumpAt ? Math.round((now.getTime() - state.lastPumpAt) / 1000) : -1,
    },
    meta: {
      uptime_seconds: tick * Math.round(5),
      wifi_rssi: -45 + Math.random() * 10,
      ip: "192.168.1.42 (demo)",
      timestamp: now.toISOString().replace("T", " ").substring(0, 19),
    },
  };
}

// Called by the App-level auto-watering loop when shouldWater() decides a
// plant needs a pulse. Mutates the running demo state so the *next* tick
// reflects the pump firing and soil recovering — the same causal shape the
// real ESP32 loop has (fire pump -> soil rises over subsequent readings).
export function applyWateringPulse(state, plantKey, now = new Date(), boostPercent = 16) {
  state.soil[plantKey] = clamp(state.soil[plantKey] + boostPercent, 0, 98);
  state.pumpActiveTicks = 1;
  state.lastPumpPlant = plantKey;
  state.lastPumpAt = now.getTime();
}
