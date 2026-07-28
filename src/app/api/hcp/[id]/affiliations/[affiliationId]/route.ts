import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { parseAffiliationInput, isCurrentAffiliation } from "@/lib/hcp-affiliation";
import { isAffiliationConflict, updateHcpAffiliation } from "@/lib/hcp-affiliation-service";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string; affiliationId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, affiliationId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }
  const input = parseAffiliationInput(body);
  if (!input) return err("任职字段不完整，且结束日期必须晚于生效日期");
  const [affiliation, hco] = await Promise.all([
    prisma.hcpAffiliation.findFirst({ where: { id: affiliationId, hcpId: id }, select: { id: true } }),
    prisma.hco.findUnique({ where: { id: input.hcoId }, select: { id: true } }),
  ]);
  if (!affiliation) return err("任职记录不存在", 404);
  if (!hco) return err("机构不存在", 404);
  try {
    const updated = await updateHcpAffiliation(id, affiliationId, input);
    return NextResponse.json({ ...updated, isCurrent: isCurrentAffiliation(updated, new Date()) });
  } catch (error) {
    if (isAffiliationConflict(error)) return err("相同机构、科室和生效日期的任职已存在", 409);
    if (error instanceof Error && error.message === "PRIMARY_AFFILIATION_NOT_CURRENT") {
      return err("只有当前任职可以设为主要任职", 409);
    }
    if (error instanceof Error && error.message === "AFFILIATION_NOT_FOUND") return err("任职记录不存在", 404);
    throw error;
  }
}
