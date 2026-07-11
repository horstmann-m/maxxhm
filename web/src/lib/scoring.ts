// SCA cupping score helpers. The classic form sums ten attributes to a 100-pt
// scale (uniformity/clean cup/sweetness default to 10; the seven quality
// attributes to 6-10). 80+ is "specialty".

import type { CuppingScores } from "./types";

export const QUALITY_ATTRS: (keyof CuppingScores)[] = [
  "fragrance",
  "flavor",
  "aftertaste",
  "acidity",
  "body",
  "balance",
  "overall",
];

export const FIXED_ATTRS: (keyof CuppingScores)[] = [
  "uniformity",
  "cleanCup",
  "sweetness",
];

export const ATTR_LABELS: Record<keyof CuppingScores, string> = {
  fragrance: "Fragrance / Aroma",
  flavor: "Flavor",
  aftertaste: "Aftertaste",
  acidity: "Acidity",
  body: "Body",
  balance: "Balance",
  uniformity: "Uniformity",
  cleanCup: "Clean cup",
  sweetness: "Sweetness",
  overall: "Overall",
};

export const defaultScores = (): CuppingScores => ({
  fragrance: 7.5,
  flavor: 7.5,
  aftertaste: 7.5,
  acidity: 7.5,
  body: 7.5,
  balance: 7.5,
  uniformity: 10,
  cleanCup: 10,
  sweetness: 10,
  overall: 7.5,
});

export function totalScore(s: CuppingScores): number {
  const sum = Object.values(s).reduce((a, b) => a + b, 0);
  return Math.round(sum * 100) / 100;
}

export function scoreBand(total: number): { label: string; color: string } {
  if (total >= 90) return { label: "Outstanding", color: "#7c3aed" };
  if (total >= 85) return { label: "Excellent", color: "#2563eb" };
  if (total >= 80) return { label: "Specialty", color: "#059669" };
  if (total >= 75) return { label: "Very good", color: "#d97706" };
  return { label: "Below specialty", color: "#6b7280" };
}
