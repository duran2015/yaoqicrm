import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test("seed contains the complete P0 demo scenarios", async () => {
  const mr = await prisma.employee.findUnique({ where: { employeeCode: "YG1004" } });
  assert.ok(mr, "demo MR YG1004 must exist");

  const [planStates, taskStates, sampleTypes, eventStates, coachingStates] = await Promise.all([
    prisma.tourPlan.groupBy({ by: ["status"], _count: true }),
    prisma.followUpTask.groupBy({ by: ["status"], where: { assigneeId: mr.id }, _count: true }),
    prisma.sampleTransaction.groupBy({ by: ["type"], where: { employeeId: mr.id }, _count: true }),
    prisma.medEvent.groupBy({ by: ["status"], _count: true }),
    prisma.coachingAction.groupBy({ by: ["status"], where: { employeeId: mr.id }, _count: true }),
  ]);

  assert.deepEqual(new Set(planStates.map((row) => row.status)), new Set(["DRAFT", "SUBMITTED", "APPROVED"]));
  assert.deepEqual(new Set(taskStates.map((row) => row.status)), new Set(["OPEN", "DONE"]));
  assert.deepEqual(new Set(sampleTypes.map((row) => row.type)), new Set(["RECEIVE", "DISTRIBUTE", "RETURN", "ADJUST"]));
  assert.deepEqual(new Set(eventStates.map((row) => row.status)), new Set(["OPEN", "COMPLETED"]));
  assert.deepEqual(new Set(coachingStates.map((row) => row.status)), new Set(["OPEN", "DONE"]));
});

test.after(async () => {
  await prisma.$disconnect();
});
