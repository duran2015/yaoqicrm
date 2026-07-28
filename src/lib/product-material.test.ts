import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionMaterial,
  isMaterialAvailable,
  validateMaterialInput,
  validateMaterialSelection,
} from "./product-material";

const input = {
  productId: "p1",
  title: "核心研究沟通卡",
  type: "DETAIL_AID",
  messageSummary: "仅按批准适应症沟通核心研究结果",
  externalUrl: "https://example.test/material.pdf",
  version: "V1.0",
  approvalCode: "APP-2026-001",
  effectiveDate: "2026-07-01",
  expiryDate: "2026-08-01",
};

test("allows only forward product material transitions", () => {
  assert.equal(canTransitionMaterial("DRAFT", "APPROVED"), true);
  assert.equal(canTransitionMaterial("APPROVED", "RETIRED"), true);
  assert.equal(canTransitionMaterial("RETIRED", "APPROVED"), false);
});

test("requires approved status and a half-open effective interval", () => {
  const material = { status: "APPROVED", approvalCode: "A1", externalUrl: "https://example.test/a", effectiveDate: new Date("2026-07-01T00:00:00+08:00"), expiryDate: new Date("2026-08-01T00:00:00+08:00") };
  assert.equal(isMaterialAvailable(material, new Date("2026-07-01T00:00:00+08:00")), true);
  assert.equal(isMaterialAvailable(material, new Date("2026-08-01T00:00:00+08:00")), false);
  assert.equal(isMaterialAvailable({ ...material, status: "DRAFT" }, new Date("2026-07-10T00:00:00+08:00")), false);
});

test("validates required metadata, dates, and safe external links", () => {
  assert.ok(validateMaterialInput(input));
  assert.equal(validateMaterialInput({ ...input, externalUrl: "file:///tmp/a.pdf" }), null);
  assert.equal(validateMaterialInput({ ...input, expiryDate: "2026-06-01" }), null);
  assert.equal(validateMaterialInput({ ...input, type: "UNKNOWN" }), null);
});

test("deduplicates valid visit materials and rejects cross-product or unavailable choices", () => {
  const date = new Date("2026-07-10T00:00:00+08:00");
  const valid = { id: "m1", productId: "p1", status: "APPROVED", approvalCode: "A1", externalUrl: "https://example.test/a", effectiveDate: new Date("2026-07-01T00:00:00+08:00"), expiryDate: new Date("2026-08-01T00:00:00+08:00") };
  assert.deepEqual(validateMaterialSelection([valid, valid], ["p1"], date), ["m1"]);
  assert.equal(validateMaterialSelection([{ ...valid, productId: "p2" }], ["p1"], date), null);
  assert.equal(validateMaterialSelection([{ ...valid, status: "RETIRED" }], ["p1"], date), null);
});
