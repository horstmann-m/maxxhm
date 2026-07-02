import { DEAL_STAGES, type Deal, type Contact } from "@/lib/api";
import { getDeals, getContacts } from "@/lib/server-api";
import { NewDealForm } from "./NewDealForm";
import { DealCard } from "./DealCard";

export default async function DealsPage() {
  let deals: Deal[] = [];
  let contacts: Contact[] = [];
  let loadError = false;
  try {
    [deals, contacts] = await Promise.all([getDeals(), getContacts()]);
  } catch {
    loadError = true;
  }

  const byStage = DEAL_STAGES.map((stage) => ({
    stage,
    deals: deals.filter((d) => d.stage === stage.value),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-espresso">Deals</h1>
        <p className="mt-1 text-espresso/70">Every offer, from first sample to closed.</p>
      </header>

      {loadError && (
        <p className="rounded-xl bg-clay/60 p-4 text-sm text-espresso/70">
          Couldn't reach the backend yet — check the API is running.
        </p>
      )}

      <NewDealForm contacts={contacts} />

      <div className="space-y-6">
        {byStage.map(({ stage, deals: stageDeals }) =>
          stageDeals.length === 0 ? null : (
            <section key={stage.value}>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-espresso/50">
                {stage.label} · {stageDeals.length}
              </h2>
              <div className="space-y-2">
                {stageDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </div>
            </section>
          )
        )}
        {deals.length === 0 && !loadError && (
          <p className="rounded-xl bg-clay/60 p-4 text-sm text-espresso/70">
            No deals yet — start one above.
          </p>
        )}
      </div>
    </div>
  );
}
