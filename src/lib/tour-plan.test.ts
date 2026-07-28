import test from "node:test";
import assert from "node:assert/strict";
import { canEditPlan, canStartPlanItem } from "./tour-plan";

test("only draft and rejected plans can be edited", () => {
  assert.equal(canEditPlan("DRAFT"), true);
  assert.equal(canEditPlan("REJECTED"), true);
  assert.equal(canEditPlan("SUBMITTED"), false);
  assert.equal(canEditPlan("APPROVED"), false);
});

test("only approved unexecuted plan items can start visits", () => {
  assert.equal(canStartPlanItem("APPROVED", "PLANNED", null), true);
  assert.equal(canStartPlanItem("DRAFT", "PLANNED", null), false);
  assert.equal(canStartPlanItem("APPROVED", "COMPLETED", "visit-1"), false);
  assert.equal(canStartPlanItem("APPROVED", "CANCELLED", null), false);
});
