import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test("seed contains the complete P0 demo scenarios", async () => {
  const mr = await prisma.employee.findUnique({ where: { employeeCode: "YG1004" } });
  assert.ok(mr, "demo MR YG1004 must exist");

  const [planStates, taskStates, sampleTypes, eventStates, coachingStates, assignments, cyclePlans] = await Promise.all([
    prisma.tourPlan.groupBy({ by: ["status"], _count: true }),
    prisma.followUpTask.groupBy({ by: ["status"], where: { assigneeId: mr.id }, _count: true }),
    prisma.sampleTransaction.groupBy({ by: ["type"], where: { employeeId: mr.id }, _count: true }),
    prisma.medEvent.groupBy({ by: ["status"], _count: true }),
    prisma.coachingAction.groupBy({ by: ["status"], where: { employeeId: mr.id }, _count: true }),
    prisma.customerAssignment.count({ where: { role: "OWNER", hcpId: { not: null } } }),
    prisma.cyclePlan.findMany({ where: { month: new Date("2026-06-30T16:00:00.000Z") }, include: { items: true } }),
  ]);

  assert.deepEqual(new Set(planStates.map((row) => row.status)), new Set(["DRAFT", "SUBMITTED", "APPROVED"]));
  assert.deepEqual(new Set(taskStates.map((row) => row.status)), new Set(["OPEN", "DONE"]));
  assert.deepEqual(new Set(sampleTypes.map((row) => row.type)), new Set(["RECEIVE", "DISTRIBUTE", "RETURN", "ADJUST"]));
  assert.deepEqual(new Set(eventStates.map((row) => row.status)), new Set(["OPEN", "COMPLETED"]));
  assert.deepEqual(new Set(coachingStates.map((row) => row.status)), new Set(["OPEN", "DONE"]));
  assert.ok(assignments >= 30, "all demo HCPs need an OWNER assignment");
  assert.ok(cyclePlans.length >= 3, "at least three representatives need July cycle plans");
  assert.ok(cyclePlans.every((plan) => plan.items.length > 0), "every cycle plan needs customer snapshots");

  const demoCodes = ["YG1004", "YG1005", "YG1006"];
  const demoRates: number[] = [];
  for (const code of demoCodes) {
    const employee = await prisma.employee.findUnique({ where: { employeeCode: code } });
    const plan = cyclePlans.find((candidate) => candidate.employeeId === employee?.id);
    assert.ok(employee && plan);
    const visits = await prisma.visit.groupBy({
      by: ["hcpId"],
      where: {
        employeeId: employee.id,
        hcpId: { in: plan.items.map((item) => item.hcpId) },
        status: "SUBMITTED",
        visitDate: { gte: new Date("2026-06-30T16:00:00.000Z"), lt: new Date("2026-07-31T16:00:00.000Z") },
      },
      _count: true,
    });
    const counts = new Map(visits.flatMap((visit) => visit.hcpId ? [[visit.hcpId, visit._count] as const] : []));
    const target = plan.items.reduce((sum, item) => sum + item.targetVisits, 0);
    const completed = plan.items.reduce((sum, item) => sum + Math.min(counts.get(item.hcpId) ?? 0, item.targetVisits), 0);
    demoRates.push(target ? completed / target : 0);
  }
  assert.ok(demoRates[0] >= 0.8, "YG1004 should demonstrate high achievement");
  assert.ok(demoRates[1] >= 0.3 && demoRates[1] < 0.8, "YG1005 should demonstrate in-progress achievement");
  assert.ok(demoRates[2] < 0.3, "YG1006 should demonstrate lagging achievement");
});

test.after(async () => {
  await prisma.$disconnect();
});
