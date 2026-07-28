import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { canTransitionMilestone } from "@/lib/account-plan";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const status = typeof body?.status === "string" ? body.status : "";
  if (status !== "DONE" && status !== "CANCELLED") return err("status 必须是 DONE 或 CANCELLED");
  const milestone = await prisma.accountMilestone.findUnique({ where: { id }, include: { accountPlan: { select: { status: true } } } });
  if (!milestone) return err("里程碑不存在", 404);
  if (milestone.accountPlan.status !== "ACTIVE") return err("已关闭计划不能修改里程碑", 409);
  if (!canTransitionMilestone(milestone.status, status)) return err("当前里程碑状态不能执行该操作", 409);
  const updated = await prisma.accountMilestone.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
    include: { owner: { select: { id: true, name: true, role: true } }, followUpTask: true },
  });
  return NextResponse.json(updated);
}
