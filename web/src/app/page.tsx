"use client";

import { useState } from "react";
import { InSeasonPanel } from "@/components/InSeasonPanel";
import { MonthScrubber } from "@/components/MonthScrubber";
import { PageHeader } from "@/components/PageHeader";
import { SeasonLegend } from "@/components/SeasonLegend";
import { WorldMap } from "@/components/WorldMap";
import { useRisk } from "@/components/WeatherRiskProvider";
import { MONTHS, currentMonth } from "@/lib/season";
import { origins, regions } from "@/lib/reference";

function WeatherToggle({
  showRisk,
  onToggle,
}: {
  showRisk: boolean;
  onToggle: () => void;
}) {
  const { loading, error, updatedAt } = useRisk();
  const status = error
    ? "weather unavailable"
    : loading
      ? "loading weather…"
      : updatedAt
        ? `updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">{status}</span>
      <button
        onClick={onToggle}
        aria-pressed={showRisk}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          showRisk ? "bg-accent text-accent-fg border-accent" : "border-border hover:bg-surface-2"
        }`}
      >
        🌦️ Weather risk {showRisk ? "on" : "off"}
      </button>
    </div>
  );
}

export default function Home() {
  const [month, setMonth] = useState(currentMonth());
  const [showRisk, setShowRisk] = useState(true);
  const isNow = month === currentMonth();

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Seasonality map"
        title="The global coffee clock"
        subtitle={
          <>
            {origins.length} origins · {regions.length} regions. Each dot is an origin,
            coloured by the most advanced stage across its regions for{" "}
            <span className="text-foreground font-medium">{MONTHS[month - 1]}</span>
            {isNow && <span className="text-muted"> (this month)</span>}. A ring flags a
            live weather-quality risk. Click an origin to open it.
          </>
        }
      />

      <div className="flex flex-col gap-3 mb-4">
        <MonthScrubber month={month} onChange={setMonth} />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SeasonLegend />
          <WeatherToggle showRisk={showRisk} onToggle={() => setShowRisk((v) => !v)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <WorldMap month={month} showRisk={showRisk} />
        <aside className="card p-4">
          <h2 className="font-display text-xl font-semibold mb-1">
            In season · {MONTHS[month - 1]}
          </h2>
          <p className="text-xs text-muted mb-4">
            Where every tracked region sits right now — the buying window opens at
            <span className="text-foreground"> Arriving</span>.
          </p>
          <InSeasonPanel month={month} />
        </aside>
      </div>
    </div>
  );
}
