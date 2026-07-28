import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { isAccountPlanYear, summarizeAccountPlanTeam } from "@/lib/account-plan";
import { accountPlanInclude, enrichAccountPlan } from "@/lib/account-plan-data";

export async function GET(req: NextRequest) {
  const managerId = req.nextUrl.searchParams.get("managerId")?.trim();
  const year = Number(req.nextUrl.searchParams.get("year"));
  if (!managerId) return err("managerId 为必填字段");
  if (!isAccountPlanYear(year)) return err("year 必须是 2020–2100 的整数");
  const employees = await prisma.employee.findMany({ select: { id: true, name: true, reportsToId: true } });
  if (!employees.some((employee) => employee.id === managerId)) return err("经理不存在", 404);
  const descendantIds = new Set<string>();
  let frontier = [managerId];
  while (frontier.length) {
    const next = employees.filter((employee) => employee.reportsToId && frontier.includes(employee.reportsToId));
    frontier = next.map((employee) => employee.id).filter((id) => !descendantIds.has(id));
    frontier.forEach((id) => descendantIds.add(id));
  }
  const plans = await prisma.accountPlan.findMany({
    where: { year, ownerId: { in: [...descendantIds] } },
    include: accountPlanInclude,
    orderBy: { hco: { name: "asc" } },
  });
  const enriched = await Promise.all(plans.map((plan) => enrichAccountPlan(plan)));
  const rows = enriched.map((plan) => ({
    id: plan.id,
    hco: plan.hco,
    owner: plan.owner,
    progress: plan.progress.progress,
    overdue: plan.progress.overdue,
    uncoveredDecisionMakers: plan.uncoveredDecisionMakers,
  }));
  return NextResponse.json({
    summary: summarizeAccountPlanTeam(rows),
    plans: rows.sort((left, right) => right.overdue - left.overdue || right.uncoveredDecisionMakers - left.uncoveredDecisionMakers),
    overdueMilestones: enriched.flatMap((plan) => plan.milestones
      .filter((item) => item.status === "OPEN" && item.dueDate < new Date())
      .map((item) => ({ id: item.id, title: item.title, dueDate: item.dueDate, planId: plan.id, hco: plan.hco, owner: item.owner }))),
    uncoveredDecisionMakers: enriched.flatMap((plan) => plan.stakeholders
      .filter((item) => item.decisionRole === "DECISION_MAKER" && !item.covered)
      .map((item) => ({ id: item.id, planId: plan.id, hco: plan.hco, owner: plan.owner, hcp: item.hcp, attitude: item.attitude }))),
  });
}
