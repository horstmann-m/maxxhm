"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPriceQuote, type PriceMarket } from "@/lib/api";

export function PriceEntryForm() {
  const router = useRouter();
  const [market, setMarket] = useState<PriceMarket>("arabica");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addPriceQuote({
        market,
        price: Number(price),
        currency,
        quoteDate: new Date().toISOString().slice(0, 10),
        source: "manual",
      });
      setPrice("");
      router.refresh();
    } catch {
      setError("Couldn't save that quote.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-clay bg-white/60 p-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-espresso/50">
        Log today's price
      </h2>
      <div className="flex gap-2">
        {(["arabica", "robusta", "usd_index"] as PriceMarket[]).map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => setMarket(m)}
            className={`flex-1 rounded-xl py-2 text-sm capitalize ${
              market === m ? "bg-terracotta text-parchment" : "bg-clay/60 text-espresso/70"
            }`}
          >
            {m === "usd_index" ? "USD/EUR" : m}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          required
          placeholder={market === "usd_index" ? "e.g. 1.08" : market === "robusta" ? "$/tonne" : "cents/lb"}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="flex-1 rounded-xl border border-clay bg-white/70 p-3 text-espresso focus:border-terracotta focus:outline-none"
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="rounded-xl border border-clay bg-white/70 p-3 text-espresso"
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      {error && <p className="text-sm text-terracotta">{error}</p>}
      <button
        type="submit"
        disabled={saving || !price}
        className="w-full rounded-xl bg-terracotta py-3 text-parchment disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save price"}
      </button>
    </form>
  );
}
