import { NextResponse } from "next/server";
import { err } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.agentEvaluationRun.findUnique({
    where: { id },
    include: { results: { include: { assertions: true }, orderBy: { startedAt: "asc" } } },
  });
  return run ? NextResponse.json(run) : err("评测运行不存在", 404);
}
