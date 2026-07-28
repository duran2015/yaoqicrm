import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { Prisma } from "@prisma/client";
import { maskHcp, maskBankAccounts } from "@/lib/mask";
import {
  assignmentInclude, HCP_STRING_FIELDS, HCP_INT_FIELDS, TIERS,
  pickFields, parseEducations, parseBankAccounts,
} from "@/lib/customer";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/hcp/[id] — HCP 360:
 * 医生全部档案字段(姓名/手机号/证件号/银行账号脱敏)+ 教育经历 + 银行账户 +
 * 合作代表 assignments + 所属医院(含辖区)+ 最近 50 条拜访历史 + 参会记录 + 收到的样品汇总
 * stats.visitCount 为全部拜访总数(数据量大时 visits 仅返回最近 50 条)
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const hcp = await prisma.hcp.findUnique({
    where: { id },
    include: {
      hco: { include: { territory: { select: { id: true, name: true } } } },
      educations: true,
      bankAccounts: true,
      assignments: assignmentInclude,
      visits: {
        orderBy: { visitDate: "desc" },
        take: 50,
        include: {
          employee: { select: { id: true, name: true, role: true } },
          products: { include: { product: { select: { id: true, brand: true, molecule: true } } } },
          samples: { include: { lot: { include: { product: { select: { id: true, brand: true } } } } } },
        },
      },
      eventAttendances: { include: { event: true } },
    },
  });
  if (!hcp) return err("HCP 不存在", 404);

  const [visitCount, distributed] = await Promise.all([
    prisma.visit.count({ where: { hcpId: id } }),
    // 收到的样品汇总(按产品聚合 DISTRIBUTE 总量)
    prisma.sampleTransaction.groupBy({
      by: ["lotId"],
      where: { hcpId: id, type: "DISTRIBUTE" },
      _sum: { quantity: true },
    }),
  ]);
  const lotIds = distributed.map((d) => d.lotId);
  const lots = await prisma.sampleLot.findMany({
    where: { id: { in: lotIds } },
    include: { product: { select: { id: true, brand: true, molecule: true } } },
  });
  const lotMap = new Map(lots.map((l) => [l.id, l]));
  const sampleByProduct = new Map<string, { product: unknown; totalQty: number }>();
  for (const d of distributed) {
    const lot = lotMap.get(d.lotId);
    if (!lot) continue;
    const cur = sampleByProduct.get(lot.productId) ?? { product: lot.product, totalQty: 0 };
    cur.totalQty += d._sum.quantity ?? 0;
    sampleByProduct.set(lot.productId, cur);
  }

  return NextResponse.json({
    ...maskHcp(hcp),
    bankAccounts: maskBankAccounts(hcp.bankAccounts),
    sampleSummary: [...sampleByProduct.values()],
    stats: {
      visitCount,
      eventCount: hcp.eventAttendances.length,
      lastVisitDate: hcp.visits[0]?.visitDate ?? null,
    },
  });
}

/** PATCH /api/hcp/[id] — 更新医生资料(扩展标量字段;可整体替换 educations/bankAccounts) */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = await prisma.hcp.findUnique({ where: { id } });
  if (!existing) return err("HCP 不存在", 404);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }
  if (body.tier && !TIERS.includes(String(body.tier) as (typeof TIERS)[number])) {
    return err("tier 必须为 A | B | C | D");
  }
  if (body.hcoId) {
    const hco = await prisma.hco.findUnique({ where: { id: String(body.hcoId) } });
    if (!hco) return err("hcoId 对应的机构不存在", 404);
  }

  const data = pickFields(body, HCP_STRING_FIELDS, HCP_INT_FIELDS) as Prisma.HcpUpdateInput;

  // 嵌套子记录:传入数组即整体替换(先删后建)
  if ("educations" in body && Array.isArray(body.educations)) {
    const educations = parseEducations(body.educations);
    await prisma.hcpEducation.deleteMany({ where: { hcpId: id } });
    if (educations.length) data.educations = { create: educations };
  }
  if ("bankAccounts" in body && Array.isArray(body.bankAccounts)) {
    const bankAccounts = parseBankAccounts(body.bankAccounts);
    await prisma.hcpBankAccount.deleteMany({ where: { hcpId: id } });
    if (bankAccounts.length) data.bankAccounts = { create: bankAccounts };
  }

  const hcp = await prisma.hcp.update({
    where: { id },
    data,
    include: {
      hco: { select: { id: true, name: true, type: true, level: true } },
      educations: true,
      bankAccounts: true,
      assignments: assignmentInclude,
    },
  });
  return NextResponse.json({ ...maskHcp(hcp), bankAccounts: maskBankAccounts(hcp.bankAccounts) });
}
