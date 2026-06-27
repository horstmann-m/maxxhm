"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDeal, type Contact, type PriceMarket } from "@/lib/api";

export function NewDealForm({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [coffeeDescription, setCoffeeDescription] = useState("");
  const [priceType, setPriceType] = useState<"outright" | "differential">("outright");
  const [currency, setCurrency] = useState<"EUR" | "USD">("USD");
  const [outrightPrice, setOutrightPrice] = useState("");
  const [market, setMarket] = useState<PriceMarket>("arabica");
  const [differentialCents, setDifferentialCents] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createDeal({
        contactId,
        coffeeDescription: coffeeDescription || undefined,
        priceType,
        currency,
        outrightPrice: priceType === "outright" ? Number(outrightPrice) : undefined,
        market: priceType === "differential" ? (market as "robusta" | "arabica") : undefined,
        differentialCents: priceType === "differential" ? Number(differentialCents) : undefined,
        quantityKg: quantityKg ? Number(quantityKg) : undefined,
      });
      setOpen(false);
      setContactId("");
      setCoffeeDescription("");
      setOutrightPrice("");
      setDifferentialCents("");
      setQuantityKg("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that deal.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl bg-terracotta py-3 font-medium text-parchment"
      >
        + New deal
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-clay bg-white/60 p-4">
      <select
        required
        value={contactId}
        onChange={(e) => setContactId(e.target.value)}
        className="w-full rounded-xl border border-clay bg-white/70 p-3 text-espresso"
      >
        <option value="">Who's this offer for?</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.company ? `(${c.company})` : ""}
          </option>
        ))}
      </select>

      <input
        placeholder="Coffee — e.g. Yirgacheffe natural, 88pts"
        value={coffeeDescription}
        onChange={(e) => setCoffeeDescription(e.target.value)}
        className="w-full rounded-xl border border-clay bg-white/70 p-3 text-espresso"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setPriceType("outright")}
          className={`flex-1 rounded-xl py-2 text-sm ${
            priceType === "outright" ? "bg-terracotta text-parchment" : "bg-clay/60 text-espresso/70"
          }`}
        >
          Outright
        </button>
        <button
          type="button"
          onClick={() => setPriceType("differential")}
          className={`flex-1 rounded-xl py-2 text-sm ${
            priceType === "differential" ? "bg-terracotta text-parchment" : "bg-clay/60 text-espresso/70"
          }`}
        >
          Differential to C-market
        </button>
      </div>

      <div className="flex gap-2">
        {(["USD", "EUR"] as const).map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setCurrency(c)}
            className={`flex-1 rounded-xl py-2 text-sm ${
              currency === c ? "bg-espresso text-parchment" : "bg-clay/60 text-espresso/70"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {priceType === "outright" ? (
        <input
          type="number"
          step="0.01"
          required
          placeholder={`Price (¢/lb, ${currency})`}
          value={outrightPrice}
          onChange={(e) => setOutrightPrice(e.target.value)}
          className="w-full rounded-xl border border-clay bg-white/70 p-3 text-espresso"
        />
      ) : (
        <div className="flex gap-2">
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value as PriceMarket)}
            className="rounded-xl border border-clay bg-white/70 p-3 text-espresso"
          >
            <option value="arabica">vs. Arabica</option>
            <option value="robusta">vs. Robusta</option>
          </select>
          <input
            type="number"
            step="0.01"
            required
            placeholder={market === "robusta" ? "± $/tonne" : "± cents/lb"}
            value={differentialCents}
            onChange={(e) => setDifferentialCents(e.target.value)}
            className="flex-1 rounded-xl border border-clay bg-white/70 p-3 text-espresso"
          />
        </div>
      )}

      <input
        type="number"
        placeholder="Quantity (kg, optional)"
        value={quantityKg}
        onChange={(e) => setQuantityKg(e.target.value)}
        className="w-full rounded-xl border border-clay bg-white/70 p-3 text-espresso"
      />

      {error && <p className="text-sm text-terracotta">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-xl border border-clay py-3 text-espresso"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !contactId}
          className="flex-1 rounded-xl bg-terracotta py-3 text-parchment disabled:opacity-50"
        >
          {saving ? "Saving…" : "Create deal"}
        </button>
      </div>
    </form>
  );
}
