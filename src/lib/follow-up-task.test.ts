import test from "node:test";
import assert from "node:assert/strict";
import { assertTaskTransition, isTaskOverdue } from "./follow-up-task";

test("open tasks can be completed or cancelled but terminal tasks cannot reopen", () => {
  assert.doesNotThrow(() => assertTaskTransition("OPEN", "DONE"));
  assert.doesNotThrow(() => assertTaskTransition("OPEN", "CANCELLED"));
  assert.throws(() => assertTaskTransition("DONE", "OPEN"), /状态不能从 DONE 变更为 OPEN/);
});

test("only open tasks before today are overdue", () => {
  const now = new Date("2026-07-28T12:00:00+08:00");
  assert.equal(isTaskOverdue({ status: "OPEN", dueDate: "2026-07-27" }, now), true);
  assert.equal(isTaskOverdue({ status: "OPEN", dueDate: "2026-07-28" }, now), false);
  assert.equal(isTaskOverdue({ status: "DONE", dueDate: "2026-07-27" }, now), false);
});
