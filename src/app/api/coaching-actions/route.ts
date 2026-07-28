import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, parseDate } from "@/lib/api";
import { assertCoachingParticipants } from "@/lib/coaching";

export async function GET(req: NextRequest) {
  const managerId = req.nextUrl.searchParams.get("managerId")?.trim();
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  if (!managerId && !employeeId) return err("managerId 或 employeeId 至少提供一个");
  const actions = await prisma.coachingAction.findMany({
    where: { ...(managerId ? { managerId } : {}), ...(employeeId ? { employeeId } : {}) },
    include: {
      manager: { select: { id: true, name: true } },
      employee: { select: { id: true, name: true, role: true } },
      sourceVisit: { select: { id: true, visitDate: true, hcp: { select: { id: true, name: true } } } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return NextResponse.json({ data: actions, total: actions.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return err("请求体不是合法 JSON");
  const managerId = typeof body.managerId === "string" ? body.managerId : "";
  const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!managerId || !employeeId || !title) return err("managerId、employeeId 和 title 为必填字段");
  try {
    assertCoachingParticipants(managerId, employeeId);
  } catch (error) {
    return err(error instanceof Error ? error.message : "辅导对象无效");
  }
  const dueDate = body.dueDate ? parseDate(String(body.dueDate)) : null;
  if (body.dueDate && !dueDate) return err("dueDate 不是合法日期");
  try {
    const action = await prisma.coachingAction.create({
      data: {
        managerId,
        employeeId,
        title,
        description: body.description ? String(body.description) : null,
        dueDate,
        sourceVisitId: body.sourceVisitId ? String(body.sourceVisitId) : null,
      },
      include: {
        manager: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true, role: true } },
      },
    });
    return NextResponse.json(action, { status: 201 });
  } catch {
    return err("经理、员工或来源拜访不存在", 404);
  }
}
