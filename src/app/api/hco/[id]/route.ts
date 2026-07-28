import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { assignmentInclude } from "@/lib/customer";
import { maskHcp } from "@/lib/mask";
import { accountPlanInclude, enrichAccountPlan } from "@/lib/account-plan-data";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/hco/[id] — 机构 360:
 * 全部档案字段 + 科室 departments + 进院产品 hospitalProducts(含 product)+
 * 国考成绩 examResults(按年份倒序)+ 合作代表 assignments + KA 负责人 +
 * 归属辖区 territory + 该机构医生列表(hcps,姓名脱敏)+ _count.visits
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const hco = await prisma.hco.findUnique({
    where: { id },
    include: {
      territory: { select: { id: true, name: true, level: true } },
      kaOwner: { select: { id: true, name: true, role: true, employeeCode: true } },
      departments: { orderBy: { name: "asc" } },
      hospitalProducts: { include: { product: true } },
      examResults: { orderBy: { year: "desc" } },
      assignments: assignmentInclude,
      hcps: { orderBy: [{ tier: "asc" }, { name: "asc" }] },
      _count: { select: { visits: true } },
    },
  });
  if (!hco) return err("机构不存在", 404);
  const accountPlan = await prisma.accountPlan.findUnique({
    where: { hcoId_year: { hcoId: id, year: 2026 } },
    include: accountPlanInclude,
  });
  const accountPlanSummary = accountPlan ? await enrichAccountPlan(accountPlan) : null;
  return NextResponse.json({ ...hco, hcps: hco.hcps.map(maskHcp), accountPlanSummary });
}
