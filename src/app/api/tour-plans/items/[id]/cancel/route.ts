import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await prisma.tourPlanItem.findUnique({ where: { id } });
  if (!item) return err("计划项不存在", 404);
  if (item.status !== "PLANNED" || item.visitId) return err("当前计划项不能取消", 409);
  const updated = await prisma.tourPlanItem.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  return NextResponse.json(updated);
}
