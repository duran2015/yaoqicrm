import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/applications/[id] — 建档申请详情(payload 解析为对象一并返回) */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const app = await prisma.customerApplication.findUnique({ where: { id } });
  if (!app) return err("建档申请不存在", 404);
  let parsedPayload: unknown = null;
  try {
    parsedPayload = JSON.parse(app.payload);
  } catch {
    /* 保留原字符串 */
  }
  return NextResponse.json({ ...app, parsedPayload });
}

/** DELETE /api/applications/[id] — 删除建档申请(仅 DRAFT 草稿可删) */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const app = await prisma.customerApplication.findUnique({ where: { id } });
  if (!app) return err("建档申请不存在", 404);
  if (app.status !== "DRAFT") return err(`当前状态为 ${app.status},仅 DRAFT(草稿)可删除`, 409);
  await prisma.customerApplication.delete({ where: { id } });
  return NextResponse.json({ ok: true, id });
}
