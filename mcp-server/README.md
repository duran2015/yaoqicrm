# pharma-crm-mcp-server

药企销售代表 CRM 的 **MCP(Model Context Protocol)Server**。它把 CRM 的 REST API
(`http://localhost:5618/api/...`,契约见项目根目录 `API.md`)封装为 25 个 AI 友好的原子工具,
让外部 AI 可以搜索医生、记录拜访(含签到)、评定拜访有效性、查询库存、提交周计划、
读取 KPI 与辖区绩效、汇总员工拜访情况。

支持两种传输方式:

| 模式 | 启动 | 适用场景 |
|---|---|---|
| **stdio**(默认) | `npm start` | 本地 MCP 客户端(Claude Desktop 等) |
| **Streamable HTTP** | `npm run start:http` | 远程 MCP 客户端(部署到服务器后,AI 工具通过 HTTP 连接) |

## 前置条件

**CRM 主应用必须先启动**(MCP server 只是 API 的封装层):

```bash
# 在项目根目录(pharma-crm/)
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev          # http://localhost:5618
```

## 安装与启动

```bash
cd mcp-server
npm install
npm run build        # 可选:tsc 编译到 dist/
npm start            # stdio:tsx 直接运行 src/index.ts
npm run start:http   # HTTP:tsx src/index.ts --http,监听 5620
# 或编译后:node dist/index.js [--http]
```

stdio 模式下进程在 stdio 上等待 MCP 客户端连接,日志输出到 stderr(不影响协议)。

### 配置项

| 来源 | 名称 | 说明 | 默认 |
|---|---|---|---|
| 环境变量 | `CRM_BASE_URL` | CRM 后端地址 | `http://localhost:5618` |
| 环境变量 | `CRM_EMPLOYEE_ID` | 默认操作身份(员工 id) | 未指定时取第一位 MR |
| 环境变量 | `MCP_TRANSPORT` | 设为 `http` 等效于 `--http` 参数 | stdio |
| 环境变量 | `MCP_PORT` | HTTP 模式监听端口 | `5620` |
| 环境变量 | `MCP_HOST` | HTTP 模式监听地址 | `0.0.0.0` |
| 环境变量 | `MCP_AUTH_TOKEN` | HTTP 模式 Bearer 鉴权 token(见下) | 未设置=不鉴权 |
| 启动参数 | `--http` | 以 Streamable HTTP 模式启动 | — |
| 启动参数 | `--employee-id <id>` | 指定默认身份(优先级高于环境变量) | — |
| 启动参数 | `--employee-name <姓名>` | 按姓名指定默认身份 | — |

运行时可用 `set_current_employee` 工具随时切换身份(内存状态,随进程生命周期;
HTTP 模式下为所有 session 共享的服务级状态)。

## HTTP(Streamable HTTP)模式

```bash
MCP_AUTH_TOKEN=请换成强随机串 npm run start:http
```

- **Endpoint**:`POST/GET/DELETE http://<host>:5620/mcp`(MCP Streamable HTTP 标准)
- **健康检查**:`GET http://<host>:5620/health` → `{"ok":true,"tools":25}`
- **鉴权**:设置了 `MCP_AUTH_TOKEN` 后,**所有** HTTP 请求(含 `/health`)必须携带
  `Authorization: Bearer <MCP_AUTH_TOKEN>`,否则返回 401;未设置则全部放行(方便本地开发)。
  stdio 模式不鉴权。**公网部署务必设置强随机 token。**
- **Session 管理**:有状态模式。客户端先发 `initialize` 建立会话,响应头
  `mcp-session-id` 返回会话 id;后续请求(含 `tools/list`、`tools/call`)需携带
  `mcp-session-id` 头;`DELETE /mcp` 关闭会话并清理资源。POST 响应为 JSON
  (`enableJsonResponse`),GET 仍支持 SSE 流。

### 远程 MCP 客户端配置示例

支持远程(Streamable HTTP)MCP 的客户端,配置 URL + Authorization 头即可:

```json
{
  "mcpServers": {
    "pharma-crm": {
      "url": "http://<服务器IP或域名>:5620/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_AUTH_TOKEN>"
      }
    }
  }
}
```

curl 手工验证:

```bash
TOKEN=<MCP_AUTH_TOKEN>
curl -s http://localhost:5620/health -H "Authorization: Bearer $TOKEN"
# initialize(保存响应头里的 mcp-session-id)
curl -si http://localhost:5620/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0.1"}}}'
# 之后用同一 session 调 tools/list 等:
curl -s http://localhost:5620/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <上一步响应头中的 session id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

也可运行脚本化冒烟(需 CRM 已在 5618 运行):

```bash
node scripts/smoke-test-http.mjs                 # 未设 token 的场景
MCP_AUTH_TOKEN=xxx node scripts/smoke-test-http.mjs   # 会额外验证 401/200 鉴权链路
```

## 本地 stdio 客户端配置

通用 `mcpServers` 配置块(Claude Desktop / 任意支持 stdio 的 MCP client 均适用,
把 `command`/路径替换为实际值):

```json
{
  "mcpServers": {
    "pharma-crm": {
      "command": "npx",
      "args": ["tsx", "/绝对路径/pharma-crm/mcp-server/src/index.ts"],
      "env": {
        "CRM_BASE_URL": "http://localhost:5618",
        "CRM_EMPLOYEE_ID": ""
      }
    }
  }
}
```

编译后运行的等价配置:

```json
{
  "mcpServers": {
    "pharma-crm": {
      "command": "node",
      "args": ["/绝对路径/pharma-crm/mcp-server/dist/index.js"],
      "env": { "CRM_BASE_URL": "http://localhost:5618" }
    }
  }
}
```

Claude Desktop 配置文件位置:
- macOS:`~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows:`%APPDATA%\Claude\claude_desktop_config.json`

## 工具清单(25 个)

| 工具名 | 说明 | 对应 REST API |
|---|---|---|
| `search_hcp` | 按姓名/分级/医院/科室搜索医生(返回含客户编码 code) | `GET /api/hcp` |
| `get_hcp_360` | 医生全景:资料 + 拜访历史(含有效性/来源/签到)+ 样品 + 参会 | `GET /api/hcp/:id` |
| `log_visit` | 记录一次拜访(结构化目的 purposes、人工总结 summary、接收人 receiverId、签到 checkin、讨论产品、发放样品;样品自动扣库存) | `POST /api/visits` |
| `list_visits` | 查询拜访记录(按代表/医生/日期范围/类型/有效性/来源) | `GET /api/visits` |
| `update_visit_ai_fields` | 回写拜访 AI 富化字段(aiSummary/aiSentiment/nextStep) | `PATCH /api/visits/:id` |
| `evaluate_visit` | 经理评定拜访有效性(VALID/INVALID,无效必须给原因;重复评定报 409) | `POST /api/visits/:id/evaluate` |
| `list_pending_evaluations` | 我的待评定收件箱(接收人是我 且 未反馈 的拜访) | `GET /api/evaluations/pending` |
| `list_departments` | 五级行政部门树(事业部→战区→分管区→区→办事处) | `GET /api/departments` |
| `check_in` | 为已有拜访补签到(地点不一致自动标记地点异常) | `POST /api/visits/:id/checkins` |
| `get_tour_plan` | 查看某代表某周拜访计划及审批状态 | `GET /api/tour-plans` |
| `submit_tour_plan` | 提交周计划审批(DRAFT/REJECTED → SUBMITTED) | `POST /api/tour-plans/:id/submit` |
| `get_sample_inventory` | 代表样品库存(按产品聚合 + 批次明细) | `GET /api/samples/inventory` |
| `get_dashboard_kpis` | 仪表盘 KPI(今日拜访/周计划完成率/月目标达成/趋势/分级分布/待评定数,asOf 默认 2026-07-24) | `GET /api/analytics/dashboard` |
| `analyze_territory_performance` | 团队辖区绩效:按代表聚合拜访数/覆盖/A 级覆盖率(管理者用) | `GET /api/analytics/territory` |
| `summarize_employee_visits` | 员工某段时间拜访情况汇总:按天/类型/有效性/来源分布 + 高频拜访医生前 10(默认当前身份、最近 14 天) | `GET /api/analytics/employee-visits` |
| `list_products` | 产品目录(品牌/分子/治疗领域 + 样品批次) | `GET /api/products` |
| `list_employees` | 组织架构 / 员工列表(含汇报关系、工号、部门路径) | `GET /api/employees` |
| `set_current_employee` | 切换当前操作身份(参数 name 或 id,内存状态) | `GET /api/employees` 匹配 |
| `get_customer_stats` | 客户分级统计卡(total/mine/ungraded/A~D) | `GET /api/customers/stats` |
| `create_customer_application` | 新建建档申请(草稿/提交,APPROVE 自动落地档案) | `POST /api/applications` |
| `list_customer_applications` | 查询建档申请(按状态/类型过滤) | `GET /api/applications` |
| `review_customer_application` | 审核建档申请(APPROVE/REJECT) | `POST /api/applications/:id/review` |
| `assign_customer` | 给客户分配合作代表(OWNER/COLLAB) | `POST /api/assignments` |
| `update_customer_tier` | 调整客户分级 A/B/C/D(自动写变更历史) | `POST /api/hcp|hco/:id/tier` |
| `get_hco_360` | 医院全景:档案 + 科室 + 进院产品 + 国考成绩 + 院内医生 | `GET /api/hco/:id` |

所有工具的参数描述均为中文(LLM 靠 description 选择工具);返回内容为 text content
包裹的 `JSON.stringify` 结果。CRM 返回非 2xx 时,后端 `{error}` 信息会原样透传为
MCP 错误(`isError: true`),不会让 LLM 拿到空响应。

## 开发

```bash
npm run build          # tsc → dist/
npm start              # tsx src/index.ts(stdio)
npm run start:http     # tsx src/index.ts --http(Streamable HTTP,5620)
node scripts/smoke-test.mjs       # stdio 协议级冒烟(需 CRM 已启动)
node scripts/smoke-test-http.mjs  # HTTP 模式冒烟(需 CRM 已启动 + MCP HTTP 已启动)
```

目录结构:

```
mcp-server/
├── package.json
├── tsconfig.json
├── README.md
├── scripts/
│   ├── smoke-test.mjs        # stdio 冒烟
│   └── smoke-test-http.mjs   # HTTP 冒烟
└── src/
    └── index.ts    # 全部工具注册 + CRM fetch 封装 + 身份状态 + stdio/HTTP 双传输
```
