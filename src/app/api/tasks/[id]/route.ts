import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { assertTaskTransition } from "@/lib/follow-up-task";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = await prisma.followUpTask.findUnique({ where: { id } });
  if (!task) return err("任务不存在", 404);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.status) return err("status 为必填字段");
  const status = String(body.status);
  try {
    assertTaskTransition(task.status, status);
  } catch (error) {
    return err(error instanceof Error ? error.message : "无效状态转换", 409);
  }
  const updated = await prisma.followUpTask.update({
    where: { id },
    data: {
      status,
      completedAt: status === "DONE" ? new Date() : null,
    },
  });
  return NextResponse.json(updated);
}
