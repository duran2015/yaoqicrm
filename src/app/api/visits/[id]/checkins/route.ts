import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, parseDate } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/visits/[id]/checkins — 为拜访补一条签到
 * body: { employeeId?, checkinTime?, locationName?, latitude?, longitude?, status? }
 *  - employeeId 缺省 = 该拜访的填写人
 *  - checkinTime 缺省 = 当前时间
 *  - status 缺省:若 locationName 与拜访机构名不一致,自动标记 LOCATION_MISMATCH,否则 NORMAL
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const visit = await prisma.visit.findUnique({
    where: { id },
    include: { hco: { select: { name: true } } },
  });
  if (!visit) return err("拜访记录不存在", 404);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }

  const employeeId = body.employeeId ? String(body.employeeId) : visit.employeeId;
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return err("employeeId 对应的员工不存在", 404);

  const checkinTime = body.checkinTime ? parseDate(String(body.checkinTime)) : new Date();
  if (!checkinTime) return err("checkinTime 不是合法日期");

  const locationName = body.locationName ? String(body.locationName) : null;
  let status = body.status ? String(body.status) : "";
  if (status && !["NORMAL", "LOCATION_MISMATCH"].includes(status)) {
    return err("status 必须为 NORMAL | LOCATION_MISMATCH");
  }
  if (!status) {
    status =
      locationName && visit.hco?.name && locationName !== visit.hco.name ? "LOCATION_MISMATCH" : "NORMAL";
  }

  const checkin = await prisma.checkIn.create({
    data: {
      visitId: id,
      employeeId,
      checkinTime,
      locationName,
      latitude: body.latitude != null ? Number(body.latitude) : null,
      longitude: body.longitude != null ? Number(body.longitude) : null,
      status,
    },
  });
  return NextResponse.json(checkin, { status: 201 });
}
