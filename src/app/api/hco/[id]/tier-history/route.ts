import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/hco/[id]/tier-history — 机构分级变更历史(按时间倒序) */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const hco = await prisma.hco.findUnique({ where: { id }, select: { id: true } });
  if (!hco) return err("机构不存在", 404);
  const history = await prisma.customerTierHistory.findMany({
    where: { hcoId: id },
    orderBy: { changedAt: "desc" },
  });
  return NextResponse.json({ data: history, total: history.length });
}
