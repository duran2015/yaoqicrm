import assert from "node:assert/strict";
import test from "node:test";
import {
  canRunAgentEvaluation,
  redactEvaluationValue,
  scoreEvaluation,
} from "./agent-evaluation";

test("required assertion failure fails the case while optional failure only lowers the rate", () => {
  assert.deepEqual(
    scoreEvaluation([
      { required: true, passed: true },
      { required: false, passed: false },
    ]),
    { passed: true, assertionCount: 2, passedAssertionCount: 1 }
  );
  assert.equal(scoreEvaluation([{ required: true, passed: false }]).passed, false);
});

test("only manager and admin roles can run agent evaluations", () => {
  assert.equal(canRunAgentEvaluation("MR"), false);
  assert.equal(canRunAgentEvaluation("ASM"), true);
  assert.equal(canRunAgentEvaluation("RSM"), true);
  assert.equal(canRunAgentEvaluation("ADMIN"), true);
});

test("evaluation snapshots redact credentials recursively and limit text", () => {
  const value = redactEvaluationValue({
    Authorization: "Bearer secret.jwt.value",
    nested: { cookie: "sid=secret", safe: "x".repeat(3000) },
  }) as Record<string, unknown>;
  assert.equal(value.Authorization, "[REDACTED]");
  assert.deepEqual((value.nested as Record<string, unknown>).cookie, "[REDACTED]");
  assert.equal(((value.nested as Record<string, string>).safe).length, 2048);
});
