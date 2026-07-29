import assert from "node:assert/strict";
import test from "node:test";
import { executeEvaluationCases } from "./agent-evaluation-runner";

test("a failed evaluation case does not stop later cases", async () => {
  const seen: string[] = [];
  const results = await executeEvaluationCases(["first", "second"], async (key) => {
    seen.push(key);
    if (key === "first") throw new Error("broken");
    return { key, passed: true };
  });
  assert.deepEqual(seen, ["first", "second"]);
  assert.equal(results[0].passed, false);
  assert.equal(results[1].passed, true);
});
