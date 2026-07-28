# 代表首页聚合工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为医药代表首页聚合今日计划、开放跟进任务和 Cycle Plan 推荐客户，并提供直接行动入口。

**Architecture:** 纯领域函数负责稳定排序和推荐解释，单一聚合接口跨现有四类业务对象查询，独立首页组件渲染三栏。管理岗路径不请求该接口。

**Tech Stack:** Next.js 15、React 19、TypeScript、Prisma 6、SQLite、Node test runner

## Global Constraints

- 仅 `MR` 展示代表工作台。
- 使用现有周计划、任务、Cycle Plan、拜访和 HCP 数据。
- 不新增数据库表或 AI 推荐。
- 首页沿用 `AS_OF` 演示基准日。

---

### Task 1: 排序与推荐领域规则

**Files:**
- Create: `src/lib/representative-workbench.ts`
- Test: `src/lib/representative-workbench.test.ts`

**Interfaces:**
- Produces: `sortRepresentativeFollowUps(items, asOf)`
- Produces: `rankRepresentativeRecommendations(items)`
- Produces: `recommendationReason(item)`

- [ ] 写失败测试，覆盖逾期优先、日期/优先级排序、等级/缺口排序和理由。
- [ ] 运行测试确认 RED。
- [ ] 实现最小纯函数并确认 GREEN。
- [ ] 提交 `feat: add representative workbench rules`。

### Task 2: 聚合接口

**Files:**
- Create: `src/app/api/representative/workbench/route.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: Task 1 的排序和理由函数
- Produces: `RepresentativeWorkbenchData`

- [ ] 校验员工和 MR 角色，计算当日、当周、当月上海时区边界。
- [ ] 查询今日周计划、开放任务、月度计划和已提交拜访。
- [ ] 排除今日已安排客户，计算缺口、最近拜访和推荐理由。
- [ ] 运行 `npm run build`。
- [ ] 提交 `feat: aggregate representative home workbench`。

### Task 3: 首页三栏

**Files:**
- Create: `src/components/representative-workbench.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `RepresentativeWorkbenchData`
- Produces: `RepresentativeWorkbench({ employeeId, asOf })`

- [ ] 渲染今日安排、待跟进和推荐客户卡片及空状态。
- [ ] 接入客户、任务、拜访和周计划快捷链接。
- [ ] 仅在 `current.role === "MR"` 时渲染和请求。
- [ ] 运行 `npm run lint && npm run build`。
- [ ] 提交 `feat: add representative home action workbench`。

### Task 4: 验证

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-28-representative-home-workbench.md`

**Interfaces:**
- Produces: 演示说明和验证记录

- [ ] 浏览器验证 MR 三栏、快捷入口和经理无个人工作台。
- [ ] 运行全量测试、lint、类型检查、Prisma 校验和生产构建。
- [ ] 更新演示说明与执行记录。
- [ ] 提交 `docs: add representative workbench demo guide`。

## Execution Record

- Completed: 2026-07-28
- Browser MR view: 陈静 displayed a planned visit with “开始拜访” plus ranked recommendations.
- Browser follow-up view: 张伟 displayed overdue and high-priority follow-ups with “创建复访”.
- Browser manager view: 李强 displayed the team aggregate badge and no personal workbench.
- Final automated verification: 53/53 tests, ESLint, TypeScript, Prisma validation, 59-page production build and diff check passed.
