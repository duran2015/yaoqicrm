import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const runs = await prisma.agentEvaluationRun.findMany({
    orderBy: { startedAt: "desc" }, take: 10,
    include: { results: { include: { assertions: true }, orderBy: { startedAt: "asc" } } },
  });
  const latest = runs[0] ?? null;
  const capabilities = latest ? Object.values(latest.results.reduce<Record<string, {
    capability: string; caseCount: number; passedCaseCount: number; assertionCount: number; passedAssertionCount: number;
  }>>((groups, result) => {
    const group = groups[result.capability] ?? { capability: result.capability, caseCount: 0, passedCaseCount: 0, assertionCount: 0, passedAssertionCount: 0 };
    group.caseCount += 1; group.passedCaseCount += result.status === "PASSED" ? 1 : 0;
    group.assertionCount += result.assertions.length; group.passedAssertionCount += result.assertions.filter((item) => item.passed).length;
    groups[result.capability] = group; return groups;
  }, {})) : [];
  const failures = latest?.results.flatMap((result) => result.assertions.filter((item) => item.required && !item.passed)
    .map((item) => ({ caseKey: result.caseKey, caseName: result.caseName, label: item.label, expected: item.expected, actual: item.actual }))) ?? [];
  return NextResponse.json({
    latest, capabilities, failures,
    recentPassRate: runs.length ? Math.round(runs.filter((run) => run.status === "PASSED").length / runs.length * 100) : 0,
    runs: runs.map(({ results: _results, ...run }) => run),
  });
}
