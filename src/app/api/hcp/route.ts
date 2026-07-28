import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { Prisma } from "@prisma/client";
import { maskHcp, maskBankAccounts } from "@/lib/mask";
import {
  assignmentInclude, HCP_STRING_FIELDS, HCP_INT_FIELDS, TIERS,
  pickFields, parseEducations, parseBankAccounts,
} from "@/lib/customer";

/**
 * GET /api/hcp?query=&tier=&hcoId=&specialty=&tags=&graded=&mine=&employeeId=&page=&pageSize=
 * 搜索/过滤 HCP(分页,含 hco 信息与合作代表 assignments;姓名/手机号全局脱敏)
 * - graded=true 已分级(tier 非空)/ false 未分级(tier 为空)
 * - mine=true 需配合 employeeId:该员工有分配关系(OWNER/COLLAB)的客户
 * - tags 按标签模糊匹配(如 KOL)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const query = sp.get("query")?.trim();
  const tier = sp.get("tier")?.trim();
  const hcoId = sp.get("hcoId")?.trim();
  const specialty = sp.get("specialty")?.trim();
  const tags = sp.get("tags")?.trim();
  const graded = sp.get("graded")?.trim();
  const mine = sp.get("mine")?.trim();
  const employeeId = sp.get("employeeId")?.trim();
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(sp.get("pageSize") ?? "20", 10) || 20));

  const where: Prisma.HcpWhereInput = {};
  if (tier) where.tier = tier;
  if (hcoId) where.hcoId = hcoId;
  if (specialty) where.specialty = { contains: specialty };
  if (tags) where.tags = { contains: tags };
  if (graded === "true") where.tier = { not: null };
  if (graded === "false") where.tier = null;
  if (mine === "true") {
    if (!employeeId) return err("mine=true 时必须提供 employeeId");
    where.assignments = { some: { employeeId } };
  }
  if (query) {
    where.OR = [
      { name: { contains: query } },
      { specialty: { contains: query } },
      { tags: { contains: query } },
      { hco: { name: { contains: query } } },
    ];
  }

  const [total, hcps] = await Promise.all([
    prisma.hcp.count({ where }),
    prisma.hcp.findMany({
      where,
      include: {
        hco: { select: { id: true, name: true, type: true, level: true } },
        assignments: assignmentInclude,
      },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return NextResponse.json({ data: hcps.map(maskHcp), total, page, pageSize });
}

/** POST /api/hcp — 新建医生(支持扩展字段 + educations/bankAccounts 嵌套) */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return err("name 为必填字段");
  if (body.tier && !TIERS.includes(String(body.tier) as (typeof TIERS)[number])) {
    return err("tier 必须为 A | B | C | D");
  }
  if (body.hcoId) {
    const hco = await prisma.hco.findUnique({ where: { id: String(body.hcoId) } });
    if (!hco) return err("hcoId 对应的机构不存在", 404);
  }

  const data = pickFields(body, HCP_STRING_FIELDS, HCP_INT_FIELDS) as Prisma.HcpCreateInput;
  const educations = parseEducations(body.educations);
  const bankAccounts = parseBankAccounts(body.bankAccounts);
  if (educations.length) data.educations = { create: educations };
  if (bankAccounts.length) data.bankAccounts = { create: bankAccounts };

  const hcp = await prisma.hcp.create({
    data,
    include: {
      hco: { select: { id: true, name: true, type: true, level: true } },
      educations: true,
      bankAccounts: true,
      assignments: assignmentInclude,
    },
  });
  return NextResponse.json(
    { ...maskHcp(hcp), bankAccounts: maskBankAccounts(hcp.bankAccounts) },
    { status: 201 },
  );
}
