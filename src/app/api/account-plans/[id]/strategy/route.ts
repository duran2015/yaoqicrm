import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { parseAccountPlanStrategyInput } from "@/lib/account-plan";
import { accountPlanInclude, enrichAccountPlan } from "@/lib/account-plan-data";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const plan = await prisma.accountPlan.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!plan) return err("Account Plan 不存在", 404);
  if (plan.status !== "ACTIVE") return err("已关闭的 Account Plan 不能修改", 409);
  const input = parseAccountPlanStrategyInput(await req.json().catch(() => null));
  if (!input) return err("业务目标、核心策略和成功标准为必填字段");
  const updated = await prisma.accountPlan.update({
    where: { id },
    data: input,
    include: accountPlanInclude,
  });
  return NextResponse.json(await enrichAccountPlan(updated));
}
