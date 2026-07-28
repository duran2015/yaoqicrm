import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

export async function GET(req: NextRequest) {
  const hcpId = req.nextUrl.searchParams.get("hcpId")?.trim();
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  if (!hcpId || !employeeId) return err("hcpId 和 employeeId 为必填字段");
  const hcp = await prisma.hcp.findUnique({
    where: { id: hcpId },
    include: { hco: { select: { id: true, name: true } } },
  });
  if (!hcp) return err("医生不存在", 404);
  const [recentVisits, openTasks, samples] = await Promise.all([
    prisma.visit.findMany({
      where: { hcpId, employeeId, status: "SUBMITTED" },
      select: {
        id: true, visitDate: true, outcome: true, summary: true, nextStep: true,
        products: { include: { product: { select: { id: true, brand: true, molecule: true } } } },
      },
      orderBy: { visitDate: "desc" },
      take: 3,
    }),
    prisma.followUpTask.findMany({
      where: { hcpId, assigneeId: employeeId, status: "OPEN" },
      select: { id: true, title: true, dueDate: true, priority: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.sampleTransaction.findMany({
      where: { hcpId, employeeId, type: "DISTRIBUTE" },
      select: { quantity: true, transDate: true, lot: { include: { product: true } } },
      orderBy: { transDate: "desc" },
      take: 20,
    }),
  ]);
  const sampleByProduct = new Map<string, { product: typeof samples[number]["lot"]["product"]; quantity: number }>();
  for (const sample of samples) {
    const current = sampleByProduct.get(sample.lot.productId) ?? { product: sample.lot.product, quantity: 0 };
    current.quantity += sample.quantity;
    sampleByProduct.set(sample.lot.productId, current);
  }
  return NextResponse.json({
    hcp,
    recentVisits,
    openTasks,
    sampleSummary: [...sampleByProduct.values()],
  });
}
