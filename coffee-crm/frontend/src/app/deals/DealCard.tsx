"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDealStage, DEAL_STAGES, type Deal } from "@/lib/api";

function priceLabel(deal: Deal): string {
  if (deal.priceType === "outright") {
    return `${deal.outrightPrice}¢/lb outright (${deal.currency})`;
  }
  const sign = (deal.differentialCents ?? 0) >= 0 ? "+" : "";
  const unit = deal.market === "robusta" ? "$/t" : "¢/lb";
  return `${sign}${deal.differentialCents}${unit} vs. ${deal.market} (${deal.currency})`;
}

export function DealCard({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  async function changeStage(stage: Deal["stage"]) {
    setUpdating(true);
    try {
      await updateDealStage(deal.id, stage);
      router.refresh();
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="rounded-xl border border-clay bg-white/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-espresso">{deal.contact.name}</p>
          <p className="text-sm text-espresso/60">{deal.coffeeDescription ?? "Coffee TBD"}</p>
        </div>
        <span className="whitespace-nowrap text-sm text-espresso/70">{priceLabel(deal)}</span>
      </div>

      {deal.priceEstimate.perTonne !== null && (
        <p className="mt-2 text-xs text-espresso/50">
          ≈ ${deal.priceEstimate.perTonne.toFixed(0)}/tonne
          {deal.priceEstimate.fxConversionApplied ? " (FX not applied — USD basis)" : ""}
        </p>
      )}

      <select
        value={deal.stage}
        disabled={updating}
        onChange={(e) => changeStage(e.target.value as Deal["stage"])}
        className="mt-3 w-full rounded-lg border border-clay bg-white/70 p-2 text-sm text-espresso"
      >
        {DEAL_STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
