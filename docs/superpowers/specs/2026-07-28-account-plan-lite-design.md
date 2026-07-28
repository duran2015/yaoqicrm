# Account Plan Lite 设计规格

## 背景与目标

现有系统已经具备 HCO/HCP 档案、战略客户标记、KA 负责人、拜访、会议和后续任务，但这些对象仍是分散记录。经理无法围绕一家战略医院说明业务目标、关键关系人、推进策略、里程碑和执行进度。

本迭代新增 Account Plan Lite，以战略 HCO 为唯一计划主体，把现有客户活动组织成一条可演示的大客户经营闭环。它用于单组织宣传演示，不建设完整 KAM、商机或预测平台。

## 用户与核心场景

- KA 负责人：为自己负责的战略 HCO 创建年度 Account Plan，填写目标、现状、策略、重点产品和成功标准。
- KA 负责人：从医院现有 HCP 中选择关键关系人，维护其决策角色和支持态度。
- KA 负责人：建立里程碑、指定负责人和截止日期，并把里程碑转成现有后续任务。
- 地区经理：查看战略客户计划进度、逾期里程碑和未覆盖关键决策人，介入辅导。
- 普通代表：查看与本人相关的计划行动，但演示环境不新增独立权限框架。

## 方案

采用“年度 Account Plan + 里程碑行动”：

- `AccountPlan` 保存 HCO、年度、负责人、业务目标、现状判断、核心策略、成功标准和状态。
- `AccountPlanProduct` 关联计划重点产品，复用现有产品主数据。
- `AccountStakeholder` 关联 HCO 下的关键 HCP，并保存计划期内的决策角色和支持态度快照。
- `AccountMilestone` 保存可执行的阶段目标、负责人、截止日期和状态。
- 里程碑可以生成一条现有 `FollowUpTask`；后续执行继续使用任务模块，不复制任务状态机。
- 拜访、会议和任务进度按 HCO/HCP 关联实时汇总，不把活动明细复制进 Account Plan。
- 同一 HCO 同一年度只能有一份 Account Plan。

## 数据模型

### AccountPlan

- `id`
- `hcoId`
- `year`：四位整数
- `ownerId`：计划负责人
- `status`：`ACTIVE | CLOSED`
- `businessGoal`：业务目标
- `situation`：现状判断
- `strategy`：核心策略
- `successCriteria`：成功标准
- `createdById`
- `createdAt`
- `updatedAt`
- 唯一约束：`hcoId + year`

### AccountPlanProduct

- `id`
- `accountPlanId`
- `productId`
- 唯一约束：`accountPlanId + productId`

### AccountStakeholder

- `id`
- `accountPlanId`
- `hcpId`
- `decisionRole`：
  - `DECISION_MAKER`
  - `INFLUENCER`
  - `SUPPORTER`
- `attitude`：
  - `ADVOCATE`
  - `SUPPORTIVE`
  - `NEUTRAL`
  - `OPPOSED`
- `notes`
- 唯一约束：`accountPlanId + hcpId`

“决策者、影响者、支持者”描述其在客户决策中的角色；“强力支持、支持、中立、反对”描述当前态度。两个维度不混用。

### AccountMilestone

- `id`
- `accountPlanId`
- `title`
- `description`
- `ownerId`
- `dueDate`
- `status`：`OPEN | DONE | CANCELLED`
- `completedAt`
- `followUpTaskId`：可空且唯一
- `createdAt`
- `updatedAt`

## 业务规则

1. 只有 `Hco.isStrategic = "是"` 的 HCO 可以创建 Account Plan。
2. 年度为 2020–2100 的整数；演示默认 2026。
3. 同一 HCO 同一年度重复创建返回 409。
4. 计划负责人和创建人必须是现有员工。
5. 关键关系人必须属于该计划的 HCO；跨医院 HCP 被拒绝。
6. 至少填写业务目标、核心策略和成功标准；现状判断可以为空。
7. 重点产品至少选择一个，且必须是现有产品。
8. 里程碑标题、负责人和截止日期必填。
9. `OPEN` 里程碑可以完成或取消；终态不能重新打开。
10. 完成里程碑时写入 `completedAt`。
11. 每个里程碑最多生成一条后续任务，重复生成返回 409。
12. 生成任务时：
    - `title` 使用里程碑标题。
    - `description` 使用里程碑说明并注明 Account Plan 来源。
    - `assigneeId` 使用里程碑负责人。
    - `hcoId` 使用计划 HCO。
    - `dueDate` 使用里程碑截止日期。
13. 任务完成不自动完成里程碑，里程碑完成也不自动完成任务；演示阶段避免隐式双向状态同步。
14. 计划进度为已完成里程碑数除以未取消里程碑数；分母为 0 时进度为 0。
15. “关键决策人未覆盖”指角色为 `DECISION_MAKER`，且本年度没有与计划负责人关联的已提交拜访。
16. “逾期里程碑”指状态为 `OPEN` 且截止日期早于业务当前日。

## 状态流转

### Account Plan

```text
ACTIVE → CLOSED
```

关闭后计划内容和里程碑只读；不支持重新开启。

### Account Milestone

```text
OPEN → DONE
OPEN → CANCELLED
```

终态不能重新打开。

## API

### `GET /api/account-plans`

参数：

- `ownerId`：可选，按负责人过滤。
- `year`：可选，按年度过滤。
- `hcoId`：可选，按 HCO 过滤。

返回计划列表、HCO、负责人、里程碑进度、逾期数和关键决策人未覆盖数。

### `POST /api/account-plans`

请求：

```json
{
  "hcoId": "hco-id",
  "year": 2026,
  "ownerId": "employee-id",
  "createdById": "employee-id",
  "businessGoal": "完成核心产品进院并覆盖重点科室",
  "situation": "药事会窗口明确，但关键决策人尚未形成共识",
  "strategy": "以重点科室临床证据沟通带动药事路径推进",
  "successCriteria": "完成进院准入并建立三个重点科室常规使用",
  "productIds": ["product-id"],
  "stakeholders": [
    {
      "hcpId": "hcp-id",
      "decisionRole": "DECISION_MAKER",
      "attitude": "NEUTRAL",
      "notes": "关注药物经济学证据"
    }
  ],
  "milestones": [
    {
      "title": "完成药事会核心材料准备",
      "description": "整合循证、药经和准入材料",
      "ownerId": "employee-id",
      "dueDate": "2026-08-15"
    }
  ]
}
```

创建计划以及重点产品、关系人和初始里程碑。

### `GET /api/account-plans/[id]`

返回计划完整详情：

- 计划基础信息
- 重点产品
- 关键关系人及最近拜访
- 里程碑及关联任务
- HCO 本年度拜访、会议和未完成任务摘要

### `PATCH /api/account-plans/[id]`

仅 `ACTIVE` 状态允许修改目标、现状、策略、成功标准、负责人、重点产品和关键关系人。

### `POST /api/account-plans/[id]/close`

关闭计划。存在未完成里程碑时仍允许关闭，但响应同时返回未完成数量，页面需要二次确认。

### `POST /api/account-plans/[id]/milestones`

为活动计划创建里程碑。

### `PATCH /api/account-plans/milestones/[id]`

执行 `DONE` 或 `CANCELLED` 状态流转。

### `POST /api/account-plans/milestones/[id]/task`

为里程碑生成后续任务并写入 `followUpTaskId`。

### `GET /api/account-plans/team`

参数：`managerId`、`year`。返回组织子树内：

- 计划总数和平均进度
- 负责人计划进度
- 逾期里程碑
- 关键决策人未覆盖清单

## 界面

### `/account-plans`

- 年度、负责人和状态筛选。
- 计划卡片显示 HCO、负责人、目标摘要、进度、逾期里程碑和关系人覆盖。
- 经理或 KA 负责人可创建计划。
- 进入 `/account-plans/[id]` 查看完整计划。

### `/account-plans/[id]`

- 顶部：HCO、负责人、年度、状态和计划进度。
- 策略区：业务目标、现状判断、核心策略、成功标准和重点产品。
- 关系人区：关键 HCP、决策角色、支持态度、最近拜访和是否已覆盖。
- 里程碑区：负责人、截止日期、状态、关联任务，以及“转为任务”“完成”“取消”操作。
- 活动摘要区：本年度拜访次数、最近拜访、关联会议和未完成任务。

### HCO 详情页

- 战略 HCO 显示当年 Account Plan 摘要。
- 有计划时显示目标、进度、逾期数和进入详情入口。
- 无计划时显示“创建 Account Plan”入口，并预选当前 HCO。

### 经理工作台

- 增加战略客户计划卡片。
- 展示计划平均进度、逾期里程碑和关键决策人未覆盖。
- 提供 Account Plan 详情下钻。

### 导航

在“日常工作”中新增“客户策略”入口，保持现有界面风格。

## 数据流与关联

```text
战略 HCO
  → 年度 Account Plan
    → 重点产品
    → 关键 HCP 关系人
    → 里程碑
      → 现有 FollowUpTask

现有 Visit / MedEvent / FollowUpTask
  → 按 HCO/HCP 实时汇总
  → Account Plan 进度与风险视图
  → 经理工作台下钻
```

## 错误处理

- 非法输入返回 400。
- 对象不存在返回 404。
- 重复计划、重复关系人、重复重点产品、重复生成任务或非法状态流转返回 409。
- API 错误使用现有 `err()` 和 `ApiError` 展示模式。
- 创建计划使用单次 Prisma 嵌套写入，任一子对象失败时整体回滚。

## 演示数据

固定生成 2026 年三份 Account Plan：

1. **推进顺利**：战略 HCO 已覆盖决策人，多数里程碑完成，存在关联任务。
2. **关系风险**：关键决策人为中立且本年尚未由计划负责人覆盖。
3. **执行风险**：存在逾期开放里程碑，经理工作台可直接下钻。

每份计划至少包含一个重点产品、两个关键关系人和两个里程碑。重跑种子结果确定，不依赖系统当前日期。

## 测试策略

### 纯函数测试

- 年度范围校验。
- 计划和里程碑状态流转。
- 里程碑进度计算，排除取消项。
- 逾期判断使用业务日期。
- 决策人覆盖判断。
- 团队计划汇总。

### API 与数据库验证

- 创建完整计划及嵌套对象。
- 拒绝非战略 HCO、跨 HCO 关系人和重复年度计划。
- 创建里程碑并生成唯一后续任务。
- 完成和取消状态流转。
- HCO 活动摘要与团队下钻口径。

### 全量验证

- `npm test`
- `npm run lint`
- `npx prisma validate`
- `npm run build`
- 重跑种子并核验三种演示状态
- 浏览器走查创建计划、关系人、里程碑转任务、HCO 摘要和经理下钻

## 验收条件

- 战略 HCO 可以创建唯一的年度 Account Plan。
- 计划可以保存目标、策略、重点产品和关键关系人。
- 关键关系人只能来自该 HCO，角色和态度分维度保存。
- 里程碑可以创建、完成、取消并生成唯一后续任务。
- 详情页可以查看计划进度和 HCO 活动摘要。
- HCO 详情页可以进入当年计划。
- 经理工作台可以查看逾期里程碑和未覆盖决策人。
- 种子数据稳定覆盖顺利推进、关系风险和执行风险。
- 单元测试、ESLint、Prisma 校验和生产构建全部通过。

## 明确删减

- 不做商机金额、销量预测、漏斗和赢单概率。
- 不做复杂医院组织关系图、关系强度打分或自动影响力算法。
- 不做计划审批、多版本、多人编辑锁、变更留痕和跨年度复制。
- 不自动双向同步里程碑与任务状态。
- 不做文件材料库、邮件、费用或合规审批。
- 不接入 WorkBuddy/MCP，不迁移 PostgreSQL，不建设 SSO/RBAC。

