import assert from "node:assert/strict";
import test from "node:test";
import { parseCollectionArgs } from "./collect-sales-intelligence";

test("collection CLI accepts all, source, or product scopes", () => {
  assert.deepEqual(parseCollectionArgs(["--all"]), { scope: "all", id: null, limit: 20 });
  assert.deepEqual(parseCollectionArgs(["--source", "s1", "--limit", "5"]), { scope: "source", id: "s1", limit: 5 });
  assert.deepEqual(parseCollectionArgs(["--product", "p1"]), { scope: "product", id: "p1", limit: 20 });
});

test("collection CLI rejects ambiguous scopes and unbounded limits", () => {
  assert.throws(() => parseCollectionArgs(["--all", "--product", "p1"]), /只能选择一个/);
  assert.throws(() => parseCollectionArgs(["--source"]), /缺少来源/);
  assert.throws(() => parseCollectionArgs(["--all", "--limit", "100"]), /1-50/);
});
