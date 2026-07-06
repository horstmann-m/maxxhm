// Supplier scorecard scoring — pure and vitest-tested. Turns a supplier's sample
// history into a 0-100 trust score: approval rate, average cup quality, and how
// established the relationship is.

import type { Sample } from "./types";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface SupplierScore {
  score: number; // 0..100
  approvalRate: number | null; // of decided samples
  avgCupScore: number | null;
  count: number;
  decided: number;
  approved: number;
}

export function supplierScore(samples: Sample[]): SupplierScore {
  const count = samples.length;
  const decided = samples.filter((s) => s.status === "approved" || s.status === "rejected");
  const approved = decided.filter((s) => s.status === "approved").length;
  const approvalRate = decided.length ? approved / decided.length : null;

  const scored = samples
    .map((s) => s.cupScore)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const avgCupScore = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;

  // subscores, neutral 0.5 where there's no signal yet
  const sApproval = approvalRate ?? 0.5;
  const sCup = avgCupScore != null ? clamp01((avgCupScore - 78) / (90 - 78)) : 0.5;
  const sEngagement = Math.min(count / 5, 1);

  const score = Math.round((0.5 * sApproval + 0.35 * sCup + 0.15 * sEngagement) * 100);
  return {
    score,
    approvalRate,
    avgCupScore: avgCupScore != null ? Math.round(avgCupScore * 100) / 100 : null,
    count,
    decided: decided.length,
    approved,
  };
}

export function supplierBand(score: number): { label: string; color: string } {
  if (score >= 75) return { label: "Trusted", color: "#059669" };
  if (score >= 60) return { label: "Solid", color: "#2563eb" };
  if (score >= 45) return { label: "Mixed", color: "#d97706" };
  return { label: "Unproven", color: "#6b7280" };
}

export const SAMPLE_STATUSES: { value: Sample["status"]; label: string; color: string }[] = [
  { value: "requested", label: "Requested", color: "#8a8f98" },
  { value: "received", label: "Received", color: "#2563eb" },
  { value: "cupped", label: "Cupped", color: "#7c3aed" },
  { value: "approved", label: "Approved", color: "#059669" },
  { value: "rejected", label: "Rejected", color: "#d64545" },
];
