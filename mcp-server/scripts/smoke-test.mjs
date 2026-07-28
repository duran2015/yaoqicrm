/**
 * MCP 协议级冒烟测试:通过 stdio 与 mcp-server 直接进行 JSON-RPC 握手。
 * 流程:initialize → notifications/initialized → tools/list → tools/call × 4
 * 用法:node scripts/smoke-test.mjs
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const child = spawn("npx", ["tsx", "src/index.ts"], {
  cwd: serverDir,
  env: { ...process.env, CRM_BASE_URL: process.env.CRM_BASE_URL ?? "http://localhost:5618" },
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      console.error("非 JSON 行:", line);
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`超时:${method}`)), 30000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

function toolText(res) {
  if (res.error) throw new Error(`RPC 错误:${JSON.stringify(res.error)}`);
  const r = res.result;
  if (r?.isError) throw new Error(`工具返回错误:${r.content?.[0]?.text}`);
  return r?.content?.[0]?.text ?? "";
}

const excerpt = (s, n = 400) => (s.length > n ? s.slice(0, n) + `…(共 ${s.length} 字符)` : s);

try {
  // 1. initialize 握手
  const init = await request("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0.1.0" },
  });
  console.log("== initialize ==\n", excerpt(JSON.stringify(init.result)), "\n");
  notify("notifications/initialized", {});

  // 2. tools/list
  const list = await request("tools/list", {});
  const tools = list.result.tools;
  console.log(`== tools/list == 共 ${tools.length} 个工具`);
  for (const t of tools) {
    const descLen = (t.description ?? "").length;
    console.log(`  - ${t.name}  (description ${descLen} 字符)`);
    if (!descLen) throw new Error(`${t.name} 缺少 description`);
  }
  if (tools.length !== 28) throw new Error(`期望 28 个工具,实际 ${tools.length}`);

  // 3. search_hcp(query=张)
  const searchRes = await request("tools/call", {
    name: "search_hcp",
    arguments: { query: "张" },
  });
  const searchText = toolText(searchRes);
  console.log("\n== tools/call search_hcp {query:\"张\"} ==\n", excerpt(searchText));
  const hcp = JSON.parse(searchText).data[0];
  if (!hcp) throw new Error("search_hcp 未返回任何医生");

  // 4. get_dashboard_kpis(缺省 asOf=2026-07-24)
  const kpiRes = await request("tools/call", { name: "get_dashboard_kpis", arguments: {} });
  const kpiText = toolText(kpiRes);
  console.log("\n== tools/call get_dashboard_kpis {} ==\n", excerpt(kpiText));

  // 5. log_visit(不带样品,避免库存变动)
  const logRes = await request("tools/call", {
    name: "log_visit",
    arguments: {
      hcpId: hcp.id,
      visitDate: "2026-07-24T15:00:00+08:00",
      type: "FACE_TO_FACE",
      purpose: "MCP 冒烟测试",
      outcome: "测试通过",
      duration: 15,
      notes: "由 mcp-server 冒烟测试脚本创建,随后将删除",
    },
  });
  const logText = toolText(logRes);
  console.log("\n== tools/call log_visit ==\n", excerpt(logText));
  const visit = JSON.parse(logText);
  console.log(`\n新建拜访 id = ${visit.id}(医生:${visit.hcp?.name}, 代表:${visit.employee?.name})`);

  // 6. list_visits 验证能查到
  const lvRes = await request("tools/call", {
    name: "list_visits",
    // from/to 为 gte/lte 闭区间,to=当天 0 点;用次日作为上界覆盖全天
    arguments: { hcpId: hcp.id, from: "2026-07-24", to: "2026-07-25" },
  });
  const lvText = toolText(lvRes);
  const found = JSON.parse(lvText).data.find((v) => v.id === visit.id);
  console.log("\n== tools/call list_visits 验证 ==", found ? `✓ 查到刚创建的拜访 ${visit.id}` : "✗ 未查到");
  if (!found) throw new Error("list_visits 未查到新拜访");

  // 7. 有效性评定链路:切换到接收人(填写人的直属上级)→ 待评定收件箱 → evaluate_visit
  const receiverName = visit.receiver?.name;
  if (!receiverName) throw new Error("新建拜访缺少 receiver(应默认为填写人的直属上级)");
  const swRes = await request("tools/call", { name: "set_current_employee", arguments: { nameOrId: receiverName } });
  console.log("\n== tools/call set_current_employee ==\n", excerpt(toolText(swRes), 200));

  const pendRes = await request("tools/call", { name: "list_pending_evaluations", arguments: {} });
  const pendText = toolText(pendRes);
  const pendList = JSON.parse(pendText).data;
  const inInbox = pendList.find((v) => v.id === visit.id);
  console.log(
    `\n== tools/call list_pending_evaluations == 待评定 ${pendList.length} 条,`,
    inInbox ? `✓ 新拜访在 ${receiverName} 的收件箱中` : "✗ 新拜访不在收件箱",
  );
  if (!inInbox) throw new Error("list_pending_evaluations 未包含刚创建的拜访");

  const evalRes = await request("tools/call", {
    name: "evaluate_visit",
    arguments: { visitId: visit.id, action: "VALID" },
  });
  const evaluated = JSON.parse(toolText(evalRes));
  console.log(
    `\n== tools/call evaluate_visit VALID == validityStatus=${evaluated.validityStatus},`,
    `evaluatedBy=${evaluated.evaluatedBy?.name}, evaluatedAt=${evaluated.evaluatedAt}`,
  );
  if (evaluated.validityStatus !== "VALID") throw new Error("evaluate_visit 未将拜访标为 VALID");

  // 8. 重复评定应报错(409 状态冲突)
  const dupRes = await request("tools/call", {
    name: "evaluate_visit",
    arguments: { visitId: visit.id, action: "VALID" },
  });
  const dupIsError = dupRes.result?.isError === true;
  console.log("\n== 重复评定拦截 ==", dupIsError ? `✓ 正确拒绝:${dupRes.result.content?.[0]?.text}` : "✗ 未拦截");
  if (!dupIsError) throw new Error("重复评定未被 409 拦截");

  // 9. list_departments 五级部门树
  const deptRes = await request("tools/call", { name: "list_departments", arguments: {} });
  const deptTree = JSON.parse(toolText(deptRes)).data;
  console.log(`\n== tools/call list_departments == 根节点:${deptTree.map((d) => d.name).join(",")}`);
  if (!deptTree.length) throw new Error("list_departments 返回空树");

  // 10. get_customer_stats(客户分级统计卡)
  const statsRes = await request("tools/call", { name: "get_customer_stats", arguments: { type: "hcp" } });
  const stats = JSON.parse(toolText(statsRes));
  console.log(
    `\n== tools/call get_customer_stats hcp == total=${stats.total}, mine=${stats.mine},`,
    `ungraded=${stats.ungraded}, A/B/C/D=${stats.tierA}/${stats.tierB}/${stats.tierC}/${stats.tierD}`,
  );
  if (typeof stats.total !== "number" || typeof stats.ungraded !== "number") {
    throw new Error("get_customer_stats 返回结构不完整");
  }

  // 11. create_customer_application(submit=true)→ review APPROVE 落地新 HCP
  const appRes = await request("tools/call", {
    name: "create_customer_application",
    arguments: {
      type: "HCP_CREATE",
      submit: true,
      pool: "架构客户池",
      payload: {
        name: "MCP冒烟建档医生",
        title: "副主任医师",
        specialty: "心内科",
        educations: [{ school: "南京医科大学", major: "临床医学", degree: "博士", education: "研究生" }],
        bankAccounts: [{ accountName: "MCP冒烟建档医生", bankName: "招商银行", accountNo: "6225880012345678", isDefault: true }],
      },
    },
  });
  const app = JSON.parse(toolText(appRes));
  console.log(`\n== tools/call create_customer_application == id=${app.id}, status=${app.status}`);
  if (app.status !== "PENDING") throw new Error("submit=true 的申请应为 PENDING");

  const revRes = await request("tools/call", {
    name: "review_customer_application",
    arguments: { applicationId: app.id, action: "APPROVE" },
  });
  const reviewed = JSON.parse(toolText(revRes));
  console.log(
    `\n== tools/call review_customer_application APPROVE == status=${reviewed.status},`,
    `createdHcpId=${reviewed.createdHcpId}`,
  );
  if (reviewed.status !== "APPROVED" || !reviewed.createdHcpId) {
    throw new Error("review APPROVE 未落地新 HCP");
  }

  // 12. get_hcp_360 验证落地档案可查(姓名脱敏)
  const h360Res = await request("tools/call", { name: "get_hcp_360", arguments: { hcpId: reviewed.createdHcpId } });
  const h360 = JSON.parse(toolText(h360Res));
  console.log(
    `\n== tools/call get_hcp_360(新建档医生) == name=${h360.name}(脱敏),`,
    `educations=${h360.educations.length}, bankAccounts=${h360.bankAccounts.length},`,
    `assignments=${h360.assignments.length}(申请人 OWNER)`,
  );
  if (!h360.name.includes("*")) throw new Error("get_hcp_360 姓名未脱敏");
  if (h360.assignments.length < 1) throw new Error("APPROVE 落地后缺少申请人 OWNER 分配");

  // 13. summarize_employee_visits(拜访聚合,显式指定种子数据月份范围)
  const repId = visit.employee?.id;
  const sumRes = await request("tools/call", {
    name: "summarize_employee_visits",
    arguments: { employeeId: repId, from: "2026-07-01", to: "2026-07-31" },
  });
  const sum = JSON.parse(toolText(sumRes));
  console.log(
    `\n== tools/call summarize_employee_visits == total=${sum.totalVisits},`,
    `daily=${sum.dailyBreakdown.length} 天, byType=${sum.byType.length} 类,`,
    `topHcps=${sum.topHcps.length}, covered=${sum.coveredHcpCount}, avg/day=${sum.avgPerDay}`,
  );
  if (!Array.isArray(sum.dailyBreakdown) || !Array.isArray(sum.byType) || !Array.isArray(sum.topHcps)) {
    throw new Error("summarize_employee_visits 返回结构不完整");
  }
  if (sum.totalVisits < 1) throw new Error("summarize_employee_visits 未统计到任何拜访");

  console.log(`\nSMOKE_TEST_VISIT_ID=${visit.id}`);
  console.log(`SMOKE_TEST_APPLICATION_ID=${app.id}`);
  console.log("SMOKE_TEST_RESULT=PASS");
} catch (e) {
  console.error("\nSMOKE_TEST_RESULT=FAIL", e.message);
  process.exitCode = 1;
} finally {
  child.kill();
}
