import test from "node:test";
import assert from "node:assert/strict";
import { signedQuantity } from "./sample-inventory";

test("returns signed inventory effects for all transaction types", () => {
  assert.equal(signedQuantity("RECEIVE", 10), 10);
  assert.equal(signedQuantity("DISTRIBUTE", 3), -3);
  assert.equal(signedQuantity("RETURN", 2), -2);
  assert.equal(signedQuantity("ADJUST", -4), -4);
  assert.equal(signedQuantity("ADJUST", 4), 4);
});

test("validates sample transaction quantities", () => {
  assert.throws(() => signedQuantity("RECEIVE", 0), /数量不能为 0/);
  assert.throws(() => signedQuantity("RETURN", -1), /数量必须为正整数/);
  assert.throws(() => signedQuantity("UNKNOWN", 1), /未知样品事务类型/);
});
