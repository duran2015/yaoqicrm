import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeSourceUrl,
  classifyCollectedDocument,
  decideCollectedDocument,
  fingerprintIntelligence,
  normalizeIntelligenceText,
} from "./intelligence-normalization";

test("canonical URL removes trackers and orders meaningful query parameters", () => {
  assert.equal(
    canonicalizeSourceUrl("https://Example.cn/policy?utm_source=x&id=2&a=1#top"),
    "https://example.cn/policy?a=1&id=2",
  );
  assert.equal(canonicalizeSourceUrl("javascript:alert(1)"), null);
});

test("normalized content produces a stable SHA-256 fingerprint", () => {
  assert.equal(normalizeIntelligenceText("  医保\n\n 政策　更新  "), "医保 政策 更新");
  assert.equal(fingerprintIntelligence("医保  政策"), fingerprintIntelligence(" 医保 政策 "));
  assert.match(fingerprintIntelligence("医保政策"), /^[a-f0-9]{64}$/);
});

test("deduplication skips repeated content and versions changed canonical URLs", () => {
  assert.deepEqual(decideCollectedDocument(
    [{ id: "old", canonicalUrl: "https://a.cn/1", contentHash: "same", version: 1 }],
    { canonicalUrl: "https://b.cn/2", contentHash: "same" },
  ), { action: "SKIP", existingId: "old" });
  assert.deepEqual(decideCollectedDocument(
    [{ id: "old", canonicalUrl: "https://a.cn/1", contentHash: "old", version: 2 }],
    { canonicalUrl: "https://a.cn/1", contentHash: "new" },
  ), { action: "VERSION", supersedesId: "old", version: 3 });
  assert.deepEqual(decideCollectedDocument([], {
    canonicalUrl: "https://a.cn/new",
    contentHash: "new",
  }), { action: "CREATE", version: 1 });
});

test("classification only links configured aliases found in text", () => {
  assert.deepEqual(classifyCollectedDocument(
    { title: "安瑞泽肺癌政策更新", excerpt: "涉及奥希替尼；竞品A未出现在正文中" },
    {
      products: [{ id: "p1", aliases: ["安瑞泽", "奥希替尼"] }, { id: "p2", aliases: ["心悦达"] }],
      competitors: [{ id: "c1", aliases: ["竞品A"] }],
      therapeuticAreas: [{ name: "肺癌靶向治疗", aliases: ["肺癌"] }],
    },
  ), {
    productIds: ["p1"],
    competitorIds: ["c1"],
    therapeuticAreas: ["肺癌靶向治疗"],
  });
});
