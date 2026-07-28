import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import {
  attachCycleProgress,
  frequencyForTier,
  parseCycleMonth,
  sortCycleGaps,
  summarizeCycleItems,
  validateFrequencies,
} from "@/lib/cycle-plan";

const include = {
  employee: { select: { id: true, name: true, role: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    include: {
      hcp: {
        select: {
          id: true,
          name: true,
          title: true,
          tier: true,
          hco: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.CyclePlanInclude;

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  const monthValue = req.nextUrl.searchParams.get("month")?.trim() ?? "";
  if (!employeeId) return err("employeeId 为必填字段");
  const range = parseCycleMonth(monthValue);
  if (!range) return err("month 必须是 YYYY-MM");

  const plan = await prisma.cyclePlan.findUnique({
    where: { employeeId_month: { employeeId, month: range.start } },
    include,
  });
  if (!plan) return NextResponse.json({ plan: null, summary: summarizeCycleItems([]), items: [] });

  const visits = await prisma.visit.groupBy({
    by: ["hcpId"],
    where: {
      employeeId,
      hcpId: { not: null },
      status: "SUBMITTED",
      visitDate: { gte: range.start, lt: range.end },
    },
    _count: { _all: true },
  });
  const visitsByHcp = new Map(
    visits.flatMap((visit) => (visit.hcpId ? [[visit.hcpId, visit._count._all] as const] : []))
  );
  const items = sortCycleGaps(attachCycleProgress(plan.items, visitsByHcp));
  return NextResponse.json({ plan: { ...plan, items: undefined }, summary: summarizeCycleItems(items), items });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }
  const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  const createdById = typeof body.createdById === "string" ? body.createdById.trim() : "";
  const range = parseCycleMonth(typeof body.month === "string" ? body.month : "");
  const frequencies = validateFrequencies(body.frequencies);
  if (!employeeId || !createdById) return err("employeeId 和 createdById 为必填字段");
  if (!range) return err("month 必须是 YYYY-MM");
  if (!frequencies) return err("frequencies 的 A/B/C/D 必须是 0–31 的整数");

  const [employee, creator] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } }),
    prisma.employee.findUnique({ where: { id: createdById }, select: { id: true } }),
  ]);
  if (!employee) return err("employeeId 对应的员工不存在", 404);
  if (!creator) return err("createdById 对应的员工不存在", 404);
  const existing = await prisma.cyclePlan.findUnique({
    where: { employeeId_month: { employeeId, month: range.start } },
    select: { id: true },
  });
  if (existing) return err("该员工本月 Cycle Plan 已存在", 409);

  const assignments = await prisma.customerAssignment.findMany({
    where: { employeeId, role: "OWNER", hcpId: { not: null } },
    include: { hcp: { select: { id: true, tier: true } } },
  });
  const plan = await prisma.cyclePlan.create({
    data: {
      employeeId,
      createdById,
      month: range.start,
      frequencyA: frequencies.A,
      frequencyB: frequencies.B,
      frequencyC: frequencies.C,
      frequencyD: frequencies.D,
      items: {
        create: assignments.flatMap((assignment) =>
          assignment.hcp
            ? [{
                hcpId: assignment.hcp.id,
                tierSnapshot: assignment.hcp.tier ?? "D",
                targetVisits: frequencyForTier(assignment.hcp.tier, frequencies),
              }]
            : []
        ),
      },
    },
    include,
  });
  return NextResponse.json(plan, { status: 201 });
}
