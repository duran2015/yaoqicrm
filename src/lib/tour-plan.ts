export function canEditPlan(status: string) {
  return status === "DRAFT" || status === "REJECTED";
}

export function canStartPlanItem(
  planStatus: string,
  itemStatus: string,
  visitId?: string | null
) {
  return planStatus === "APPROVED" && itemStatus === "PLANNED" && !visitId;
}
