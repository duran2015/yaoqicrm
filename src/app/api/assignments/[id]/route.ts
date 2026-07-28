import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/assignments/[id] — 解除一条客户-代表分配 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = await prisma.customerAssignment.findUnique({ where: { id } });
  if (!existing) return err("分配关系不存在", 404);
  await prisma.customerAssignment.delete({ where: { id } });
  return NextResponse.json({ ok: true, id });
}
