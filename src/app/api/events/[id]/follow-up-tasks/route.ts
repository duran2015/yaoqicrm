import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, parseDate } from "@/lib/api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = await prisma.medEvent.findUnique({
    where: { id },
    include: { attendees: { where: { status: "CHECKED_IN" } } },
  });
  if (!event) return err("会议不存在", 404);
  if (event.status !== "COMPLETED") return err("会议结束后才能生成跟进任务", 409);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const assigneeId = typeof body?.assigneeId === "string" ? body.assigneeId : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!assigneeId || !title) return err("assigneeId 和 title 为必填字段");
  const dueDate = body?.dueDate ? parseDate(String(body.dueDate)) : null;
  if (body?.dueDate && !dueDate) return err("dueDate 不是合法日期");
  const requestedIds = Array.isArray(body?.attendanceIds) ? body.attendanceIds.map(String) : event.attendees.map((a) => a.id);
  const selected = event.attendees.filter((attendance) => requestedIds.includes(attendance.id));
  let created = 0;
  let skipped = 0;
  await prisma.$transaction(async (tx) => {
    for (const attendance of selected) {
      const duplicate = await tx.followUpTask.findFirst({
        where: { sourceEventId: id, hcpId: attendance.hcpId, title, status: "OPEN" },
      });
      if (duplicate) {
        skipped += 1;
        continue;
      }
      await tx.followUpTask.create({
        data: {
          title, dueDate, assigneeId,
          hcpId: attendance.hcpId,
          sourceEventId: id,
        },
      });
      created += 1;
    }
  });
  return NextResponse.json({ created, skipped });
}
