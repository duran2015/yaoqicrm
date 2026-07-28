import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, parseDate, startOfDay } from "@/lib/api";
import { maskName } from "@/lib/mask";

/**
 * GET /api/analytics/employee-visits?employeeId=xx(必填)[&from=YYYY-MM-DD][&to=YYYY-MM-DD]
 * 员工某段时间拜访情况聚合:按天/类型/有效性/来源分布 + 高频拜访医生(前 10)。
 * from/to 缺省 = 最近 14 天(含今天),闭区间。
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const employeeId = sp.get("employeeId")?.trim();
  if (!employeeId) return err("employeeId 为必填参数");

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return err("员工不存在", 404);

  const toRaw = parseDate(sp.get("to")) ?? new Date();
  const fromParsed = parseDate(sp.get("from"));
  const fromRaw = fromParsed ?? (() => {
    const d = new Date(toRaw);
    d.setDate(d.getDate() - 13);
    return d;
  })();
  const from = startOfDay(fromRaw);
  const toInclusive = startOfDay(toRaw);
  if (from > toInclusive) return err("from 不能晚于 to");
  const toExclusive = new Date(toInclusive);
  toExclusive.setDate(toExclusive.getDate() + 1);

  const visits = await prisma.visit.findMany({
    where: { employeeId, visitDate: { gte: from, lt: toExclusive } },
    select: {
      visitDate: true,
      type: true,
      validityStatus: true,
      source: true,
      hcpId: true,
      jointWithId: true,
      hcp: { select: { name: true } },
    },
    orderBy: { visitDate: "asc" },
  });

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // 逐日分布(范围内含 0 值天)
  const dailyMap = new Map<string, number>();
  for (let d = new Date(from); d < toExclusive; d.setDate(d.getDate() + 1)) {
    dailyMap.set(dayKey(d), 0);
  }
  const typeMap = new Map<string, number>();
  const validityMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  const hcpMap = new Map<string, { name: string; count: number }>();
  let jointVisitCount = 0;

  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const v of visits) {
    const k = dayKey(new Date(v.visitDate));
    if (dailyMap.has(k)) dailyMap.set(k, dailyMap.get(k)! + 1);
    bump(typeMap, v.type);
    bump(validityMap, v.validityStatus);
    bump(sourceMap, v.source);
    if (v.type === "JOINT" || v.jointWithId) jointVisitCount++;
    if (v.hcpId) {
      const cur = hcpMap.get(v.hcpId);
      if (cur) cur.count++;
      else hcpMap.set(v.hcpId, { name: v.hcp?.name ?? "", count: 1 });
    }
  }

  const toSorted = (m: Map<string, number>, keyName: string) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, count]) => ({ [keyName]: k, count }));

  const days = dailyMap.size;
  const totalVisits = visits.length;
  const topHcps = [...hcpMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([hcpId, v]) => ({ hcpId, name: maskName(v.name), count: v.count }));

  return NextResponse.json({
    employee: { id: employee.id, name: employee.name, role: employee.role, division: employee.division },
    range: { from: from.toISOString(), to: toInclusive.toISOString(), days },
    totalVisits,
    dailyBreakdown: [...dailyMap.entries()].map(([date, count]) => ({ date, count })),
    byType: toSorted(typeMap, "type"),
    byValidity: toSorted(validityMap, "status"),
    bySource: toSorted(sourceMap, "source"),
    topHcps,
    coveredHcpCount: hcpMap.size,
    jointVisitCount,
    avgPerDay: days > 0 ? Math.round((totalVisits / days) * 1000) / 1000 : 0,
  });
}
