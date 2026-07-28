import assert from "node:assert/strict";
import test from "node:test";
import { rankRelevantIntelligence } from "./intelligence-relevance";

const item = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  verificationStatus: "VERIFIED",
  priority: "NORMAL",
  publishedAt: "2026-07-20T00:00:00Z",
  validUntil: null,
  productIds: [],
  therapeuticAreas: [],
  ...overrides,
});

test("exact product relevance outranks therapy matches and pending leads", () => {
  const ranked = rankRelevantIntelligence([
    item("therapy", { therapeuticAreas: ["肺癌"] }),
    item("pending-product", { verificationStatus: "PENDING_REVIEW", productIds: ["p1"] }),
    item("product", { productIds: ["p1"] }),
  ], {
    productIds: ["p1"],
    therapeuticAreas: ["肺癌"],
    asOf: new Date("2026-07-29T00:00:00Z"),
    limit: 5,
  });
  assert.deepEqual(ranked.map((entry) => entry.id), ["product", "therapy", "pending-product"]);
});

test("expired and terminal intelligence is excluded and result count is bounded", () => {
  const ranked = rankRelevantIntelligence([
    item("expired", { validUntil: "2026-07-28T00:00:00Z", productIds: ["p1"] }),
    item("rejected", { verificationStatus: "REJECTED", productIds: ["p1"] }),
    item("one", { productIds: ["p1"] }),
    item("two", { productIds: ["p1"], priority: "HIGH" }),
  ], {
    productIds: ["p1"],
    therapeuticAreas: [],
    asOf: new Date("2026-07-29T00:00:00Z"),
    limit: 1,
  });
  assert.deepEqual(ranked.map((entry) => entry.id), ["two"]);
});
