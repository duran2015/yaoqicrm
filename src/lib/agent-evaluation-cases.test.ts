import assert from "node:assert/strict";
import test from "node:test";
import {
  FIXED_EVALUATION_CASES,
  evaluateBattlecardResult,
  evaluateSearchResult,
  evaluateToolDiscovery,
} from "./agent-evaluation-cases";

test("fixed suite contains nine stable unique cases", () => {
  assert.equal(FIXED_EVALUATION_CASES.length, 9);
  assert.equal(new Set(FIXED_EVALUATION_CASES.map((item) => item.key)).size, 9);
});

test("tool discovery requires all three composite intelligence tools", () => {
  const assertions = evaluateToolDiscovery(["search_sales_intelligence", "get_product_battlecard"]);
  assert.equal(assertions[0].passed, false);
});

test("search results require bounded source-traceable records", () => {
  const assertions = evaluateSearchResult(
    { items: [{ title: "医保政策", sourceName: "国家医保局", sourceUrl: "https://example.cn/policy" }] },
    3
  );
  assert.equal(assertions.every((item) => item.passed), true);
  assert.equal(evaluateSearchResult({ items: [{ title: "无引用" }] }, 3)[1].passed, false);
});

test("battlecard keeps verified facts leads and approved materials separate", () => {
  const assertions = evaluateBattlecardResult({
    product: { name: "天韵" },
    verifiedFacts: [{ sourceUrl: "https://example.cn/fact" }],
    pendingLeads: [],
    approvedMaterials: [{ externalUrl: "https://example.cn/material" }],
  });
  assert.equal(assertions.every((item) => item.passed), true);
});
