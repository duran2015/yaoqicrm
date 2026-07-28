import { assertTransition } from "./workflow";

export const COACHING_TRANSITIONS: Record<string, readonly string[]> = {
  OPEN: ["DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

export function assertCoachingTransition(current: string, next: string) {
  assertTransition(current, next, COACHING_TRANSITIONS);
}

export function assertCoachingParticipants(managerId: string, employeeId: string) {
  if (managerId === employeeId) throw new Error("经理和被辅导员工不能相同");
}
