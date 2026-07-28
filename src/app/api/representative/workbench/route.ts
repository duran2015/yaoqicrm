import { NextRequest, NextResponse } from "next/server";
import { err, parseDate, startOfDay } from "@/lib/api";
import { parseCycleMonth } from "@/lib/cycle-plan";
import { prisma } from "@/lib/prisma";
import {
  rankRepresentativeRecommendations,
  recommendationReason,
  sortRepresentativeFollowUps,
} from "@/lib/representative-workbench";
import { rankRelevantIntelligence } from "@/lib/intelligence-relevance";
import { shapeIntelligenceItem } from "@/lib/intelligence-query";

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  if (!employeeId) return err("employeeId 为必填参数");
  const asOf = parseDate(req.nextUrl.searchParams.get("asOf")) ?? new Date();
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, role: true, division: true } });
  if (!employee) return err("员工不存在", 404);
  if (employee.role !== "MR") return err("代表工作台仅支持医药代表", 409);

  const todayStart = startOfDay(asOf);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthValue = `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, "0")}`;
  const monthRange = parseCycleMonth(monthValue)!;

  const [todaySchedule, followUps, cyclePlan, products] = await Promise.all([
    prisma.tourPlanItem.findMany({
      where: {
        tourPlan: { employeeId },
        planDate: { gte: todayStart, lt: tomorrow },
      },
      include: {
        tourPlan: { select: { id: true, status: true } },
        hcp: { select: { id: true, name: true, title: true, tier: true, hco: { select: { id: true, name: true } } } },
      },
      orderBy: { planDate: "asc" },
      take: 10,
    }),
    prisma.followUpTask.findMany({
      where: { assigneeId: employeeId, status: "OPEN" },
      include: {
        hcp: { select: { id: true, name: true, title: true, hco: { select: { id: true, name: true } } } },
        hco: { select: { id: true, name: true } },
      },
    }),
    prisma.cyclePlan.findUnique({
      where: { employeeId_month: { employeeId, month: monthRange.start } },
      include: {
        items: {
          include: {
            hcp: {
              select: { id: true, name: true, title: true, tier: true, hco: { select: { id: true, name: true } } },
            },
          },
        },
      },
    }),
    prisma.product.findMany({ where: { division: employee.division }, select: { id: true, therapeuticCategory: true } }),
  ]);

  const todayHcpIds = new Set(
    todaySchedule.flatMap((item) => item.status !== "CANCELLED" && item.hcpId ? [item.hcpId] : [])
  );
  let recommendations: Array<{
    id: string;
    hcp: NonNullable<typeof cyclePlan>["items"][number]["hcp"];
    tier: string;
    targetVisits: number;
    completedVisits: number;
    remainingVisits: number;
    lastVisitDate: Date | null;
    reason: string;
  }> = [];

  if (cyclePlan) {
    const visits = await prisma.visit.groupBy({
      by: ["hcpId"],
      where: {
        employeeId,
        hcpId: { in: cyclePlan.items.map((item) => item.hcpId) },
        status: "SUBMITTED",
        visitDate: { gte: monthRange.start, lt: monthRange.end },
      },
      _count: { _all: true },
      _max: { visitDate: true },
    });
    const progress = new Map(visits.flatMap((item) => item.hcpId ? [[item.hcpId, item] as const] : []));
    recommendations = rankRepresentativeRecommendations(cyclePlan.items.flatMap((item) => {
      const visit = progress.get(item.hcpId);
      const completedVisits = visit?._count._all ?? 0;
      const remainingVisits = Math.max(0, item.targetVisits - completedVisits);
      if (!remainingVisits || todayHcpIds.has(item.hcpId)) return [];
      const recommendation = {
        id: item.id,
        hcp: item.hcp,
        tier: item.tierSnapshot,
        targetVisits: item.targetVisits,
        completedVisits,
        remainingVisits,
        lastVisitDate: visit?._max.visitDate ?? null,
      };
      return [{ ...recommendation, reason: recommendationReason(recommendation) }];
    })).slice(0, 6);
  }

  const productIds = products.map((item) => item.id);
  const intelligence = await prisma.salesIntelligence.findMany({
    where: {
      verificationStatus: { in: ["VERIFIED", "PENDING_REVIEW"] },
      products: { some: { productId: { in: productIds } } },
    },
    include: {
      products: { include: { product: true } },
      therapeuticAreas: true,
      competitors: { include: { competitor: true } },
    },
    take: 30,
  });
  const relevantIntelligence = rankRelevantIntelligence(
    intelligence.map((item) => ({
      ...item,
      productIds: item.products.map((link) => link.productId),
      therapeuticAreas: item.therapeuticAreas.map((link) => link.name),
    })),
    {
      productIds,
      therapeuticAreas: products.map((item) => item.therapeuticCategory),
      asOf: todayStart,
      limit: 5,
    },
  ).map(shapeIntelligenceItem);

  return NextResponse.json({
    asOf: todayStart.toISOString(),
    todaySchedule,
    followUps: sortRepresentativeFollowUps(followUps, todayStart).slice(0, 8),
    recommendations,
    recommendationEmptyReason: cyclePlan ? null : "本月尚未建立 Cycle Plan，请先创建月度覆盖计划",
    relevantIntelligence,
  });
}
