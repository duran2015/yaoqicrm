# Agent/MCP 自动评测集与结果看板设计

## 1. 目标

在现有 Pharma CRM 内增加一套不依赖外部大模型的确定性评测能力，真实调用已部署的 MCP 接口，持续验证 WorkBuddy → MCP → CRM 演示闭环的协议、身份、业务结果、引用、幂等和审计行为。

第一版服务于单组织演示环境，重点是结果稳定、可复现、能快速定位失败原因，不建设通用评测平台。

## 2. 范围

### 2.1 首批能力域

1. MCP 协议
   - `initialize` 成功。
   - `tools/list` 成功。
   - 必须发现 `search_sales_intelligence`、`get_product_battlecard`、`refresh_product_intelligence`。
2. 销售情报搜索
   - 工具调用成功。
   - 返回数量不超过输入上限。
   - 每条正式情报包含标题、来源名称和 HTTP(S) 来源链接。
   - 已核验结果不会混入已拒绝或已过期内容。
3. 产品战卡
   - 工具调用成功。
   - 返回产品身份。
   - 已核验事实、待核验线索、批准材料分组明确。
   - 正式事实和材料保留可追溯引用。
4. 情报刷新
   - 缺少显式确认时被拒绝。
   - 首次确认调用成功。
   - 相同幂等键和相同负载重放时不重复创建业务结果。
   - CRM 中产生成功的 `McpOperation` 审计记录。
5. 身份隔离
   - 缺少 JWT 时被拒绝。
   - 过期 JWT 时被拒绝。
   - JWT 员工或角色与 CRM 映射不一致时被拒绝。

### 2.2 明确不做

- 不调用外部大模型评分。
- 不评价回答文风、说服力或语言自然度。
- 不做并发压测、长稳测试和容量规划。
- 不建设多租户评测隔离。
- 不保存完整 JWT、签名密钥或完整敏感请求体。

## 3. 架构

评测能力内置于现有 Next.js CRM：

- SQLite/Prisma 保存评测用例定义、运行记录、场景结果和断言结果。
- 服务端评测执行器通过 Streamable HTTP 调用真实 MCP 地址。
- CRM API 负责启动评测、查询汇总、读取运行详情。
- 独立 `/agent-evaluations` 页面展示总览、能力域结果、失败断言和历史运行。
- 现有 `/evaluations` 继续只承载经理的拜访有效性评定，二者不复用路由或业务对象。

评测执行器只负责协议编排和确定性断言，不复制 MCP 工具业务逻辑。业务正确性通过公开输出、CRM 查询接口和最小数据库验证接口确认。

## 4. 数据模型

### 4.1 `AgentEvaluationCase`

保存可运行的固定评测定义：

- `id`
- `key`：稳定唯一键
- `name`
- `capability`：`PROTOCOL`、`INTELLIGENCE_SEARCH`、`PRODUCT_BATTLECARD`、`INTELLIGENCE_REFRESH`、`IDENTITY`
- `description`
- `toolName`：协议或身份用例可为空
- `inputJson`：脱敏后的固定输入
- `required`：是否为必要场景
- `enabled`
- `sortOrder`
- `createdAt`
- `updatedAt`

### 4.2 `AgentEvaluationRun`

保存一轮全部或部分评测：

- `id`
- `status`：`RUNNING`、`PASSED`、`FAILED`
- `scope`：`ALL` 或能力域
- `mcpEndpoint`：只保存地址，不保存凭证
- `startedByEmployeeId`
- `startedAt`
- `completedAt`
- `caseCount`
- `passedCaseCount`
- `assertionCount`
- `passedAssertionCount`
- `averageLatencyMs`
- `errorMessage`

### 4.3 `AgentEvaluationResult`

保存单场景执行结果：

- `id`
- `runId`
- `caseId`
- `status`：`PASSED`、`FAILED`
- `latencyMs`
- `httpStatus`
- `requestSummary`
- `responseSummary`
- `errorMessage`
- `startedAt`
- `completedAt`

### 4.4 `AgentEvaluationAssertion`

保存可解释的断言结果：

- `id`
- `resultId`
- `key`
- `label`
- `required`
- `passed`
- `expected`
- `actual`

运行记录保存当次结果快照。后续修改用例不会改变历史运行。

## 5. 执行流程

1. 管理员在看板选择运行全部或单个场景。
2. API 校验当前 CRM 员工具有 `ADMIN` 或经理角色。
3. 服务端创建 `RUNNING` 运行记录并按 `sortOrder` 顺序执行用例。
4. 执行器为正常场景签发短期测试 JWT；身份异常场景使用专门构造的缺失、过期或映射不一致凭证。
5. 执行器完成 MCP `initialize`，保留会话 ID，并在同一会话内调用 `tools/list` 或 `tools/call`。
6. 场景适配器把输出转换成统一的断言列表。
7. 必要断言任意失败则场景失败；必要场景任意失败则整轮失败。
8. 执行器保存延迟、脱敏摘要、断言及最终汇总。
9. API 返回运行详情，看板刷新结果。

为避免浏览器请求超时，第一版整轮用例保持在 10 个以内并串行执行；单个 MCP 请求超时为 15 秒，超时记为场景失败而不是终止整轮。

## 6. 固定评测集

第一版建立 9 个用例：

| Key | 能力域 | 场景 |
| --- | --- | --- |
| `protocol.initialize` | MCP 协议 | 初始化并获得协议能力 |
| `protocol.tools-list` | MCP 协议 | 发现三个销售情报复合工具 |
| `identity.missing-jwt` | 身份隔离 | 无凭证请求被拒绝 |
| `identity.expired-jwt` | 身份隔离 | 过期凭证请求被拒绝 |
| `identity.employee-mismatch` | 身份隔离 | CRM 员工映射不一致被拒绝 |
| `intelligence.search` | 情报搜索 | 搜索天韵相关政策并验证引用 |
| `battlecard.product` | 产品战卡 | 获取天韵战卡并验证分组和批准材料 |
| `refresh.confirmation` | 情报刷新 | 未确认刷新被拒绝 |
| `refresh.idempotency` | 情报刷新 | 已确认刷新成功且重放与审计一致 |

种子脚本按 `key` 幂等写入这些用例。演示产品、员工或 MCP 地址通过环境变量/现有 CRM 数据解析，不把数据库 ID 固化在用例中。

## 7. 评分口径

- 场景通过：该场景全部必要断言通过。
- 整轮通过：全部必要场景通过。
- 通过率：`passedAssertionCount / assertionCount`。
- 平均延迟：只统计收到 MCP 响应的场景。
- 延迟只展示，不设置硬性失败阈值。
- 可选断言失败降低通过率，但不使场景失败。

断言结果必须展示期望值和经过长度限制、敏感字段脱敏后的实际值。

## 8. API

### `GET /api/agent-evaluations/summary`

返回最近一次运行、近 10 次趋势、能力域汇总及最近失败断言。

### `GET /api/agent-evaluations/runs`

分页返回运行历史。

### `GET /api/agent-evaluations/runs/:id`

返回运行、场景结果和断言明细。

### `POST /api/agent-evaluations/runs`

输入：

```json
{
  "scope": "ALL",
  "caseKey": null
}
```

规则：

- 只允许 `ADMIN`、`RSM`、`ASM`。
- 同一时间只允许一个 `RUNNING` 运行。
- 支持 `ALL` 或一个 `caseKey`。
- 凭证、签名密钥及完整响应不得进入 API 响应或数据库。

## 9. 结果看板

新建导航项“Agent 评测”和页面 `/agent-evaluations`：

1. 顶部操作区
   - “运行全部评测”按钮。
   - 最近运行时间、状态。
2. KPI
   - 总体通过率。
   - 通过场景数。
   - 平均延迟。
   - 最近 10 次成功率。
3. 能力域卡片
   - 每个能力域的场景数、通过数、断言通过率。
4. 当前运行明细
   - 场景、工具、状态、延迟。
   - 展开后显示断言、期望和实际。
   - 支持单场景重跑。
5. 失败聚合
   - 按最近运行展示必要断言失败原因。
6. 历史运行
   - 展示最近 10 次运行，不建设复杂筛选器和图表系统。

页面沿用现有 CRM 的卡片、Badge、表格和状态颜色，不引入新的 UI 依赖。

## 10. 安全与错误处理

- JWT 仅在内存中生成和使用。
- 数据库只保存 employeeId、role 和脱敏摘要。
- 请求与响应摘要最大 2 KB。
- `Authorization`、Cookie、JWT、签名密钥和会话 ID 不写日志或数据库。
- 单场景失败被隔离，后续场景继续执行。
- MCP 不可达、协议错误、超时和断言失败使用不同错误消息。
- 刷新幂等评测使用带运行 ID 的稳定键，避免与人工演示操作冲突。

## 11. 配置

服务端环境变量：

- `AGENT_EVAL_MCP_ENDPOINT`：默认 `http://127.0.0.1:5620/mcp`。
- `AGENT_EVAL_JWT_SECRET`：默认复用 MCP 的 WorkBuddy JWT 签名密钥，但必须在服务端配置。
- `AGENT_EVAL_JWT_ISSUER`
- `AGENT_EVAL_JWT_AUDIENCE`
- `AGENT_EVAL_PRODUCT_NAME`：默认 `天韵`。

生产环境不允许由浏览器传入 MCP 地址或签名密钥。

## 12. 验收条件

1. 9 个固定场景能够从 CRM 看板一键执行。
2. 正常演示数据下，协议、搜索、战卡、刷新和身份场景均产生可解释断言。
3. 断开 MCP、移除来源链接或破坏幂等时，对应用例明确失败，其他用例仍继续。
4. 看板展示总体通过率、能力域、失败断言、延迟和历史运行。
5. 单场景可重跑且不会覆盖历史结果。
6. 数据库和日志中不存在完整 JWT 或签名密钥。
7. 自动测试覆盖评分聚合、断言规则、脱敏、互斥运行和 MCP 协议客户端。
8. 现有 CRM、采集任务和 MCP 测试继续通过。

