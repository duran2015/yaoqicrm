import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, parseDate, startOfMonth, collectSubtreeIds, isManager } from "@/lib/api";

/**
 * GET /api/analytics/territory?employeeId=[&asOf=YYYY-MM-DD]
 * 按下属代表聚合:本月拜访数、覆盖 HCP 数、A 级 HCP 覆盖率。
 * asOf 可指定基准日期(默认服务器当前时间;种子数据基准为 2026-07-24)。
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const employeeId = sp.get("employeeId")?.trim();
  if (!employeeId) return err("employeeId 为必填参数");
  const asOf = parseDate(sp.get("asOf")) ?? new Date();

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return err("员工不存在", 404);

  const scopeIds = isManager(employee.role) ? await collectSubtreeIds(employeeId) : [employeeId];
  const reps = await prisma.employee.findMany({
    where: { id: { in: scopeIds }, role: "MR" },
    select: { id: true, name: true, division: true, territoryId: true, territory: { select: { id: true, name: true } } },
  });

  const monthStart = startOfMonth(asOf);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const period = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

  const data = [] as {
    employee: { id: string; name: string; division: string; territory: { id: string; name: string } | null };
    visitCount: number;
    coveredHcpCount: number;
    aTier: { total: number; covered: number; coverageRate: number | null };
  }[];

  for (const rep of reps) {
    const visits = await prisma.visit.findMany({
      where: { employeeId: rep.id, visitDate: { gte: monthStart, lt: monthEnd } },
      select: { hcpId: true },
    });
    const covered = new Set(visits.map((v) => v.hcpId).filter((x): x is string => !!x));
    // 该代表辖区(含下级)内的 A 级 HCP 名单
    let territoryAHcpIds: string[] = [];
    if (rep.territoryId) {
      const allTerritories = await prisma.territory.findMany({ select: { id: true, parentId: true } });
      const childMap = new Map<string, string[]>();
      for (const t of allTerritories) {
        if (!t.parentId) continue;
        const list = childMap.get(t.parentId) ?? [];
        list.push(t.id);
        childMap.set(t.parentId, list);
      }
      const scope = new Set<string>();
      const queue = [rep.territoryId];
      while (queue.length) {
        const cur = queue.pop()!;
        if (scope.has(cur)) continue;
        scope.add(cur);
        queue.push(...(childMap.get(cur) ?? []));
      }
      const aHcps = await prisma.hcp.findMany({
        where: { tier: "A", hco: { territoryId: { in: [...scope] } } },
        select: { id: true },
      });
      territoryAHcpIds = aHcps.map((h) => h.id);
    }
    // A 级覆盖率 = 本月拜访过的辖区内 A 级 HCP / 辖区内 A 级 HCP 总数
    const aTotal = territoryAHcpIds.length;
    const coveredA = territoryAHcpIds.filter((id) => covered.has(id));

    data.push({
      employee: { id: rep.id, name: rep.name, division: rep.division, territory: rep.territory },
      visitCount: visits.length,
      coveredHcpCount: covered.size,
      aTier: {
        total: aTotal,
        covered: coveredA.length,
        coverageRate: aTotal > 0 ? Math.round((coveredA.length / aTotal) * 1000) / 1000 : null,
      },
    });
  }

  return NextResponse.json({
    employee: { id: employee.id, name: employee.name, role: employee.role },
    period,
    data,
  });
}
