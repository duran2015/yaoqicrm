import { NextRequest, NextResponse } from "next/server";
import { GET as getDashboard } from "@/app/api/analytics/dashboard/route";
import { GET as getWorkbench } from "@/app/api/representative/workbench/route";
import { err } from "@/lib/api";
import { buildMyDay } from "@/lib/agent-demo";
import { prisma } from "@/lib/prisma";
import { rankRelevantIntelligence } from "@/lib/intelligence-relevance";
import { shapeIntelligenceItem } from "@/lib/intelligence-query";

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  if (!employeeId) return err("employeeId 为必填参数");
  const asOf = req.nextUrl.searchParams.get("asOf")?.trim() || new Date().toISOString().slice(0, 10);
  const representative = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, employeeCode: true, role: true, division: true },
  });
  if (!representative) return err("员工不存在", 404);
  if (representative.role !== "MR") return err("我的今日工作仅支持医药代表", 409);

  const query = new URLSearchParams({ employeeId, asOf });
  const [workbenchResponse, dashboardResponse, products] = await Promise.all([
    getWorkbench(new NextRequest(new URL(`/api/representative/workbench?${query}`, req.nextUrl.origin))),
    getDashboard(new NextRequest(new URL(`/api/analytics/dashboard?${query}`, req.nextUrl.origin))),
    prisma.product.findMany({ where: { division: representative.division }, select: { id: true, therapeuticCategory: true } }),
  ]);
  if (!workbenchResponse.ok) {
    return NextResponse.json(await workbenchResponse.json(), { status: workbenchResponse.status });
  }
  if (!dashboardResponse.ok) {
    return NextResponse.json(await dashboardResponse.json(), { status: dashboardResponse.status });
  }
  const workbench = await workbenchResponse.json();
  const dashboard = await dashboardResponse.json();
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
      asOf: new Date(`${asOf}T12:00:00+08:00`),
      limit: 5,
    },
  ).map(shapeIntelligenceItem);
  return NextResponse.json({
    ...buildMyDay(representative, workbench, dashboard, workbench.asOf),
    relevantIntelligence,
  });
}
