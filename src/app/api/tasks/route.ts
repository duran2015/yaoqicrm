import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { err, parseDate } from "@/lib/api";

const taskInclude = {
  assignee: { select: { id: true, name: true, role: true } },
  hcp: { select: { id: true, name: true, title: true, hco: { select: { id: true, name: true } } } },
  hco: { select: { id: true, name: true } },
} satisfies Prisma.FollowUpTaskInclude;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const assigneeId = sp.get("assigneeId")?.trim();
  const status = sp.get("status")?.trim();
  const hcpId = sp.get("hcpId")?.trim();
  if (!assigneeId && !hcpId) return err("assigneeId 或 hcpId 至少提供一个");
  const where: Prisma.FollowUpTaskWhereInput = {
    ...(assigneeId ? { assigneeId } : {}),
    ...(hcpId ? { hcpId } : {}),
    ...(status ? { status } : {}),
  };
  const tasks = await prisma.followUpTask.findMany({
    where,
    include: taskInclude,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return NextResponse.json({ data: tasks, total: tasks.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return err("请求体不是合法 JSON");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const assigneeId = typeof body.assigneeId === "string" ? body.assigneeId : "";
  const hcpId = typeof body.hcpId === "string" ? body.hcpId : null;
  const hcoId = typeof body.hcoId === "string" ? body.hcoId : null;
  if (!title) return err("title 为必填字段");
  if (!assigneeId) return err("assigneeId 为必填字段");
  if (!hcpId && !hcoId) return err("任务必须关联 HCP 或 HCO");
  const dueDate = body.dueDate ? parseDate(String(body.dueDate)) : null;
  if (body.dueDate && !dueDate) return err("dueDate 不是合法日期");
  const priority = body.priority === "HIGH" ? "HIGH" : "NORMAL";
  try {
    const task = await prisma.followUpTask.create({
      data: {
        title,
        description: body.description ? String(body.description) : null,
        assigneeId,
        hcpId,
        hcoId,
        dueDate,
        priority,
        sourceVisitId: body.sourceVisitId ? String(body.sourceVisitId) : null,
        sourceEventId: body.sourceEventId ? String(body.sourceEventId) : null,
      },
      include: taskInclude,
    });
    return NextResponse.json(task, { status: 201 });
  } catch {
    return err("任务关联的员工或客户不存在", 404);
  }
}
