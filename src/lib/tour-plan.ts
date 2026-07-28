export function canEditPlan(status: string) {
  return status === "DRAFT" || status === "REJECTED";
}

export function businessDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function canStartPlanItem(
  planStatus: string,
  itemStatus: string,
  visitId?: string | null
) {
  return planStatus === "APPROVED" && itemStatus === "PLANNED" && !visitId;
}
