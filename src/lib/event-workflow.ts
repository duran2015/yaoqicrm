import { assertTransition } from "./workflow";

export const EVENT_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertEventTransition(current: string, next: string) {
  assertTransition(current, next, EVENT_TRANSITIONS);
}

export function canMarkAttendance(eventStatus: string) {
  return eventStatus === "OPEN";
}
