"use client";

import { useState } from "react";
import { InSeasonPanel } from "@/components/InSeasonPanel";
import { LeafletMap } from "@/components/LeafletMap";
import { MonthScrubber } from "@/components/MonthScrubber";
import { PageHeader } from "@/components/PageHeader";
import { SeasonLegend } from "@/components/SeasonLegend";
import { useRisk } from "@/components/WeatherRiskProvider";
import { MONTHS, currentMonth } from "@/lib/season";
import { origins, regions } from "@/lib/reference";

function WeatherStatus() {
  const { loading, error, updatedAt } = useRisk();
  const status = error
    ? "weather unavailable"
    : loading
      ? "loading weather…"
      : updatedAt
        ? `weather updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "";
  return <span className="text-xs text-muted">{status}</span>;
}

export default function Home() {
  const [month, setMonth] = useState(currentMonth());
  const isNow = month === currentMonth();

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Seasonality map"
        title="The global coffee clock"
        subtitle={
          <>
            {origins.length} origins · {regions.length} regions. Pan and zoom the map; each
            dot is an origin coloured by its stage for{" "}
            <span className="text-foreground font-medium">{MONTHS[month - 1]}</span>
            {isNow && <span className="text-muted"> (this month)</span>}. A ring flags a live
            weather-quality risk. Toggle the precipitation and temperature radar top-right.
          </>
        }
      />

      <div className="flex flex-col gap-3 mb-4">
        <MonthScrubber month={month} onChange={setMonth} />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SeasonLegend />
          <WeatherStatus />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <LeafletMap month={month} />
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
