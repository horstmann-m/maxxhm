"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { origins, regionsForOrigin } from "@/lib/reference";
import { originCentroid, originStatus } from "@/lib/season";
import { useRisk } from "@/components/WeatherRiskProvider";
import { RISK_META, aggregateLevel } from "@/lib/risk";

const OWM_KEY = process.env.NEXT_PUBLIC_OWM_API_KEY;
type Layer = "none" | "precip" | "temp";

// Fetch RainViewer's latest radar frame -> a Leaflet tile URL template.
let radarUrlPromise: Promise<string | null> | null = null;
function radarTileUrl(): Promise<string | null> {
  if (!radarUrlPromise) {
    radarUrlPromise = fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then((r) => r.json())
      .then((j) => {
        const frames = [...(j.radar?.past ?? []), ...(j.radar?.nowcast ?? [])];
        const last = frames[frames.length - 1];
        return last ? `${j.host}${last.path}/256/{z}/{x}/{y}/6/1_1.png` : null;
      })
      .catch(() => null);
  }
  return radarUrlPromise;
}

export default function LeafletMapImpl({ month }: { month: number }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const overlay = useRef<L.TileLayer | null>(null);
  const [layer, setLayer] = useState<Layer>("none");
  const { byRegion } = useRisk();

  // one-time map init
  useEffect(() => {
    if (map.current || !mapRef.current) return;
    const m = L.map(mapRef.current, { worldCopyJump: true, minZoom: 2 }).setView([12, 0], 2);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(m);
    markerLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // (re)draw origin markers when month or risk changes
  const markerDeps = useMemo(() => `${month}:${byRegion.size}`, [month, byRegion]);
  useEffect(() => {
    const grp = markerLayer.current;
    if (!grp) return;
    grp.clearLayers();
    for (const o of origins) {
      const rs = regionsForOrigin(o.id);
      if (rs.length === 0) continue;
      const c = originCentroid(rs);
      const st = originStatus(rs, month);
      const risk = aggregateLevel(rs.map((r) => byRegion.get(r.id)));
      const marker = L.circleMarker([c.lat, c.lng], {
        radius: 7,
        color: risk !== "ok" ? RISK_META[risk].color : "rgba(0,0,0,0.35)",
        weight: risk !== "ok" ? 3 : 1,
        fillColor: st.meta.color,
        fillOpacity: 1,
      });
      marker.bindTooltip(`${o.name} — ${st.meta.label}`, { direction: "top" });
      marker.bindPopup(
        `<strong>${o.name}</strong><br/><span style="color:${st.meta.color}">●</span> ${st.meta.label}` +
          (risk !== "ok" ? `<br/>${RISK_META[risk].icon} weather ${RISK_META[risk].label}` : "") +
          `<br/><a href="/origin/${o.id}">View profile →</a>`
      );
      marker.addTo(grp);
    }
  }, [markerDeps, month, byRegion]);

  // weather radar overlay
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (overlay.current) {
      overlay.current.remove();
      overlay.current = null;
    }
    if (layer === "precip") {
      radarTileUrl().then((url) => {
        if (url && map.current && layer === "precip") {
          overlay.current = L.tileLayer(url, { opacity: 0.6, attribution: "RainViewer" }).addTo(map.current);
        }
      });
    } else if (layer === "temp" && OWM_KEY) {
      overlay.current = L.tileLayer(
        `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
        { opacity: 0.6, attribution: "OpenWeatherMap" }
      ).addTo(m);
    }
  }, [layer]);

  const btn = (v: Layer, label: string) => (
    <button
      onClick={() => setLayer(v)}
      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
        layer === v ? "bg-accent text-accent-fg" : "bg-surface hover:bg-surface-2"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className="w-full h-[520px] rounded-xl border border-border overflow-hidden z-0"
      />
      <div className="absolute top-3 right-3 z-[500] flex rounded-lg overflow-hidden border border-border shadow-sm">
        {btn("none", "Season")}
        {btn("precip", "Precip")}
        {btn("temp", "Temp")}
      </div>
      {layer === "temp" && !OWM_KEY && (
        <div className="absolute bottom-3 left-3 z-[500] text-xs bg-surface border border-border rounded-lg px-2.5 py-1.5 text-muted max-w-[260px]">
          Temperature radar needs a free OpenWeatherMap key — set{" "}
          <code>NEXT_PUBLIC_OWM_API_KEY</code>. Markers stay coloured by season.
        </div>
      )}
    </div>
  );
}
