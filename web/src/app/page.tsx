"use client";

import { useState } from "react";
import { InSeasonPanel } from "@/components/InSeasonPanel";
import { MonthScrubber } from "@/components/MonthScrubber";
import { SeasonLegend } from "@/components/SeasonLegend";
import { WorldMap } from "@/components/WorldMap";
import { MONTHS, currentMonth } from "@/lib/season";
import { origins, regions } from "@/lib/reference";

export default function Home() {
  const [month, setMonth] = useState(currentMonth());
  const isNow = month === currentMonth();

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          The global coffee clock
        </h1>
        <p className="text-muted mt-1 max-w-2xl">
          {origins.length} origins · {regions.length} regions. Each dot is an origin,
          coloured by the most advanced stage across its regions for{" "}
          <span className="text-foreground font-medium">{MONTHS[month - 1]}</span>
          {isNow && <span className="text-muted"> (this month)</span>}. Click an origin
          to open its regions, notes and tastings.
        </p>
      </header>

      <div className="flex flex-col gap-3 mb-4">
        <MonthScrubber month={month} onChange={setMonth} />
        <SeasonLegend />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <WorldMap month={month} />
        <aside className="bg-surface border border-border rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-1">
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
