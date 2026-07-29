export interface EvaluationAssertionInput {
  required: boolean;
  passed: boolean;
}

export function scoreEvaluation(assertions: EvaluationAssertionInput[]) {
  return {
    passed: assertions.every((item) => !item.required || item.passed),
    assertionCount: assertions.length,
    passedAssertionCount: assertions.filter((item) => item.passed).length,
  };
}

export function canRunAgentEvaluation(role: string) {
  return ["ASM", "RSM", "ADMIN"].includes(role);
}

const SECRET_KEYS = /authorization|cookie|token|secret|session/i;

export function redactEvaluationValue(value: unknown, key = ""): unknown {
  if (SECRET_KEYS.test(key)) return "[REDACTED]";
  if (typeof value === "string") return value.slice(0, 2048);
  if (Array.isArray(value)) return value.map((item) => redactEvaluationValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [childKey, redactEvaluationValue(child, childKey)])
    );
  }
  return value;
}
