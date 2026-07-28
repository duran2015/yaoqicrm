import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { attachCycleProgress, parseCycleMonth, sortCycleGaps, summarizeCycleItems, summarizeTeamCycles } from "@/lib/cycle-plan";

export async function GET(req: NextRequest) {
  const managerId = req.nextUrl.searchParams.get("managerId")?.trim();
  const monthValue = req.nextUrl.searchParams.get("month")?.trim() ?? "";
  if (!managerId) return err("managerId 为必填字段");
  const range = parseCycleMonth(monthValue);
  if (!range) return err("month 必须是 YYYY-MM");

  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, role: true, reportsToId: true },
  });
  if (!employees.some((employee) => employee.id === managerId)) return err("经理不存在", 404);
  const descendantIds = new Set<string>();
  let frontier = [managerId];
  while (frontier.length) {
    const next = employees.filter((employee) => employee.reportsToId && frontier.includes(employee.reportsToId));
    frontier = next.map((employee) => employee.id).filter((id) => !descendantIds.has(id));
    frontier.forEach((id) => descendantIds.add(id));
  }
  const scopeIds = [...descendantIds];

  const plans = await prisma.cyclePlan.findMany({
    where: { employeeId: { in: scopeIds }, month: range.start },
    include: {
      employee: { select: { id: true, name: true, role: true } },
      items: {
        include: {
          hcp: { select: { id: true, name: true, title: true, hco: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { employee: { name: "asc" } },
  });
  const visits = await prisma.visit.findMany({
    where: {
      employeeId: { in: scopeIds },
      hcpId: { not: null },
      status: "SUBMITTED",
      visitDate: { gte: range.start, lt: range.end },
    },
    select: { employeeId: true, hcpId: true },
  });

  const visitCounts = new Map<string, number>();
  for (const visit of visits) {
    if (!visit.hcpId) continue;
    const key = `${visit.employeeId}:${visit.hcpId}`;
    visitCounts.set(key, (visitCounts.get(key) ?? 0) + 1);
  }

  const employeeRows = plans.map((plan) => {
    const counts = new Map(plan.items.map((item) => [item.hcpId, visitCounts.get(`${plan.employeeId}:${item.hcpId}`) ?? 0]));
    const items = sortCycleGaps(attachCycleProgress(plan.items, counts));
    return { ...summarizeCycleItems(items), employeeId: plan.employeeId, employeeName: plan.employee.name, employeeRole: plan.employee.role };
  });
  const priorityUncovered = plans.flatMap((plan) => {
    const counts = new Map(plan.items.map((item) => [item.hcpId, visitCounts.get(`${plan.employeeId}:${item.hcpId}`) ?? 0]));
    return sortCycleGaps(attachCycleProgress(plan.items, counts))
      .filter((item) => (item.tierSnapshot === "A" || item.tierSnapshot === "B") && item.targetVisits > 0 && item.completedVisits === 0)
      .map((item) => ({
        id: item.id,
        employee: plan.employee,
        hcp: item.hcp,
        tier: item.tierSnapshot,
        remainingVisits: item.remainingVisits,
      }));
  });

  return NextResponse.json({
    summary: summarizeTeamCycles(employeeRows),
    employees: employeeRows.sort((left, right) => left.achievementRate - right.achievementRate),
    priorityUncovered: priorityUncovered.slice(0, 20),
  });
}
