import assert from "node:assert/strict";
import test from "node:test";
import { buildProductBattlecard } from "./product-battlecard";

test("battlecard separates verified facts, pending leads, and approved materials", () => {
  const result = buildProductBattlecard({
    product: { id: "p1", brand: "安瑞泽", molecule: "奥希替尼", therapeuticCategory: "肺癌" },
    intelligence: [
      { id: "i1", type: "POLICY", title: "医保政策", summary: "政策摘要", verificationStatus: "VERIFIED", sourceName: "医保局", sourceUrl: "https://nhsa.gov.cn/1", publishedAt: null, collectedAt: "2026-07-29" },
      { id: "i2", type: "COMPETITOR", title: "竞品线索", summary: "媒体摘要", verificationStatus: "PENDING_REVIEW", sourceName: "媒体", sourceUrl: "https://media.cn/2", publishedAt: null, collectedAt: "2026-07-29" },
    ],
    approvedMaterials: [{ id: "m1", title: "批准沟通卡", version: "v1", approvalCode: "APP-1", externalUrl: "https://company.cn/m1" }],
  });
  assert.deepEqual(result.verifiedFacts.map((item) => item.intelligenceId), ["i1"]);
  assert.deepEqual(result.pendingLeads.map((item) => item.intelligenceId), ["i2"]);
  assert.equal(result.approvedMaterials[0]?.approvalCode, "APP-1");
  assert.equal(result.citations.length, 2);
  assert.match(result.complianceNotice, /内部参考/);
});

test("battlecard states when no verified evidence exists", () => {
  const result = buildProductBattlecard({
    product: { id: "p1", brand: "产品", molecule: "分子", therapeuticCategory: "领域" },
    intelligence: [],
    approvedMaterials: [],
  });
  assert.deepEqual(result.warnings, ["未找到该产品的已核验情报"]);
});
