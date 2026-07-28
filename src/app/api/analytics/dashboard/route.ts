import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, parseDate, startOfDay, startOfWeek, startOfMonth, collectSubtreeIds, isManager } from "@/lib/api";

/**
 * GET /api/analytics/dashboard?employeeId=[&asOf=YYYY-MM-DD]
 * 今日拜访数、本周计划完成率、本月拜访 vs 目标、近14天拜访趋势、所管 HCP 分级分布。
 * manager(ASM/RSM/ADMIN)时聚合整个下属子树。
 * asOf 可指定"今天"的基准日期(默认服务器当前时间;种子数据基准为 2026-07-24)。
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const employeeId = sp.get("employeeId")?.trim();
  if (!employeeId) return err("employeeId 为必填参数");
  const asOf = parseDate(sp.get("asOf")) ?? new Date();

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return err("员工不存在", 404);

  const scopeIds = isManager(employee.role) ? await collectSubtreeIds(employeeId) : [employeeId];
  const manager = isManager(employee.role);

  const todayStart = startOfDay(asOf);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = startOfWeek(asOf);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const monthStart = startOfMonth(asOf);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const period = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
  const trendStart = new Date(todayStart);
  trendStart.setDate(trendStart.getDate() - 13);

  const [todayCount, weekCount, monthCount, trendVisits, plans, targets, scopeEmployees, pendingEvaluations] = await Promise.all([
    prisma.visit.count({ where: { employeeId: { in: scopeIds }, visitDate: { gte: todayStart, lt: tomorrow } } }),
    prisma.visit.count({ where: { employeeId: { in: scopeIds }, visitDate: { gte: weekStart, lt: weekEnd } } }),
    prisma.visit.count({ where: { employeeId: { in: scopeIds }, visitDate: { gte: monthStart, lt: monthEnd } } }),
    prisma.visit.findMany({
      where: { employeeId: { in: scopeIds }, visitDate: { gte: trendStart, lt: tomorrow } },
      select: { visitDate: true },
    }),
    prisma.tourPlan.findMany({
      where: { employeeId: { in: scopeIds }, weekStart },
      include: { items: { select: { id: true } } },
    }),
    prisma.target.findMany({ where: { employeeId: { in: scopeIds }, period } }),
    prisma.employee.findMany({ where: { id: { in: scopeIds } }, select: { territoryId: true } }),
    // 待我评定的拜访数(仅管理岗有意义:接收人是我 且 未反馈)
    manager
      ? prisma.visit.count({ where: { receiverId: employeeId, validityStatus: "PENDING" } })
      : Promise.resolve(null),
  ]);

  // 本周计划完成率
  const plannedCount = plans.reduce((s, p) => s + p.items.length, 0);
  const weekCompletionRate = plannedCount > 0 ? Math.round((weekCount / plannedCount) * 1000) / 1000 : null;

  // 本月拜访 vs 目标
  const visitTarget = targets.reduce((s, t) => s + t.visitTarget, 0);
  const salesTarget = targets.reduce((s, t) => s + (t.salesTarget ?? 0), 0);

  // 近 14 天趋势(按天)
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const trendMap = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(trendStart);
    d.setDate(d.getDate() + i);
    trendMap.set(dayKey(d), 0);
  }
  for (const v of trendVisits) {
    const k = dayKey(new Date(v.visitDate));
    trendMap.set(k, (trendMap.get(k) ?? 0) + 1);
  }

  // 所管 HCP 分级分布:scope 员工辖区(含下级辖区)内的所有医生
  const territoryIds = scopeEmployees.map((e) => e.territoryId).filter((x): x is string => !!x);
  const allTerritories = await prisma.territory.findMany({ select: { id: true, parentId: true } });
  const childMap = new Map<string, string[]>();
  for (const t of allTerritories) {
    if (!t.parentId) continue;
    const list = childMap.get(t.parentId) ?? [];
    list.push(t.id);
    childMap.set(t.parentId, list);
  }
  const territoryScope = new Set<string>();
  const queue = [...territoryIds];
  while (queue.length) {
    const cur = queue.pop()!;
    if (territoryScope.has(cur)) continue;
    territoryScope.add(cur);
    queue.push(...(childMap.get(cur) ?? []));
  }
  const hcpGroups = await prisma.hcp.groupBy({
    by: ["tier"],
    where: { hco: { territoryId: { in: [...territoryScope] } } },
    _count: { _all: true },
  });
  const hcpTierDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, 未分级: 0 };
  for (const g of hcpGroups) hcpTierDistribution[g.tier ?? "未分级"] = g._count._all;

  return NextResponse.json({
    employee: { id: employee.id, name: employee.name, role: employee.role, division: employee.division },
    scope: { employeeCount: scopeIds.length, isManager: isManager(employee.role) },
    asOf: asOf.toISOString(),
    todayVisits: todayCount,
    week: {
      weekStart: weekStart.toISOString(),
      plannedVisits: plannedCount,
      completedVisits: weekCount,
      completionRate: weekCompletionRate,
    },
    month: {
      period,
      visits: monthCount,
      visitTarget,
      attainmentRate: visitTarget > 0 ? Math.round((monthCount / visitTarget) * 1000) / 1000 : null,
      salesTarget,
    },
    visitTrend14d: [...trendMap.entries()].map(([date, count]) => ({ date, count })),
    hcpTierDistribution,
    ...(manager ? { pendingEvaluations } : {}),
  });
}
