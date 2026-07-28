import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { visitInclude } from "@/lib/visit-include";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/visits/[id]/evaluate — 经理评定拜访有效性
 * body: { action: "VALID" | "INVALID", evaluatorId: string, reason?: string }
 * 规则:
 *  - 仅 PENDING(未反馈)状态可评定,重复评定返回 409
 *  - action=INVALID 必须提供 reason(写入 invalidReason)
 *  - 写入 evaluatedById / evaluatedAt / invalidReason
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const visit = await prisma.visit.findUnique({ where: { id } });
  if (!visit) return err("拜访记录不存在", 404);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!["VALID", "INVALID"].includes(action)) return err("action 必须为 VALID | INVALID");

  const evaluatorId = typeof body.evaluatorId === "string" ? body.evaluatorId : "";
  if (!evaluatorId) return err("evaluatorId 为必填字段");
  const evaluator = await prisma.employee.findUnique({ where: { id: evaluatorId } });
  if (!evaluator) return err("evaluatorId 对应的员工不存在", 404);

  if (visit.validityStatus !== "PENDING") {
    return err(`该拜访已评定为 ${visit.validityStatus},不能重复评定`, 409);
  }

  const reason = body.reason ? String(body.reason).trim() : "";
  if (action === "INVALID" && !reason) return err("评定为无效时必须提供 reason(无效原因)");

  const updated = await prisma.visit.update({
    where: { id },
    data: {
      validityStatus: action,
      evaluatedById: evaluatorId,
      evaluatedAt: new Date(),
      invalidReason: action === "INVALID" ? reason : null,
    },
    include: visitInclude,
  });
  return NextResponse.json(updated);
}
