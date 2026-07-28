# Account Plan 策略正文编辑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Account Plan 详情页安全编辑四个策略正文字段，不重建其他关联对象。

**Architecture:** 纯函数校验聚焦输入，专用 Route Handler 只更新正文列，独立 React 对话框承载编辑状态。详情页继续通过现有 GET 重新聚合活动数据。

**Tech Stack:** Next.js 15、React 19、TypeScript、Prisma 6、SQLite、Node test runner

## Global Constraints

- 仅编辑 `businessGoal`、`situation`、`strategy`、`successCriteria`。
- 关闭计划只读。
- 不修改负责人、产品、关系人和里程碑。

---

### Task 1: 正文输入规则

**Files:**
- Modify: `src/lib/account-plan.ts`
- Test: `src/lib/account-plan.test.ts`

**Interfaces:**
- Produces: `parseAccountPlanStrategyInput(value): AccountPlanStrategyInput | null`

- [ ] 写测试，断言必填、可空现状和 trim 行为。
- [ ] 运行 `npm test -- src/lib/account-plan.test.ts`，确认因函数缺失失败。
- [ ] 实现最小解析函数。
- [ ] 重跑测试，确认通过。
- [ ] 提交 `feat: validate Account Plan strategy edits`。

### Task 2: 专用接口

**Files:**
- Create: `src/app/api/account-plans/[id]/strategy/route.ts`

**Interfaces:**
- Consumes: `parseAccountPlanStrategyInput`
- Produces: `PATCH /api/account-plans/[id]/strategy`

- [ ] 校验计划存在、状态和输入，只更新四个字段。
- [ ] 使用 `accountPlanInclude` 与 `enrichAccountPlan` 返回统一结构。
- [ ] 运行 `npm run build`，确认路由和类型通过。
- [ ] 提交 `feat: update Account Plan strategy text`。

### Task 3: 编辑对话框

**Files:**
- Create: `src/components/account-plan-strategy-editor.tsx`
- Modify: `src/app/account-plans/[id]/page.tsx`

**Interfaces:**
- Produces: `AccountPlanStrategyEditor({ plan, open, onClose, onSaved })`

- [ ] 建立四字段多行编辑对话框和错误状态。
- [ ] 在活动计划客户策略卡片接入编辑入口。
- [ ] 保存成功刷新详情并展示提示。
- [ ] 运行 `npm run lint && npm run build`。
- [ ] 提交 `feat: edit strategy from Account Plan detail`。

### Task 4: 验证

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-account-plan-strategy-edit.md`

**Interfaces:**
- Produces: 验证记录

- [ ] 浏览器编辑四项正文并确认关联对象数量不变。
- [ ] 重置种子数据。
- [ ] 记录自动化和浏览器结果。
