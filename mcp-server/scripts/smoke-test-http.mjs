/**
 * MCP over HTTP(Streamable HTTP)冒烟测试。
 * 前置:CRM dev server(5618)+ MCP HTTP 模式(5620)均已启动。
 * 流程:/health → (可选)鉴权 401/200 → initialize → tools/list(25 个)
 *       → tools/call summarize_employee_visits → DELETE 关闭 session
 *
 * 用法:
 *   node scripts/smoke-test-http.mjs [员工姓名]
 * 环境变量:
 *   MCP_URL         默认 http://localhost:5620
 *   MCP_AUTH_TOKEN  设置后:所有请求带 Bearer,并额外验证「不带 token 返回 401」
 *   CRM_BASE_URL    默认 http://localhost:5618(用于取一个真实代表姓名)
 */

const MCP_URL = (process.env.MCP_URL ?? "http://localhost:5620").replace(/\/+$/, "");
const CRM_BASE_URL = (process.env.CRM_BASE_URL ?? "http://localhost:5618").replace(/\/+$/, "");
const TOKEN = process.env.MCP_AUTH_TOKEN;

const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
const mcpHeaders = {
  ...authHeaders,
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

let nextId = 1;

/** 解析响应:兼容 application/json 与 text/event-stream(SSE) */
async function parseMcpResponse(res) {
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (ct.includes("text/event-stream")) {
    for (const line of text.split("\n")) {
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data) return JSON.parse(data);
      }
    }
    throw new Error(`SSE 响应中没有 data 行:${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : undefined;
}

async function mcpRequest(method, params, sessionId) {
  const res = await fetch(`${MCP_URL}/mcp`, {
    method: "POST",
    headers: { ...mcpHeaders, ...(sessionId ? { "mcp-session-id": sessionId } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  if (!res.ok) throw new Error(`${method} HTTP ${res.status}:${(await res.text()).slice(0, 300)}`);
  return { msg: await parseMcpResponse(res), sessionId: res.headers.get("mcp-session-id") ?? sessionId };
}

function toolText(msg) {
  if (msg.error) throw new Error(`RPC 错误:${JSON.stringify(msg.error)}`);
  const r = msg.result;
  if (r?.isError) throw new Error(`工具返回错误:${r.content?.[0]?.text}`);
  return r?.content?.[0]?.text ?? "";
}

try {
  // 0. 取一个真实代表姓名(参数 > CRM 查询)
  let employeeName = process.argv[2];
  if (!employeeName) {
    const res = await fetch(`${CRM_BASE_URL}/api/employees`);
    const { data } = await res.json();
    const flat = [];
    const walk = (nodes) => nodes.forEach((n) => {
      flat.push(n);
      if (n.subordinates?.length) walk(n.subordinates);
    });
    walk(data ?? []);
    const mr = flat.find((e) => e.role === "MR");
    if (!mr) throw new Error("CRM 中未找到任何 MR");
    employeeName = mr.name;
  }
  console.log(`测试代表:${employeeName}(MCP_URL=${MCP_URL}, 鉴权=${TOKEN ? "启用" : "未启用"})\n`);

  // 1. 鉴权负向用例(仅当设了 token):不带 token 必须 401
  if (TOKEN) {
    const noAuth = await fetch(`${MCP_URL}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 0, method: "tools/list", params: {} }),
    });
    console.log("== 鉴权:不带 token 访问 /mcp ==", noAuth.status === 401 ? "✓ 401(正确拒绝)" : `✗ ${noAuth.status}`);
    if (noAuth.status !== 401) throw new Error(`不带 token 应返回 401,实际 ${noAuth.status}`);

    const noAuthHealth = await fetch(`${MCP_URL}/health`);
    console.log("== 鉴权:不带 token 访问 /health ==", noAuthHealth.status === 401 ? "✓ 401(正确拒绝)" : `✗ ${noAuthHealth.status}`);
    if (noAuthHealth.status !== 401) throw new Error(`/health 不带 token 应返回 401,实际 ${noAuthHealth.status}`);
  }

  // 2. /health(带 token 时应 200)
  const healthRes = await fetch(`${MCP_URL}/health`, { headers: authHeaders });
  const health = await healthRes.json();
  console.log(`\n== GET /health == HTTP ${healthRes.status}`, JSON.stringify(health));
  if (!healthRes.ok || health.ok !== true) throw new Error("/health 异常");
  if (health.tools !== 25) throw new Error(`期望 tools=25,实际 ${health.tools}`);

  // 3. initialize → 拿 sessionId
  const init = await mcpRequest("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "smoke-test-http", version: "0.1.0" },
  });
  const sessionId = init.sessionId;
  console.log(`\n== initialize == ✓ sessionId=${sessionId}, server=${init.msg.result?.serverInfo?.name}@${init.msg.result?.serverInfo?.version}`);
  if (!sessionId) throw new Error("initialize 响应缺少 mcp-session-id 头(有状态模式必须返回)");

  await fetch(`${MCP_URL}/mcp`, {
    method: "POST",
    headers: { ...mcpHeaders, "mcp-session-id": sessionId },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }),
  });

  // 4. tools/list
  const list = await mcpRequest("tools/list", {}, sessionId);
  const tools = list.msg.result.tools;
  console.log(`== tools/list == 共 ${tools.length} 个工具`);
  if (tools.length !== 25) throw new Error(`期望 25 个工具,实际 ${tools.length}`);
  if (!tools.some((t) => t.name === "summarize_employee_visits")) {
    throw new Error("tools/list 中缺少 summarize_employee_visits");
  }
  console.log("  ✓ 含 summarize_employee_visits");

  // 5. tools/call summarize_employee_visits(范围默认覆盖种子数据期,可用 SMOKE_FROM/SMOKE_TO 覆盖)
  const from = process.env.SMOKE_FROM ?? "2026-06-01";
  const to = process.env.SMOKE_TO ?? "2026-07-31";
  const sumRes = await mcpRequest("tools/call", {
    name: "summarize_employee_visits",
    arguments: { employeeName, from, to },
  }, sessionId);
  const sum = JSON.parse(toolText(sumRes.msg));
  console.log(
    `\n== tools/call summarize_employee_visits {employeeName:"${employeeName}", ${from}~${to}} ==`,
    `\n  employee=${sum.employee?.name}(${sum.employee?.role}), totalVisits=${sum.totalVisits},`,
    `\n  dailyBreakdown=${sum.dailyBreakdown?.length} 天, byType=${JSON.stringify(sum.byType)},`,
    `\n  topHcps 前 3=${JSON.stringify(sum.topHcps?.slice(0, 3))},`,
    `\n  coveredHcpCount=${sum.coveredHcpCount}, jointVisitCount=${sum.jointVisitCount}, avgPerDay=${sum.avgPerDay}`,
  );
  for (const k of ["dailyBreakdown", "byType", "byValidity", "bySource", "topHcps"]) {
    if (!Array.isArray(sum[k])) throw new Error(`summarize_employee_visits 缺少数组字段 ${k}`);
  }
  if (sum.totalVisits < 1) throw new Error("summarize_employee_visits 未统计到任何拜访");

  // 6. 关闭 session
  const del = await fetch(`${MCP_URL}/mcp`, {
    method: "DELETE",
    headers: { ...authHeaders, "mcp-session-id": sessionId },
  });
  console.log(`\n== DELETE /mcp 关闭 session == HTTP ${del.status}`);

  console.log("\nHTTP_SMOKE_TEST_RESULT=PASS");
} catch (e) {
  console.error("\nHTTP_SMOKE_TEST_RESULT=FAIL", e.message);
  process.exitCode = 1;
}
