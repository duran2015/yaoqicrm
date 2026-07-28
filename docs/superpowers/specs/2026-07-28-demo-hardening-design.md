# Pharma CRM 演示增强版设计

日期：2026-07-28  
状态：已确认范围，待实施计划  
目标周期：10–15 个工作日

## 1. 目标

把现有 Pharma CRM 从“能运行的业务原型”提升为“可公开宣传、可稳定演示、可与本地部署 WorkBuddy 通过 MCP 完成可信业务闭环”的版本。

本次不追求真实药企生产上线。验收重点是：

1. 演示用户不能任意冒充其他员工。
2. Agent 的读取和写入都绑定明确身份与角色。
3. 高价值流程能从页面和 Agent 两条入口完成。
4. 写操作可追踪、可去重、可预览。
5. 窄屏和平板尺寸下关键演示页面可正常使用。
6. 演示脚本可重复运行，不依赖人工修改数据库。

## 2. 明确不做

以下能力延后到获得客户并进入试点后：

- PostgreSQL 迁移
- 多租户
- 原生 iOS/Android 应用
- 完整离线同步与冲突解决
- 企业 SSO 的真实供应商联调
- 通用工作流引擎
- 消息队列和通用事件平台
- 电子签名及正式样品监管
- 批准内容库、合规邮件
- 全量个人信息治理后台
- 自建日志、指标、追踪平台
- 通用 Agent 评测平台

SQLite、Next.js、Prisma 和现有 MCP SDK 保持不变。

## 3. 设计原则

### 3.1 复用优先

- 复用现有 `Employee`、组织树和辖区关系，不建立第二套用户目录。
- 复用 `CustomerApplication`、`TourPlan`、拜访评定状态，不引入工作流引擎。
- 复用现有 REST API，MCP 只做身份注入、参数约束和业务编排。
- 复用现有页面组件和视觉语言，只修复演示阻断项。
- 复用 stdout/PM2 日志和 SQLite 备份，不引入观测平台。

### 3.2 服务端决定权限

前端、MCP 参数和 Agent 提示都不是权限来源。每个 API Route 在服务端取得 `AuthContext` 后执行策略检查。

### 3.3 Agent 默认先建议、后提交

复合工具默认返回预览。涉及业务写入的工具明确区分 `preview` 与 `commit`；`commit` 必须提供幂等键。

### 3.4 演示数据可重置

所有宣传演示使用 seed 数据。新增演示重置脚本恢复固定场景，禁止依赖从服务器复制的真实数据库。

## 4. 认证与身份

### 4.1 标准接口

WorkBuddy 视为可信身份提供方或网关，采用标准 Bearer JWT。CRM 通过配置的 Issuer、Audience 和 JWKS 验证签名。

最小 claims：

```ts
type WorkBuddyClaims = {
  sub: string;
  employee_id: string;
  role: "MR" | "ASM" | "RSM" | "ADMIN";
  department_id?: string;
  iss: string;
  aud: string | string[];
  exp: number;
};
```

单企业演示版不要求 `tenantId`。未来多租户改造时再加入，不提前污染所有查询。

### 4.2 统一认证上下文

```ts
type AuthContext = {
  userId: string;
  employeeId: string;
  role: "MR" | "ASM" | "RSM" | "ADMIN";
  departmentId: string | null;
  source: "web" | "mcp";
};
```

Web 请求从 HttpOnly Session Cookie 获取 JWT；MCP 请求从 `Authorization: Bearer` 获取 JWT。二者调用同一个验证函数。

### 4.3 演示登录

在 `DEMO_AUTH_ENABLED=true` 时提供演示登录页，只有三个固定 persona：

- 医药代表
- 地区经理
- 管理员

演示登录由服务端签发短期 HttpOnly Cookie。生产配置未显式开启时，演示登录路由返回 404。

现有“全员身份下拉框”从生产 UI 移除。开发环境可保留在独立调试区，但不作为权限实现。

## 5. RBAC 与数据范围

只实现演示需要的三层策略，不建设通用权限配置后台。

| 操作 | MR | ASM/RSM | ADMIN |
|---|---|---|---|
| 查看客户与拜访 | 自己负责/协作的客户及自己的拜访 | 下属部门范围 | 全部演示数据 |
| 创建拜访、签到 | 自己 | 可代录但记录真实 actor | 可 |
| 建档申请 | 可发起 | 可发起/审核下属申请 | 可 |
| 拜访评定 | 不可 | 仅收到或下属的拜访 | 可 |
| 周计划 | 自己创建/提交 | 查看和审批下属计划 | 可 |
| 客户分级/分配 | 仅发起建议 | 部门范围内执行 | 可 |
| 样品事务 | 自己库存和发放 | 查看下属汇总 | 可 |

策略以函数实现：

```ts
authorize(ctx, action, resource): Promise<void>
scopeFor(ctx, resourceType): Promise<PrismaWhereInput>
```

未经授权统一返回 `403` 和稳定错误码 `FORBIDDEN`。

## 6. 审计与幂等

### 6.1 AuditLog

新增最小审计表：

```prisma
model AuditLog {
  id            String   @id @default(cuid())
  actorId       String
  actorRole     String
  source        String
  action        String
  resourceType  String
  resourceId    String?
  requestId     String
  summary       String
  beforeJson    String?
  afterJson     String?
  createdAt     DateTime @default(now())
}
```

演示版只审计关键写操作：

- 拜访创建和 AI 字段更新
- 签到
- 拜访评定
- 客户建档申请和审核
- 客户分级和分配
- 周计划提交和审核
- 样品发放

不建设审计搜索后台；经理工作台只展示最近审计活动。

### 6.2 IdempotencyRecord

```prisma
model IdempotencyRecord {
  id             String   @id @default(cuid())
  actorId        String
  operation      String
  key            String
  requestHash    String
  responseJson   String
  resourceId     String?
  createdAt      DateTime @default(now())

  @@unique([actorId, operation, key])
}
```

相同 actor、operation、key 和 requestHash 返回第一次结果。相同 key 但请求内容不同返回 `409 IDEMPOTENCY_CONFLICT`。

幂等只覆盖 MCP 写工具和演示中会被重复调用的 REST 写接口。

## 7. MCP 身份与工具设计

### 7.1 身份绑定

- 移除 MCP 生产工具 `set_current_employee`。
- MCP Session 创建时从 JWT 建立固定 `AuthContext`。
- 工具 handler 不再接受可冒充 actor 的 `employeeId`、`evaluatorId`、`changedById`。
- 查询其他员工只允许作为筛选对象，且必须通过 RBAC 数据范围校验。

### 7.2 现有工具瘦身

- 列表默认 `limit=20`，最大 `limit=100`。
- 统一 cursor 分页返回：

```ts
type Page<T> = {
  items: T[];
  nextCursor: string | null;
  total?: number;
};
```

- 默认返回摘要字段；360 工具返回详情。
- 错误统一为：

```ts
type ToolError = {
  code:
    | "UNAUTHENTICATED"
    | "FORBIDDEN"
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "IDEMPOTENCY_CONFLICT"
    | "CONFIRMATION_REQUIRED"
    | "CONFLICT";
  message: string;
  retryable: boolean;
};
```

### 7.3 复合工具

本期只新增六个工具：

1. `prepare_visit_brief`
   - 汇总 HCP/HCO、近期拜访、产品反馈、未完成 nextStep。
2. `recommend_next_best_customers`
   - 用确定性规则按分级、覆盖间隔、未完成动作排序。
3. `draft_week_plan`
   - 生成周计划草稿，不直接提交。
4. `capture_visit_notes`
   - 将自然语言整理为拜访草稿；`mode=commit` 时创建拜访。
5. `propose_follow_up_actions`
   - 根据拜访输出结构化后续动作，不直接写 CRM。
6. `explain_kpi_gap`
   - 解释计划、覆盖和拜访目标差距，返回证据字段。

本期不引入向量数据库、RAG 框架或模型服务。复合工具基于 CRM 结构化数据和确定性规则；自然语言生成由 WorkBuddy 完成。

## 8. 业务演示闭环

### 8.1 MR 流程

1. 登录为 MR。
2. 首页查看今日计划、待跟进和推荐客户。
3. 打开 HCP 360 和拜访准备摘要。
4. Agent 生成拜访记录草稿。
5. 用户确认后提交拜访、签到和产品反馈。
6. Agent 生成后续动作。
7. 首页 KPI 和最近拜访立即更新。

### 8.2 经理流程

1. 登录为经理。
2. 查看团队今日执行、待评定拜访、待审批建档和计划。
3. 打开拜访详情与异常提示。
4. 完成有效性评定或驳回。
5. 查看最近 Agent/用户审计活动。

### 8.3 样品流程

只演示：

- 查看个人库存和临期批次
- 在拜访提交时预览样品发放
- 用户确认后扣减
- 阻止负库存和重复提交
- 经理查看团队汇总

不演示电子签名、退回、盘点和召回。

## 9. 页面调整

只修复关键演示页面：

- 登录页
- 仪表盘
- HCP 列表与详情
- 拜访记录与表单
- 周计划
- 样品库存
- 经理工作台

统一要求：

- 768px 平板宽度和 1280px 桌面宽度无横向页面溢出。
- 宽表在平板改为卡片或内部横向滚动。
- 空状态提供唯一明确主操作。
- 角色无权限页保持正常排版并提供返回入口。
- emoji 导航图标替换为现有图标库；本期不重做品牌系统。

## 10. 测试策略

### 10.1 单元测试

- JWT 验证与 claims 映射
- RBAC action 和 scope
- 幂等重复与冲突
- 审计写入
- 推荐客户确定性排序
- KPI 解释规则

### 10.2 API 集成测试

- MR 不能读取非归属客户的敏感详情
- MR 不能评定拜访
- 经理只能审批下属范围
- MCP actor 参数不能覆盖 JWT 身份
- 相同幂等键不会重复创建拜访或扣减样品

### 10.3 MCP 测试

- 未认证拒绝
- JWT 过期、错误 audience、未知员工拒绝
- 列表分页和最大返回量
- 六个复合工具输出契约
- preview 不写数据库，commit 只写一次

### 10.4 浏览器演示测试

用 Playwright 覆盖 MR 和经理两条演示流程，并在 768×1024、1280×800 两种尺寸截图。

## 11. 工作包与工期

### WP1：身份、RBAC、审计底座（2–3 天）

- JWT/JWKS 和演示登录
- AuthContext
- 三角色策略
- AuditLog 与 IdempotencyRecord
- 单元/集成测试

验收：所有关键 API 在无身份时拒绝；MR/经理数据范围测试通过；关键写操作有审计。

### WP2：MCP 身份绑定与写入安全（2 天）

- 每 Session 固定 actor
- 删除生产身份切换
- 写工具去除 actor 参数
- preview/commit、幂等和统一错误
- 分页/限量

验收：Agent 无法冒充其他员工；重复提交不产生重复数据；大列表不会撑爆上下文。

### WP3：MR 演示闭环（2–3 天）

- 首页行动区
- 拜访准备
- 拜访草稿与确认
- 后续动作
- 相关复合工具

验收：MR 页面和 WorkBuddy 两条路径均能完成一次完整拜访闭环。

### WP4：经理与样品演示闭环（2–3 天）

- 经理工作台
- 评定/审批聚合
- 样品预览、扣减和负库存保护
- 最近审计活动

验收：经理能处理 MR 产生的待办；样品扣减可审计且幂等。

### WP5：响应式与演示包装（1–2 天）

- 七个关键页面修复
- 固定 seed 和 reset
- 演示 persona、脚本和 README

验收：两种目标尺寸无页面级横向溢出，演示可一键重置并按脚本重复。

### WP6：回归和宣传验收（1–2 天）

- API、MCP、浏览器回归
- 权限负向测试
- 演示录像前的稳定性检查
- 已知限制清单

验收：完整演示连续运行三次无人工修库、无身份串线、无重复写入。

总计：10–15 个工作日。若只有一名实现者且需要同时制作宣传素材，使用上限；两名实现者并行处理后端/MCP与页面，可接近下限。

## 12. 交付物

- 可重复启动的演示 CRM
- WorkBuddy MCP 配置示例
- MR 与经理演示账号/persona
- 两条端到端演示脚本
- 固定 seed 与 reset 命令
- API/MCP/浏览器测试
- 安全边界和延后能力清单

## 13. 后续升级触发条件

出现以下任一条件时，再启动试点版设计：

- 已有首个付费或明确试点客户
- 需要导入客户真实数据
- 超过 20 名并发用户
- 需要接企业 SSO/HR/ERP
- 需要离线作业
- 需要正式样品签名或监管流程
- 需要多企业共用同一部署
