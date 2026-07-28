import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { isAccountPlanYear, validateAccountPlanInput } from "@/lib/account-plan";
import { accountPlanInclude, enrichAccountPlan } from "@/lib/account-plan-data";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const ownerId = search.get("ownerId")?.trim();
  const hcoId = search.get("hcoId")?.trim();
  const status = search.get("status")?.trim();
  const rawYear = search.get("year");
  const year = rawYear ? Number(rawYear) : undefined;
  if (rawYear && !isAccountPlanYear(year)) return err("year 必须是 2020–2100 的整数");

  const where: Prisma.AccountPlanWhereInput = {};
  if (ownerId) where.ownerId = ownerId;
  if (hcoId) where.hcoId = hcoId;
  if (status) where.status = status;
  if (year) where.year = year;
  const plans = await prisma.accountPlan.findMany({
    where,
    include: accountPlanInclude,
    orderBy: [{ year: "desc" }, { hco: { name: "asc" } }],
    take: 200,
  });
  const data = await Promise.all(plans.map((plan) => enrichAccountPlan(plan)));
  return NextResponse.json({ data, total: data.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const input = validateAccountPlanInput(body);
  if (!input) return err("Account Plan 请求字段不完整或格式不正确");

  const [hco, owner, creator, productCount, stakeholders, existing] = await Promise.all([
    prisma.hco.findUnique({ where: { id: input.hcoId }, select: { id: true, isStrategic: true } }),
    prisma.employee.findUnique({ where: { id: input.ownerId }, select: { id: true } }),
    prisma.employee.findUnique({ where: { id: input.createdById }, select: { id: true } }),
    prisma.product.count({ where: { id: { in: input.productIds } } }),
    prisma.hcp.findMany({ where: { id: { in: input.stakeholders.map((item) => item.hcpId) } }, select: { id: true, hcoId: true } }),
    prisma.accountPlan.findUnique({ where: { hcoId_year: { hcoId: input.hcoId, year: input.year } }, select: { id: true } }),
  ]);
  if (!hco) return err("HCO 不存在", 404);
  if (hco.isStrategic !== "是") return err("只有战略 HCO 可以创建 Account Plan", 409);
  if (!owner || !creator) return err("计划负责人或创建人不存在", 404);
  if (productCount !== input.productIds.length) return err("存在无效产品", 404);
  if (stakeholders.length !== input.stakeholders.length) return err("存在无效关键关系人", 404);
  if (stakeholders.some((stakeholder) => stakeholder.hcoId !== input.hcoId)) return err("关键关系人必须属于计划 HCO", 409);
  if (existing) return err("该 HCO 本年度 Account Plan 已存在", 409);

  const milestoneOwnerIds = [...new Set(input.milestones.map((item) => item.ownerId))];
  if (await prisma.employee.count({ where: { id: { in: milestoneOwnerIds } } }) !== milestoneOwnerIds.length) {
    return err("存在无效里程碑负责人", 404);
  }
  const plan = await prisma.accountPlan.create({
    data: {
      hcoId: input.hcoId,
      year: input.year,
      ownerId: input.ownerId,
      createdById: input.createdById,
      businessGoal: input.businessGoal,
      situation: input.situation,
      strategy: input.strategy,
      successCriteria: input.successCriteria,
      products: { create: input.productIds.map((productId) => ({ productId })) },
      stakeholders: { create: input.stakeholders },
      milestones: { create: input.milestones },
    },
    include: accountPlanInclude,
  });
  return NextResponse.json(await enrichAccountPlan(plan), { status: 201 });
}
