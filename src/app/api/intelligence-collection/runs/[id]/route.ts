import { NextResponse } from "next/server";
import { err } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.collectionRun.findUnique({ where: { id }, include: { source: true, product: true } });
  return run ? NextResponse.json(run) : err("采集任务不存在", 404);
}
