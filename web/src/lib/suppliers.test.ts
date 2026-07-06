import { describe, expect, it } from "vitest";
import { supplierScore } from "./suppliers";
import type { Sample } from "./types";

function sample(p: Partial<Sample>): Sample {
  return {
    id: Math.random().toString(),
    supplierId: "s",
    name: "lot",
    date: "2024-01-01",
    status: "requested",
    createdAt: 0,
    ...p,
  };
}

describe("supplierScore", () => {
  it("no samples → neutral-ish score, null rates", () => {
    const r = supplierScore([]);
    expect(r.count).toBe(0);
    expect(r.approvalRate).toBeNull();
    expect(r.avgCupScore).toBeNull();
    expect(r.score).toBeGreaterThan(35);
    expect(r.score).toBeLessThan(50);
  });

  it("consistently approved, high-scoring supplier → high score", () => {
    const samples = Array.from({ length: 5 }, () =>
      sample({ status: "approved", cupScore: 88 })
    );
    const r = supplierScore(samples);
    expect(r.approvalRate).toBe(1);
    expect(r.avgCupScore).toBe(88);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  it("rejections drag the score down", () => {
    const r = supplierScore([sample({ status: "rejected" }), sample({ status: "rejected" })]);
    expect(r.approvalRate).toBe(0);
    expect(r.score).toBeLessThan(35);
  });

  it("approval rate ignores undecided samples", () => {
    const r = supplierScore([
      sample({ status: "approved", cupScore: 86 }),
      sample({ status: "requested" }),
      sample({ status: "received" }),
    ]);
    expect(r.decided).toBe(1);
    expect(r.approvalRate).toBe(1);
    expect(r.count).toBe(3);
  });
});
