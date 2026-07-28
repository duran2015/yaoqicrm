import test from "node:test";
import assert from "node:assert/strict";
import { assertTransition, calculateInventory } from "./workflow";

test("rejects transitions not present in the state graph", () => {
  assert.throws(
    () => assertTransition("COMPLETED", "OPEN", { OPEN: ["COMPLETED"], COMPLETED: [] }),
    /状态不能从 COMPLETED 变更为 OPEN/
  );
});

test("calculates inventory from all four transaction types", () => {
  assert.equal(
    calculateInventory([
      { type: "RECEIVE", quantity: 20 },
      { type: "DISTRIBUTE", quantity: 5 },
      { type: "RETURN", quantity: 2 },
      { type: "ADJUST", quantity: -1 },
    ]),
    12
  );
});
