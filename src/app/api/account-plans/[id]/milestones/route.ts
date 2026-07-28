import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { validateMilestoneInput } from "@/lib/account-plan";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const input = validateMilestoneInput(await req.json().catch(() => null));
  if (!input) return err("里程碑标题、负责人和截止日期为必填字段");
  const [plan, owner] = await Promise.all([
    prisma.accountPlan.findUnique({ where: { id }, select: { id: true, status: true } }),
    prisma.employee.findUnique({ where: { id: input.ownerId }, select: { id: true } }),
  ]);
  if (!plan) return err("Account Plan 不存在", 404);
  if (plan.status !== "ACTIVE") return err("已关闭计划不能新增里程碑", 409);
  if (!owner) return err("里程碑负责人不存在", 404);
  const milestone = await prisma.accountMilestone.create({
    data: { accountPlanId: id, ...input },
    include: { owner: { select: { id: true, name: true, role: true } }, followUpTask: true },
  });
  return NextResponse.json(milestone, { status: 201 });
}
