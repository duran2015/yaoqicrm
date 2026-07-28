import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/hcp/[id]/tier-history — 医生分级变更历史(按时间倒序) */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const hcp = await prisma.hcp.findUnique({ where: { id }, select: { id: true } });
  if (!hcp) return err("HCP 不存在", 404);
  const history = await prisma.customerTierHistory.findMany({
    where: { hcpId: id },
    orderBy: { changedAt: "desc" },
  });
  return NextResponse.json({ data: history, total: history.length });
}
