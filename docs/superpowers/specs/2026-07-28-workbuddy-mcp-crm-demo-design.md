# WorkBuddy → MCP → CRM 演示闭环设计

## 目标

在不继续扩展 CRM 产品模块的前提下，跑通一个可宣传演示的用户级 Agent 闭环：

1. WorkBuddy 以医药代表身份携带短期 JWT 连接 MCP；
2. MCP 将身份固定绑定到会话，不能由工具参数冒充其他员工；
3. Agent 可查看“我的今日工作”、生成 HCP 拜访前简报；
4. Agent 经用户明确确认后完成拜访、资料/样品使用和后续任务；
5. 重试同一写操作不会产生重复数据，CRM 留下最小审计记录。

## 范围与删减

本期只服务单公司、单组织演示。保留 Next.js、SQLite、现有 MCP Streamable HTTP 和界面风格。

本期不建设 WorkBuddy SSO、JWKS 管理后台、通用审批引擎、全量 RBAC、事件总线或多租户后台。JWT 先使用 HS256 共享密钥；验证器保持独立，后续可替换成 JWKS，不影响工具与 CRM 接口。

## 身份与信任边界

- WorkBuddy 调用 `/mcp` 时发送 `Authorization: Bearer <JWT>`。
- JWT 必须包含 `sub`、`employeeId`、`role`、`exp`，可包含 `departmentId`、`tenantId`；校验 `iss`、`aud`、签名和过期时间。
- 初始化会话时，MCP 使用 `employeeId` 查询 CRM 员工并校验员工存在、角色一致，然后把身份固定在该 session。
- 同一 session 后续请求必须使用同一员工的有效 JWT；换人或过期立即拒绝。
- HTTP JWT 模式不暴露 `set_current_employee`；工具中的 `employeeId`、`evaluatorId`、`changedById` 等操作人参数若与会话身份不一致则拒绝。
- stdio 本地开发继续允许 `CRM_EMPLOYEE_ID` 和 `set_current_employee`，不影响现有调试方式。
- `/health` 不承载业务操作，保持无需用户 JWT，便于部署探活。

## 三个复合工具

### `get_my_day`

输入：可选 `asOf`。身份只取 session actor。

输出：代表资料、今日安排、待跟进、推荐客户及个人 KPI。组合现有代表工作台和仪表盘接口。

### `prepare_hcp_visit`

输入：`hcpId`。

输出：HCP 360、该代表的拜访简报、当前样品库存、该 HCP/产品可使用的批准且有效的沟通资料。所有“我的”数据只使用 session actor。

### `complete_hcp_visit`

输入：`idempotencyKey`、`confirmed: true`、`hcpId`、拜访信息，以及可选产品、资料、样品、签到和后续任务。

行为：调用 CRM 专用 Agent 写接口，在一个数据库事务中写入拜访及关联数据，并登记操作记录。`confirmed` 不是通用审批引擎，只是演示中阻止 Agent 未经明确确认直接写入。

## 幂等与审计

新增 `McpOperation`：

- 唯一键：`employeeId + toolName + idempotencyKey`
- 状态：`IN_PROGRESS | SUCCEEDED | FAILED`
- 保存请求编号、输入摘要、结果 JSON、错误信息、业务对象、创建/完成时间。

首次请求创建操作并执行；相同键、相同载荷重放已成功结果；相同键、不同载荷返回 409。业务写入和成功结果在同一事务中完成，避免重复拜访/任务。

审计只记录演示所需的业务摘要，不存 JWT、手机号、证件号、拜访全文等敏感内容。

## 演示验收

1. 两个代表分别初始化 MCP session，`get_my_day` 返回各自数据，不能通过参数串号。
2. 无 JWT、坏签名、过期 JWT、角色与 CRM 不匹配均被拒绝。
3. `prepare_hcp_visit` 能返回真实 HCP、历史拜访、库存和合规资料。
4. `complete_hcp_visit` 创建拜访和后续任务；同一幂等键重试只产生一条拜访。
5. CRM 数据库可查到成功操作的 actor、工具、请求号和实体 ID。
6. README 和演示脚本给出 WorkBuddy 配置、JWT 示例生成方式和完整三轮对话。

