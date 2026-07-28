import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/tour-plans/[id]/review — 经理审批
 * body: { action: "APPROVE" | "REJECT", approverId, reason? }
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const plan = await prisma.tourPlan.findUnique({ where: { id } });
  if (!plan) return err("计划不存在", 404);
  if (plan.status !== "SUBMITTED") return err(`当前状态 ${plan.status} 不允许审批,仅 SUBMITTED 可审批`, 409);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }
  const action = typeof body.action === "string" ? body.action : "";
  if (action !== "APPROVE" && action !== "REJECT") return err('action 必须为 "APPROVE" | "REJECT"');
  const approverId = typeof body.approverId === "string" ? body.approverId : "";
  if (!approverId) return err("approverId 为必填字段");
  const approver = await prisma.employee.findUnique({ where: { id: approverId } });
  if (!approver) return err("approverId 对应的员工不存在", 404);
  if (action === "REJECT" && !body.reason) return err("REJECT 时必须提供 reason");

  const updated = await prisma.tourPlan.update({
    where: { id },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      approverId,
      approvedAt: new Date(),
      rejectReason: action === "REJECT" ? String(body.reason) : null,
    },
    include: { items: true },
  });
  return NextResponse.json(updated);
}
