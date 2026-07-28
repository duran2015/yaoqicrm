import { createHash } from "node:crypto";

type ExistingOperation = {
  status: string;
  inputHash: string;
  resultJson: string | null;
};

export type McpOperationDecision =
  | { action: "START" }
  | { action: "REPLAY"; resultJson: string }
  | { action: "CONFLICT" }
  | { action: "IN_PROGRESS" };

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function hashAgentPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableValue(payload))).digest("hex");
}

export function requireAgentConfirmation(confirmed: unknown): asserts confirmed is true {
  if (confirmed !== true) {
    throw new Error("complete_hcp_visit 必须在用户明确确认后传入 confirmed: true");
  }
}

export function decideMcpOperation(
  existing: ExistingOperation | null,
  inputHash: string,
): McpOperationDecision {
  if (!existing || existing.status === "FAILED") return { action: "START" };
  if (existing.inputHash !== inputHash) return { action: "CONFLICT" };
  if (existing.status === "SUCCEEDED" && existing.resultJson) {
    return { action: "REPLAY", resultJson: existing.resultJson };
  }
  return { action: "IN_PROGRESS" };
}
