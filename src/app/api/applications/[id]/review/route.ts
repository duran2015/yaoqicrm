import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { applyApprovedPayload, ApplicationError } from "@/lib/application";
import { employeeExists } from "@/lib/customer";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/review — 审核建档申请
 * body: { action: APPROVE | REJECT, reviewerId, reason? }
 * - 仅 PENDING 状态可审,重复审核返回 409
 * - REJECT 必须提供 reason
 * - APPROVE 按 type 用 payload 创建/更新客户档案(含子记录 + 申请人默认 OWNER 分配)
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }
  const action = String(body.action ?? "");
  if (!["APPROVE", "REJECT"].includes(action)) return err("action 必须为 APPROVE | REJECT");
  const reviewerId = String(body.reviewerId ?? "");
  if (!reviewerId) return err("reviewerId 为必填字段");
  if (!(await employeeExists(reviewerId))) return err("reviewerId 对应的员工不存在", 404);
  const reason = body.reason ? String(body.reason) : null;
  if (action === "REJECT" && !reason) return err("REJECT 必须提供 reason(驳回原因)");

  const app = await prisma.customerApplication.findUnique({ where: { id } });
  if (!app) return err("建档申请不存在", 404);
  if (app.status !== "PENDING") {
    return err(`当前状态为 ${app.status},仅 PENDING(待审核)可审核,不能重复审核`, 409);
  }

  if (action === "REJECT") {
    const updated = await prisma.customerApplication.update({
      where: { id },
      data: { status: "REJECTED", reviewerId, reviewedAt: new Date(), rejectReason: reason },
    });
    return NextResponse.json(updated);
  }

  // APPROVE:落地 payload
  try {
    const { createdHcpId, createdHcoId } = await applyApprovedPayload(app);
    const updated = await prisma.customerApplication.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewerId,
        reviewedAt: new Date(),
        rejectReason: null,
        createdHcpId,
        createdHcoId,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof ApplicationError) return err(e.message, e.status);
    throw e;
  }
}
