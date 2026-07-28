import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/applications/[id]/submit — 提交审核:DRAFT → PENDING(无请求体) */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const app = await prisma.customerApplication.findUnique({ where: { id } });
  if (!app) return err("建档申请不存在", 404);
  if (app.status !== "DRAFT") {
    return err(`当前状态为 ${app.status},仅 DRAFT(草稿)可提交`, 409);
  }
  const updated = await prisma.customerApplication.update({
    where: { id },
    data: { status: "PENDING" },
  });
  return NextResponse.json(updated);
}
