# WorkBuddy → MCP → CRM 演示脚本

## 启动

在项目根目录：

```bash
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

另开终端：

```bash
cd mcp-server
npm install
export WORKBUDDY_JWT_SECRET='demo-secret-at-least-32-characters'
export WORKBUDDY_JWT_ISSUER='workbuddy-local'
export WORKBUDDY_JWT_AUDIENCE='pharma-crm-mcp'
npm run start:http
```

WorkBuddy 的 MCP 地址为 `http://127.0.0.1:5620/mcp`。每次连接和后续请求都携带
WorkBuddy 为当前用户动态签发的 5 分钟 JWT，不能配置成所有用户共享的固定 token。

演示版 claims：

```json
{
  "sub": "workbuddy-user-1001",
  "employeeId": "<CRM Employee.id>",
  "role": "MR",
  "departmentId": "<CRM Department.id>",
  "tenantId": "demo-company",
  "iss": "workbuddy-local",
  "aud": "pharma-crm-mcp",
  "iat": 1785232800,
  "exp": 1785233100
}
```

本地可以生成测试 token：

```bash
cd mcp-server
WORKBUDDY_JWT_SECRET="$WORKBUDDY_JWT_SECRET" \
  node scripts/create-demo-jwt.mjs <employeeId> MR
```

## 三轮演示

### 1. 今日工作

用户：“我今天应该先做什么？”

Agent 调 `get_my_day`，说明今日计划、逾期待跟进、推荐客户和推荐原因。展示 CRM 代表首页，
两边内容应一致。

### 2. 拜访准备

用户：“帮我准备拜访张医生。”

Agent 先用已有客户 ID 调 `prepare_hcp_visit`，生成：

- HCP 当前主要任职及其他任职；
- 最近拜访结果与下一步；
- 尚未完成的跟进任务；
- 所在机构 Account Plan 策略与里程碑；
- 本次可用的批准资料、版本、批准文号和有效期；
- 代表当前可发放样品批次与数量。

### 3. 确认写回

用户：“记录这次拜访：沟通了临床数据，医生愿意继续了解，下周复访。”

Agent 先总结将要写入的内容并请求明确确认。用户确认后，Agent 生成稳定
`idempotencyKey`，调用 `complete_hcp_visit(confirmed: true)`。

展示 CRM：

- 拜访列表出现 `source=AI` 的新记录；
- 拜访详情出现实际使用的材料、样品和签到（演示输入提供时）；
- 任务列表出现“一周后复访”；
- `McpOperation` 中有当前代表、工具名、请求号、Visit ID 和成功状态。

网络重试时必须复用相同 `idempotencyKey`。工具会返回同一个 Visit ID，并带
`replayed: true`，不能重新生成键。

## 自动验收

CRM 与 MCP 启动后：

```bash
cd mcp-server
WORKBUDDY_JWT_SECRET="$WORKBUDDY_JWT_SECRET" node scripts/smoke-test-http.mjs
```

脚本验证无 JWT 拒绝、两代表 session 隔离、三个复合工具、拜访写入和幂等重放。
