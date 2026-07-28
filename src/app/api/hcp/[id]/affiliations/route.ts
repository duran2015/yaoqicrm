import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { parseAffiliationInput, isCurrentAffiliation } from "@/lib/hcp-affiliation";
import { createHcpAffiliation, isAffiliationConflict } from "@/lib/hcp-affiliation-service";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

const hcoSelect = { id: true, code: true, name: true, type: true, level: true } as const;

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await prisma.hcp.findUnique({ where: { id }, select: { id: true } }))) return err("HCP 不存在", 404);
  const now = new Date();
  const affiliations = await prisma.hcpAffiliation.findMany({
    where: { hcpId: id },
    include: { hco: { select: hcoSelect } },
    orderBy: [{ isPrimary: "desc" }, { effectiveDate: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(affiliations.map((item) => ({ ...item, isCurrent: isCurrentAffiliation(item, now) })));
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }
  const input = parseAffiliationInput(body);
  if (!input) return err("任职字段不完整，且结束日期必须晚于生效日期");
  const [hcp, hco] = await Promise.all([
    prisma.hcp.findUnique({ where: { id }, select: { id: true } }),
    prisma.hco.findUnique({ where: { id: input.hcoId }, select: { id: true } }),
  ]);
  if (!hcp) return err("HCP 不存在", 404);
  if (!hco) return err("机构不存在", 404);
  try {
    const affiliation = await createHcpAffiliation(id, input);
    return NextResponse.json(
      { ...affiliation, isCurrent: isCurrentAffiliation(affiliation, new Date()) },
      { status: 201 },
    );
  } catch (error) {
    if (isAffiliationConflict(error)) return err("相同机构、科室和生效日期的任职已存在", 409);
    if (error instanceof Error && error.message === "PRIMARY_AFFILIATION_NOT_CURRENT") {
      return err("只有当前任职可以设为主要任职", 409);
    }
    throw error;
  }
}
