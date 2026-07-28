import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, parseDate } from "@/lib/api";
import { visitInclude } from "@/lib/visit-include";
import { Prisma } from "@prisma/client";

const VISIT_TYPES = ["FACE_TO_FACE", "PHONE", "CONFERENCE", "JOINT"];
const VISIT_SOURCES = ["MANUAL", "AI", "IMPORT"];
/** 结构化拜访目的枚举(逗号组合存储于 Visit.purposes) */
const PURPOSE_OPTIONS = ["产品信息传递", "临床信息沟通", "市场现状调研", "学术会议沟通", "其他"];

/** GET /api/visits?employeeId=&hcpId=&from=&to=&type=&validityStatus=&source=&page=&pageSize= — 拜访列表(分页) */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const employeeId = sp.get("employeeId")?.trim();
  const hcpId = sp.get("hcpId")?.trim();
  const type = sp.get("type")?.trim();
  const validityStatus = sp.get("validityStatus")?.trim();
  const source = sp.get("source")?.trim();
  const from = parseDate(sp.get("from"));
  const to = parseDate(sp.get("to"));
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, Number.parseInt(sp.get("pageSize") ?? "50", 10) || 50));

  const where: Prisma.VisitWhereInput = {};
  if (employeeId) where.employeeId = employeeId;
  if (hcpId) where.hcpId = hcpId;
  if (type) where.type = type;
  if (validityStatus) where.validityStatus = validityStatus;
  if (source) where.source = source;
  if (from || to) where.visitDate = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const [total, visits] = await Promise.all([
    prisma.visit.count({ where }),
    prisma.visit.findMany({
      where,
      include: visitInclude,
      orderBy: { visitDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return NextResponse.json({ data: visits, total, page, pageSize });
}

/**
 * POST /api/visits — 新建拜访
 * body 支持嵌套:
 *   products: [{ productId, feedback? }]
 *   samples:  [{ lotId, quantity }]   // 自动创建 DISTRIBUTE 事务,并校验该代表该产品库存充足
 *   checkins: [{ checkinTime?, locationName?, latitude?, longitude?, status? }]  // 同事务创建签到
 * 新字段:
 *   purposes: string[]  // 结构化拜访目的多选,存为逗号分隔
 *   summary:  string    // 人工拜访总结
 *   source:   MANUAL | AI | IMPORT(默认 MANUAL)
 *   receiverId: 报告接收人,默认 = 填写人的直属上级
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }

  const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
  if (!employeeId) return err("employeeId 为必填字段");
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return err("employeeId 对应的员工不存在", 404);

  const type = body.type ? String(body.type) : "FACE_TO_FACE";
  if (!VISIT_TYPES.includes(type)) return err(`type 必须为 ${VISIT_TYPES.join(" | ")}`);

  const source = body.source ? String(body.source) : "MANUAL";
  if (!VISIT_SOURCES.includes(source)) return err(`source 必须为 ${VISIT_SOURCES.join(" | ")}`);

  const visitDate = body.visitDate ? parseDate(String(body.visitDate)) : new Date();
  if (!visitDate) return err("visitDate 不是合法日期");
  const status = body.status ? String(body.status) : "SUBMITTED";
  if (!["DRAFT", "SUBMITTED"].includes(status)) return err("status 必须为 DRAFT | SUBMITTED");

  // 结构化拜访目的(数组 → 逗号分隔)
  let purposes: string | null = null;
  if (body.purposes !== undefined && body.purposes !== null) {
    if (!Array.isArray(body.purposes)) return err("purposes 必须为字符串数组");
    const list = (body.purposes as unknown[]).map((p) => String(p).trim()).filter(Boolean);
    for (const p of list) {
      if (!PURPOSE_OPTIONS.includes(p)) return err(`purposes 含非法值「${p}」,可选:${PURPOSE_OPTIONS.join(" | ")}`);
    }
    purposes = list.length ? list.join(",") : null;
  }

  // 报告接收人:默认 = 填写人的直属上级
  let receiverId: string | null = employee.reportsToId ?? null;
  if (body.receiverId !== undefined && body.receiverId !== null && body.receiverId !== "") {
    receiverId = String(body.receiverId);
    const receiver = await prisma.employee.findUnique({ where: { id: receiverId } });
    if (!receiver) return err("receiverId 对应的员工不存在", 404);
  }

  if (body.hcpId) {
    const hcp = await prisma.hcp.findUnique({ where: { id: String(body.hcpId) } });
    if (!hcp) return err("hcpId 对应的医生不存在", 404);
  }
  if (body.hcoId) {
    const hco = await prisma.hco.findUnique({ where: { id: String(body.hcoId) } });
    if (!hco) return err("hcoId 对应的机构不存在", 404);
  }

  const productItems = Array.isArray(body.products) ? (body.products as Record<string, unknown>[]) : [];
  const sampleItems = Array.isArray(body.samples) ? (body.samples as Record<string, unknown>[]) : [];
  const checkinItems = Array.isArray(body.checkins) ? (body.checkins as Record<string, unknown>[]) : [];

  // 校验样品:批次存在、数量为正整数、该代表该产品库存充足
  const sampleCreates: Prisma.SampleTransactionCreateWithoutVisitInput[] = [];
  for (const s of sampleItems) {
    const lotId = typeof s.lotId === "string" ? s.lotId : "";
    const quantity = Number(s.quantity);
    if (!lotId) return err("samples[].lotId 为必填字段");
    if (!Number.isInteger(quantity) || quantity <= 0) return err("samples[].quantity 必须为正整数");

    const lot = await prisma.sampleLot.findUnique({ where: { id: lotId } });
    if (!lot) return err(`批次 ${lotId} 不存在`, 404);

    // 该代表在该产品上的当前库存 = 领用总量 - 发放总量
    const txns = await prisma.sampleTransaction.findMany({
      where: { employeeId, lot: { productId: lot.productId } },
      select: { quantity: true, type: true },
    });
    const available = txns.reduce((sum, t) => sum + (t.type === "RECEIVE" ? t.quantity : -t.quantity), 0);
    if (quantity > available) {
      return err(`样品库存不足:当前可发放 ${available} 盒,申请发放 ${quantity} 盒`, 409);
    }
    sampleCreates.push({
      lot: { connect: { id: lotId } },
      employee: { connect: { id: employeeId } },
      quantity,
      type: "DISTRIBUTE",
      hcp: body.hcpId ? { connect: { id: String(body.hcpId) } } : undefined,
    });
  }

  // 校验产品明细
  const productCreates: Prisma.VisitProductCreateWithoutVisitInput[] = [];
  for (const p of productItems) {
    const productId = typeof p.productId === "string" ? p.productId : "";
    if (!productId) return err("products[].productId 为必填字段");
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return err(`产品 ${productId} 不存在`, 404);
    productCreates.push({ product: { connect: { id: productId } }, feedback: p.feedback ? String(p.feedback) : null });
  }

  // 校验签到明细
  const checkinCreates: Prisma.CheckInCreateWithoutVisitInput[] = [];
  for (const c of checkinItems) {
    const checkinTime = c.checkinTime ? parseDate(String(c.checkinTime)) : new Date();
    if (!checkinTime) return err("checkins[].checkinTime 不是合法日期");
    const status = c.status ? String(c.status) : "NORMAL";
    if (!["NORMAL", "LOCATION_MISMATCH"].includes(status)) return err("checkins[].status 必须为 NORMAL | LOCATION_MISMATCH");
    checkinCreates.push({
      employee: { connect: { id: employeeId } },
      checkinTime,
      locationName: c.locationName ? String(c.locationName) : null,
      latitude: c.latitude != null ? Number(c.latitude) : null,
      longitude: c.longitude != null ? Number(c.longitude) : null,
      status,
    });
  }

  const tourPlanItemId = body.tourPlanItemId ? String(body.tourPlanItemId) : null;
  const followUp = body.followUp && typeof body.followUp === "object"
    ? body.followUp as Record<string, unknown>
    : null;
  const followUpDueDate = followUp?.dueDate ? parseDate(String(followUp.dueDate)) : null;
  if (followUp?.dueDate && !followUpDueDate) return err("followUp.dueDate 不是合法日期");
  const visit = await prisma.$transaction(async (tx) => {
    if (tourPlanItemId) {
      const item = await tx.tourPlanItem.findUnique({
        where: { id: tourPlanItemId },
        include: { tourPlan: true },
      });
      if (!item) throw new Error("PLAN_ITEM_NOT_FOUND");
      if (item.tourPlan.employeeId !== employeeId || item.tourPlan.status !== "APPROVED" || item.status !== "PLANNED" || item.visitId) {
        throw new Error("PLAN_ITEM_CONFLICT");
      }
    }
    const created = await tx.visit.create({
      data: {
        employeeId,
        hcpId: body.hcpId ? String(body.hcpId) : null,
        hcoId: body.hcoId ? String(body.hcoId) : null,
        visitDate,
        type,
        status,
        purpose: body.purpose ? String(body.purpose) : null,
        purposes,
        outcome: body.outcome ? String(body.outcome) : null,
        duration: body.duration != null ? Number(body.duration) : null,
        notes: body.notes ? String(body.notes) : null,
        summary: body.summary ? String(body.summary) : null,
        nextStep: body.nextStep ? String(body.nextStep) : null,
        aiSummary: body.aiSummary ? String(body.aiSummary) : null,
        aiSentiment: body.aiSentiment ? String(body.aiSentiment) : null,
        source,
        receiverId,
        jointWithId: body.jointWithId ? String(body.jointWithId) : null,
        products: { create: productCreates },
        samples: { create: sampleCreates },
        checkins: { create: checkinCreates },
      },
      include: visitInclude,
    });
    if (tourPlanItemId) {
      await tx.tourPlanItem.update({
        where: { id: tourPlanItemId },
        data: {
          visitId: created.id,
          status: status === "SUBMITTED" ? "COMPLETED" : "PLANNED",
        },
      });
    }
    if (followUp?.title && body.hcpId) {
      await tx.followUpTask.create({
        data: {
          title: String(followUp.title),
          description: followUp.description ? String(followUp.description) : null,
          priority: followUp.priority === "HIGH" ? "HIGH" : "NORMAL",
          dueDate: followUpDueDate,
          assigneeId: employeeId,
          hcpId: String(body.hcpId),
          hcoId: body.hcoId ? String(body.hcoId) : null,
          sourceVisitId: created.id,
        },
      });
    }
    return created;
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "PLAN_ITEM_NOT_FOUND") return null;
    if (error instanceof Error && error.message === "PLAN_ITEM_CONFLICT") return false;
    throw error;
  });
  if (visit === null) return err("计划项不存在", 404);
  if (visit === false) return err("该计划项当前不能创建拜访", 409);
  return NextResponse.json(visit, { status: 201 });
}
