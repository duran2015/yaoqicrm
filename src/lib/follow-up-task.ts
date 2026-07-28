import { assertTransition } from "./workflow";

export const TASK_TRANSITIONS: Record<string, readonly string[]> = {
  OPEN: ["DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

export function assertTaskTransition(current: string, next: string) {
  assertTransition(current, next, TASK_TRANSITIONS);
}

export function isTaskOverdue(
  task: { status: string; dueDate?: Date | string | null },
  now = new Date()
) {
  if (task.status !== "OPEN" || !task.dueDate) return false;
  const due = new Date(task.dueDate);
  const today = new Date(now);
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return due < today;
}
