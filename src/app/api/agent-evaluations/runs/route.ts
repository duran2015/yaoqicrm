import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { canRunAgentEvaluation } from "@/lib/agent-evaluation";
import { runAgentEvaluationSuite } from "@/lib/agent-evaluation-runner";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return NextResponse.json(await prisma.agentEvaluationRun.findMany({
    orderBy: { startedAt: "desc" }, take: 10,
  }));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { employeeId?: string; caseKey?: string } | null;
  if (!body?.employeeId) return err("employeeId 为必填参数");
  const employee = await prisma.employee.findUnique({ where: { id: body.employeeId }, select: { role: true } });
  if (!employee || !canRunAgentEvaluation(employee.role)) return err("只有经理或管理员可以运行 Agent 评测", 403);
  try {
    return NextResponse.json(await runAgentEvaluationSuite({ employeeId: body.employeeId, caseKey: body.caseKey }));
  } catch (error) {
    return err(error instanceof Error ? error.message : "评测运行失败", 409);
  }
}
