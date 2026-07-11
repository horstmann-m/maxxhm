import { HarvestCalendar } from "@/components/HarvestCalendar";
import { PageHeader } from "@/components/PageHeader";
import { SeasonLegend } from "@/components/SeasonLegend";

export default function CalendarPage() {
  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Seasonality"
        title="Harvest calendar"
        subtitle="The whole growing year across every tracked region. Colours follow the headline stage each month; the outlined column is the current month."
      />
      <SeasonLegend className="mb-4" />
      <HarvestCalendar />
    </div>
  );
}
