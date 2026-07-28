import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, parseDate } from "@/lib/api";
import { Prisma } from "@prisma/client";

/** GET /api/events?from=&to= — 会议列表 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = parseDate(sp.get("from"));
  const to = parseDate(sp.get("to"));

  const where: Prisma.MedEventWhereInput = {};
  if (from || to) where.eventDate = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const events = await prisma.medEvent.findMany({
    where,
    include: { _count: { select: { attendees: true } } },
    orderBy: { eventDate: "desc" },
  });
  return NextResponse.json({ data: events, total: events.length });
}

/**
 * POST /api/events — 新建会议
 * body: { name, type, eventDate, location?, budget?, attendeeHcpIds?: string[] }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return err("name 为必填字段");
  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!type) return err("type 为必填字段(科室会 | 城市会 | 学术研讨会 | 卫星会)");
  const eventDate = parseDate(typeof body.eventDate === "string" ? body.eventDate : null);
  if (!eventDate) return err("eventDate 为必填且必须是合法日期");

  const attendeeIds = Array.isArray(body.attendeeHcpIds) ? (body.attendeeHcpIds as unknown[]).map(String) : [];
  for (const hcpId of attendeeIds) {
    const hcp = await prisma.hcp.findUnique({ where: { id: hcpId } });
    if (!hcp) return err(`参会医生 ${hcpId} 不存在`, 404);
  }

  const event = await prisma.medEvent.create({
    data: {
      name,
      type,
      eventDate,
      location: body.location ? String(body.location) : null,
      budget: body.budget != null ? Number(body.budget) : null,
      attendees: { create: attendeeIds.map((hcpId) => ({ hcp: { connect: { id: hcpId } } })) },
    },
    include: { attendees: { include: { hcp: { select: { id: true, name: true, title: true, tier: true } } } } },
  });
  return NextResponse.json(event, { status: 201 });
}
