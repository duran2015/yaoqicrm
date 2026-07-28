import test from "node:test";
import assert from "node:assert/strict";
import { businessDateKey, canEditPlan, canStartPlanItem } from "./tour-plan";

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

test("uses the Shanghai business date instead of the UTC date", () => {
  assert.equal(businessDateKey("2026-07-19T16:00:00.000Z"), "2026-07-20");
  assert.equal(businessDateKey("2026-07-20T01:00:00.000Z"), "2026-07-20");
});
