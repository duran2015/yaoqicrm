import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { Prisma } from "@prisma/client";
import { APPLICATION_TYPES, APPLICATION_STATUSES } from "@/lib/application";
import { employeeExists } from "@/lib/customer";

/**
 * GET /api/applications?status=&applicantId=&type= — 建档申请列表(按创建时间倒序)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status")?.trim();
  const applicantId = sp.get("applicantId")?.trim();
  const type = sp.get("type")?.trim();

  const where: Prisma.CustomerApplicationWhereInput = {};
  if (status) {
    if (!APPLICATION_STATUSES.includes(status as (typeof APPLICATION_STATUSES)[number])) {
      return err("status 必须为 DRAFT | PENDING | APPROVED | REJECTED");
    }
    where.status = status;
  }
  if (type) {
    if (!APPLICATION_TYPES.includes(type as (typeof APPLICATION_TYPES)[number])) {
      return err("type 必须为 HCP_CREATE | HCO_CREATE | HCP_MODIFY | HCO_MODIFY");
    }
    where.type = type;
  }
  if (applicantId) where.applicantId = applicantId;

  const apps = await prisma.customerApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ data: apps, total: apps.length });
}

/**
 * POST /api/applications — 新建建档申请
 * body: { type, payload(对象或 JSON 字符串), pool?, submit?=false,
 *         applicantId, targetHcpId?(MODIFY), targetHcoId?(MODIFY) }
 * submit=true 直接置 PENDING(立即创建流程),否则 DRAFT(暂存草稿)
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }
  const type = String(body.type ?? "");
  if (!APPLICATION_TYPES.includes(type as (typeof APPLICATION_TYPES)[number])) {
    return err("type 必须为 HCP_CREATE | HCO_CREATE | HCP_MODIFY | HCO_MODIFY");
  }
  const applicantId = String(body.applicantId ?? "");
  if (!applicantId) return err("applicantId 为必填字段");
  if (!(await employeeExists(applicantId))) return err("applicantId 对应的员工不存在", 404);

  let payloadStr: string;
  if (typeof body.payload === "string") {
    try {
      JSON.parse(body.payload);
    } catch {
      return err("payload 字符串不是合法 JSON");
    }
    payloadStr = body.payload;
  } else if (body.payload && typeof body.payload === "object") {
    payloadStr = JSON.stringify(body.payload);
  } else {
    return err("payload 为必填字段(对象或 JSON 字符串)");
  }

  // MODIFY 类必须指定目标档案(支持 body 级或 payload 内携带)
  const parsed = JSON.parse(payloadStr) as Record<string, unknown>;
  const targetHcpId = body.targetHcpId ? String(body.targetHcpId) : parsed.targetHcpId ? String(parsed.targetHcpId) : null;
  const targetHcoId = body.targetHcoId ? String(body.targetHcoId) : parsed.targetHcoId ? String(parsed.targetHcoId) : null;
  if (type === "HCP_MODIFY" && !targetHcpId) return err("HCP_MODIFY 必须提供 targetHcpId");
  if (type === "HCO_MODIFY" && !targetHcoId) return err("HCO_MODIFY 必须提供 targetHcoId");
  if (targetHcpId) {
    const hcp = await prisma.hcp.findUnique({ where: { id: targetHcpId } });
    if (!hcp) return err("targetHcpId 对应的医生不存在", 404);
  }
  if (targetHcoId) {
    const hco = await prisma.hco.findUnique({ where: { id: targetHcoId } });
    if (!hco) return err("targetHcoId 对应的机构不存在", 404);
  }

  const submit = body.submit === true || body.submit === "true";
  const app = await prisma.customerApplication.create({
    data: {
      type,
      payload: payloadStr,
      status: submit ? "PENDING" : "DRAFT",
      applicantId,
      targetHcpId,
      targetHcoId,
      pool: body.pool ? String(body.pool) : null,
    },
  });
  return NextResponse.json(app, { status: 201 });
}
