import { HarvestCalendar } from "@/components/HarvestCalendar";
import { SeasonLegend } from "@/components/SeasonLegend";

export default function CalendarPage() {
  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Harvest calendar
        </h1>
        <p className="text-muted mt-1 max-w-2xl">
          The whole growing year across every tracked region. Colours follow the
          headline stage each month; the outlined column is the current month.
        </p>
      </header>
      <SeasonLegend className="mb-4" />
      <HarvestCalendar />
    </div>
  );
}
