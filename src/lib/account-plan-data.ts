import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isDecisionMakerCovered, summarizeMilestones } from "@/lib/account-plan";

export const accountPlanInclude = {
  hco: { select: { id: true, name: true, level: true, isStrategic: true } },
  owner: { select: { id: true, name: true, role: true, division: true } },
  createdBy: { select: { id: true, name: true } },
  products: { include: { product: true } },
  stakeholders: {
    include: {
      hcp: {
        select: { id: true, name: true, title: true, tier: true, hcoId: true, hco: { select: { id: true, name: true } } },
      },
    },
  },
  milestones: {
    include: {
      owner: { select: { id: true, name: true, role: true } },
      followUpTask: { select: { id: true, title: true, status: true, dueDate: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  },
} satisfies Prisma.AccountPlanInclude;

export type AccountPlanWithRelations = Prisma.AccountPlanGetPayload<{ include: typeof accountPlanInclude }>;

export function accountYearRange(year: number) {
  return {
    start: new Date(`${year}-01-01T00:00:00+08:00`),
    end: new Date(`${year + 1}-01-01T00:00:00+08:00`),
  };
}

export async function enrichAccountPlan(plan: AccountPlanWithRelations, now = new Date()) {
  const range = accountYearRange(plan.year);
  const visits = await prisma.visit.findMany({
    where: {
      employeeId: plan.ownerId,
      hcpId: { in: plan.stakeholders.map((stakeholder) => stakeholder.hcpId) },
      visitDate: { gte: range.start, lt: range.end },
    },
    select: { id: true, employeeId: true, hcpId: true, status: true, visitDate: true },
    orderBy: { visitDate: "desc" },
  });
  const progress = summarizeMilestones(plan.milestones, now);
  const stakeholders = plan.stakeholders.map((stakeholder) => {
    const stakeholderVisits = visits.filter((visit) => visit.hcpId === stakeholder.hcpId);
    return {
      ...stakeholder,
      covered: isDecisionMakerCovered(stakeholder, visits, plan.ownerId),
      lastVisitDate: stakeholderVisits.find((visit) => visit.status === "SUBMITTED")?.visitDate ?? null,
    };
  });
  return {
    ...plan,
    progress,
    uncoveredDecisionMakers: stakeholders.filter(
      (stakeholder) => stakeholder.decisionRole === "DECISION_MAKER" && !stakeholder.covered
    ).length,
    stakeholders,
  };
}
