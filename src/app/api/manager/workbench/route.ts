import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

export async function GET(req: NextRequest) {
  const managerId = req.nextUrl.searchParams.get("managerId")?.trim();
  if (!managerId) return err("managerId 为必填字段");
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
  const [pendingPlans, pendingEvaluations, checkinExceptions, overdueTasks, coachingActions] = await Promise.all([
    prisma.tourPlan.findMany({
      where: { employeeId: { in: scopeIds }, status: "SUBMITTED" },
      include: { employee: { select: { id: true, name: true } }, items: true },
      orderBy: { weekStart: "desc" },
      take: 50,
    }),
    prisma.visit.findMany({
      where: { employeeId: { in: scopeIds }, receiverId: managerId, validityStatus: "PENDING", status: "SUBMITTED" },
      include: { employee: { select: { id: true, name: true } }, hcp: { select: { id: true, name: true } } },
      orderBy: { visitDate: "desc" },
      take: 50,
    }),
    prisma.checkIn.findMany({
      where: { employeeId: { in: scopeIds }, status: "LOCATION_MISMATCH" },
      include: { employee: { select: { id: true, name: true } }, visit: { include: { hcp: { select: { id: true, name: true } } } } },
      orderBy: { checkinTime: "desc" },
      take: 50,
    }),
    prisma.followUpTask.findMany({
      where: { assigneeId: { in: scopeIds }, status: "OPEN", dueDate: { lt: new Date() } },
      include: { assignee: { select: { id: true, name: true } }, hcp: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    prisma.coachingAction.findMany({
      where: { managerId },
      include: { employee: { select: { id: true, name: true, role: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 100,
    }),
  ]);
  return NextResponse.json({
    counts: {
      pendingPlans: pendingPlans.length,
      pendingEvaluations: pendingEvaluations.length,
      checkinExceptions: checkinExceptions.length,
      overdueTasks: overdueTasks.length,
      openCoachings: coachingActions.filter((action) => action.status === "OPEN").length,
    },
    pendingPlans,
    pendingEvaluations,
    checkinExceptions,
    overdueTasks,
    coachingActions,
    employees: employees.filter((employee) => descendantIds.has(employee.id)),
  });
}
