#!/usr/bin/env node
/**
 * pharma-crm-mcp-server
 *
 * 药企销售代表 CRM 的 MCP(Model Context Protocol)Server。
 * 所有工具都是对 CRM REST API(http://localhost:5618/api/...)的封装。
 * 传输方式:
 *   - stdio(默认):本地 MCP 客户端(Claude Desktop / 自研 AI 助手等)
 *   - Streamable HTTP(--http 或 MCP_TRANSPORT=http):远程 MCP 客户端,
 *     endpoint 为 POST/GET/DELETE /mcp,健康检查 GET /health
 *
 * 环境变量:
 *   CRM_BASE_URL      CRM 后端地址,默认 http://localhost:5618
 *   CRM_EMPLOYEE_ID   默认操作身份(员工 id),也可用启动参数 --employee-id
 *   MCP_PORT          HTTP 模式监听端口,默认 5620
 *   MCP_HOST          HTTP 模式监听地址,默认 0.0.0.0
 *   WORKBUDDY_JWT_SECRET   HTTP 模式 HS256 JWT 共享密钥(必填)
 *   WORKBUDDY_JWT_ISSUER   JWT issuer,默认 workbuddy-local
 *   WORKBUDDY_JWT_AUDIENCE JWT audience,默认 pharma-crm-mcp
 * 启动参数:
 *   --http                 以 Streamable HTTP 模式启动(默认 stdio)
 *   --employee-id <id>     指定默认员工 id
 *   --employee-name <姓名> 指定默认员工姓名(启动时向 CRM 查询解析为 id)
 */

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  AuthError,
  mapClaimsToEmployee,
  verifyWorkBuddyJwt,
  type SessionActor,
} from "./auth.js";
import {
  assertEmployeeScope,
  assertSessionRequestActor,
  bearerToken,
  type SessionContext,
} from "./session-auth.js";

// ---------------------------------------------------------------------------
// 配置与运行时状态
// ---------------------------------------------------------------------------

const BASE_URL = (process.env.CRM_BASE_URL ?? "http://localhost:5618").replace(/\/+$/, "");

/** 解析启动参数 */
function argvValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

/** 当前操作身份仅用于 stdio 本地开发；HTTP 身份固定在各 session。 */
let currentEmployee: SessionActor | null = null;
const envEmployeeId = argvValue("--employee-id") ?? process.env.CRM_EMPLOYEE_ID;
const envEmployeeName = argvValue("--employee-name");

/** 种子数据的演示时间基准(见 API.md"演示数据基准") */
const DEMO_AS_OF = "2026-07-24";

// ---------------------------------------------------------------------------
// CRM REST API 封装
// ---------------------------------------------------------------------------

class CrmError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "CrmError";
  }
}

type Query = Record<string, string | number | undefined>;

async function crmFetch<T = unknown>(
  path: string,
  opts: { method?: string; query?: Query; body?: unknown } = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new CrmError(
      0,
      `无法连接 CRM 后端(${url.origin})。请先运行 npm run dev 启动 CRM。原始错误:${(e as Error).message}`,
    );
  }
  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    /* 非 JSON 响应,原样透传 */
  }
  if (!res.ok) {
    const msg =
      (json as { error?: string } | undefined)?.error ??
      `HTTP ${res.status} ${res.statusText}:${text.slice(0, 300)}`;
    throw new CrmError(res.status, msg);
  }
  return (json ?? text) as T;
}

/** 把 CRM 返回结果包装为 MCP text content(JSON 字符串) */
function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/** 统一错误处理:把后端 {error} 透传为 MCP 错误,绝不返回空响应 */
async function callTool(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (e) {
    const message =
      e instanceof CrmError
        ? `CRM 接口错误(HTTP ${e.status}):${e.message}`
        : `MCP server 内部错误:${(e as Error).message}`;
    return { content: [{ type: "text" as const, text: message }], isError: true as const };
  }
}

/** 需要"当前员工"时的兜底:未设置则给出可操作的中文提示 */
function requireEmployee(context: SessionContext, explicitId?: string): string {
  try {
    return assertEmployeeScope(context, explicitId);
  } catch (error) {
    if (error instanceof AuthError) throw new CrmError(403, error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 组织架构解析(员工树 → 扁平列表)
// ---------------------------------------------------------------------------

interface EmployeeNode {
  id: string;
  name: string;
  role: string;
  division?: string;
  departmentId?: string | null;
  territory?: { id: string; name: string; level: string } | null;
  subordinates?: EmployeeNode[];
}

function flattenEmployees(nodes: EmployeeNode[]): EmployeeNode[] {
  const out: EmployeeNode[] = [];
  const walk = (list: EmployeeNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.subordinates?.length) walk(n.subordinates);
    }
  };
  walk(nodes);
  return out;
}

async function findEmployee(nameOrId: string): Promise<EmployeeNode | null> {
  const res = await crmFetch<{ data: EmployeeNode[] }>("/api/employees");
  const all = flattenEmployees(res.data ?? []);
  return all.find((e) => e.id === nameOrId) ?? all.find((e) => e.name === nameOrId) ?? null;
}

// ---------------------------------------------------------------------------
// MCP Server 与工具注册
// ---------------------------------------------------------------------------

/** 已注册工具数(每次 createMcpServer 时刷新,供 /health 汇报) */
let toolCount = 0;

/**
 * 创建一份注册好全部工具的 McpServer。
 * stdio 模式创建 1 份;HTTP(Streamable)模式每个 session 各创建 1 份
 * (一份 McpServer 只能连接一个 transport)。
 */
function createMcpServer(context: SessionContext): McpServer {
  const server = new McpServer({
    name: "pharma-crm-mcp-server",
    version: "1.0.0",
  });
  let count = 0;
  // 包一层注册,只为统计工具数;断言为 registerTool 原类型以保留调用点的上下文类型推断
  const tool = ((name: string, cfg: unknown, handler: unknown) => {
    count++;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return server.registerTool(name, cfg as any, handler as any);
  }) as unknown as McpServer["registerTool"];

// 1. search_hcp -------------------------------------------------------------
tool(
  "search_hcp",
  {
    title: "搜索医生",
    description:
      "按姓名/分级/医院/科室搜索医生(HCP)。返回医生列表,含所属医院摘要与合作代表(assignments);姓名与手机号已全局脱敏(如「张*远」「138****01」);含扩展档案字段(医生等级/行政职务/擅长疾病等)。找医生、定位客户时第一步使用;拿到 id 后可再调 get_hcp_360 看全景。",
    inputSchema: {
      query: z.string().optional().describe("模糊关键词,匹配医生姓名/科室/标签/所属机构名,如「张明远」「肿瘤内科」"),
      tier: z.enum(["A", "B", "C", "D"]).optional().describe("医生分级:A=重点客户,B=潜力客户,C=普通客户,D=观察客户"),
      hcoId: z.string().optional().describe("按医疗机构 id 过滤(机构 id 可由 list/search 类工具获得)"),
      specialty: z.string().optional().describe("科室模糊匹配,如「肿瘤内科」「心内科」"),
      graded: z
        .enum(["true", "false"])
        .optional()
        .describe("是否已分级:true=已分级(tier 非空),false=未分级;缺省不过滤"),
      employeeId: z.string().optional().describe("配合 mine=true 使用:只看该员工有分配关系的客户"),
      mine: z
        .enum(["true"])
        .optional()
        .describe("传 \"true\" 且带 employeeId(或已设置当前身份)时,只返回我的客户"),
    },
  },
  async ({ query, tier, hcoId, specialty, graded, employeeId, mine }) =>
    callTool(() =>
      crmFetch("/api/hcp", {
        query: {
          query,
          tier,
          hcoId,
          specialty,
          graded,
          mine,
          employeeId: employeeId ? requireEmployee(context, employeeId) : context.actor?.employeeId,
        },
      }),
    ),
);

// 2. get_hcp_360 ------------------------------------------------------------
tool(
  "get_hcp_360",
  {
    title: "医生全景视图",
    description:
      "医生 360° 全景:全部档案字段(基础/工作/其他/证件,扩展字段含医生等级、行政职务、是否药事会成员、周门诊量、管理床位、擅长疾病等)+ 教育经历 + 银行账户 + 合作代表(assignments)+ 所属医院(含辖区)+ 拜访历史(含讨论产品、发放样品)+ 参会记录 + 收到样品汇总 + 统计。姓名/手机号/证件号/银行账号已全局脱敏。拜访前准备、客户分析时使用。",
    inputSchema: {
      hcpId: z.string().describe("医生 id(可由 search_hcp 获得)"),
    },
  },
  async ({ hcpId }) => callTool(() => crmFetch(`/api/hcp/${encodeURIComponent(hcpId)}`)),
);

// 3. log_visit --------------------------------------------------------------
tool(
  "log_visit",
  {
    title: "记录拜访",
    description:
      "记录一次医生拜访(DCR 日报)。可附带:结构化拜访目的 purposes(多选)、人工总结 summary、报告接收人 receiverId(缺省=填写人的直属上级)、签到 checkin(时间默认当前)、讨论的产品明细与发放的样品;发放样品会自动校验并扣减代表库存,库存不足会返回错误。employeeId 缺省用当前操作身份。",
    inputSchema: {
      hcpId: z.string().describe("拜访的医生 id(可由 search_hcp 获得)"),
      employeeId: z.string().optional().describe("执行拜访的代表员工 id,缺省为当前操作身份"),
      hcoId: z.string().optional().describe("拜访发生的机构 id(可选,缺省取医生所属机构)"),
      visitDate: z.string().optional().describe("拜访时间,ISO 8601,如 2026-07-24T10:30:00+08:00;缺省为当前时间"),
      type: z
        .enum(["FACE_TO_FACE", "PHONE", "CONFERENCE", "JOINT"])
        .optional()
        .describe("拜访类型:FACE_TO_FACE=面访(默认),PHONE=电话,CONFERENCE=会议,JOINT=协同拜访"),
      purposes: z
        .array(z.enum(["产品信息传递", "临床信息沟通", "市场现状调研", "学术会议沟通", "其他"]))
        .optional()
        .describe("结构化拜访目的(可多选),如 [\"产品信息传递\", \"临床信息沟通\"]"),
      purpose: z.string().optional().describe("拜访目的自由文本(旧字段,建议优先用 purposes)"),
      outcome: z.string().optional().describe("拜访结果,如「同意试用」「需进一步跟进」"),
      duration: z.number().int().positive().optional().describe("拜访时长(分钟)"),
      notes: z.string().optional().describe("拜访原始记录(语音速记/文字备忘)"),
      summary: z.string().optional().describe("人工拜访总结(与 AI 摘要独立保存,如「本次拜访医生接受度较好,约定下周回访」)"),
      nextStep: z.string().optional().describe("下一步计划,如「下周带文献回访」"),
      receiverId: z.string().optional().describe("报告接收人(上级)员工 id,缺省为填写人的直属上级;接收人将在待评定收件箱中看到本条拜访"),
      checkin: z
        .object({
          locationName: z.string().describe("签到地点名称,一般为医院名"),
          latitude: z.number().optional().describe("签到纬度(可选)"),
          longitude: z.number().optional().describe("签到经度(可选)"),
        })
        .optional()
        .describe("拜访签到(签到时间自动取当前时间);事后补签到请用 check_in 工具"),
      products: z
        .array(
          z.object({
            productId: z.string().describe("讨论的产品 id(可由 list_products 获得)"),
            feedback: z.string().optional().describe("医生对该产品的反馈"),
          }),
        )
        .optional()
        .describe("本次拜访讨论的产品明细"),
      samples: z
        .array(
          z.object({
            lotId: z.string().describe("发放的样品批次 id(可由 get_sample_inventory 的 lots 获得)"),
            quantity: z.number().int().positive().describe("发放数量(盒),必须为正整数"),
          }),
        )
        .optional()
        .describe("本次发放的样品明细;将自动扣减代表在该产品上的库存"),
    },
  },
  async ({ products, samples, checkin, ...rest }) =>
    callTool(async () => {
      const body: Record<string, unknown> = { ...rest, employeeId: requireEmployee(context, rest.employeeId) };
      if (products?.length) body.products = products;
      if (samples?.length) body.samples = samples;
      if (checkin) body.checkins = [checkin];
      return crmFetch("/api/visits", { method: "POST", body });
    }),
);

// 4. list_visits ------------------------------------------------------------
tool(
  "list_visits",
  {
    title: "查询拜访记录",
    description:
      "查询拜访记录,可按代表/医生/日期范围/拜访类型/有效性/来源组合过滤,按拜访时间倒序。返回含结构化目的 purposes、人工总结 summary、接收人、签到记录。用于回顾工作、核对日报。",
    inputSchema: {
      employeeId: z.string().optional().describe("按代表员工 id 过滤,缺省为当前操作身份"),
      hcpId: z.string().optional().describe("按医生 id 过滤"),
      from: z.string().optional().describe("起始日期(含),ISO 8601,如 2026-07-01"),
      to: z.string().optional().describe("截止日期(含),ISO 8601,如 2026-07-31"),
      type: z
        .enum(["FACE_TO_FACE", "PHONE", "CONFERENCE", "JOINT"])
        .optional()
        .describe("拜访类型过滤"),
      validityStatus: z
        .enum(["PENDING", "VALID", "INVALID"])
        .optional()
        .describe("有效性过滤:PENDING=未反馈,VALID=有效,INVALID=无效"),
      source: z
        .enum(["MANUAL", "AI", "IMPORT"])
        .optional()
        .describe("数据来源过滤:MANUAL=手工录入,AI=AI 助手录入,IMPORT=导入"),
    },
  },
  async ({ employeeId, hcpId, from, to, type, validityStatus, source }) =>
    callTool(() =>
      crmFetch("/api/visits", {
        query: { employeeId: requireEmployee(context, employeeId), hcpId, from, to, type, validityStatus, source },
      }),
    ),
);

// 5. update_visit_ai_fields ---------------------------------------------------
tool(
  "update_visit_ai_fields",
  {
    title: "回写拜访 AI 富化字段",
    description:
      "给已有拜访记录写入 AI 富化字段:aiSummary(AI 摘要)、aiSentiment(AI 情感倾向)、nextStep(下一步建议)。通常在 list_visits 读到原始 notes 后,由 AI 分析并回写。",
    inputSchema: {
      visitId: z.string().describe("拜访记录 id"),
      aiSummary: z.string().optional().describe("AI 生成的拜访摘要"),
      aiSentiment: z
        .enum(["POSITIVE", "NEUTRAL", "NEGATIVE"])
        .optional()
        .describe("AI 判断的医生态度:POSITIVE=积极,NEUTRAL=中性,NEGATIVE=消极"),
      nextStep: z.string().optional().describe("AI 建议的下一步行动"),
    },
  },
  async ({ visitId, aiSummary, aiSentiment, nextStep }) =>
    callTool(() =>
      crmFetch(`/api/visits/${encodeURIComponent(visitId)}`, {
        method: "PATCH",
        body: { aiSummary, aiSentiment, nextStep },
      }),
    ),
);

// 6. get_tour_plan ------------------------------------------------------------
tool(
  "get_tour_plan",
  {
    title: "查看周拜访计划",
    description:
      "查看某代表的周拜访计划(Tour Plan)及审批状态(DRAFT/SUBMITTED/APPROVED/REJECTED),含逐日计划条目。employeeId 缺省为当前操作身份。",
    inputSchema: {
      employeeId: z.string().optional().describe("代表员工 id,缺省为当前操作身份"),
      status: z
        .enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"])
        .optional()
        .describe("按计划状态过滤:DRAFT=草稿,SUBMITTED=待审批,APPROVED=已批准,REJECTED=已驳回"),
      weekStart: z.string().optional().describe("周一日期,ISO 格式,如 2026-07-20;精确匹配该周计划"),
    },
  },
  async ({ employeeId, status, weekStart }) =>
    callTool(() =>
      crmFetch("/api/tour-plans", {
        query: { employeeId: requireEmployee(context, employeeId), status, weekStart },
      }),
    ),
);

// 7. submit_tour_plan ---------------------------------------------------------
tool(
  "submit_tour_plan",
  {
    title: "提交周计划审批",
    description:
      "把周拜访计划提交给经理审批:DRAFT 或 REJECTED 状态 → SUBMITTED。已 SUBMITTED/APPROVED 的计划不能重复提交(会返回状态冲突错误)。",
    inputSchema: {
      planId: z.string().describe("周计划 id(可由 get_tour_plan 获得)"),
    },
  },
  async ({ planId }) =>
    callTool(() =>
      crmFetch(`/api/tour-plans/${encodeURIComponent(planId)}/submit`, { method: "POST" }),
    ),
);

// 8. get_sample_inventory -----------------------------------------------------
tool(
  "get_sample_inventory",
  {
    title: "查询样品库存",
    description:
      "查询代表的样品库存:按产品聚合(领用总量 − 发放总量 = 当前库存),并含各批次明细(lotId、批号、效期)。发放样品前应先查库存拿 lotId。employeeId 缺省为当前操作身份。",
    inputSchema: {
      employeeId: z.string().optional().describe("代表员工 id,缺省为当前操作身份"),
    },
  },
  async ({ employeeId }) =>
    callTool(() =>
      crmFetch("/api/samples/inventory", { query: { employeeId: requireEmployee(context, employeeId) } }),
    ),
);

// 9. get_dashboard_kpis -------------------------------------------------------
tool(
  "get_dashboard_kpis",
  {
    title: "仪表盘 KPI",
    description:
      "个人/团队工作台 KPI:今日拜访数、本周计划完成率、本月目标达成率、近 14 天拜访趋势、辖区 HCP 分级分布;管理岗(ASM/RSM/ADMIN)自动聚合整个下属子树,并额外返回 pendingEvaluations(待我评定的拜访数)。employeeId 缺省为当前操作身份;asOf 用于把「今天」钉在种子数据基准日 2026-07-24。",
    inputSchema: {
      employeeId: z.string().optional().describe("员工 id,缺省为当前操作身份"),
      asOf: z
        .string()
        .optional()
        .describe("统计基准日 YYYY-MM-DD,缺省 2026-07-24(种子数据基准);传真实当天日期可看实时口径"),
    },
  },
  async ({ employeeId, asOf }) =>
    callTool(() =>
      crmFetch("/api/analytics/dashboard", {
        query: { employeeId: requireEmployee(context, employeeId), asOf: asOf ?? DEMO_AS_OF },
      }),
    ),
);

// 10. analyze_territory_performance -------------------------------------------
tool(
  "analyze_territory_performance",
  {
    title: "辖区绩效分析",
    description:
      "团队辖区绩效分析(管理者视角):按下属代表逐人聚合本月拜访数、覆盖医生数、A 级重点客户覆盖率。用于辅导下属、发现覆盖盲区。employeeId 缺省为当前操作身份(传 MR 则只统计本人)。",
    inputSchema: {
      employeeId: z.string().optional().describe("管理者(或代表)员工 id,缺省为当前操作身份"),
      asOf: z.string().optional().describe("统计基准日 YYYY-MM-DD,缺省 2026-07-24(种子数据基准)"),
    },
  },
  async ({ employeeId, asOf }) =>
    callTool(() =>
      crmFetch("/api/analytics/territory", {
        query: { employeeId: requireEmployee(context, employeeId), asOf: asOf ?? DEMO_AS_OF },
      }),
    ),
);

// 11. list_products -----------------------------------------------------------
tool(
  "list_products",
  {
    title: "产品目录",
    description:
      "查询产品目录:商品名/通用名(分子)/治疗领域/所属事业部/规格/价格,以及样品批次。log_visit 填 products 前先在此查 productId。",
    inputSchema: {
      division: z.string().optional().describe("按事业部过滤,如「肿瘤线」「心血管线」"),
      query: z.string().optional().describe("模糊关键词,匹配商品名/通用名/治疗领域,如「安瑞泽」「奥希替尼」"),
    },
  },
  async ({ division, query }) =>
    callTool(() => crmFetch("/api/products", { query: { division, query } })),
);

// 12. list_employees ----------------------------------------------------------
tool(
  "list_employees",
  {
    title: "员工与组织架构",
    description:
      "查询完整组织架构树:医药代表(MR)→ 地区经理(ASM)→ 大区经理(RSM),含汇报关系与所属辖区。需要找同事、上级或确认 employeeId 时使用。",
    inputSchema: {},
  },
  async () => callTool(() => crmFetch("/api/employees")),
);

// 13. set_current_employee ----------------------------------------------------
if (context.mode === "stdio") {
tool(
  "set_current_employee",
  {
    title: "切换当前操作身份",
    description:
      "切换 MCP 会话的当前操作身份(后续工具的缺省 employeeId)。按姓名或 id 匹配员工。切换后 log_visit、get_dashboard_kpis 等工具缺省都以该身份执行。",
    inputSchema: {
      nameOrId: z.string().describe("员工姓名(如「刘洋」)或员工 id"),
    },
  },
  async ({ nameOrId }) =>
    callTool(async () => {
      const emp = await findEmployee(nameOrId);
      if (!emp) {
        throw new CrmError(404, `未找到员工:「${nameOrId}」。可用 list_employees 查看全部员工。`);
      }
      context.actor = {
        userId: `stdio:${emp.id}`,
        employeeId: emp.id,
        employeeName: emp.name,
        role: emp.role,
        division: emp.division,
        departmentId: emp.departmentId ?? undefined,
      };
      return {
        message: `当前操作身份已切换为:${emp.name}(${emp.role}${emp.division ? ", " + emp.division : ""})`,
        currentEmployee: context.actor,
      };
    }),
);
}

// 14. evaluate_visit ----------------------------------------------------------
tool(
  "evaluate_visit",
  {
    title: "评定拜访有效性",
    description:
      "经理对收到的拜访做有效性评定:VALID=有效 / INVALID=无效(必须给原因)。仅「未反馈(PENDING)」的拜访可评定,重复评定会返回状态冲突错误。评定前可用 list_pending_evaluations 查看待评定收件箱。evaluatorId 缺省为当前操作身份。",
    inputSchema: {
      visitId: z.string().describe("要评定的拜访 id(可由 list_pending_evaluations 或 list_visits 获得)"),
      action: z.enum(["VALID", "INVALID"]).describe("评定结论:VALID=有效,INVALID=无效"),
      reason: z.string().optional().describe("无效原因(action=INVALID 时必填),如「重复拜访记录」「内容过短」「签到地点不对」「结果未体现」"),
      evaluatorId: z.string().optional().describe("评定人(经理)员工 id,缺省为当前操作身份"),
    },
  },
  async ({ visitId, action, reason, evaluatorId }) =>
    callTool(() =>
      crmFetch(`/api/visits/${encodeURIComponent(visitId)}/evaluate`, {
        method: "POST",
        body: { action, reason, evaluatorId: requireEmployee(context, evaluatorId) },
      }),
    ),
);

// 15. list_pending_evaluations --------------------------------------------------
tool(
  "list_pending_evaluations",
  {
    title: "待评定收件箱",
    description:
      "查看「接收人是我 且 尚未反馈(PENDING)」的拜访列表(我的待评定收件箱),含填写人/医生/医院/拜访时间/结构化目的/人工总结/签到。经理做拜访有效性评定前使用;评定动作用 evaluate_visit。evaluatorId 缺省为当前操作身份。",
    inputSchema: {
      evaluatorId: z.string().optional().describe("接收人(经理)员工 id,缺省为当前操作身份"),
    },
  },
  async ({ evaluatorId }) =>
    callTool(() =>
      crmFetch("/api/evaluations/pending", { query: { evaluatorId: requireEmployee(context, evaluatorId) } }),
    ),
);

// 16. list_departments ------------------------------------------------------------
tool(
  "list_departments",
  {
    title: "部门树",
    description:
      "查询五级行政部门树(嵌套 children):1=事业部 → 2=战区 → 3=分管区 → 4=区 → 5=办事处,含每个部门的员工数。部门树是行政组织,独立于 Territory 辖区;查看员工所属部门路径可用 list_employees。",
    inputSchema: {},
  },
  async () => callTool(() => crmFetch("/api/departments")),
);

// 17. check_in ---------------------------------------------------------------------
tool(
  "check_in",
  {
    title: "拜访补签到",
    description:
      "为已有拜访补一条签到记录(签到时间默认当前,可指定地点名称与经纬度)。若签到地点与拜访机构不一致,系统会标记为「地点异常(LOCATION_MISMATCH)」。employeeId 缺省为当前操作身份。",
    inputSchema: {
      visitId: z.string().describe("要补签到的拜访 id"),
      locationName: z.string().describe("签到地点名称,一般为医院名"),
      latitude: z.number().optional().describe("签到纬度(可选)"),
      longitude: z.number().optional().describe("签到经度(可选)"),
      employeeId: z.string().optional().describe("签到人员工 id,缺省为当前操作身份(应为该拜访的填写人)"),
    },
  },
  async ({ visitId, locationName, latitude, longitude, employeeId }) =>
    callTool(async () => {
      const empId = requireEmployee(context, employeeId);
      return crmFetch(`/api/visits/${encodeURIComponent(visitId)}/checkins`, {
        method: "POST",
        body: { employeeId: empId, locationName, latitude, longitude },
      });
    }),
);

// 18. get_customer_stats -------------------------------------------------------
tool(
  "get_customer_stats",
  {
    title: "客户分级统计卡",
    description:
      "客户分级统计卡数据:total(客户总数)/ mine(我的客户数,有分配关系)/ ungraded(未分级)/ tierA~tierD(各分级数量),对齐客户管理页顶部统计卡。type 选 hcp(医生)或 hco(机构);employeeId 缺省为当前操作身份。",
    inputSchema: {
      type: z.enum(["hcp", "hco"]).describe("客户类型:hcp=医生,hco=医疗机构"),
      employeeId: z.string().optional().describe("员工 id(用于统计 mine),缺省为当前操作身份"),
    },
  },
  async ({ type, employeeId }) =>
    callTool(() =>
      crmFetch("/api/customers/stats", {
        query: {
          type,
          employeeId: employeeId ? requireEmployee(context, employeeId) : context.actor?.employeeId,
        },
      }),
    ),
);

// 19. create_customer_application ----------------------------------------------
tool(
  "create_customer_application",
  {
    title: "新建建档申请",
    description:
      "创建客户建档申请(对应「暂存草稿/立即创建」):HCP_CREATE=新建医生,HCO_CREATE=新建机构,HCP_MODIFY/HCO_MODIFY=修改已有档案(需在 payload 或参数中带 targetHcpId/targetHcoId)。submit=false 暂存为草稿(DRAFT),submit=true 直接提交待审核(PENDING)。审核动作用 review_customer_application;APPROVE 后自动落地为正式客户档案,申请人自动成为负责代表(OWNER)。",
    inputSchema: {
      type: z
        .enum(["HCP_CREATE", "HCO_CREATE", "HCP_MODIFY", "HCO_MODIFY"])
        .describe("申请类型:HCP_CREATE=新建医生,HCO_CREATE=新建机构,HCP_MODIFY=修改医生,HCO_MODIFY=修改机构"),
      payload: z
        .record(z.unknown())
        .describe("表单内容对象,如 { name, title, specialty, hcoId, educations: [...], bankAccounts: [...] };新建时 name 必填"),
      pool: z.string().optional().describe("客户池,如「架构客户池」「业绩客户池」(可选)"),
      submit: z.boolean().optional().describe("true=立即提交待审核(PENDING),false/缺省=暂存草稿(DRAFT)"),
      targetHcpId: z.string().optional().describe("HCP_MODIFY 时的目标医生 id"),
      targetHcoId: z.string().optional().describe("HCO_MODIFY 时的目标机构 id"),
    },
  },
  async ({ type, payload, pool, submit, targetHcpId, targetHcoId }) =>
    callTool(() =>
      crmFetch("/api/applications", {
        method: "POST",
        body: {
          type, payload, pool, submit: submit ?? false,
          targetHcpId, targetHcoId,
          applicantId: requireEmployee(context),
        },
      }),
    ),
);

// 20. list_customer_applications -----------------------------------------------
tool(
  "list_customer_applications",
  {
    title: "查询建档申请",
    description:
      "查询客户建档申请列表,可按状态(DRAFT=草稿/PENDING=待审核/APPROVED=已通过/REJECTED=已驳回)与类型过滤,按创建时间倒序。管理端审核前先在此查看待审核(PENDING)列表。",
    inputSchema: {
      status: z
        .enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"])
        .optional()
        .describe("按状态过滤:DRAFT=草稿,PENDING=待审核,APPROVED=已通过,REJECTED=已驳回"),
      type: z
        .enum(["HCP_CREATE", "HCO_CREATE", "HCP_MODIFY", "HCO_MODIFY"])
        .optional()
        .describe("按申请类型过滤"),
      applicantId: z.string().optional().describe("按申请人员工 id 过滤"),
    },
  },
  async ({ status, type, applicantId }) =>
    callTool(() => crmFetch("/api/applications", { query: { status, type, applicantId } })),
);

// 21. review_customer_application ------------------------------------------------
tool(
  "review_customer_application",
  {
    title: "审核建档申请",
    description:
      "审核客户建档申请(客户核决):APPROVE=通过(自动按 payload 落地为正式 HCP/HCO 档案,含教育经历/银行账户/科室等子记录,申请人自动成为负责代表)/ REJECT=驳回(必须给原因)。仅待审核(PENDING)状态可审,重复审核会返回状态冲突错误。reviewerId 缺省为当前操作身份。",
    inputSchema: {
      applicationId: z.string().describe("建档申请 id(可由 list_customer_applications 获得)"),
      action: z.enum(["APPROVE", "REJECT"]).describe("审核结论:APPROVE=通过,REJECT=驳回"),
      reason: z.string().optional().describe("驳回原因(action=REJECT 时必填)"),
      reviewerId: z.string().optional().describe("审核人员工 id,缺省为当前操作身份"),
    },
  },
  async ({ applicationId, action, reason, reviewerId }) =>
    callTool(() =>
      crmFetch(`/api/applications/${encodeURIComponent(applicationId)}/review`, {
        method: "POST",
        body: { action, reason, reviewerId: requireEmployee(context, reviewerId) },
      }),
    ),
);

// 22. assign_customer -------------------------------------------------------------
tool(
  "assign_customer",
  {
    title: "分配客户代表",
    description:
      "给客户(医生或机构)分配合作代表:role=OWNER(负责,默认)或 COLLAB(协作)。同一客户可有多个代表(对应「合作办事处/合作代表」多值)。employeeName 与 employeeId 二选一。",
    inputSchema: {
      hcpId: z.string().optional().describe("医生 id(与 hcoId 二选一)"),
      hcoId: z.string().optional().describe("机构 id(与 hcpId 二选一)"),
      employeeId: z.string().optional().describe("代表员工 id(与 employeeName 二选一)"),
      employeeName: z.string().optional().describe("代表姓名(与 employeeId 二选一),如「刘洋」"),
      role: z.enum(["OWNER", "COLLAB"]).optional().describe("分配角色:OWNER=负责(默认),COLLAB=协作"),
    },
  },
  async ({ hcpId, hcoId, employeeId, employeeName, role }) =>
    callTool(async () => {
      let empId = employeeId;
      if (!empId) {
        if (!employeeName) throw new CrmError(400, "必须提供 employeeId 或 employeeName");
        const emp = await findEmployee(employeeName);
        if (!emp) throw new CrmError(404, `未找到员工:「${employeeName}」。可用 list_employees 查看全部员工。`);
        empId = emp.id;
      }
      if (!hcpId && !hcoId) throw new CrmError(400, "必须提供 hcpId 或 hcoId 之一");
      return crmFetch("/api/assignments", {
        method: "POST",
        body: { hcpId, hcoId, employeeId: empId, role: role ?? "OWNER" },
      });
    }),
);

// 23. update_customer_tier ---------------------------------------------------------
tool(
  "update_customer_tier",
  {
    title: "调整客户分级",
    description:
      "调整客户(医生或机构)的分级为 A/B/C/D,并自动写入分级变更历史(可回溯原分级、操作人、原因)。hcpId 与 hcoId 二选一;changedById 缺省为当前操作身份。",
    inputSchema: {
      hcpId: z.string().optional().describe("医生 id(与 hcoId 二选一)"),
      hcoId: z.string().optional().describe("机构 id(与 hcpId 二选一)"),
      toTier: z.enum(["A", "B", "C", "D"]).describe("目标分级:A=重点,B=潜力,C=普通,D=观察"),
      reason: z.string().optional().describe("调整原因,如「销量提升,升级重点客户」"),
      changedById: z.string().optional().describe("操作人员工 id,缺省为当前操作身份"),
    },
  },
  async ({ hcpId, hcoId, toTier, reason, changedById }) =>
    callTool(() => {
      if (!hcpId && !hcoId) throw new CrmError(400, "必须提供 hcpId 或 hcoId 之一");
      const path = hcpId
        ? `/api/hcp/${encodeURIComponent(hcpId)}/tier`
        : `/api/hco/${encodeURIComponent(hcoId!)}/tier`;
      return crmFetch(path, {
        method: "POST",
        body: { toTier, reason, changedById: requireEmployee(context, changedById) },
      });
    }),
);

// 24. get_hco_360 --------------------------------------------------------------------
tool(
  "get_hco_360",
  {
    title: "医院全景视图",
    description:
      "医院(HCO)360° 全景:全部档案字段(工商/机构/管理/合作信息)+ 科室列表 + 进院产品(已进院/客户池)+ 国考成绩(按年份倒序)+ 合作代表(OWNER/COLLAB)+ KA 负责人 + 归属辖区 + 院内医生列表。医院调研、进院分析时使用。",
    inputSchema: {
      hcoId: z.string().describe("机构 id"),
    },
  },
  async ({ hcoId }) => callTool(() => crmFetch(`/api/hco/${encodeURIComponent(hcoId)}`)),
);

// 25. summarize_employee_visits ------------------------------------------------
tool(
  "summarize_employee_visits",
  {
    title: "员工拜访情况汇总",
    description:
      "员工某段时间拜访情况汇总:一次调用返回总拜访数、按天分布(dailyBreakdown)、按拜访类型/有效性/来源分布(byType/byValidity/bySource)、高频拜访医生 topHcps(前 10,姓名脱敏)、覆盖医生数 coveredHcpCount、协同拜访数 jointVisitCount、日均拜访 avgPerDay。适用场景:「看看某员工过去 2 周拜访情况」「某代表最近拜访了哪些医生、频率如何、有效拜访占比」。employeeId 与 employeeName 二选一,都不传用当前操作身份;from/to 缺省为最近 14 天(注意:种子数据基准日约为 2026-07-24,查历史数据请显式传日期范围,如 from=2026-07-11&to=2026-07-24)。",
    inputSchema: {
      employeeId: z.string().optional().describe("员工 id(与 employeeName 二选一;都不传则用当前操作身份)"),
      employeeName: z.string().optional().describe("员工姓名(与 employeeId 二选一),如「刘洋」"),
      from: z.string().optional().describe("起始日期(含),ISO 8601,如 2026-07-11;缺省 = to 往前 13 天"),
      to: z.string().optional().describe("截止日期(含),ISO 8601,如 2026-07-24;缺省 = 今天"),
    },
  },
  async ({ employeeId, employeeName, from, to }) =>
    callTool(async () => {
      let empId = employeeId;
      if (!empId && employeeName) {
        const emp = await findEmployee(employeeName);
        if (!emp) throw new CrmError(404, `未找到员工:「${employeeName}」。可用 list_employees 查看全部员工。`);
        empId = emp.id;
      }
      return crmFetch("/api/analytics/employee-visits", {
        query: { employeeId: requireEmployee(context, empId), from, to },
      });
    }),
);

// 26. get_my_day -------------------------------------------------------------
tool(
  "get_my_day",
  {
    title: "查看我的今日工作",
    description:
      "WorkBuddy 代表首页复合工具:一次返回当前登录代表的今日安排、待跟进、推荐客户和个人 KPI。身份固定取当前 JWT 会话,不能查询其他代表。",
    inputSchema: {
      asOf: z.string().optional().describe("演示统计基准日 YYYY-MM-DD,缺省使用 2026-07-24"),
    },
  },
  async ({ asOf }) =>
    callTool(() =>
      crmFetch("/api/agent/my-day", {
        query: {
          employeeId: requireEmployee(context),
          asOf: asOf ?? DEMO_AS_OF,
        },
      }),
    ),
);

// 27. prepare_hcp_visit -------------------------------------------------------
tool(
  "prepare_hcp_visit",
  {
    title: "生成 HCP 拜访前简报",
    description:
      "为当前登录代表组合 HCP 档案、多任职、最近拜访、待跟进任务、Account Plan、批准资料和可用样品库存。用于拜访前准备,不产生 CRM 写操作。",
    inputSchema: {
      hcpId: z.string().describe("要准备拜访的医生 id,可由 search_hcp 或 get_my_day 获得"),
    },
  },
  async ({ hcpId }) =>
    callTool(() =>
      crmFetch("/api/agent/prepare-visit", {
        query: { employeeId: requireEmployee(context), hcpId },
      }),
    ),
);

// 28. search_sales_intelligence ----------------------------------------------
tool(
  "search_sales_intelligence",
  {
    title: "检索销售情报与共享知识",
    description:
      "按自然语言检索行业政策、竞品动态、行业新闻、疾病知识和产品知识。默认只返回已核验内容;每条结果带来源、时间和核验状态。",
    inputSchema: {
      query: z.string().min(1).describe("检索问题或关键词,如「奥希替尼最近医保政策和竞品变化」"),
      types: z.array(z.enum(["POLICY", "COMPETITOR", "INDUSTRY_NEWS", "DISEASE_KNOWLEDGE", "PRODUCT_KNOWLEDGE"])).optional(),
      productId: z.string().optional().describe("限定 CRM 产品 id"),
      includePending: z.boolean().optional().default(false).describe("是否包含待核验线索;包含时不得作为确定性结论"),
      limit: z.number().int().min(1).max(20).optional().default(10),
    },
  },
  async ({ query, types, productId, includePending, limit }) =>
    callTool(() =>
      crmFetch("/api/agent/sales-intelligence/search", {
        query: {
          employeeId: requireEmployee(context),
          query,
          types: types?.join(","),
          productId,
          includePending: String(includePending ?? false),
          limit: limit ?? 10,
        },
      }),
    ),
);

// 29. get_product_battlecard --------------------------------------------------
tool(
  "get_product_battlecard",
  {
    title: "生成产品拜访应对卡",
    description:
      "组合产品、已核验政策、竞品动态、共享知识、准备问题和当前有效批准资料。内部参考与可对外使用材料分开展示并附来源。",
    inputSchema: {
      productId: z.string().describe("CRM 产品 id,可由 list_products 获得"),
      hcpId: z.string().optional().describe("可选 HCP id,保留用于客户场景说明"),
      asOf: z.string().optional().describe("材料有效性基准日 YYYY-MM-DD"),
    },
  },
  async ({ productId, hcpId, asOf }) =>
    callTool(() =>
      crmFetch("/api/agent/product-battlecard", {
        query: {
          employeeId: requireEmployee(context),
          productId,
          hcpId,
          asOf,
        },
      }),
    ),
);

// 30. refresh_product_intelligence -------------------------------------------
tool(
  "refresh_product_intelligence",
  {
    title: "确认并更新产品情报",
    description:
      "在用户明确确认后触发指定产品的互联网补充采集。返回采集任务和统计;相同幂等键重试不会重复创建任务。",
    inputSchema: {
      productId: z.string().describe("要更新的 CRM 产品 id"),
      confirmed: z.boolean().describe("只有用户明确确认触发互联网采集后才能传 true"),
      idempotencyKey: z.string().min(8).max(128).describe("稳定业务幂等键;网络重试必须复用"),
    },
  },
  async ({ productId, confirmed, idempotencyKey }) =>
    callTool(() => {
      if (!confirmed) throw new CrmError(400, "必须取得用户明确确认后才能更新产品情报");
      return crmFetch("/api/agent/refresh-intelligence", {
        method: "POST",
        body: {
          productId,
          employeeId: requireEmployee(context),
          confirmed: true,
          idempotencyKey,
        },
      });
    }),
);

// 31. complete_hcp_visit ------------------------------------------------------
tool(
  "complete_hcp_visit",
  {
    title: "确认并完成 HCP 拜访",
    description:
      "在用户明确确认后,以当前 WorkBuddy 登录代表身份一次写入拜访、资料/样品使用、签到和可选后续任务。必须提供稳定 idempotencyKey;相同内容重试返回原拜访,不会重复创建。",
    inputSchema: {
      idempotencyKey: z.string().min(8).max(128).describe("本次业务操作的稳定唯一键;网络重试必须复用同一个值"),
      confirmed: z.boolean().describe("只有用户明确确认写入 CRM 后才能传 true"),
      hcpId: z.string().describe("拜访医生 id"),
      hcoId: z.string().optional().describe("拜访机构 id;缺省可留空"),
      visitDate: z.string().optional().describe("ISO 8601 拜访时间,缺省当前时间"),
      type: z.enum(["FACE_TO_FACE", "PHONE", "CONFERENCE", "JOINT"]).optional(),
      purposes: z
        .array(z.enum(["产品信息传递", "临床信息沟通", "市场现状调研", "学术会议沟通", "其他"]))
        .optional(),
      outcome: z.string().optional(),
      duration: z.number().int().positive().optional(),
      notes: z.string().optional(),
      summary: z.string().optional(),
      nextStep: z.string().optional(),
      tourPlanItemId: z.string().optional().describe("从已批准计划转拜访时传计划项 id"),
      products: z.array(z.object({
        productId: z.string(),
        feedback: z.string().optional(),
      })).optional(),
      materialIds: z.array(z.string()).optional().describe("本次实际使用的已批准资料 id"),
      samples: z.array(z.object({
        lotId: z.string(),
        quantity: z.number().int().positive(),
        confirmedByHcp: z.boolean().optional(),
      })).optional(),
      checkin: z.object({
        locationName: z.string(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }).optional(),
      followUp: z.object({
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(["NORMAL", "HIGH"]).optional(),
        dueDate: z.string().optional(),
      }).optional(),
    },
  },
  async ({ idempotencyKey, confirmed, checkin, ...visit }) =>
    callTool(() =>
      crmFetch("/api/agent/complete-visit", {
        method: "POST",
        body: {
          employeeId: requireEmployee(context),
          idempotencyKey,
          requestId: randomUUID(),
          confirmed,
          visit: {
            ...visit,
            ...(checkin ? { checkins: [checkin] } : {}),
          },
        },
      }),
    ),
);

  toolCount = count;
  return server;
}

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------

async function resolveInitialEmployee() {
  try {
    if (envEmployeeId || envEmployeeName) {
      const emp = await findEmployee(envEmployeeId ?? envEmployeeName!);
      if (emp) {
        currentEmployee = {
          userId: `stdio:${emp.id}`,
          employeeId: emp.id,
          employeeName: emp.name,
          role: emp.role,
          division: emp.division,
          departmentId: emp.departmentId ?? undefined,
        };
        console.error(`[mcp-server] 当前操作身份:${emp.name}(${emp.role}, id=${emp.id})`);
        return;
      }
      console.error(`[mcp-server] 警告:未找到指定员工「${envEmployeeId ?? envEmployeeName}」,身份留空`);
      return;
    }
    // 未指定:默认取第一位医药代表(MR),方便开箱即用
    const res = await crmFetch<{ data: EmployeeNode[] }>("/api/employees");
    const mr = flattenEmployees(res.data ?? []).find((e) => e.role === "MR");
    if (mr) {
      currentEmployee = {
        userId: `stdio:${mr.id}`,
        employeeId: mr.id,
        employeeName: mr.name,
        role: mr.role,
        division: mr.division,
        departmentId: mr.departmentId ?? undefined,
      };
      console.error(`[mcp-server] 未指定员工,默认取第一位 MR:${mr.name}(id=${mr.id}),可用 set_current_employee 切换`);
    }
  } catch (e) {
    console.error(
      `[mcp-server] 警告:启动时无法连接 CRM 解析默认员工(${(e as Error).message})。` +
        `请确认 CRM 已在 ${BASE_URL} 运行;之后可用 set_current_employee 设置身份。`,
    );
  }
}

// ---------------------------------------------------------------------------
// HTTP(Streamable HTTP)传输:有状态模式,每个 sessionId 一个 transport 实例
// ---------------------------------------------------------------------------

const MCP_PORT = Number(process.env.MCP_PORT ?? 5620);
const MCP_HOST = process.env.MCP_HOST ?? "0.0.0.0";
const WORKBUDDY_JWT_SECRET = process.env.WORKBUDDY_JWT_SECRET;
const WORKBUDDY_JWT_ISSUER = process.env.WORKBUDDY_JWT_ISSUER ?? "workbuddy-local";
const WORKBUDDY_JWT_AUDIENCE = process.env.WORKBUDDY_JWT_AUDIENCE ?? "pharma-crm-mcp";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function authenticateHttpRequest(req: IncomingMessage): Promise<SessionActor> {
  if (!WORKBUDDY_JWT_SECRET) {
    throw new AuthError("INVALID_CLAIMS", "MCP HTTP 模式缺少 WORKBUDDY_JWT_SECRET");
  }
  const claims = verifyWorkBuddyJwt(bearerToken(req.headers.authorization), {
    secret: WORKBUDDY_JWT_SECRET,
    issuer: WORKBUDDY_JWT_ISSUER,
    audience: WORKBUDDY_JWT_AUDIENCE,
  });
  const employee = await crmFetch<EmployeeNode>(
    `/api/employees/${encodeURIComponent(claims.employeeId)}`,
  ).catch((error: unknown) => {
    if (error instanceof CrmError && error.status === 404) return null;
    throw error;
  });
  return mapClaimsToEmployee(claims, employee);
}

async function startHttpServer() {
  if (!WORKBUDDY_JWT_SECRET) {
    throw new Error("HTTP 模式必须设置 WORKBUDDY_JWT_SECRET");
  }
  // sessionId → transport + immutable actor
  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; context: SessionContext }
  >();

  const httpServer = createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (url.pathname === "/health" && req.method === "GET") {
        sendJson(res, 200, { ok: true, tools: toolCount });
        return;
      }
      if (url.pathname !== "/mcp") {
        sendJson(res, 404, { error: "Not Found。MCP endpoint:POST/GET/DELETE /mcp;健康检查:GET /health" });
        return;
      }

      const requestActor = await authenticateHttpRequest(req);
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (req.method === "POST") {
        const raw = await readBody(req);
        let body: unknown;
        try {
          body = raw ? JSON.parse(raw) : undefined;
        } catch {
          sendJson(res, 400, { jsonrpc: "2.0", error: { code: -32700, message: "Parse error:请求体不是合法 JSON" }, id: null });
          return;
        }
        // 已有 session:按 sessionId 路由
        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          assertSessionRequestActor(session.context, requestActor);
          await session.transport.handleRequest(req, res, body);
          return;
        }
        // 新 session:仅 initialize 请求可建立
        if (!sessionId && isInitializeRequest(body)) {
          const context: SessionContext = { mode: "jwt", actor: requestActor };
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            // POST 直接返回 JSON 响应(不包 SSE),便于简单客户端集成;GET 仍支持 SSE 流
            enableJsonResponse: true,
            onsessioninitialized: (sid) => {
              sessions.set(sid, { transport, context });
            },
          });
          transport.onclose = () => {
            if (transport.sessionId) sessions.delete(transport.sessionId);
          };
          const server = createMcpServer(context);
          await server.connect(transport);
          await transport.handleRequest(req, res, body);
          return;
        }
        sendJson(res, 400, {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request:缺失或无效的 mcp-session-id;新会话请先发送 initialize" },
          id: null,
        });
        return;
      }

      if (req.method === "GET" || req.method === "DELETE") {
        if (!sessionId || !sessions.has(sessionId)) {
          sendJson(res, 400, {
            jsonrpc: "2.0",
            error: { code: -32000, message: "Bad Request:缺失或无效的 mcp-session-id" },
            id: null,
          });
          return;
        }
        const session = sessions.get(sessionId)!;
        assertSessionRequestActor(session.context, requestActor);
        await session.transport.handleRequest(req, res);
        return;
      }

      sendJson(res, 405, { error: "Method Not Allowed" });
    } catch (e) {
      console.error("[mcp-server] HTTP 请求处理失败:", e);
      if (!res.headersSent) {
        const status = e instanceof AuthError ? 401 : e instanceof CrmError && e.status === 404 ? 401 : 500;
        sendJson(res, status, { error: (e as Error).message });
      }
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(MCP_PORT, MCP_HOST, resolve));
  // 预建一份只为初始化 toolCount,使首个 session 建立前 /health 也能返回正确工具数
  if (toolCount === 0) createMcpServer({ mode: "jwt", actor: null });
  console.error(
    `[mcp-server] pharma-crm MCP server 已启动(Streamable HTTP,${toolCount} 个工具),` +
      `endpoint=http://${MCP_HOST}:${MCP_PORT}/mcp,health=http://${MCP_HOST}:${MCP_PORT}/health,` +
      `鉴权=WorkBuddy JWT(HS256),CRM=${BASE_URL}`,
  );
}

async function main() {
  const useHttp = process.argv.includes("--http") || process.env.MCP_TRANSPORT === "http";
  await resolveInitialEmployee();
  if (useHttp) {
    await startHttpServer();
    return;
  }
  const server = createMcpServer({ mode: "stdio", actor: currentEmployee });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp-server] pharma-crm MCP server 已启动(stdio,${toolCount} 个工具),CRM=${BASE_URL}`);
}

main().catch((e) => {
  console.error("[mcp-server] 启动失败:", e);
  process.exit(1);
});
