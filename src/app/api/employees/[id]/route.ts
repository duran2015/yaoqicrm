import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/employees/[id] — 员工详情:下属、辖区、本月 target */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      territory: true,
      department: { select: { id: true, name: true, level: true } },
      reportsTo: { select: { id: true, name: true, role: true } },
      subordinates: {
        select: { id: true, employeeCode: true, name: true, role: true, division: true, territory: { select: { id: true, name: true } } },
      },
    },
  });
  if (!employee) return err("员工不存在", 404);

  // 当月,如 2026-07;可用 ?period=YYYY-MM 覆盖(演示/测试用)
  const period = req.nextUrl.searchParams.get("period") ?? new Date().toISOString().slice(0, 7);
  const targets = await prisma.target.findMany({
    where: { employeeId: id, period },
    include: { product: { select: { id: true, brand: true, molecule: true } } },
  });

  return NextResponse.json({ ...employee, currentPeriod: period, targets });
}
