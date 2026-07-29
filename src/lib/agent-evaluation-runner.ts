import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { redactEvaluationValue, scoreEvaluation } from "./agent-evaluation";
import {
  EvaluationAssertion,
  FIXED_EVALUATION_CASES,
  evaluateBattlecardResult,
  evaluateSearchResult,
  evaluateToolDiscovery,
} from "./agent-evaluation-cases";
import { McpEvaluationClient } from "./agent-evaluation-mcp";

export async function executeEvaluationCases<T>(
  keys: string[],
  execute: (key: string) => Promise<T & { passed: boolean }>
): Promise<(T & { passed: boolean; errorMessage?: string })[]> {
  const results = [];
  for (const key of keys) {
    try { results.push(await execute(key)); }
    catch (error) { results.push({ passed: false, errorMessage: error instanceof Error ? error.message : "评测失败" } as T & { passed: boolean; errorMessage: string }); }
  }
  return results;
}

function jwt(employee: { id: string; role: string; departmentId: string | null }, expired = false, employeeId = employee.id) {
  const secret = process.env.AGENT_EVAL_JWT_SECRET ?? process.env.WORKBUDDY_JWT_SECRET;
  if (!secret) throw new Error("缺少 AGENT_EVAL_JWT_SECRET");
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub: `agent-eval:${employeeId}`, employeeId, role: employee.role,
    departmentId: employee.departmentId, tenantId: "demo-company",
    iss: process.env.AGENT_EVAL_JWT_ISSUER ?? process.env.WORKBUDDY_JWT_ISSUER ?? "workbuddy-local",
    aud: process.env.AGENT_EVAL_JWT_AUDIENCE ?? process.env.WORKBUDDY_JWT_AUDIENCE ?? "pharma-crm-mcp",
    iat: now - (expired ? 600 : 0), exp: expired ? now - 300 : now + 300,
  })}`;
  return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
}

const check = (key: string, label: string, passed: boolean, expected: string, actual: string): EvaluationAssertion =>
  ({ key, label, required: true, passed, expected, actual });

async function unauthorized(endpoint: string, token?: string) {
  const response = await fetch(endpoint, {
    method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "eval", version: "1" } } }),
  });
  return response.status;
}

export async function ensureEvaluationCases() {
  for (const item of FIXED_EVALUATION_CASES) {
    await prisma.agentEvaluationCase.upsert({ where: { key: item.key }, update: item, create: item });
  }
}

export async function runAgentEvaluationSuite(input: { employeeId: string; caseKey?: string }) {
  await ensureEvaluationCases();
  const endpoint = process.env.AGENT_EVAL_MCP_ENDPOINT ?? "http://127.0.0.1:5620/mcp";
  const employee = await prisma.employee.findUnique({ where: { id: input.employeeId }, select: { id: true, role: true, departmentId: true } });
  if (!employee) throw new Error("评测发起员工不存在");
  const product = await prisma.product.findFirst({ where: { brand: process.env.AGENT_EVAL_PRODUCT_NAME ?? "天韵" } })
    ?? await prisma.product.findFirst();
  if (!product) throw new Error("缺少可评测产品");
  if (await prisma.agentEvaluationRun.findFirst({ where: { status: "RUNNING" } })) throw new Error("已有评测正在运行");
  const cases = await prisma.agentEvaluationCase.findMany({
    where: { enabled: true, ...(input.caseKey ? { key: input.caseKey } : {}) }, orderBy: { sortOrder: "asc" },
  });
  if (!cases.length) throw new Error("没有可运行的评测用例");
  const run = await prisma.agentEvaluationRun.create({ data: {
    scope: input.caseKey ?? "ALL", mcpEndpoint: endpoint, startedByEmployeeId: employee.id, caseCount: cases.length,
  } });
  const outcomes = await executeEvaluationCases(cases.map((item) => item.key), async (caseKey) => {
    const started = Date.now();
    let assertions: EvaluationAssertion[] = [];
    let response: unknown;
    let httpStatus: number | undefined;
    const normalToken = jwt(employee);
    if (caseKey.startsWith("identity.")) {
      httpStatus = caseKey === "identity.missing-jwt" ? await unauthorized(endpoint)
        : caseKey === "identity.expired-jwt" ? await unauthorized(endpoint, jwt(employee, true))
        : await unauthorized(endpoint, jwt(employee, false, "missing-employee"));
      assertions = [check("identity.rejected", "无效身份被拒绝", httpStatus === 401, "HTTP 401", `HTTP ${httpStatus}`)];
    } else {
      const client = new McpEvaluationClient(endpoint, normalToken);
      if (caseKey === "protocol.initialize") {
        const initialized = await client.initialize(); httpStatus = initialized.status; response = initialized.body;
        assertions = [check("protocol.initialized", "MCP 初始化成功", initialized.ok, "成功", initialized.ok ? "成功" : `HTTP ${initialized.status}`)];
      } else {
        await client.initialize();
        if (caseKey === "protocol.tools-list") {
          const listed = await client.listTools(); httpStatus = listed.status; response = listed.tools;
          assertions = evaluateToolDiscovery(listed.tools.map((item) => item.name));
        } else if (caseKey === "intelligence.search") {
          const called = await client.callTool("search_sales_intelligence", { query: product.brand, productId: product.id, limit: 5 });
          httpStatus = called.status; response = called.data; assertions = evaluateSearchResult(called.data, 5);
        } else if (caseKey === "battlecard.product") {
          const called = await client.callTool("get_product_battlecard", { productId: product.id });
          httpStatus = called.status; response = called.data; assertions = evaluateBattlecardResult(called.data);
        } else if (caseKey === "refresh.confirmation") {
          const called = await client.callTool("refresh_product_intelligence", { productId: product.id, confirmed: false, idempotencyKey: `eval-deny-${run.id}` });
          httpStatus = called.status; response = called.data;
          assertions = [check("refresh.confirmation", "未确认刷新被拒绝", called.isError, "拒绝", called.isError ? "已拒绝" : "未拒绝")];
        } else {
          const args = { productId: product.id, confirmed: true, idempotencyKey: `eval-refresh-${run.id}` };
          const first = await client.callTool("refresh_product_intelligence", args);
          const replay = await client.callTool("refresh_product_intelligence", args);
          response = { first: first.data, replay: replay.data }; httpStatus = replay.status;
          const replayData = replay.data as { replayed?: boolean; operationId?: string };
          const audit = await prisma.mcpOperation.findFirst({ where: { employeeId: employee.id, toolName: "refresh_product_intelligence", idempotencyKey: args.idempotencyKey, status: "SUCCEEDED" } });
          assertions = [
            check("refresh.replayed", "相同负载幂等重放", replayData?.replayed === true, "replayed=true", String(replayData?.replayed)),
            check("refresh.audit", "产生成功审计记录", Boolean(audit), "SUCCEEDED", audit?.status ?? "缺失"),
          ];
        }
      }
    }
    const score = scoreEvaluation(assertions);
    return { passed: score.passed, assertions, latencyMs: Date.now() - started, httpStatus, response };
  });
  for (let index = 0; index < outcomes.length; index++) {
    const item = outcomes[index]; const currentCase = cases[index];
    const result = await prisma.agentEvaluationResult.create({ data: {
      runId: run.id, caseId: currentCase.id, caseKey: currentCase.key, caseName: currentCase.name,
      capability: currentCase.capability, status: item.passed ? "PASSED" : "FAILED",
      latencyMs: "latencyMs" in item ? item.latencyMs : null, httpStatus: "httpStatus" in item ? item.httpStatus : null,
      requestSummary: JSON.stringify(redactEvaluationValue({ caseKey: currentCase.key, employeeId: employee.id, role: employee.role })),
      responseSummary: "response" in item ? JSON.stringify(redactEvaluationValue(item.response)) : null,
      errorMessage: item.errorMessage, completedAt: new Date(),
    } });
    if ("assertions" in item) await prisma.agentEvaluationAssertion.createMany({ data: item.assertions.map((entry) => ({ ...entry, resultId: result.id })) });
  }
  const stored = await prisma.agentEvaluationResult.findMany({ where: { runId: run.id }, include: { assertions: true } });
  const assertionCount = stored.reduce((sum, item) => sum + item.assertions.length, 0);
  const passedAssertionCount = stored.reduce((sum, item) => sum + item.assertions.filter((entry) => entry.passed).length, 0);
  const latencies = stored.flatMap((item) => item.latencyMs == null ? [] : [item.latencyMs]);
  return prisma.agentEvaluationRun.update({ where: { id: run.id }, data: {
    status: stored.every((item) => item.status === "PASSED") ? "PASSED" : "FAILED",
    completedAt: new Date(), passedCaseCount: stored.filter((item) => item.status === "PASSED").length,
    assertionCount, passedAssertionCount,
    averageLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
  }, include: { results: { include: { assertions: true }, orderBy: { startedAt: "asc" } } } });
}
