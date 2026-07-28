import { NextResponse } from "next/server";
import { err } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = await req.json().catch(() => null) as { enabled?: unknown } | null;
  if (!input || typeof input.enabled !== "boolean") return err("目前仅支持启用或停用来源");
  if (!await prisma.intelligenceSource.findUnique({ where: { id }, select: { id: true } })) return err("来源不存在", 404);
  return NextResponse.json(await prisma.intelligenceSource.update({ where: { id }, data: { enabled: input.enabled } }));
}
