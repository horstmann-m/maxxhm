import { type PriceQuote, type Arbitrage } from "@/lib/api";
import { getPrices, getArbitrage } from "@/lib/server-api";
import { PriceEntryForm } from "./PriceEntryForm";

function latestByMarket(quotes: PriceQuote[], market: string): PriceQuote | undefined {
  return quotes
    .filter((q) => q.market === market)
    .sort((a, b) => new Date(b.quoteDate).getTime() - new Date(a.quoteDate).getTime())[0];
}

export default async function PricesPage() {
  let quotes: PriceQuote[] = [];
  let arbitrage: Arbitrage | null = null;
  let loadError = false;
  try {
    [quotes, arbitrage] = await Promise.all([getPrices(), getArbitrage()]);
  } catch {
    loadError = true;
  }

  const arabica = latestByMarket(quotes, "arabica");
  const robusta = latestByMarket(quotes, "robusta");
  const usd = latestByMarket(quotes, "usd_index");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-espresso">Market prices</h1>
        <p className="mt-1 text-espresso/70">
          Delayed, manually logged — good enough to see where things stand.
        </p>
      </header>

      {loadError && (
        <p className="rounded-xl bg-clay/60 p-4 text-sm text-espresso/70">
          Couldn't reach the backend yet — check the API is running.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <PriceTile label="Arabica" quote={arabica} unit="¢/lb" />
        <PriceTile label="Robusta" quote={robusta} unit="$/t" />
        <PriceTile label="USD/EUR" quote={usd} unit="" />
      </div>

      <div className="rounded-2xl bg-sage/10 p-4">
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-espresso/50">
          Arbitrage (Arabica − Robusta)
        </h2>
        {arbitrage ? (
          <p className="text-2xl font-semibold text-espresso">
            ${arbitrage.spreadUsdPerTonne.toFixed(0)}
            <span className="ml-1 text-sm font-normal text-espresso/60">/tonne</span>
          </p>
        ) : (
          <p className="text-sm text-espresso/60">Log both an Arabica and a Robusta price to see the spread.</p>
        )}
      </div>

      <PriceEntryForm />

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-espresso/50">
          Recent entries
        </h2>
        <ul className="space-y-2">
          {quotes
            .slice()
            .reverse()
            .slice(0, 15)
            .map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between rounded-xl border border-clay bg-white/60 p-3 text-sm"
              >
                <span className="capitalize text-espresso/80">{q.market.replace("_", " ")}</span>
                <span className="text-espresso">
                  {q.price} {q.currency}
                </span>
                <span className="text-espresso/50">{new Date(q.quoteDate).toLocaleDateString()}</span>
              </li>
            ))}
          {quotes.length === 0 && !loadError && (
            <p className="text-sm text-espresso/60">No prices logged yet.</p>
          )}
        </ul>
      </section>
    </div>
  );
}

function PriceTile({ label, quote, unit }: { label: string; quote?: PriceQuote; unit: string }) {
  return (
    <div className="rounded-xl border border-clay bg-white/60 p-3 text-center">
      <p className="text-xs text-espresso/50">{label}</p>
      <p className="mt-1 font-semibold text-espresso">{quote ? `${quote.price}${unit ? ` ${unit}` : ""}` : "—"}</p>
    </div>
  );
}
