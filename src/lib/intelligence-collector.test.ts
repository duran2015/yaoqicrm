import assert from "node:assert/strict";
import test from "node:test";
import {
  collectEnabledSources,
  initialVerification,
  type CollectedDocument,
  type IntelligenceCollector,
} from "./intelligence-collector";

const document = (title: string): CollectedDocument => ({
  title,
  sourceUrl: `https://example.cn/${encodeURIComponent(title)}`,
  excerpt: `${title}摘要`,
  publishedAt: null,
});

test("collection isolates source failures, caps results, and reports partial status", async () => {
  const collectors: Record<string, IntelligenceCollector> = {
    RSS: { collect: async () => [document("一"), document("二"), document("三")] },
    LIST_PAGE: { collect: async () => { throw new Error("结构变化"); } },
  };
  const result = await collectEnabledSources({
    sources: [
      { id: "s1", collectionType: "RSS", enabled: true },
      { id: "s2", collectionType: "LIST_PAGE", enabled: true },
      { id: "s3", collectionType: "RSS", enabled: false },
    ],
    limitPerSource: 2,
    timeoutMs: 100,
  }, collectors);

  assert.equal(result.status, "PARTIAL");
  assert.deepEqual(result.documents.map((item) => item.title), ["一", "二"]);
  assert.deepEqual(result.failures, [{ sourceId: "s2", message: "结构变化" }]);
});

test("collection times out a slow source without blocking successful sources", async () => {
  const collectors: Record<string, IntelligenceCollector> = {
    RSS: { collect: async ({ source }) => {
      if (source.id === "slow") await new Promise((resolve) => setTimeout(resolve, 30));
      return [document(source.id)];
    } },
  };
  const result = await collectEnabledSources({
    sources: [
      { id: "fast", collectionType: "RSS", enabled: true },
      { id: "slow", collectionType: "RSS", enabled: true },
    ],
    limitPerSource: 5,
    timeoutMs: 10,
  }, collectors);

  assert.equal(result.status, "PARTIAL");
  assert.deepEqual(result.documents.map((item) => item.title), ["fast"]);
  assert.equal(result.failures[0]?.sourceId, "slow");
  assert.match(result.failures[0]?.message ?? "", /超时/);
});

test("only authoritative white-list results begin verified", () => {
  assert.equal(initialVerification({ sourceType: "OFFICIAL", trustLevel: "AUTHORITATIVE" }), "VERIFIED");
  assert.equal(initialVerification({ sourceType: "MEDIA", trustLevel: "TRUSTED" }), "PENDING_REVIEW");
  assert.equal(initialVerification({ sourceType: "SEARCH", trustLevel: "REFERENCE" }), "PENDING_REVIEW");
});
