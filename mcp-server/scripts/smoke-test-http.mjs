/**
 * WorkBuddy → MCP → CRM HTTP 端到端冒烟。
 * 前置：CRM :5618、MCP HTTP :5620，二者使用已迁移且已 seed 的同一数据库。
 */
import { createHmac, randomUUID } from "node:crypto";

const MCP_URL = (process.env.MCP_URL ?? "http://localhost:5620").replace(/\/+$/, "");
const CRM_BASE_URL = (process.env.CRM_BASE_URL ?? "http://localhost:5618").replace(/\/+$/, "");
const SECRET = process.env.WORKBUDDY_JWT_SECRET;
const ISSUER = process.env.WORKBUDDY_JWT_ISSUER ?? "workbuddy-local";
const AUDIENCE = process.env.WORKBUDDY_JWT_AUDIENCE ?? "pharma-crm-mcp";
if (!SECRET) throw new Error("必须设置 WORKBUDDY_JWT_SECRET");

function jwt(employee) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub: `workbuddy-demo:${employee.employeeCode}`,
    employeeId: employee.id,
    role: employee.role,
    departmentId: employee.departmentId,
    tenantId: "demo-company",
    iss: ISSUER,
    aud: AUDIENCE,
    iat: now,
    exp: now + 300,
  })}`;
  return `${unsigned}.${createHmac("sha256", SECRET).update(unsigned).digest("base64url")}`;
}

let nextId = 1;
async function parseResponse(response) {
  const text = await response.text();
  if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const line = text.split("\n").find((item) => item.startsWith("data:"));
    return line ? JSON.parse(line.slice(5).trim()) : undefined;
  }
  return text ? JSON.parse(text) : undefined;
}

async function rpc(token, method, params, sessionId) {
  const response = await fetch(`${MCP_URL}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  const body = await parseResponse(response);
  return { response, body, sessionId: response.headers.get("mcp-session-id") ?? sessionId };
}

function resultJson(message) {
  if (message?.error) throw new Error(`RPC 错误：${JSON.stringify(message.error)}`);
  if (message?.result?.isError) throw new Error(message.result.content?.[0]?.text ?? "工具执行失败");
  return JSON.parse(message.result.content[0].text);
}

async function initialize(employee) {
  const token = jwt(employee);
  const initialized = await rpc(token, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "workbuddy-demo-smoke", version: "1.0.0" },
  });
  if (!initialized.response.ok || !initialized.sessionId) {
    throw new Error(`initialize 失败：HTTP ${initialized.response.status}`);
  }
  await rpc(token, "notifications/initialized", {}, initialized.sessionId);
  return { token, sessionId: initialized.sessionId };
}

try {
  const unavailable = await fetch(`${MCP_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (unavailable.status !== 401) throw new Error(`无 JWT 应返回 401，实际 ${unavailable.status}`);

  const healthResponse = await fetch(`${MCP_URL}/health`);
  const health = await healthResponse.json();
  if (!healthResponse.ok || health.ok !== true || health.tools !== 27) {
    throw new Error(`健康检查异常：${JSON.stringify(health)}`);
  }

  const employeeResponse = await fetch(`${CRM_BASE_URL}/api/employees`);
  const tree = (await employeeResponse.json()).data ?? [];
  const flat = [];
  const walk = (nodes) => nodes.forEach((employee) => {
    flat.push(employee);
    walk(employee.subordinates ?? []);
  });
  walk(tree);
  const representatives = flat.filter((employee) => employee.role === "MR").slice(0, 2);
  if (representatives.length < 2) throw new Error("演示数据至少需要两名 MR");

  const first = await initialize(representatives[0]);
  const second = await initialize(representatives[1]);
  const crossActor = await rpc(second.token, "tools/list", {}, first.sessionId);
  if (crossActor.response.status !== 401) {
    throw new Error(`跨员工复用 session 应返回 401，实际 ${crossActor.response.status}`);
  }

  const list = await rpc(first.token, "tools/list", {}, first.sessionId);
  const tools = list.body.result.tools;
  for (const name of ["get_my_day", "prepare_hcp_visit", "complete_hcp_visit"]) {
    if (!tools.some((tool) => tool.name === name)) throw new Error(`缺少复合工具 ${name}`);
  }
  if (tools.some((tool) => tool.name === "set_current_employee")) {
    throw new Error("HTTP JWT 模式不应暴露 set_current_employee");
  }

  const myDay = resultJson((await rpc(first.token, "tools/call", {
    name: "get_my_day",
    arguments: { asOf: "2026-07-24" },
  }, first.sessionId)).body);
  if (myDay.representative.id !== representatives[0].id) throw new Error("get_my_day 身份串号");

  const search = resultJson((await rpc(first.token, "tools/call", {
    name: "search_hcp",
    arguments: { mine: "true" },
  }, first.sessionId)).body);
  const hcp = search.data?.[0];
  if (!hcp) throw new Error("当前代表没有可用于演示的 HCP");

  const preparation = resultJson((await rpc(first.token, "tools/call", {
    name: "prepare_hcp_visit",
    arguments: { hcpId: hcp.id },
  }, first.sessionId)).body);
  if (preparation.hcp.id !== hcp.id || preparation.representative.id !== representatives[0].id) {
    throw new Error("prepare_hcp_visit 返回对象或身份错误");
  }

  const idempotencyKey = `demo-${randomUUID()}`;
  const completeArguments = {
    idempotencyKey,
    confirmed: true,
    hcpId: hcp.id,
    hcoId: preparation.hcp.hco?.id,
    visitDate: new Date().toISOString(),
    type: "FACE_TO_FACE",
    purposes: ["临床信息沟通"],
    outcome: "已完成 WorkBuddy 演示沟通",
    summary: "由 WorkBuddy 通过 MCP 创建的演示拜访",
    nextStep: "一周后复访",
    followUp: {
      title: "WorkBuddy 演示：一周后复访",
      priority: "NORMAL",
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
  };
  const firstWrite = resultJson((await rpc(first.token, "tools/call", {
    name: "complete_hcp_visit",
    arguments: completeArguments,
  }, first.sessionId)).body);
  const replay = resultJson((await rpc(first.token, "tools/call", {
    name: "complete_hcp_visit",
    arguments: completeArguments,
  }, first.sessionId)).body);
  if (!firstWrite.visit?.id || replay.visit?.id !== firstWrite.visit.id || replay.replayed !== true) {
    throw new Error("幂等重放未返回同一拜访");
  }

  for (const session of [first, second]) {
    await fetch(`${MCP_URL}/mcp`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.token}`, "mcp-session-id": session.sessionId },
    });
  }
  console.log(JSON.stringify({
    result: "PASS",
    representative: myDay.representative.name,
    hcp: preparation.hcp.name,
    visitId: firstWrite.visit.id,
    operationId: firstWrite.operationId,
    replayed: replay.replayed,
  }, null, 2));
} catch (error) {
  console.error(`HTTP_SMOKE_TEST_RESULT=FAIL ${error.message}`);
  process.exitCode = 1;
}
