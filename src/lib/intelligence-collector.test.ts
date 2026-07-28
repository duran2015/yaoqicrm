import assert from "node:assert/strict";
import test from "node:test";
import {
  collectEnabledSources,
  initialVerification,
  type CollectedDocument,
  type IntelligenceCollector,
} from "./intelligence-collector";
import { parseHtmlList } from "./intelligence-collectors/html-list";

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

test("HTML list extraction can use the matched link element itself", () => {
  const items = parseHtmlList(
    `<div class="list"><a href="/policy/1">医保目录更新</a><a href="/policy/2">集采通知</a></div>`,
    new URL("https://www.gov.cn/zhengce/"),
    { itemSelector: "a", titleSelector: "a", linkSelector: "a" },
    10,
  );
  assert.deepEqual(items.map((item) => ({ title: item.title, sourceUrl: item.sourceUrl })), [
    { title: "医保目录更新", sourceUrl: "https://www.gov.cn/policy/1" },
    { title: "集采通知", sourceUrl: "https://www.gov.cn/policy/2" },
  ]);
});

test("HTML list extraction unwraps government-site record CDATA", () => {
  const items = parseHtmlList(
    `<ul></ul><record><![CDATA[<li><a href="/art/1">医保支付改革</a><span>2026-07-29</span></li>]]></record>`,
    new URL("https://www.nhsa.gov.cn/col/col14/index.html"),
    { itemSelector: "li", titleSelector: "a", linkSelector: "a", dateSelector: "span" },
    10,
  );
  assert.deepEqual(items, [{
    title: "医保支付改革",
    sourceUrl: "https://www.nhsa.gov.cn/art/1",
    excerpt: "",
    publishedAt: "2026-07-29",
  }]);
});
