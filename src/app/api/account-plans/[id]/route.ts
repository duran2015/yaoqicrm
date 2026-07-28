import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { validateAccountPlanInput } from "@/lib/account-plan";
import { accountPlanInclude, accountYearRange, enrichAccountPlan } from "@/lib/account-plan-data";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const plan = await prisma.accountPlan.findUnique({ where: { id }, include: accountPlanInclude });
  if (!plan) return err("Account Plan 不存在", 404);
  const range = accountYearRange(plan.year);
  const [visits, attendances, openTasks] = await Promise.all([
    prisma.visit.findMany({
      where: { hcoId: plan.hcoId, status: "SUBMITTED", visitDate: { gte: range.start, lt: range.end } },
      include: { employee: { select: { id: true, name: true } }, hcp: { select: { id: true, name: true } } },
      orderBy: { visitDate: "desc" },
      take: 20,
    }),
    prisma.eventAttendance.findMany({
      where: { hcp: { hcoId: plan.hcoId }, event: { eventDate: { gte: range.start, lt: range.end } } },
      include: { event: true, hcp: { select: { id: true, name: true } } },
      orderBy: { event: { eventDate: "desc" } },
      take: 20,
    }),
    prisma.followUpTask.findMany({
      where: { hcoId: plan.hcoId, status: "OPEN" },
      include: { assignee: { select: { id: true, name: true, role: true } }, hcp: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
  ]);
  return NextResponse.json({
    ...(await enrichAccountPlan(plan)),
    activity: {
      visitCount: visits.length,
      meetings: attendances,
      openTasks,
      recentVisits: visits,
    },
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const current = await prisma.accountPlan.findUnique({ where: { id } });
  if (!current) return err("Account Plan 不存在", 404);
  if (current.status !== "ACTIVE") return err("已关闭的 Account Plan 不能修改", 409);
  const input = validateAccountPlanInput(await req.json().catch(() => null));
  if (!input || input.hcoId !== current.hcoId || input.year !== current.year) return err("更新字段不完整，且 HCO/年度不能改变");

  const [productCount, stakeholders, owner] = await Promise.all([
    prisma.product.count({ where: { id: { in: input.productIds } } }),
    prisma.hcp.findMany({ where: { id: { in: input.stakeholders.map((item) => item.hcpId) } }, select: { id: true, hcoId: true } }),
    prisma.employee.findUnique({ where: { id: input.ownerId }, select: { id: true } }),
  ]);
  if (!owner || productCount !== input.productIds.length || stakeholders.length !== input.stakeholders.length) return err("负责人、产品或关系人不存在", 404);
  if (stakeholders.some((stakeholder) => stakeholder.hcoId !== current.hcoId)) return err("关键关系人必须属于计划 HCO", 409);

  await prisma.$transaction([
    prisma.accountPlanProduct.deleteMany({ where: { accountPlanId: id } }),
    prisma.accountStakeholder.deleteMany({ where: { accountPlanId: id } }),
    prisma.accountPlan.update({
      where: { id },
      data: {
        ownerId: input.ownerId,
        businessGoal: input.businessGoal,
        situation: input.situation,
        strategy: input.strategy,
        successCriteria: input.successCriteria,
        products: { create: input.productIds.map((productId) => ({ productId })) },
        stakeholders: { create: input.stakeholders },
      },
    }),
  ]);
  const updated = await prisma.accountPlan.findUniqueOrThrow({ where: { id }, include: accountPlanInclude });
  return NextResponse.json(await enrichAccountPlan(updated));
}
