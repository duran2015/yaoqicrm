# HCP 多任职 Lite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 HCP 增加可流转的多机构、多科室任职记录，并可靠同步现有主要任职兼容字段。

**Architecture:** 使用纯领域函数负责日期和输入校验，使用 Prisma 事务服务负责唯一主要任职、候选晋升及兼容字段同步；HCP 360 接口聚合任职记录，详情页提供轻量编辑卡片。现有消费 `Hcp.hcoId` 与 `Hcp.specialty` 的模块保持不变。

**Tech Stack:** Next.js 15 App Router、TypeScript、React 19、Prisma 6、SQLite、Node test runner

## Global Constraints

- 保留现有 Next.js、SQLite 和界面风格。
- 科室使用文本字段，不新增科室主数据。
- 同一 HCP 只能有一条当前主要任职。
- `Hcp.hcoId`、`specialty`、`title`、`adminDuty` 由当前主要任职同步维护。
- 遵守 YAGNI，不新增审批、证照、租户或历史拜访快照。

---

### Task 1: 任职领域规则

**Files:**
- Create: `src/lib/hcp-affiliation.ts`
- Test: `src/lib/hcp-affiliation.test.ts`

**Interfaces:**
- Produces: `parseAffiliationInput(value): AffiliationInput | null`
- Produces: `isCurrentAffiliation(affiliation, asOf): boolean`
- Produces: `choosePrimaryAffiliation(affiliations, asOf): affiliation | null`

- [ ] **Step 1: 写失败测试**

覆盖合法输入、结束日期晚于生效日期、左闭右开当前区间，以及候选主要任职按生效日期和创建时间倒序选择。

- [ ] **Step 2: 验证 RED**

Run: `npm test -- src/lib/hcp-affiliation.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现最小领域函数**

日期格式只接受 `YYYY-MM-DD`，字符串去除首尾空格；候选仅限当前任职。

- [ ] **Step 4: 验证 GREEN**

Run: `npm test -- src/lib/hcp-affiliation.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/lib/hcp-affiliation.ts src/lib/hcp-affiliation.test.ts
git commit -m "feat: add HCP affiliation domain rules"
```

### Task 2: 数据模型、迁移和事务服务

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260728210000_hcp_affiliations_lite/migration.sql`
- Create: `src/lib/hcp-affiliation-service.ts`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: Task 1 的 `AffiliationInput`、`isCurrentAffiliation`
- Produces: `createHcpAffiliation(hcpId, input, asOf?)`
- Produces: `updateHcpAffiliation(hcpId, affiliationId, input, asOf?)`
- Produces: 事务内私有 `reconcilePrimaryAffiliation(tx, hcpId, preferredId, asOf)`

- [ ] **Step 1: 增加 Prisma 模型和迁移**

建立 HCP/HCO 关联、索引和 `[hcpId,hcoId,departmentName,effectiveDate]` 唯一约束；迁移从现有兼容字段回填主要任职。

- [ ] **Step 2: 生成客户端并验证模型**

Run: `npx prisma generate && npx prisma validate`
Expected: 两条命令均成功。

- [ ] **Step 3: 实现事务服务**

创建时第一条当前任职自动主要；显式主要仅允许当前记录；更新导致主要失效时自动选取最近生效候选；最后同步或清空四个 HCP 兼容字段。

- [ ] **Step 4: 补充演示数据**

在已有 HCP 创建后 upsert 任职：所有 HCP 有默认主要任职，指定 HCP 增加第二当前任职，另一 HCP 增加历史任职。

- [ ] **Step 5: 验证数据库**

Run: `npx prisma migrate deploy && npx prisma db seed`
Expected: 迁移和种子成功，无重复主要任职。

- [ ] **Step 6: 提交**

```bash
git add prisma src/lib/hcp-affiliation-service.ts
git commit -m "feat: persist and synchronize HCP affiliations"
```

### Task 3: 任职 API 与 HCP 360 聚合

**Files:**
- Create: `src/app/api/hcp/[id]/affiliations/route.ts`
- Create: `src/app/api/hcp/[id]/affiliations/[affiliationId]/route.ts`
- Modify: `src/app/api/hcp/[id]/route.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: Task 2 的创建、更新服务
- Produces: 任职 GET/POST/PATCH JSON 接口
- Produces: `HcpAffiliationView` 和 `HcpDetail.affiliations`

- [ ] **Step 1: 实现列表和创建接口**

解析 JSON，返回明确的 400/404/409；创建成功返回 201。

- [ ] **Step 2: 实现更新接口**

校验所属 HCP，通过整体字段提交支持编辑、设为主要和当天结束。

- [ ] **Step 3: 聚合至 HCP 360**

按主要优先和生效日期倒序 include 任职与 HCO，并映射 `isCurrent`。

- [ ] **Step 4: 验证类型和构建**

Run: `npx tsc --noEmit`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/app/api/hcp src/lib/types.ts
git commit -m "feat: expose HCP affiliation APIs"
```

### Task 4: HCP 详情任职交互

**Files:**
- Create: `src/components/hcp-affiliations.tsx`
- Modify: `src/app/hcp/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 3 的 `HcpAffiliationView` 和任职接口
- Produces: `HcpAffiliations({ hcpId, affiliations, hcos, onChanged })`

- [ ] **Step 1: 建立任职卡片**

显示机构、科室、职称、行政职务、起止日期及主要/当前/历史/未来状态。

- [ ] **Step 2: 建立新增和编辑表单**

表单包含规格中的全部字段；提交成功调用 `onChanged` 刷新 HCP 360。

- [ ] **Step 3: 增加设为主要和结束操作**

设为主要提交 `isPrimary: true`；结束提交当天日期，展示接口错误且不丢失编辑内容。

- [ ] **Step 4: 接入详情页**

将卡片放在工作信息之前，并从 HCP 360 数据取得可选 HCO 列表。

- [ ] **Step 5: 验证 lint**

Run: `npm run lint`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/components/hcp-affiliations.tsx src/app/hcp/[id]/page.tsx
git commit -m "feat: manage affiliations from HCP 360"
```

### Task 5: 全量验证和演示说明

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-28-hcp-affiliations-lite.md`

**Interfaces:**
- Consumes: Tasks 1–4 的完整功能
- Produces: 可重复的演示路径与验证证据

- [ ] **Step 1: 执行自动验证**

Run: `npm test && npm run lint && npx prisma validate && npm run build`
Expected: 全部成功。

- [ ] **Step 2: 浏览器验证关键流**

在一个多任职 HCP 上新增第二任职、设为主要、验证头部兼容字段更新、结束主要任职并验证自动晋升和历史展示。

- [ ] **Step 3: 复位演示数据**

Run: `npx prisma db seed`
Expected: 成功并恢复确定性演示数据。

- [ ] **Step 4: 更新说明和计划勾选**

README 写明入口、三种场景和切换主要任职演示步骤；将完成步骤改为 `[x]`。

- [ ] **Step 5: 提交**

```bash
git add README.md docs/superpowers/plans/2026-07-28-hcp-affiliations-lite.md
git commit -m "docs: add HCP affiliation demo guide"
```

## Execution Record

- Completed: 2026-07-28
- Domain tests: 48/48 passed
- Database reset: 32 affiliation records, zero current-primary conflicts, two current affiliations on `DR0001`
- Static checks: ESLint, `tsc --noEmit`, Prisma validation and `git diff --check` passed
- Production build: 58 pages/routes generated successfully
- Browser flow: primary switch updated compatibility fields; ending the primary promoted the remaining current affiliation and retained the ended record as history
