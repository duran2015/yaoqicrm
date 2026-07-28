import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { canTransitionAccountPlan } from "@/lib/account-plan";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const plan = await prisma.accountPlan.findUnique({
    where: { id },
    include: { milestones: { where: { status: "OPEN" }, select: { id: true } } },
  });
  if (!plan) return err("Account Plan 不存在", 404);
  if (!canTransitionAccountPlan(plan.status, "CLOSED")) return err("当前状态不能关闭", 409);
  const updated = await prisma.accountPlan.update({ where: { id }, data: { status: "CLOSED" } });
  return NextResponse.json({ plan: updated, openMilestones: plan.milestones.length });
}
