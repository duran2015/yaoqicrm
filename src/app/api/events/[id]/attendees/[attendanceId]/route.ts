import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { canMarkAttendance } from "@/lib/event-workflow";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attendanceId: string }> }
) {
  const { id, attendanceId } = await params;
  const event = await prisma.medEvent.findUnique({ where: { id } });
  if (!event) return err("会议不存在", 404);
  if (!canMarkAttendance(event.status)) return err("只有进行中的会议可以签到", 409);
  const attendance = await prisma.eventAttendance.findUnique({ where: { id: attendanceId } });
  if (!attendance || attendance.eventId !== id) return err("参会记录不存在", 404);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const status = body?.status ? String(body.status) : "";
  if (!["CHECKED_IN", "ABSENT"].includes(status)) return err("status 必须为 CHECKED_IN | ABSENT");
  const updated = await prisma.eventAttendance.update({
    where: { id: attendanceId },
    data: { status, checkedInAt: status === "CHECKED_IN" ? new Date() : null },
  });
  return NextResponse.json(updated);
}
