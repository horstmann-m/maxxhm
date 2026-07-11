"use client";

import { RISK_META, type RiskResult } from "@/lib/risk";

/** Compact ok/watch/alert pill. `ok` is de-emphasised (weather is reassuring, not noisy). */
export function RiskBadge({ risk }: { risk: RiskResult | undefined }) {
  if (!risk) return null;
  const meta = RISK_META[risk.level];
  return (
    <span
      title={risk.headline}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: meta.color + "22", color: meta.color }}
    >
      <span aria-hidden>{meta.icon}</span>
      {risk.level === "ok" ? "Weather ok" : meta.label}
    </span>
  );
}

/** One-line driving metric, e.g. "45 mm rain over any 7 days (warn 15 / alert 35)". */
export function RiskDetail({ risk }: { risk: RiskResult | undefined }) {
  if (!risk || risk.stage === null) return null;
  const driver =
    risk.metrics.find((m) => m.level !== "ok") ??
    risk.metrics.slice().sort((a, b) => b.value - a.value)[0];
  if (!driver) return null;
  const meta = RISK_META[risk.level];
  return (
    <p className="text-xs mt-2" style={{ color: risk.level === "ok" ? "var(--muted)" : meta.color }}>
      {risk.headline}
      <span className="text-muted">
        {" "}
        · {driver.label}: {driver.value} {driver.unit} (warn {driver.warn} / alert {driver.alert})
      </span>
    </p>
  );
}
