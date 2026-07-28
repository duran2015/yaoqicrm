import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/tour-plans/[id]/submit — 提交审批(DRAFT/REJECTED → SUBMITTED) */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const plan = await prisma.tourPlan.findUnique({ where: { id } });
  if (!plan) return err("计划不存在", 404);
  if (plan.status !== "DRAFT" && plan.status !== "REJECTED") {
    return err(`当前状态 ${plan.status} 不允许提交`, 409);
  }

  const updated = await prisma.tourPlan.update({
    where: { id },
    data: { status: "SUBMITTED", rejectReason: null },
    include: { items: true },
  });
  return NextResponse.json(updated);
}
