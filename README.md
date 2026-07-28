# Pharma CRM(药企销售代表 CRM)

一套面向**医药代表(MR/SFA 场景)**的演示用 CRM 系统:中文前端 + REST API + **MCP Server**,
外部 AI 助手(类似 workbuddy)可通过 Model Context Protocol 直接操作整套 CRM——
搜索医生、记录拜访、扣减样品库存、提交周计划审批、读取 KPI 与辖区绩效。

> 演示项目。种子数据基准日为 **2026-07-24**;开源界缺少成熟的 pharma CRM 与 pharma MCP
> server,本项目为填补该空白的演示实现(设计溯源见 [DESIGN.md](./DESIGN.md))。

## P0 销售日常闭环

当前演示版已打通五条核心产品链路：

- 周计划创建/编辑、审批、周日历与计划转拜访。
- HCP 拜访前简报、结构化后续任务、完成/取消与复访草稿。
- 经理待办、异常签到、逾期任务与辅导行动。
- 样品领用、拜访发放、退回、盘点调整和批次流水。
- 会议创建、邀请、签到/缺席、结束和批量生成跟进任务。

完整演示步骤见 [Pharma Sales P0 演示脚本](./docs/product/pharma-sales-p0-demo-script.md)。

## 对照外部 CRM 导出格式的字段补全(第二阶段)

项目支持从外部 CRM 拜访导出格式导入数据,并据此补齐以下领域字段:

- **五级行政部门树 Department**(事业部→战区→分管区→区→办事处),独立于 Territory 辖区;员工带工号 `employeeCode`(YG1001+),HCP/HCO 带客户/医院编码 `code`(DR0001+/HOS001+)。
- **结构化拜访目的 `purposes`**:支持「产品信息传递，临床信息沟通」式逗号组合存储(旧自由文本 `purpose` 保留)。
- **人工总结 `summary` 与 AI 摘要 `aiSummary` 并存**;**数据来源 `source`**(MANUAL/AI/IMPORT)。
- **报告接收人 `receiverId` + 有效性评定**:经理在收件箱(`/evaluations` 页、`GET /api/evaluations/pending`)对收到的拜访标 有效/无效(无效必须填原因:重复/内容过短/签到地点不对/结果未体现),重复评定返回 409。
- **签到 CheckIn**:每条拜访绑定签到(时间/地点/经纬度),地点与拜访机构不一致自动标记 `LOCATION_MISMATCH`(地点异常)。

涉及的新接口:`POST /api/visits/:id/evaluate`、`POST /api/visits/:id/checkins`、`GET /api/evaluations/pending`、`GET /api/departments`(契约详见 [API.md](./API.md));
MCP 工具同步从 13 个扩展到 **17 个**(新增 `evaluate_visit`、`list_pending_evaluations`、`list_departments`、`check_in`)。

## 功能截图

<!-- TODO: 截图占位 -->
| 仪表盘 | HCP 360 | 拜访记录 |
|---|---|---|
| ![dashboard](docs/screenshots/dashboard.png) | ![hcp360](docs/screenshots/hcp360.png) | ![visits](docs/screenshots/visits.png) |

| 周计划审批 | 样品库存 | 辖区绩效 |
|---|---|---|
| ![tourplan](docs/screenshots/tourplan.png) | ![samples](docs/screenshots/samples.png) | ![territory](docs/screenshots/territory.png) |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库(SQLite)
npx prisma migrate dev

# 3. 写入种子数据(员工 9 · HCP 30 · 拜访 507 · 样品批次 7 …)
npx prisma db seed

# 4. 启动 CRM(前端 + REST API,端口 5618)
npm run dev          # http://localhost:5618

# 5. 启动 MCP server(供外部 AI 助手接入,另开一个终端)
cd mcp-server
npm install
npm start            # stdio 传输,等待 MCP 客户端连接
```

MCP 客户端(Claude Desktop 等)配置方式见 [mcp-server/README.md](./mcp-server/README.md)。

## 架构

```
┌────────────────────────────────────────────────────────────┐
│  外部 AI 助手(workbuddy / Claude Desktop / MCP client)     │
└──────────────────────┬─────────────────────────────────────┘
                       │ MCP protocol(JSON-RPC over stdio)
                       ▼
┌────────────────────────────────────────────────────────────┐
│  mcp-server/  MCP Server(17 个原子工具,tsx/ts-node)       │
│  · search_hcp / get_hcp_360 / log_visit / list_visits …    │
│  · 内存态"当前操作身份"(CRM_EMPLOYEE_ID / set_current_…)  │
└──────────────────────┬─────────────────────────────────────┘
                       │ fetch(REST,CRM_BASE_URL)
                       ▼
┌────────────────────────────────────────────────────────────┐
│  pharma-crm  Next.js 15(App Router,端口 5618)             │
│  ├─ src/app/**/route.ts   REST API(/api/hcp, /api/visits…)│
│  └─ src/app/(pages)       中文前端(仪表盘/HCP/拜访/计划…) │
└──────────────────────┬─────────────────────────────────────┘
                       │ Prisma Client
                       ▼
┌────────────────────────────────────────────────────────────┐
│  SQLite(prisma/dev.db)                                    │
│  Employee/Territory/Hco/Hcp/Product/Visit/TourPlan/        │
│  SampleLot/SampleTransaction/MedEvent/Target               │
└────────────────────────────────────────────────────────────┘
```

## 目录结构

```
pharma-crm/
├── API.md                 # REST API 契约(MCP server 的封装依据)
├── DESIGN.md              # 设计溯源:各核心设计借鉴的开源项目与理由
├── prisma/
│   ├── schema.prisma      # 领域模型(组织树/辖区树/HCP/拜访/样品/周计划…)
│   ├── migrations/
│   └── seed.ts            # 种子数据(基准日 2026-07-24)
├── src/
│   ├── app/
│   │   ├── api/           # REST API route handlers
│   │   └── …              # 中文前端页面(仪表盘、HCP、拜访、周计划、样品、分析)
│   ├── components/
│   └── lib/
├── mcp-server/            # MCP Server 独立子包(不污染主应用)
│   ├── src/index.ts       # 17 个工具注册 + CRM fetch 封装 + 身份状态
│   ├── scripts/smoke-test.mjs  # stdio JSON-RPC 协议级冒烟测试
│   └── README.md          # 安装/启动/MCP 客户端配置
└── package.json
```

## 技术栈

- **应用框架**:Next.js 15(App Router,Route Handler 即 API)+ React 19 + TypeScript
- **数据层**:Prisma 6 + SQLite(零外部依赖,开箱即跑)
- **前端**:Tailwind CSS 4 + Recharts(中文 UI)
- **MCP Server**:`@modelcontextprotocol/sdk`(stdio 传输)+ zod + tsx
- **测试**:`mcp-server/scripts/smoke-test.mjs`(initialize → tools/list → tools/call 协议级冒烟)

## 常用命令

```bash
npm run dev            # CRM dev server,端口 5618
npm run build          # 生产构建(含类型检查与 ESLint)
npm test               # 领域规则与演示场景测试
npx prisma migrate dev # 应用迁移
npx prisma db seed     # 重置并写入种子数据
npx prisma studio      # 数据浏览
cd mcp-server && npm start                # MCP server(stdio)
cd mcp-server && node scripts/smoke-test.mjs  # MCP 冒烟测试(需 CRM 已启动)
```

## HCP 多任职演示

进入“个人客户”，打开 `DR0001 张明远` 的详情页即可看到两条当前任职；`DR0002 李慧敏` 同时包含历史任职和当前主要任职。

推荐演示路径：

1. 在张明远的“任职经历”中，将苏州市立医院设为主要任职。
2. 观察页面头部、工作单位、科室、职称和行政职务同步变化。
3. 结束该主要任职，系统会自动将仍有效的苏州大学附属第一医院任职晋升为主要任职。
4. 使用“新增任职”和“编辑”演示机构、科室、职称、行政职务及有效日期维护。

科室在演示版本中使用文本字段；原有拜访、会议和客户筛选继续读取 HCP 的主要任职兼容字段。
