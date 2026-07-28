import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { selectVisitPreparationMaterials } from "@/lib/agent-demo";
import { prisma } from "@/lib/prisma";
import { signedQuantity } from "@/lib/sample-inventory";
import { rankRelevantIntelligence } from "@/lib/intelligence-relevance";
import { shapeIntelligenceItem } from "@/lib/intelligence-query";

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  const hcpId = req.nextUrl.searchParams.get("hcpId")?.trim();
  if (!employeeId || !hcpId) return err("employeeId 和 hcpId 为必填参数");
  const asOf = new Date();

  const [employee, hcp] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, employeeCode: true, role: true, division: true },
    }),
    prisma.hcp.findUnique({
      where: { id: hcpId },
      select: {
        id: true,
        code: true,
        name: true,
        title: true,
        specialty: true,
        tier: true,
        tags: true,
        notes: true,
        adminDuty: true,
        academicTitle: true,
        doctorLevel: true,
        expertise: true,
        weeklyOutpatient: true,
        hco: { select: { id: true, name: true, level: true, address: true } },
        affiliations: {
          select: {
            id: true,
            departmentName: true,
            title: true,
            adminDuty: true,
            isPrimary: true,
            effectiveDate: true,
            endDate: true,
            hco: { select: { id: true, name: true } },
          },
          orderBy: [{ isPrimary: "desc" }, { effectiveDate: "desc" }],
        },
      },
    }),
  ]);
  if (!employee) return err("员工不存在", 404);
  if (!hcp) return err("医生不存在", 404);

  const [assignment, recentVisits, openTasks, accountPlans, inventoryTransactions] = await Promise.all([
    prisma.customerAssignment.findFirst({ where: { employeeId, hcpId }, select: { id: true, role: true } }),
    prisma.visit.findMany({
      where: { employeeId, hcpId, status: "SUBMITTED" },
      select: {
        id: true,
        visitDate: true,
        type: true,
        purposes: true,
        outcome: true,
        summary: true,
        nextStep: true,
        products: { select: { product: { select: { id: true, brand: true, molecule: true } }, feedback: true } },
        materialUsages: { select: { titleSnapshot: true, versionSnapshot: true, approvalCodeSnapshot: true } },
      },
      orderBy: { visitDate: "desc" },
      take: 5,
    }),
    prisma.followUpTask.findMany({
      where: { assigneeId: employeeId, hcpId, status: "OPEN" },
      select: { id: true, title: true, description: true, priority: true, dueDate: true },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    }),
    hcp.hco
      ? prisma.accountPlan.findMany({
          where: { hcoId: hcp.hco.id, ownerId: employeeId, status: "ACTIVE" },
          select: {
            id: true,
            year: true,
            businessGoal: true,
            situation: true,
            strategy: true,
            successCriteria: true,
            products: { select: { product: { select: { id: true, brand: true, molecule: true } } } },
            milestones: {
              where: { status: "OPEN" },
              select: { id: true, title: true, dueDate: true, status: true },
              orderBy: { dueDate: "asc" },
            },
          },
        })
      : Promise.resolve([]),
    prisma.sampleTransaction.findMany({
      where: { employeeId },
      select: {
        type: true,
        quantity: true,
        lot: {
          select: {
            id: true,
            lotNumber: true,
            expiryDate: true,
            product: { select: { id: true, brand: true, molecule: true, unit: true } },
          },
        },
      },
    }),
  ]);

  const productIds = new Set<string>();
  for (const visit of recentVisits) for (const item of visit.products) productIds.add(item.product.id);
  for (const plan of accountPlans) for (const item of plan.products) productIds.add(item.product.id);

  const materials = productIds.size
    ? await prisma.productMaterial.findMany({
        where: { productId: { in: [...productIds] } },
        select: {
          id: true,
          productId: true,
          title: true,
          type: true,
          messageSummary: true,
          externalUrl: true,
          version: true,
          approvalCode: true,
          status: true,
          effectiveDate: true,
          expiryDate: true,
          product: { select: { id: true, brand: true, molecule: true } },
        },
      })
    : [];

  const intelligenceRecords = await prisma.salesIntelligence.findMany({
    where: {
      verificationStatus: { in: ["VERIFIED", "PENDING_REVIEW"] },
      OR: [
        ...(productIds.size ? [{ products: { some: { productId: { in: [...productIds] } } } }] : []),
        ...(hcp.specialty ? [{ therapeuticAreas: { some: { name: { contains: hcp.specialty } } } }] : []),
      ],
    },
    include: {
      products: { include: { product: true } },
      therapeuticAreas: true,
      competitors: { include: { competitor: true } },
    },
    orderBy: [{ priority: "asc" }, { publishedAt: "desc" }],
    take: 30,
  });
  const relevantIntelligence = rankRelevantIntelligence(
    intelligenceRecords.map((item) => ({
      ...item,
      productIds: item.products.map((link) => link.productId),
      therapeuticAreas: item.therapeuticAreas.map((link) => link.name),
    })),
    {
      productIds: [...productIds],
      therapeuticAreas: [hcp.specialty, hcp.expertise].filter((item): item is string => Boolean(item)),
      asOf,
      limit: 8,
    },
  );
  const verifiedIntelligence = relevantIntelligence
    .filter((item) => item.verificationStatus === "VERIFIED")
    .slice(0, 5)
    .map(shapeIntelligenceItem);
  const pendingLeads = relevantIntelligence
    .filter((item) => item.verificationStatus === "PENDING_REVIEW")
    .slice(0, 3)
    .map(shapeIntelligenceItem);

  const inventory = new Map<string, {
    lotId: string;
    lotNumber: string;
    expiryDate: Date;
    product: typeof inventoryTransactions[number]["lot"]["product"];
    current: number;
  }>();
  for (const transaction of inventoryTransactions) {
    if (productIds.size && !productIds.has(transaction.lot.product.id)) continue;
    const item = inventory.get(transaction.lot.id) ?? {
      lotId: transaction.lot.id,
      lotNumber: transaction.lot.lotNumber,
      expiryDate: transaction.lot.expiryDate,
      product: transaction.lot.product,
      current: 0,
    };
    item.current += signedQuantity(transaction.type, transaction.quantity);
    inventory.set(transaction.lot.id, item);
  }

  return NextResponse.json({
    preparedAt: asOf.toISOString(),
    representative: employee,
    assignment,
    hcp,
    recentVisits,
    openTasks,
    accountPlans,
    approvedMaterials: selectVisitPreparationMaterials(materials, productIds, asOf),
    sampleInventory: [...inventory.values()].filter((item) => item.current > 0 && item.expiryDate >= asOf),
    verifiedIntelligence,
    pendingLeads,
    suggestedQuestions: verifiedIntelligence.slice(0, 5).map((item) => `结合“${item.title}”，了解医生当前关注点及实际诊疗场景。`),
    citations: [...verifiedIntelligence, ...pendingLeads].map((item) => ({
      intelligenceId: item.id,
      title: item.title,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      verificationStatus: item.verificationStatus,
    })),
  });
}
