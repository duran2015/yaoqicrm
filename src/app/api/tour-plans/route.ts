import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, parseDate } from "@/lib/api";
import { Prisma } from "@prisma/client";

const planInclude = {
  employee: { select: { id: true, name: true, role: true, division: true } },
  items: {
    orderBy: { planDate: "asc" },
    include: { hcp: { select: { id: true, name: true, title: true, tier: true, hco: { select: { id: true, name: true } } } } },
  },
} satisfies Prisma.TourPlanInclude;

/** GET /api/tour-plans?employeeId=&status= — 周计划列表 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const employeeId = sp.get("employeeId")?.trim();
  const status = sp.get("status")?.trim();
  const weekStart = parseDate(sp.get("weekStart"));

  const where: Prisma.TourPlanWhereInput = {};
  if (employeeId) where.employeeId = employeeId;
  if (status) where.status = status;
  if (weekStart) where.weekStart = weekStart;

  const plans = await prisma.tourPlan.findMany({
    where,
    include: planInclude,
    orderBy: [{ weekStart: "desc" }, { employee: { name: "asc" } }],
    take: 200,
  });
  return NextResponse.json({ data: plans, total: plans.length });
}

/**
 * POST /api/tour-plans — 新建周计划(含 items)
 * body: { employeeId, weekStart, items: [{ planDate, hcpId?, hcoName?, note? }] }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }

  const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
  if (!employeeId) return err("employeeId 为必填字段");
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return err("employeeId 对应的员工不存在", 404);

  const weekStart = parseDate(typeof body.weekStart === "string" ? body.weekStart : null);
  if (!weekStart) return err("weekStart 为必填且必须是合法日期");

  const rawItems = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
  const items: Prisma.TourPlanItemCreateWithoutTourPlanInput[] = [];
  for (const it of rawItems) {
    const planDate = parseDate(typeof it.planDate === "string" ? it.planDate : null);
    if (!planDate) return err("items[].planDate 为必填且必须是合法日期");
    if (it.hcpId) {
      const hcp = await prisma.hcp.findUnique({ where: { id: String(it.hcpId) } });
      if (!hcp) return err(`items[].hcpId ${it.hcpId} 对应的医生不存在`, 404);
    }
    items.push({
      planDate,
      hcp: it.hcpId ? { connect: { id: String(it.hcpId) } } : undefined,
      hcoName: it.hcoName ? String(it.hcoName) : null,
      note: it.note ? String(it.note) : null,
    });
  }

  const plan = await prisma.tourPlan.create({
    data: { employeeId, weekStart, status: "DRAFT", items: { create: items } },
    include: planInclude,
  });
  return NextResponse.json(plan, { status: 201 });
}
