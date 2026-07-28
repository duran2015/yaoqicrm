import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { Prisma } from "@prisma/client";
import {
  assignmentInclude, HCO_STRING_FIELDS, HCO_INT_FIELDS, HCO_FLOAT_FIELDS, TIERS,
  pickFields, parseDepartments, employeeExists,
} from "@/lib/customer";

/**
 * GET /api/hco?query=&type=&territoryId=&graded=&mine=&employeeId=&category=&page=&pageSize= — 机构列表
 * 列表项含:territory 摘要、category(客户分类)、kaOwner(KA 负责人)、
 * 最新国考成绩 latestExam(年份+等级)、合作代表 assignments、_count
 * - graded=true 已分级 / false 未分级(tier 为空)
 * - mine=true 需配合 employeeId:该员工有分配关系的机构
 * - category 按客户分类过滤(目标医院 | 潜力医院 | 观察医院)
 * - page / pageSize 分页(默认 1 / 20,pageSize 上限 100)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const query = sp.get("query")?.trim();
  const type = sp.get("type")?.trim();
  const territoryId = sp.get("territoryId")?.trim();
  const graded = sp.get("graded")?.trim();
  const mine = sp.get("mine")?.trim();
  const employeeId = sp.get("employeeId")?.trim();
  const category = sp.get("category")?.trim();
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(sp.get("pageSize") ?? "20", 10) || 20));

  const where: Prisma.HcoWhereInput = {};
  if (type) where.type = type;
  if (territoryId) where.territoryId = territoryId;
  if (category) where.category = category;
  if (query) where.OR = [{ name: { contains: query } }, { address: { contains: query } }];
  if (graded === "true") where.tier = { not: null };
  if (graded === "false") where.tier = null;
  if (mine === "true") {
    if (!employeeId) return err("mine=true 时必须提供 employeeId");
    where.assignments = { some: { employeeId } };
  }

  const [total, hcos] = await Promise.all([
    prisma.hco.count({ where }),
    prisma.hco.findMany({
      where,
      include: {
        territory: { select: { id: true, name: true, level: true } },
        kaOwner: { select: { id: true, name: true, role: true } },
        examResults: { orderBy: { year: "desc" }, take: 1 },
        assignments: assignmentInclude,
        _count: { select: { hcps: true, visits: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const data = hcos.map(({ examResults, ...rest }) => ({
    ...rest,
    latestExam: examResults[0] ?? null,
  }));
  return NextResponse.json({ data, total, page, pageSize });
}

/** POST /api/hco — 新建机构(支持全部扩展字段 + departments 嵌套) */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return err("name 为必填字段");
  const type = body.type ? String(body.type) : "HOSPITAL";
  if (!["HOSPITAL", "PHARMACY", "DISTRIBUTOR"].includes(type)) {
    return err("type 必须为 HOSPITAL | PHARMACY | DISTRIBUTOR");
  }
  if (body.tier && !TIERS.includes(String(body.tier) as (typeof TIERS)[number])) {
    return err("tier 必须为 A | B | C | D");
  }
  if (body.territoryId) {
    const t = await prisma.territory.findUnique({ where: { id: String(body.territoryId) } });
    if (!t) return err("territoryId 对应的辖区不存在", 404);
  }
  if (body.kaOwnerId && !(await employeeExists(String(body.kaOwnerId)))) {
    return err("kaOwnerId 对应的员工不存在", 404);
  }

  const data = pickFields(body, HCO_STRING_FIELDS, HCO_INT_FIELDS, HCO_FLOAT_FIELDS) as Prisma.HcoCreateInput;
  if (!body.type) data.type = type;
  const departments = parseDepartments(body.departments);
  if (departments.length) data.departments = { create: departments };

  const hco = await prisma.hco.create({
    data,
    include: {
      territory: { select: { id: true, name: true, level: true } },
      kaOwner: { select: { id: true, name: true, role: true } },
      departments: true,
      assignments: assignmentInclude,
    },
  });
  return NextResponse.json(hco, { status: 201 });
}
