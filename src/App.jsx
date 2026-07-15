import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { CONFIG } from "./config.js";
import { colors, fonts } from "./theme.js";
import { PLANTS, PLANT_ORDER } from "./plants/profiles.js";
import { generateDemoData, createDemoState, applyWateringPulse } from "./lib/demoData.js";
import { checkAlerts, dedupeAlerts } from "./lib/alerts.js";
import { computeHealth, estimateDLIIncrementMol, forecastSoilDryHours, shouldWater, defaultAutoWaterRule } from "./lib/health.js";
import { loadState, saveState } from "./lib/storage.js";
import { fetchSensors, sendCommand as apiSendCommand, fetchConfig, postConfig } from "./lib/api.js";

import Header from "./components/Header.jsx";
import Tabs from "./components/Tabs.jsx";
import StatusBar from "./components/StatusBar.jsx";
import Gauge from "./components/Gauge.jsx";
import PlantHealthCard from "./components/PlantHealthCard.jsx";
import TrendChart from "./components/TrendChart.jsx";
import Controls from "./components/Controls.jsx";
import ProfileEditor from "./components/ProfileEditor.jsx";
import AutoWaterPanel from "./components/AutoWaterPanel.jsx";
import WateringHistory from "./components/WateringHistory.jsx";
import Alerts from "./components/Alerts.jsx";
import Toast from "./components/Toast.jsx";
import SectionLabel from "./components/SectionLabel.jsx";

const EMPTY_HISTORY = () => ({
  temperature: [],
  humidity: [],
  tds: [],
  ph: [],
  plants: Object.fromEntries(PLANT_ORDER.map((k) => [k, { soil: [], light: [] }])),
});

const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);

function pushBounded(arr, val, max) {
  return [...arr.slice(-(max - 1)), val];
}

let idCounter = 0;
const nextId = () => `${Date.now()}-${idCounter++}`;

export default function App() {
  // ---- persisted state -------------------------------------------------
  const [tab, setTab] = useState(() => loadState("tab", "live"));
  const [isDemo, setIsDemo] = useState(() => loadState("isDemo", CONFIG.ESP32_URL === "demo"));
  const [alertLog, setAlertLog] = useState(() => loadState("alertLog", []));
  const [wateringLog, setWateringLog] = useState(() => loadState("wateringLog", []));
  const [profileOverrides, setProfileOverrides] = useState(() => loadState("profileOverrides", {}));
  const [autoWaterRules, setAutoWaterRules] = useState(() => {
    const saved = loadState("autoWaterRules", {});
    const merged = {};
    for (const key of PLANT_ORDER) merged[key] = saved[key] || defaultAutoWaterRule(PLANTS[key]);
    return merged;
  });
  const [autoWaterRuntime, setAutoWaterRuntime] = useState(() => {
    const saved = loadState("autoWaterRuntime", {});
    const merged = {};
    for (const key of PLANT_ORDER)
      merged[key] = saved[key] || { state: "disarmed", lastPumpAt: null, pulsesToday: 0, pulsesDate: todayKey(), lastReason: "" };
    return merged;
  });
  const [dli, setDli] = useState(() => loadState("dli", Object.fromEntries(PLANT_ORDER.map((k) => [k, { value: 0, date: todayKey() }]))));

  // ---- ephemeral state ---------------------------------------------------
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(EMPTY_HISTORY);
  const [alerts, setAlerts] = useState([]);
  const [connectionState, setConnectionState] = useState(isDemo ? "demo" : "disconnected");
  const [lastUpdateAt, setLastUpdateAt] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [toasts, setToasts] = useState([]);
  const [trendMetricKey, setTrendMetricKey] = useState("temperature");
  const [editingPlant, setEditingPlant] = useState("arabica");

  const demoStateRef = useRef(createDemoState());
  const activeAlertKeysRef = useRef(new Set());
  const consecutiveFailuresRef = useRef(0);
  const lastTickAtRef = useRef(Date.now());
  const autoWaterRulesRef = useRef(autoWaterRules);
  const autoWaterRuntimeRef = useRef(autoWaterRuntime);
  const liveConfigHydratedRef = useRef(false);
  const skipNextConfigPushRef = useRef(true); // don't push on initial mount / hydration

  useEffect(() => {
    autoWaterRulesRef.current = autoWaterRules;
  }, [autoWaterRules]);
  useEffect(() => {
    autoWaterRuntimeRef.current = autoWaterRuntime;
  }, [autoWaterRuntime]);

  // ---- persistence effects ----------------------------------------------
  useEffect(() => saveState("tab", tab), [tab]);
  useEffect(() => saveState("isDemo", isDemo), [isDemo]);
  useEffect(() => saveState("alertLog", alertLog), [alertLog]);
  useEffect(() => saveState("wateringLog", wateringLog), [wateringLog]);
  useEffect(() => saveState("profileOverrides", profileOverrides), [profileOverrides]);
  useEffect(() => saveState("autoWaterRules", autoWaterRules), [autoWaterRules]);
  useEffect(() => saveState("autoWaterRuntime", autoWaterRuntime), [autoWaterRuntime]);
  useEffect(() => saveState("dli", dli), [dli]);

  // Push rule edits to the ESP32 in live mode (GET/POST /api/config,
  // per docs/API.md). Skipped right after hydrating from the device so we
  // don't immediately echo its own config back at it.
  useEffect(() => {
    if (isDemo) return;
    if (skipNextConfigPushRef.current) {
      skipNextConfigPushRef.current = false;
      return;
    }
    postConfig(CONFIG.ESP32_URL, { auto_water: autoWaterRules }).then((result) => {
      if (!result.ok) showToast(`Konfiguration konnte nicht an das Gerät gesendet werden: ${result.error}`, "error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWaterRules, isDemo]);

  // ---- merged (defaults + user overrides) profiles -----------------------
  const profiles = useMemo(() => {
    const merged = {};
    for (const key of PLANT_ORDER) {
      const override = profileOverrides[key];
      merged[key] = override ? { ...PLANTS[key], thresholds: { ...PLANTS[key].thresholds, ...override } } : PLANTS[key];
    }
    return merged;
  }, [profileOverrides]);

  const showToast = useCallback((message, type = "info") => {
    const id = nextId();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800);
  }, []);

  // ---- main poll loop -----------------------------------------------------
  const fetchData = useCallback(async () => {
    const now = new Date();
    const dtSeconds = Math.max(0.5, (now.getTime() - lastTickAtRef.current) / 1000);
    lastTickAtRef.current = now.getTime();

    let newData;
    if (isDemo) {
      newData = generateDemoData(demoStateRef.current, now);
      consecutiveFailuresRef.current = 0;
      setConnectionState("demo");
      setLastUpdateAt(now.getTime());
    } else {
      const result = await fetchSensors(CONFIG.ESP32_URL);
      if (!result.ok) {
        consecutiveFailuresRef.current += 1;
        setConnectionState(consecutiveFailuresRef.current >= 3 ? "disconnected" : "stale");
        return; // keep last data on screen — no crash, no wipe (bug #4)
      }
      newData = result.data;
      consecutiveFailuresRef.current = 0;
      setConnectionState("live");
      setLastUpdateAt(now.getTime());

      // The ESP32 is the authoritative auto-water actor in live mode (see
      // docs/API.md) — hydrate the dashboard's rules from its /api/config
      // once per connection instead of pushing our (possibly stale/demo)
      // local defaults onto the device.
      if (!liveConfigHydratedRef.current) {
        liveConfigHydratedRef.current = true;
        const configResult = await fetchConfig(CONFIG.ESP32_URL);
        if (configResult.ok && configResult.data?.auto_water) {
          skipNextConfigPushRef.current = true;
          setAutoWaterRules((prev) => ({ ...prev, ...configResult.data.auto_water }));
        }
      }

      // Mirror the device-reported auto-water status (armed/cooling-down/
      // pumping, pulses_today) instead of re-simulating shouldWater()
      // client-side — in live mode the firmware already decided.
      if (newData.auto_water) {
        setAutoWaterRuntime((prev) => {
          const next = { ...prev };
          for (const key of PLANT_ORDER) {
            const reported = newData.auto_water[key];
            if (!reported) continue;
            next[key] = {
              ...next[key],
              state: reported.state || (reported.enabled ? "armed" : "disarmed"),
              pulsesToday: reported.pulses_today ?? next[key].pulsesToday,
              lastReason: "",
            };
          }
          return next;
        });
      }
    }

    // ---- demo-only auto-watering simulation --------------------------
    // Uses the same shouldWater() decision the firmware documents, so the
    // dashboard visibly exercises arm/cooldown/daily-cap/rising-edge
    // behavior even without hardware. On real hardware the ESP32 is
    // authoritative; the dashboard here just displays auto_water state
    // that arrives in the sensor payload.
    if (isDemo) {
      const runtime = { ...autoWaterRuntimeRef.current };
      const rules = autoWaterRulesRef.current;
      const newLogEntries = [];
      for (const plantKey of PLANT_ORDER) {
        const pr = { ...runtime[plantKey] };
        if (pr.pulsesDate !== todayKey(now)) {
          pr.pulsesToday = 0;
          pr.pulsesDate = todayKey(now);
        }
        const rule = rules[plantKey];
        const soilPercent = newData.plants[plantKey].soil_percent;
        const decision = shouldWater(
          { soilPercent, pumpActive: newData.actuators.pump_active, lastPumpAt: pr.lastPumpAt, pulsesToday: pr.pulsesToday, now: now.getTime() },
          rule
        );
        pr.lastReason = decision.reason;
        if (decision.water) {
          applyWateringPulse(demoStateRef.current, plantKey, now, 16);
          pr.lastPumpAt = now.getTime();
          pr.pulsesToday += 1;
          pr.state = "pumping";
          newData.actuators.pump_active = true;
          newData.plants[plantKey].soil_percent = demoStateRef.current.soil[plantKey];
          newLogEntries.push({
            id: nextId(),
            time: now.toLocaleTimeString(),
            plant: plantKey,
            pulseSeconds: rule.pulseSeconds,
            soilBefore: soilPercent,
            reason: decision.reason,
          });
        } else if (!rule.enabled) {
          pr.state = "disarmed";
        } else if (pr.lastPumpAt && (now.getTime() - pr.lastPumpAt) / 60000 < rule.cooldownMinutes) {
          pr.state = "cooling-down";
        } else {
          pr.state = "armed";
        }
        runtime[plantKey] = pr;
      }
      autoWaterRuntimeRef.current = runtime;
      setAutoWaterRuntime(runtime);
      if (newLogEntries.length) {
        setWateringLog((prev) => [...newLogEntries.reverse(), ...prev].slice(0, CONFIG.MAX_WATERING_LOG));
        for (const entry of newLogEntries) {
          showToast(`💧 ${profiles[entry.plant].name}: Auto-Bewässerung ausgelöst (${entry.pulseSeconds}s)`, "success");
        }
      }
    }

    setData(newData);

    setHistory((prev) => ({
      temperature: pushBounded(prev.temperature, newData.temperature, CONFIG.MAX_HISTORY),
      humidity: pushBounded(prev.humidity, newData.humidity, CONFIG.MAX_HISTORY),
      tds: pushBounded(prev.tds, newData.water?.tds_ppm, CONFIG.MAX_HISTORY),
      ph: pushBounded(prev.ph, newData.water?.ph, CONFIG.MAX_HISTORY),
      plants: Object.fromEntries(
        PLANT_ORDER.map((key) => [
          key,
          {
            soil: pushBounded(prev.plants[key].soil, newData.plants?.[key]?.soil_percent, CONFIG.MAX_HISTORY),
            light: pushBounded(prev.plants[key].light, newData.plants?.[key]?.light_lux, CONFIG.MAX_HISTORY),
          },
        ])
      ),
    }));

    // ---- DLI accumulation (labeled estimate; resets at local midnight) --
    setDli((prev) => {
      const next = { ...prev };
      for (const key of PLANT_ORDER) {
        const entry = prev[key]?.date === todayKey(now) ? prev[key] : { value: 0, date: todayKey(now) };
        const increment = estimateDLIIncrementMol(newData.plants?.[key]?.light_lux, dtSeconds);
        next[key] = { value: entry.value + increment, date: todayKey(now) };
      }
      return next;
    });

    // ---- alerts: rising-edge dedupe (bug #1) ------------------------------
    const newAlerts = checkAlerts(newData, profiles);
    setAlerts(newAlerts);
    const { activeKeys, risingEdge } = dedupeAlerts(newAlerts, activeAlertKeysRef.current);
    activeAlertKeysRef.current = activeKeys;
    if (risingEdge.length > 0) {
      setAlertLog((prev) => [...risingEdge.map((a) => ({ ...a, id: nextId(), time: now.toLocaleTimeString() })), ...prev].slice(0, CONFIG.MAX_ALERT_LOG));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, profiles, showToast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, CONFIG.POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // tick every second so "aktualisiert vor Ns" and cooldown timers stay live
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ---- command handling (manual controls) ---------------------------------
  const handleCommand = useCallback(
    async (endpoint, label) => {
      if (isDemo) {
        showToast(`${label}: im Demo-Modus simuliert (kein Gerät angesprochen)`, "info");
        return;
      }
      const result = await apiSendCommand(CONFIG.ESP32_URL, endpoint);
      if (result.ok) showToast(`${label}: Befehl gesendet`, "success");
      else showToast(`${label}: Fehler — ${result.error}`, "error");
    },
    [isDemo, showToast]
  );

  const toggleDemo = useCallback(() => {
    setIsDemo((prev) => {
      const next = !prev;
      demoStateRef.current = createDemoState();
      consecutiveFailuresRef.current = 0;
      liveConfigHydratedRef.current = false; // re-hydrate rules from device on next live connect
      skipNextConfigPushRef.current = true;
      setHistory(EMPTY_HISTORY());
      // Deliberately keep the last reading on screen instead of nulling
      // `data` here: if the newly selected mode (e.g. a live host) never
      // responds, the app must still show the last known values with a
      // stale/disconnected badge (bug #4) rather than an indefinite
      // full-screen "loading" state with no chrome at all.
      setConnectionState(next ? "stale" : "demo");
      return next;
    });
  }, []);

  const handleSaveProfile = useCallback((plantKey, thresholds) => {
    setProfileOverrides((prev) => ({ ...prev, [plantKey]: thresholds }));
  }, []);

  const handleResetProfile = useCallback((plantKey) => {
    setProfileOverrides((prev) => {
      const next = { ...prev };
      delete next[plantKey];
      return next;
    });
  }, []);

  const handleChangeRule = useCallback((plantKey, patch) => {
    setAutoWaterRules((prev) => ({ ...prev, [plantKey]: { ...prev[plantKey], ...patch } }));
  }, []);

  const handleToggleArm = useCallback(
    (plantKey) => {
      setAutoWaterRules((prev) => {
        const nextEnabled = !prev[plantKey].enabled;
        showToast(`${profiles[plantKey].name}: Auto-Bewässerung ${nextEnabled ? "scharf geschaltet" : "deaktiviert"}`, "info");
        return { ...prev, [plantKey]: { ...prev[plantKey], enabled: nextEnabled } };
      });
    },
    [profiles, showToast]
  );

  // ---- derived / render ----------------------------------------------------
  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, color: colors.green, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fonts.mono }}>
        Lade Sensordaten…
      </div>
    );
  }

  const upMin = Math.floor((data.meta?.uptime_seconds || 0) / 60);
  const secondsSinceUpdate = lastUpdateAt ? (nowTick - lastUpdateAt) / 1000 : null;

  const trendMetrics = [
    { key: "temperature", label: "Temperatur", color: colors.orange, unit: "°C", data: history.temperature },
    { key: "humidity", label: "Luftfeuchtigkeit", color: colors.blue, unit: "%", data: history.humidity },
    { key: "tds", label: "TDS", color: colors.cyan, unit: "ppm", data: history.tds },
    { key: "ph", label: "pH", color: colors.purple, unit: "", data: history.ph },
    ...PLANT_ORDER.map((k) => ({ key: `${k}.soil`, label: `${profiles[k].name} Boden`, color: profiles[k].color, unit: "%", data: history.plants[k].soil })),
    ...PLANT_ORDER.map((k) => ({ key: `${k}.light`, label: `${profiles[k].name} Licht`, color: profiles[k].color, unit: " lux", data: history.plants[k].light })),
  ];

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: fonts.serif }}>
      <Header isDemo={isDemo} onToggleDemo={toggleDemo} alertCount={alerts.length} ip={data.meta?.ip} connectionState={connectionState} />
      <Tabs tab={tab} onChange={setTab} alertLogCount={alertLog.length} />

      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          {tab === "live" && (
            <div id="panel-live" role="tabpanel" aria-labelledby="tab-live" style={{ display: "grid", gap: 14 }}>
              {PLANT_ORDER.map((key) => {
                const profile = profiles[key];
                const reading = {
                  temperature: data.temperature,
                  humidity: data.humidity,
                  light_lux: data.plants?.[key]?.light_lux,
                  soil_percent: data.plants?.[key]?.soil_percent,
                  ph: data.water?.ph,
                };
                const health = computeHealth(profile, reading);
                const forecastHours = forecastSoilDryHours(history.plants[key].soil, autoWaterRules[key].thresholdPercent, CONFIG.POLL_INTERVAL / 1000);
                return (
                  <PlantHealthCard key={key} profile={profile} health={health} dliToday={dli[key]?.value} forecastHours={forecastHours} />
                );
              })}

              <SectionLabel>Umgebung</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Gauge label="Temperatur" value={data.temperature} unit="°C" min={10} max={40} color={colors.orange} icon="🌡️" sparkData={history.temperature} />
                <Gauge label="Luftfeuchtigkeit" value={data.humidity} unit="%" min={0} max={100} color={colors.blue} icon="💨" sparkData={history.humidity} />
              </div>

              <SectionLabel>Licht</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PLANT_ORDER.map((key) => (
                  <Gauge
                    key={key}
                    label={profiles[key].name}
                    value={data.plants?.[key]?.light_lux}
                    unit="lux"
                    min={0}
                    max={key === "chili" ? 35000 : 16000}
                    decimals={0}
                    color={profiles[key].color}
                    icon={profiles[key].icon}
                    sparkData={history.plants[key].light}
                  />
                ))}
              </div>

              <SectionLabel>Bodenfeuchtigkeit</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PLANT_ORDER.map((key) => (
                  <Gauge
                    key={key}
                    label={profiles[key].name}
                    value={data.plants?.[key]?.soil_percent}
                    unit="%"
                    min={0}
                    max={100}
                    decimals={0}
                    color={profiles[key].color}
                    icon={profiles[key].icon}
                    sparkData={history.plants[key].soil}
                  />
                ))}
              </div>

              <SectionLabel>Wasserqualität</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Gauge label="TDS" value={data.water?.tds_ppm} unit="ppm" min={0} max={1000} decimals={0} color={colors.cyan} icon="🧪" sparkData={history.tds} />
                <Gauge label="pH" value={data.water?.ph} unit="pH" min={4} max={9} decimals={1} color={colors.purple} icon="⚗️" sparkData={history.ph} />
              </div>

              <SectionLabel>Verlauf</SectionLabel>
              <TrendChart metrics={trendMetrics} selectedKey={trendMetricKey} onSelect={setTrendMetricKey} />

              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                <StatusPill label="Pumpe" active={data.actuators?.pump_active} colorOn={colors.blue} />
                <StatusPill label="Licht" active={data.actuators?.light_active} colorOn={colors.orange} />
                <div style={{ padding: "8px 14px", borderRadius: 6, background: colors.bgPanel, border: `1px solid ${colors.borderSubtle}`, fontSize: 11, fontFamily: fonts.mono, color: colors.textSecondary }}>
                  Letzte Bewässerung:{" "}
                  {data.actuators?.last_pump_seconds_ago > 0 ? `vor ${Math.floor(data.actuators.last_pump_seconds_ago / 60)}m` : "nie"}
                </div>
                <div style={{ padding: "8px 14px", borderRadius: 6, background: colors.bgPanel, border: `1px solid ${colors.borderSubtle}`, fontSize: 11, fontFamily: fonts.mono, color: colors.textSecondary }}>
                  Uptime {upMin}m
                </div>
              </div>

              <StatusBar connectionState={connectionState} secondsSinceUpdate={secondsSinceUpdate} dataPointCount={history.temperature.length} timestamp={data.meta?.timestamp} />
            </div>
          )}

          {tab === "controls" && (
            <div id="panel-controls" role="tabpanel" aria-labelledby="tab-controls" style={{ display: "grid", gap: 16 }}>
              <Controls isDemo={isDemo} onCommand={handleCommand} />

              <SectionLabel>Automatische Bewässerung</SectionLabel>
              {PLANT_ORDER.map((key) => (
                <AutoWaterPanel
                  key={key}
                  profile={profiles[key]}
                  rule={autoWaterRules[key]}
                  status={autoWaterRuntime[key]}
                  onChangeRule={handleChangeRule}
                  onToggleArm={handleToggleArm}
                />
              ))}

              <WateringHistory log={wateringLog} profiles={profiles} />

              <SectionLabel>Pflanzenprofile bearbeiten</SectionLabel>
              <div style={{ padding: 16, background: colors.bgPanel, borderRadius: 8, border: `1px solid ${colors.borderSubtle}` }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {PLANT_ORDER.map((key) => (
                    <button
                      key={key}
                      onClick={() => setEditingPlant(key)}
                      className="sg-focusable"
                      aria-pressed={editingPlant === key}
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 11,
                        padding: "6px 12px",
                        borderRadius: 6,
                        cursor: "pointer",
                        background: editingPlant === key ? "rgba(139,195,74,0.16)" : "transparent",
                        border: `1px solid ${editingPlant === key ? colors.green + "66" : colors.borderSubtle}`,
                        color: editingPlant === key ? colors.green : colors.textSecondary,
                      }}
                    >
                      {profiles[key].icon} {profiles[key].name}
                    </button>
                  ))}
                </div>
                <ProfileEditor plantKey={editingPlant} thresholds={profiles[editingPlant].thresholds} onSave={handleSaveProfile} onReset={handleResetProfile} />
              </div>
            </div>
          )}

          {tab === "alerts" && (
            <div id="panel-alerts" role="tabpanel" aria-labelledby="tab-alerts">
              <Alerts alerts={alerts} alertLog={alertLog} />
            </div>
          )}
        </div>
      </div>

      <Toast toasts={toasts} />
    </div>
  );
}

function StatusPill({ label, active, colorOn }) {
  return (
    <div
      role="status"
      style={{
        padding: "8px 14px",
        borderRadius: 6,
        background: active ? `${colorOn}18` : colors.bgPanel,
        border: `1px solid ${active ? colorOn + "44" : colors.borderSubtle}`,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: active ? colorOn : colors.textMuted }} aria-hidden="true" />
      <span style={{ fontSize: 11, fontFamily: fonts.mono, color: active ? colorOn : colors.textSecondary }}>
        {label}: {active ? "AN" : "AUS"}
      </span>
    </div>
  );
}
