import test from "node:test";
import assert from "node:assert/strict";
import { assertEventTransition, canMarkAttendance } from "./event-workflow";

test("events follow draft, open, and terminal transitions", () => {
  assert.doesNotThrow(() => assertEventTransition("DRAFT", "OPEN"));
  assert.doesNotThrow(() => assertEventTransition("DRAFT", "CANCELLED"));
  assert.doesNotThrow(() => assertEventTransition("OPEN", "COMPLETED"));
  assert.throws(() => assertEventTransition("COMPLETED", "OPEN"), /状态不能从 COMPLETED 变更为 OPEN/);
});

test("attendance can only be marked while an event is open", () => {
  assert.equal(canMarkAttendance("OPEN"), true);
  assert.equal(canMarkAttendance("DRAFT"), false);
  assert.equal(canMarkAttendance("COMPLETED"), false);
});
