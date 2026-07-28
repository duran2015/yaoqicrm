import assert from "node:assert/strict";
import test from "node:test";
import { buildIntelligenceWhere, parseIntelligenceListQuery, shapeIntelligenceItem } from "./intelligence-query";

test("list query clamps pagination and excludes terminal statuses by default", () => {
  const parsed = parseIntelligenceListQuery(new URLSearchParams("type=POLICY&page=0&pageSize=999&query= 医保 "));
  assert.deepEqual(parsed, {
    type: "POLICY",
    status: null,
    productId: null,
    query: "医保",
    page: 1,
    pageSize: 50,
  });
  assert.deepEqual(buildIntelligenceWhere(parsed), {
    type: "POLICY",
    verificationStatus: { notIn: ["REJECTED", "ARCHIVED"] },
    OR: [
      { title: { contains: "医保" } },
      { summary: { contains: "医保" } },
      { contentExcerpt: { contains: "医保" } },
    ],
  });
});

test("product and explicit status filters produce bounded relation criteria", () => {
  const parsed = parseIntelligenceListQuery(new URLSearchParams("productId=p1&status=PENDING_REVIEW&page=2&pageSize=10"));
  assert.deepEqual(buildIntelligenceWhere(parsed), {
    verificationStatus: "PENDING_REVIEW",
    products: { some: { productId: "p1" } },
  });
});

test("response shaping always preserves provenance and a bounded excerpt", () => {
  const item = shapeIntelligenceItem({
    id: "i1",
    type: "POLICY",
    title: "政策",
    summary: "摘要",
    contentExcerpt: "长".repeat(700),
    sourceName: "国家医保局",
    sourceUrl: "https://www.nhsa.gov.cn/policy",
    publishedAt: new Date("2026-07-20T00:00:00Z"),
    collectedAt: new Date("2026-07-21T00:00:00Z"),
    validFrom: null,
    validUntil: null,
    verificationStatus: "VERIFIED",
    confidence: "HIGH",
    priority: "HIGH",
    products: [],
    therapeuticAreas: [],
    competitors: [],
  });
  assert.equal(item.sourceUrl, "https://www.nhsa.gov.cn/policy");
  assert.equal(item.contentExcerpt.length, 501);
  assert.match(item.contentExcerpt, /…$/);
});
