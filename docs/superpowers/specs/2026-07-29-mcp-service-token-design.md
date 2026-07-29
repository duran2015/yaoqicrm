# MCP 专用长期 Token 设计

## 1. 目标

为 Pharma CRM 演示环境增加独立于 WorkBuddy 用户 JWT 的 MCP 专用长期 Token。Token 由 CRM 生成和管理，只能用于 Streamable HTTP MCP 鉴权，绑定专用 `ADMIN` 服务身份，覆盖全部 MCP 工具和 CRM 演示数据。

## 2. 认证边界

- `Bearer eyJ...`：继续走现有 WorkBuddy 短期 JWT 校验，绑定真实用户和员工。
- `Bearer phmcp_live_...`：走新的 MCP Token 校验，绑定 `MCP 演示管理员` 服务身份。
- MCP Token 不作为普通 CRM API 的外部认证方式。
- MCP Server 只通过服务器内网 CRM 地址调用 Token 校验接口。
- 两条认证链最终都产生不可变 `SessionActor`，后续工具身份隔离逻辑保持一致。

## 3. 服务身份

新增幂等演示员工：

- 工号：`MCP-DEMO-ADMIN`
- 姓名：`MCP 演示管理员`
- 角色：`ADMIN`
- 事业部：`演示环境`

该身份能够使用全部 HTTP MCP 工具。它不冒充销售代表，也不复用陈晓明、孟祥云等员工身份。

## 4. Token 模型

新增 `McpServiceToken`：

- `id`
- `name`
- `tokenPrefix`：固定为 `phmcp_live_`
- `tokenHint`：只保存末尾四位
- `tokenHash`：完整 Token 的 SHA-256，唯一
- `employeeId`：固定绑定服务身份
- `status`：`ACTIVE` 或 `REVOKED`
- `expiresAt`：可空；空表示不因时间自动到期
- `lastUsedAt`
- `lastUsedIp`
- `createdByEmployeeId`
- `createdAt`
- `revokedAt`
- `revokedByEmployeeId`

Token 明文使用 `randomBytes(32)` 生成：

```text
phmcp_live_<base64url random bytes>
```

数据库、日志和审计不得保存完整明文。

## 5. CRM 管理能力

新增管理页面 `/mcp-tokens`，只对当前演示身份为 `ADMIN`、`RSM` 或 `ASM` 时展示。

页面包含：

- Token 名称和状态列表。
- 创建时间、最后使用时间、末四位。
- 创建长期 Token。
- 创建时一次性显示明文和完整客户端 JSON。
- 一键复制 JSON。
- 撤销 Token。
- 轮换 Token：撤销旧 Token 并生成新 Token，明文同样只显示一次。

由于当前 CRM 仅有身份切换而非真实登录，该权限属于演示 UI 限制，不作为生产级后台认证。MCP Token 自身的认证和撤销必须在服务端严格执行。

## 6. API

### `GET /api/mcp-service-tokens`

输入 `employeeId`，校验其角色为 `ADMIN`、`RSM` 或 `ASM`，返回脱敏列表。

### `POST /api/mcp-service-tokens`

输入：

```json
{
  "employeeId": "管理岗员工 ID",
  "name": "Zerone 客户端演示",
  "expiresAt": null
}
```

返回一次性明文、脱敏记录和完整 WorkBuddy/Zerone JSON 配置。

### `POST /api/mcp-service-tokens/:id/rotate`

校验管理角色，在事务中撤销旧 Token 并生成新 Token。

### `POST /api/mcp-service-tokens/:id/revoke`

校验管理角色并撤销。重复撤销保持幂等。

### `POST /api/internal/mcp-service-tokens/verify`

仅接受配置的内部共享密钥 `X-MCP-Internal-Secret`。输入完整 MCP Token，返回服务身份：

```json
{
  "tokenId": "token ID",
  "actor": {
    "userId": "mcp-service:<token ID>",
    "employeeId": "服务员工 ID",
    "employeeName": "MCP 演示管理员",
    "role": "ADMIN"
  }
}
```

成功校验同时更新 `lastUsedAt` 和来源 IP。无效、过期或撤销 Token 返回 401。

## 7. MCP Server 行为

1. 从 `Authorization: Bearer ...` 读取凭证。
2. `phmcp_live_` 前缀调用 CRM 内网验证接口。
3. 其他 Token 继续调用现有 JWT 校验。
4. MCP Session 保存 `tokenId`。
5. 使用专用 Token 的每个后续请求均重新校验 Token，而不是只在 initialize 时校验。
6. Token 被撤销后，已有 Session 的下一次请求立即返回 401。
7. 不允许一个 Session 在 JWT 和 MCP Token 身份之间切换。

## 8. 审计与安全

- 复用现有 MCP 工具审计，并增加 `authType` 与 `credentialId` 上下文。
- 创建、轮换和撤销操作写入 `McpTokenAudit`：
  - `action`：`CREATED`、`ROTATED`、`REVOKED`、`AUTH_SUCCEEDED`、`AUTH_FAILED`
  - `tokenId`
  - `operatorEmployeeId`
  - `ip`
  - `createdAt`
- 认证失败审计不得包含 Token 明文，只保存不可逆的短指纹。
- Token 创建响应设置 `Cache-Control: no-store`。
- 内部验证密钥只存在服务器环境变量，不能进入客户端或数据库。

## 9. 部署配置

新增服务器环境变量：

- `MCP_INTERNAL_AUTH_SECRET`：CRM 与 MCP Server 之间的内网校验密钥。
- `MCP_PUBLIC_URL`：默认 `http://47.116.206.152/pharma-mcp`，用于生成客户端 JSON。

CRM 和 MCP 必须使用相同的 `MCP_INTERNAL_AUTH_SECRET`。

## 10. 测试

按 TDD 覆盖：

- Token 格式、随机性、哈希和明文一次性返回。
- 数据库不保存明文。
- 管理角色校验。
- ACTIVE、REVOKED、过期状态。
- 轮换撤销旧 Token。
- 内部接口共享密钥。
- JWT 与 MCP Token 认证分流。
- 撤销后已有 Session 即时失败。
- Employee/role 映射。
- 客户端 JSON 不包含 JWT。
- 现有 JWT、身份隔离、MCP 和 CRM 测试不回归。

## 11. 验收条件

1. CRM 页面能创建一个长期 `phmcp_live_` Token，并一次性复制完整 JSON。
2. Token 能从线上 Zerone/WorkBuddy 客户端初始化 MCP、列出并调用全部工具。
3. Token 绑定 `MCP 演示管理员`，返回角色为 `ADMIN`。
4. 数据库和日志中不存在 Token 明文。
5. 撤销后，新请求和已有 Session 的下一次请求均为 401。
6. 轮换后旧 Token 失效，新 Token 可用。
7. 现有用户级短期 JWT 调用继续正常。

