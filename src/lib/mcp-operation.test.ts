import assert from "node:assert/strict";
import test from "node:test";
import {
  decideMcpOperation,
  hashAgentPayload,
  requireAgentConfirmation,
} from "./mcp-operation";

test("hashAgentPayload is stable across object key order but changes with business input", () => {
  const first = hashAgentPayload({
    hcpId: "hcp-1",
    outcome: "同意试用",
    followUp: { title: "下周复访", priority: "HIGH" },
  });
  const reordered = hashAgentPayload({
    followUp: { priority: "HIGH", title: "下周复访" },
    outcome: "同意试用",
    hcpId: "hcp-1",
  });
  const changed = hashAgentPayload({
    hcpId: "hcp-1",
    outcome: "暂不考虑",
    followUp: { title: "下周复访", priority: "HIGH" },
  });
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test("requireAgentConfirmation rejects absent explicit user confirmation", () => {
  assert.doesNotThrow(() => requireAgentConfirmation(true));
  assert.throws(() => requireAgentConfirmation(false), /confirmed/);
  assert.throws(() => requireAgentConfirmation(undefined), /confirmed/);
});

test("decideMcpOperation replays a successful identical request", () => {
  assert.deepEqual(
    decideMcpOperation(
      { status: "SUCCEEDED", inputHash: "same", resultJson: '{"visit":{"id":"visit-1"}}' },
      "same",
    ),
    { action: "REPLAY", resultJson: '{"visit":{"id":"visit-1"}}' },
  );
});

test("decideMcpOperation rejects reuse of a key for another payload", () => {
  assert.deepEqual(
    decideMcpOperation({ status: "SUCCEEDED", inputHash: "first", resultJson: "{}" }, "other"),
    { action: "CONFLICT" },
  );
});

test("decideMcpOperation blocks an operation still in progress and permits failed retry", () => {
  assert.deepEqual(
    decideMcpOperation({ status: "IN_PROGRESS", inputHash: "same", resultJson: null }, "same"),
    { action: "IN_PROGRESS" },
  );
  assert.deepEqual(
    decideMcpOperation({ status: "FAILED", inputHash: "same", resultJson: null }, "same"),
    { action: "START" },
  );
  assert.deepEqual(decideMcpOperation(null, "same"), { action: "START" });
});
