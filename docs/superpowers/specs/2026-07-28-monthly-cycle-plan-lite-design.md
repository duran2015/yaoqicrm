# 月度 Cycle Plan Lite 设计规格

## 背景与目标

现有系统已经具备客户分级、客户归属、周计划、拜访执行和经理工作台，但缺少一层稳定的月度覆盖目标，导致经理无法回答“本月哪些重点客户必须覆盖、已经覆盖多少、谁的缺口最大”，代表也无法从缺口直接安排下周行动。

本迭代新增 Cycle Plan Lite，以月度目标快照串联客户分级、周计划、实际拜访和经理下钻。它用于单组织演示，不建设完整企业级周期规划平台。

## 用户与核心场景

- 地区经理：为某位代表创建一个月度 Cycle Plan，按 A/B/C/D 客户层级配置目标频次并生成客户明细。
- 医药代表：查看本人本月覆盖目标、完成次数和缺口，从缺口客户直接加入周计划。
- 地区经理：在经理工作台查看团队达成率、落后代表和重点客户未覆盖清单，并下钻到月度计划。

## 方案

采用“月度目标快照”：

- `CyclePlan` 保存员工、月份、创建人、状态和各层级频次。
- `CyclePlanItem` 保存生成当时的客户、客户层级与目标次数。
- 实际完成次数不冗余写回计划，而是按 `Visit.employeeId + Visit.hcpId + Visit.visitDate` 实时汇总。
- 客户后来改分级，不改写已经生成的月度明细，保证演示历史稳定。
- 同一员工同一月份只能有一个 Cycle Plan。

## 数据模型

### CyclePlan

- `id`
- `employeeId`
- `month`：该月第一天的 UTC 日期
- `status`：`ACTIVE | CLOSED`
- `frequencyA/B/C/D`
- `createdById`
- `createdAt`
- `updatedAt`
- 唯一约束：`employeeId + month`

### CyclePlanItem

- `id`
- `cyclePlanId`
- `hcpId`
- `tierSnapshot`
- `targetVisits`
- 唯一约束：`cyclePlanId + hcpId`

客户范围只使用 `CustomerAssignment.role = OWNER` 且关联 HCP 的记录；若演示种子尚无归属记录，则补齐确定性的代表客户归属。

## 业务规则

1. 月份必须是合法的 `YYYY-MM`。
2. 频次必须是 0–31 的整数，演示默认 A/B/C/D 为 4/2/1/0。
3. 生成时对该代表所有 OWNER HCP 归属做快照；未分级客户按 D 处理。
4. 完成次数只统计该月内、状态为 `SUBMITTED`、同时具有相同 `employeeId` 和 `hcpId` 的拜访。
5. `remainingVisits = max(targetVisits - completedVisits, 0)`。
6. 达成率在总目标为 0 时为 0，否则为 `min(completed / target, 1)`；页面显示百分比。
7. “未覆盖”指 `completedVisits = 0` 且 `targetVisits > 0`。
8. “重点缺口”优先级按 A、B、C、D，再按剩余次数降序排列。
9. 从缺口加入周计划时复用现有周计划 API，生成普通 `TourPlanItem`，不引入第二套排程状态。

## API

### `GET /api/cycle-plans`

参数：`employeeId`、`month`。返回月度计划、汇总值和带完成/缺口数据的明细。

### `POST /api/cycle-plans`

请求：

```json
{
  "employeeId": "employee-id",
  "createdById": "manager-id",
  "month": "2026-07",
  "frequencies": { "A": 4, "B": 2, "C": 1, "D": 0 }
}
```

创建计划和客户快照。重复创建返回 409。

### `GET /api/cycle-plans/team`

参数：`managerId`、`month`。返回直属及间接下属的个人汇总、团队汇总和重点未覆盖客户。

## 界面

### `/cycle-plans`

- 月份选择、本人/下属选择。
- 经理可设置四层频次并生成计划。
- 顶部展示目标次数、完成次数、达成率、未覆盖客户数。
- 明细展示客户、医院、层级、目标、完成、缺口。
- 有缺口的客户可一键带入周计划页；通过查询参数传 `hcpId`，周计划编辑器预选该客户。

### 经理工作台

- 增加当月团队覆盖卡片。
- 展示每名下属达成率与缺口。
- 展示 A/B 级未覆盖客户。
- 提供 Cycle Plan 页面下钻链接。

### 导航

在“日常工作”中新增“月度覆盖”入口，保持现有界面风格。

## 演示数据

- 固定生成 2026-07 的月度计划。
- 至少三名代表分别呈现高达成、进行中和明显落后。
- 补齐 OWNER 客户归属，确保计划明细与现有拜访真实关联。
- 重跑种子结果确定，不依赖当前日期。

## 验收条件

- 月度计划可以创建，重复创建被拒绝。
- 客户分级和频次正确生成目标快照。
- 现有提交拜访正确计入完成数。
- 页面可查看汇总、缺口和客户明细。
- 缺口客户可以带入周计划。
- 经理工作台可以查看团队达成和重点未覆盖客户。
- 种子数据可以稳定演示三种达成状态。
- 单元测试、ESLint、Prisma 校验和生产构建全部通过。

## 明确删减

- 不做审批、多版本、调整留痕和跨月结转。
- 不做季度拆月、区域容量算法和智能推荐。
- 不做预测、销售指标联动或 WorkBuddy/MCP 接入。
- 不引入 PostgreSQL、SSO 或新的权限框架。

