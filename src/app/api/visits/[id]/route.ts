import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, parseDate } from "@/lib/api";
import { visitInclude } from "@/lib/visit-include";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/visits/[id] — 拜访详情 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const visit = await prisma.visit.findUnique({ where: { id }, include: visitInclude });
  if (!visit) return err("拜访记录不存在", 404);
  return NextResponse.json(visit);
}

/**
 * PATCH /api/visits/[id] — 更新拜访标量字段
 * (不处理 products/samples/checkins 明细的替换;AI 字段 aiSummary/aiSentiment 由此写入;
 *  有效性评定请使用 POST /api/visits/[id]/evaluate)
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = await prisma.visit.findUnique({ where: { id } });
  if (!existing) return err("拜访记录不存在", 404);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }

  const data: Record<string, unknown> = {};
  const strFields = [
    "hcpId", "hcoId", "type", "purpose", "purposes", "outcome", "notes", "summary", "nextStep",
    "aiSummary", "aiSentiment", "jointWithId", "receiverId",
  ] as const;
  for (const f of strFields) {
    if (f in body) data[f] = body[f] === null ? null : String(body[f]);
  }
  if ("duration" in body) data.duration = body.duration === null ? null : Number(body.duration);
  if ("visitDate" in body) {
    const d = parseDate(String(body.visitDate));
    if (!d) return err("visitDate 不是合法日期");
    data.visitDate = d;
  }

  const visit = await prisma.visit.update({ where: { id }, data, include: visitInclude });
  return NextResponse.json(visit);
}
