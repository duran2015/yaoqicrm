import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = await prisma.followUpTask.findUnique({
    where: { id },
    include: { assignee: true, hcp: true },
  });
  if (!task) return err("任务不存在", 404);
  if (task.followUpVisitId) return err("该任务已经创建过复访", 409);
  if (!task.hcpId) return err("只有关联 HCP 的任务才能创建复访", 409);
  const visit = await prisma.$transaction(async (tx) => {
    const created = await tx.visit.create({
      data: {
        employeeId: task.assigneeId,
        receiverId: task.assignee.reportsToId,
        hcpId: task.hcpId,
        hcoId: task.hcp?.hcoId,
        visitDate: task.dueDate ?? new Date(),
        type: "FACE_TO_FACE",
        purpose: task.title,
        status: "DRAFT",
        source: "MANUAL",
      },
    });
    await tx.followUpTask.update({
      where: { id },
      data: { followUpVisitId: created.id },
    });
    return created;
  });
  return NextResponse.json(visit, { status: 201 });
}
