# Account Plan Lite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an HCO-centered annual account strategy workflow that connects goals, products, stakeholders, milestones, existing tasks, customer activity, and manager intervention.

**Architecture:** Persist one `AccountPlan` per strategic HCO and year with product, stakeholder, and milestone child records. Keep milestone state independent, generate at most one existing `FollowUpTask` per milestone, and calculate customer activity and management risks from existing visits, events, and tasks at read time.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 6, SQLite, Node test runner via `tsx --test`, Tailwind CSS.

## Global Constraints

- Preserve the existing Next.js, SQLite, navigation, component patterns, and visual style.
- Use strategic HCO as the only Account Plan subject.
- Allow one Account Plan per HCO and year.
- Keep milestone and follow-up task states independent.
- Reuse existing Employee, HCO, HCP, Product, Visit, MedEvent, and FollowUpTask models.
- Do not implement opportunity value, sales forecasting, approval, plan versions, relationship graphs, editing locks, cross-year copying, WorkBuddy/MCP, PostgreSQL, SSO, or RBAC.
- Use HTTP 400 for invalid input, 404 for missing objects, and 409 for duplicates or invalid transitions.
- Read the relevant Next.js 15 guide in `node_modules/next/dist/docs/` before changing App Router pages or route handlers.
- Follow strict red-green-refactor TDD for every behavior.

---

### Task 1: Account planning domain rules

**Files:**
- Create: `src/lib/account-plan.ts`
- Test: `src/lib/account-plan.test.ts`

**Interfaces:**
- Produces: `isAccountPlanYear(value: unknown): value is number`
- Produces: `canTransitionAccountPlan(from: string, to: string): boolean`
- Produces: `canTransitionMilestone(from: string, to: string): boolean`
- Produces: `summarizeMilestones(items, now): AccountPlanProgress`
- Produces: `isDecisionMakerCovered(stakeholder, visits): boolean`
- Produces: `summarizeAccountPlanTeam(rows): AccountPlanTeamSummary`

- [ ] **Step 1: Write failing tests for year boundaries, terminal state rules, cancelled milestone exclusion, overdue dates, decision-maker coverage, and team aggregation**

```ts
test("excludes cancelled milestones from progress", () => {
  assert.deepEqual(summarizeMilestones([
    { status: "DONE", dueDate: "2026-07-20" },
    { status: "OPEN", dueDate: "2026-07-27" },
    { status: "CANCELLED", dueDate: "2026-07-01" },
  ], new Date("2026-07-28T00:00:00+08:00")), {
    total: 2, completed: 1, progress: 0.5, overdue: 1,
  });
});
```

- [ ] **Step 2: Run `npx tsx --test src/lib/account-plan.test.ts` and verify failure because the module is missing**

- [ ] **Step 3: Implement the pure helpers and exported types with literal status graphs**

- [ ] **Step 4: Run the focused test and `npm test`; both must pass**

- [ ] **Step 5: Commit `test: define account planning rules`**

### Task 2: Account Plan persistence and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260728180000_account_plan_lite/migration.sql`

**Interfaces:**
- Produces: Prisma models `AccountPlan`, `AccountPlanProduct`, `AccountStakeholder`, and `AccountMilestone`
- Extends: Employee, Hco, Hcp, Product, and FollowUpTask relations

- [ ] **Step 1: Add the four models with explicit named Employee relations and required uniqueness constraints**

```prisma
@@unique([hcoId, year])
@@unique([accountPlanId, productId])
@@unique([accountPlanId, hcpId])
```

- [ ] **Step 2: Add the SQL migration with foreign keys, cascade deletion for child rows, indexes for manager queries, and a unique optional `followUpTaskId`**

- [ ] **Step 3: Run `npx prisma format`, `npx prisma generate`, and `npx prisma validate`**

- [ ] **Step 4: Run `npm test` to prove existing behavior remains green**

- [ ] **Step 5: Commit `feat: add account plan data model`**

### Task 3: Create and list Account Plans

**Files:**
- Create: `src/app/api/account-plans/route.ts`
- Modify: `src/lib/account-plan.ts`
- Test: `src/lib/account-plan.test.ts`

**Interfaces:**
- Consumes: `isAccountPlanYear`, `summarizeMilestones`
- Produces: `validateAccountPlanInput(value): AccountPlanInput | null`
- Produces: `GET /api/account-plans?ownerId=&year=&hcoId=&status=`
- Produces: `POST /api/account-plans`

- [ ] **Step 1: Add failing input tests for required strategy fields, at least one product, valid stakeholder roles/attitudes, and valid milestone fields**

- [ ] **Step 2: Run the focused test and verify the expected validation failure**

- [ ] **Step 3: Implement input parsing and validation without Prisma dependencies**

- [ ] **Step 4: Implement POST checks for strategic HCO, employees, products, same-HCO stakeholders, duplicate year, and nested atomic creation**

- [ ] **Step 5: Implement GET filters and return each plan with milestone progress, overdue count, and uncovered decision-maker count**

- [ ] **Step 6: Run focused tests, `npm test`, `npm run lint`, and `npm run build`**

- [ ] **Step 7: Commit `feat: create and list account plans`**

### Task 4: Account Plan detail, editing, and closure

**Files:**
- Create: `src/app/api/account-plans/[id]/route.ts`
- Create: `src/app/api/account-plans/[id]/close/route.ts`
- Modify: `src/lib/types.ts`
- Test: `src/lib/account-plan.test.ts`

**Interfaces:**
- Consumes: plan and milestone summaries
- Produces: `GET /api/account-plans/[id]`
- Produces: `PATCH /api/account-plans/[id]`
- Produces: `POST /api/account-plans/[id]/close`
- Produces: TypeScript interfaces `AccountPlan`, `AccountStakeholder`, `AccountMilestone`

- [ ] **Step 1: Add a failing test proving closed plans are immutable**

- [ ] **Step 2: Run the focused test and verify the expected failure**

- [ ] **Step 3: Implement detail GET with products, stakeholder latest visits, milestones/tasks, HCO yearly visits, attended events, and open-task summary**

- [ ] **Step 4: Implement ACTIVE-only PATCH with full product/stakeholder replacement in a Prisma transaction**

- [ ] **Step 5: Implement one-way close and return `{ plan, openMilestones }`**

- [ ] **Step 6: Run focused tests, `npm test`, `npm run lint`, and `npm run build`**

- [ ] **Step 7: Commit `feat: manage account plan strategy`**

### Task 5: Milestones and task handoff

**Files:**
- Create: `src/app/api/account-plans/[id]/milestones/route.ts`
- Create: `src/app/api/account-plans/milestones/[id]/route.ts`
- Create: `src/app/api/account-plans/milestones/[id]/task/route.ts`
- Modify: `src/lib/account-plan.ts`
- Test: `src/lib/account-plan.test.ts`

**Interfaces:**
- Consumes: `canTransitionMilestone`
- Produces: `validateMilestoneInput(value): MilestoneInput | null`
- Produces: create milestone, transition milestone, and generate task routes

- [ ] **Step 1: Add failing validation tests for title, owner, date, and allowed status actions**

- [ ] **Step 2: Run the focused test and verify the expected failure**

- [ ] **Step 3: Implement milestone creation only for ACTIVE plans**

- [ ] **Step 4: Implement DONE/CANCELLED transitions and `completedAt` handling**

- [ ] **Step 5: Implement idempotency guard and atomic FollowUpTask creation plus `followUpTaskId` binding**

- [ ] **Step 6: Run focused tests, `npm test`, `npm run lint`, and `npm run build`**

- [ ] **Step 7: Commit `feat: connect account milestones to tasks`**

### Task 6: Account Plan list and creation interface

**Files:**
- Create: `src/app/account-plans/page.tsx`
- Create: `src/components/account-plan-editor.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: account-plan list/create API, existing HCO/HCP/Product/Employee endpoints
- Produces: `/account-plans`
- Produces: preselected HCO query `?hcoId=<id>`

- [ ] **Step 1: Read the App Router client-component and navigation guides under `node_modules/next/dist/docs/`**

- [ ] **Step 2: Build the list page with year/owner/status filters and progress/risk cards**

- [ ] **Step 3: Build the creation dialog with strategic HCO, owner, strategy fields, products, same-HCO stakeholders, and initial milestones**

- [ ] **Step 4: Add “客户策略” navigation and preselect `hcoId` from the URL**

- [ ] **Step 5: Run `npm test`, `npm run lint`, and `npm run build`**

- [ ] **Step 6: Commit `feat: add account strategy workspace`**

### Task 7: Account Plan detail interface

**Files:**
- Create: `src/app/account-plans/[id]/page.tsx`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: detail, patch, close, milestone, and task APIs
- Produces: complete strategy, stakeholder, milestone, task, and activity detail workflow

- [ ] **Step 1: Build summary cards for status, milestone progress, overdue milestones, visits, meetings, and open tasks**

- [ ] **Step 2: Render strategy and products, stakeholder roles/attitudes/coverage, milestones, and activity history**

- [ ] **Step 3: Add ACTIVE-only controls for milestone creation, task generation, completion, cancellation, editing, and close confirmation**

- [ ] **Step 4: Run `npm test`, `npm run lint`, and `npm run build`**

- [ ] **Step 5: Commit `feat: add account plan execution view`**

### Task 8: HCO and manager integration

**Files:**
- Modify: `src/app/api/hco/[id]/route.ts`
- Modify: `src/app/hco/[id]/page.tsx`
- Create: `src/app/api/account-plans/team/route.ts`
- Modify: `src/app/manager/page.tsx`
- Test: `src/lib/account-plan.test.ts`

**Interfaces:**
- Consumes: account plan progress/team helpers
- Produces: current-year `accountPlanSummary` in HCO detail
- Produces: `GET /api/account-plans/team?managerId=&year=`
- Extends: manager workbench UI with account strategy risks

- [ ] **Step 1: Add a failing team-summary test for healthy, relationship-risk, and execution-risk plans**

- [ ] **Step 2: Run the focused test and verify the missing aggregation behavior**

- [ ] **Step 3: Extend HCO detail API/page with current-year plan summary or a preselected creation link**

- [ ] **Step 4: Implement descendant-scope team API with average progress, overdue milestones, and uncovered decision makers**

- [ ] **Step 5: Load and render account strategy cards and drilldowns in the manager workbench**

- [ ] **Step 6: Run focused tests, `npm test`, `npm run lint`, and `npm run build`**

- [ ] **Step 7: Commit `feat: surface account strategy risks`**

### Task 9: Deterministic demo data

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `src/lib/demo-scenarios.test.ts`

**Interfaces:**
- Produces: three deterministic 2026 plans for healthy progress, uncovered decision-maker risk, and overdue execution risk

- [ ] **Step 1: Add failing database assertions for three plans, products, two stakeholders per plan, two milestones per plan, and the three risk states**

- [ ] **Step 2: Run `npx tsx --test src/lib/demo-scenarios.test.ts` and verify the new assertions fail**

- [ ] **Step 3: Add Account Plan children to deletion order before HCO/HCP/Product/Employee deletion**

- [ ] **Step 4: Seed three strategic HCO plans with deterministic stakeholders, milestone states, and one generated follow-up task**

- [ ] **Step 5: Run `npx prisma db seed`, the focused test, and `npm test`**

- [ ] **Step 6: Commit `chore: seed account strategy demo`**

### Task 10: Full verification and demo documentation

**Files:**
- Modify: `docs/product/pharma-sales-p0-demo-script.md`

**Interfaces:**
- Produces: repeatable Account Plan creation, execution, HCO drilldown, and manager-risk demo path

- [ ] **Step 1: Document the exact healthy, relationship-risk, execution-risk, and milestone-to-task demo flow**

- [ ] **Step 2: Run `npm test` and verify zero failures**

- [ ] **Step 3: Run `npm run lint` and verify zero errors**

- [ ] **Step 4: Run `npx prisma validate` and verify the schema is valid**

- [ ] **Step 5: Run `npm run build` and verify exit code 0**

- [ ] **Step 6: Run the production server and browser-check `/account-plans`, `/account-plans/[id]`, HCO summary, milestone-to-task, and manager risks**

- [ ] **Step 7: Run `git diff --check` and confirm only the existing `audit-output/` remains untracked**

- [ ] **Step 8: Commit `docs: add account strategy demo flow`**

