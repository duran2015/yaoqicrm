import test from "node:test";
import assert from "node:assert/strict";
import { assertCoachingParticipants, assertCoachingTransition } from "./coaching";

test("open coaching actions can finish or cancel but cannot reopen", () => {
  assert.doesNotThrow(() => assertCoachingTransition("OPEN", "DONE"));
  assert.doesNotThrow(() => assertCoachingTransition("OPEN", "CANCELLED"));
  assert.throws(() => assertCoachingTransition("DONE", "OPEN"), /状态不能从 DONE 变更为 OPEN/);
});

test("a manager cannot coach themselves", () => {
  assert.throws(() => assertCoachingParticipants("employee-1", "employee-1"), /经理和被辅导员工不能相同/);
  assert.doesNotThrow(() => assertCoachingParticipants("manager-1", "employee-1"));
});
