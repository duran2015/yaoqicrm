# Pharma Sales P0 Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully persisted demo flow from weekly planning through visits, follow-up, manager coaching, samples, and event follow-up.

**Architecture:** Extend the existing Prisma schema with small linked workflow entities and keep state-transition rules in focused domain modules used by route handlers. Existing pages remain the primary UI; two focused pages, tasks and manager workbench, are added. API mutations use Prisma transactions so linked status changes and inventory calculations remain consistent.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 6, SQLite, Tailwind CSS 4, Node test runner through `tsx --test`.

## Global Constraints

- Preserve the existing Next.js, SQLite, navigation, component patterns, and visual style.
- Every user action must persist a database state change; do not add static demo-only controls.
- Link plans, visits, tasks, samples, events, and coaching through database IDs.
- Use HTTP 409 for invalid state transitions, 400 for invalid input, and 404 for missing objects.
- Do not implement offline, maps, drag-and-drop calendars, legal electronic signatures, generic workflow engines, Cycle Plan, Account Plan, sales imports, WorkBuddy/MCP, PostgreSQL, or SSO/RBAC.
- Follow `AGENTS.md`: read relevant Next.js 15 documentation in `node_modules/next/dist/docs/` before changing routes or pages.

---

### Task 1: Test Harness and Shared Workflow Schema

**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma`
- Create: `src/lib/workflow.ts`
- Create: `src/lib/workflow.test.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `assertTransition(current: string, next: string, allowed: Record<string, readonly string[]>): void`
- Produces: `calculateInventory(transactions: Array<{ type: string; quantity: number }>): number`
- Produces Prisma entities and relations consumed by every later task.

- [ ] **Step 1: Add a failing workflow test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { assertTransition, calculateInventory } from "./workflow";

test("rejects transitions not present in the state graph", () => {
  assert.throws(
    () => assertTransition("COMPLETED", "OPEN", { OPEN: ["COMPLETED"], COMPLETED: [] }),
    /状态不能从 COMPLETED 变更为 OPEN/
  );
});

test("calculates inventory from all four transaction types", () => {
  assert.equal(calculateInventory([
    { type: "RECEIVE", quantity: 20 },
    { type: "DISTRIBUTE", quantity: 5 },
    { type: "RETURN", quantity: 2 },
    { type: "ADJUST", quantity: -1 },
  ]), 12);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx --test src/lib/workflow.test.ts`  
Expected: FAIL because `src/lib/workflow.ts` does not exist.

- [ ] **Step 3: Implement the workflow helpers**

```ts
export function assertTransition(
  current: string,
  next: string,
  allowed: Record<string, readonly string[]>
) {
  if (!allowed[current]?.includes(next)) {
    throw new Error(`状态不能从 ${current} 变更为 ${next}`);
  }
}

export function calculateInventory(
  transactions: Array<{ type: string; quantity: number }>
) {
  return transactions.reduce((sum, txn) => {
    if (txn.type === "RECEIVE") return sum + txn.quantity;
    if (txn.type === "DISTRIBUTE" || txn.type === "RETURN") return sum - txn.quantity;
    if (txn.type === "ADJUST") return sum + txn.quantity;
    throw new Error(`未知样品事务类型: ${txn.type}`);
  }, 0);
}
```

- [ ] **Step 4: Extend Prisma**

Add `FollowUpTask` and `CoachingAction`; add the plan item, visit, sample transaction, event, and attendance fields exactly as defined in the approved spec. Use explicit relation names where `Visit` and `Employee` have multiple relations. Add indexes on assignee/status/dueDate and manager/employee/status.

- [ ] **Step 5: Generate and migrate**

Run: `npx prisma format && npx prisma migrate dev --name pharma_sales_p0`

- [ ] **Step 6: Run tests and type generation**

Run: `npx tsx --test src/lib/workflow.test.ts && npx prisma validate`
Expected: 2 tests pass and schema validation succeeds.

- [ ] **Step 7: Commit**

```bash
git add package.json prisma src/lib/workflow.ts src/lib/workflow.test.ts src/lib/types.ts
git commit -m "feat: add sales workflow domain model"
```

### Task 2: Weekly Plan Editor, Calendar, and Plan-to-Visit Flow

**Files:**
- Create: `src/lib/tour-plan.ts`
- Create: `src/lib/tour-plan.test.ts`
- Modify: `src/app/api/tour-plans/route.ts`
- Create: `src/app/api/tour-plans/[id]/route.ts`
- Create: `src/app/api/tour-plans/items/[id]/cancel/route.ts`
- Modify: `src/app/api/visits/route.ts`
- Modify: `src/app/tour-plans/page.tsx`
- Modify: `src/components/visit-form.tsx`

**Interfaces:**
- Consumes: `assertTransition`
- Produces: `canEditPlan(status: string): boolean`
- Produces: `canStartPlanItem(planStatus: string, itemStatus: string, visitId?: string | null): boolean`
- Produces API support for `tourPlanItemId` and `status`.

- [ ] **Step 1: Write failing plan rule tests**

```ts
test("only draft and rejected plans can be edited", () => {
  assert.equal(canEditPlan("DRAFT"), true);
  assert.equal(canEditPlan("REJECTED"), true);
  assert.equal(canEditPlan("SUBMITTED"), false);
});

test("only approved unexecuted plan items can start visits", () => {
  assert.equal(canStartPlanItem("APPROVED", "PLANNED", null), true);
  assert.equal(canStartPlanItem("DRAFT", "PLANNED", null), false);
  assert.equal(canStartPlanItem("APPROVED", "COMPLETED", "visit-1"), false);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/lib/tour-plan.test.ts`
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement rules and route mutations**

Implement plan patching only for editable plans, cancel only planned items, and visit creation in a Prisma transaction. When a submitted visit references a plan item, connect the visit and set the item to `COMPLETED`; draft visits retain `PLANNED`.

- [ ] **Step 4: Implement the existing-page UI**

Add create/edit plan modal, week selector, seven-column responsive week view, status badges, empty-state CTA, and “记录拜访” action. Reuse `Card`, `Button`, `Badge`, and existing HCP lookup patterns.

- [ ] **Step 5: Verify GREEN and build**

Run: `npx tsx --test src/lib/tour-plan.test.ts && npm run lint && npm run build`
Expected: rule tests pass, lint and build exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/tour-plans src/app/api/tour-plans src/app/api/visits src/components/visit-form.tsx src/lib/tour-plan*
git commit -m "feat: complete weekly plan to visit flow"
```

### Task 3: Visit Brief, Structured Tasks, and Follow-up Visits

**Files:**
- Create: `src/lib/follow-up-task.ts`
- Create: `src/lib/follow-up-task.test.ts`
- Create: `src/app/api/visit-brief/route.ts`
- Create: `src/app/api/tasks/route.ts`
- Create: `src/app/api/tasks/[id]/route.ts`
- Create: `src/app/api/tasks/[id]/follow-up-visit/route.ts`
- Modify: `src/app/api/visits/route.ts`
- Modify: `src/app/api/visits/[id]/route.ts`
- Create: `src/app/tasks/page.tsx`
- Modify: `src/components/visit-form.tsx`
- Modify: `src/app/hcp/[id]/page.tsx`
- Modify: `src/components/app-shell.tsx`

**Interfaces:**
- Produces: `TASK_TRANSITIONS`
- Produces: `isTaskOverdue(task: { status: string; dueDate: Date | string | null }, now?: Date): boolean`
- Produces visit brief response `{ hcp, recentVisits, openTasks, sampleSummary }`.

- [ ] **Step 1: Write failing task rule tests**

Test that only `OPEN → DONE/CANCELLED` is allowed, due dates before today are overdue only while open, and completed tasks are not overdue.

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/lib/follow-up-task.test.ts`
Expected: FAIL because the task module is missing.

- [ ] **Step 3: Implement task APIs**

Create list/create/update routes scoped by `assigneeId`. Enforce at least one HCP/HCO. Follow-up creation must create a draft visit once and save `followUpVisitId`; a repeated request returns HTTP 409.

- [ ] **Step 4: Implement visit brief and task creation during submission**

Return HCP profile, three recent submitted visits, open tasks, product feedback, and sample summary. In visit submission, create the optional task in the same transaction.

- [ ] **Step 5: Implement UI**

Add a brief panel to the visit form, task fields on submission, `/tasks` filters/actions, task section and “计划拜访” on HCP detail, and navigation entry.

- [ ] **Step 6: Verify GREEN**

Run: `npx tsx --test src/lib/follow-up-task.test.ts && npm run lint && npm run build`
Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/follow-up-task* src/app/api/visit-brief src/app/api/tasks src/app/api/visits src/app/tasks src/app/hcp src/components
git commit -m "feat: add visit briefs and follow-up workflow"
```

### Task 4: Manager Workbench and Coaching Loop

**Files:**
- Create: `src/lib/coaching.ts`
- Create: `src/lib/coaching.test.ts`
- Create: `src/app/api/manager/workbench/route.ts`
- Create: `src/app/api/coaching-actions/route.ts`
- Create: `src/app/api/coaching-actions/[id]/route.ts`
- Create: `src/app/manager/page.tsx`
- Modify: `src/app/evaluations/page.tsx`
- Modify: `src/components/app-shell.tsx`

**Interfaces:**
- Produces: `COACHING_TRANSITIONS`
- Produces workbench counts and records for plan approvals, visit evaluations, check-in exceptions, overdue tasks, and coaching actions.

- [ ] **Step 1: Write failing coaching transition tests**

Test `OPEN → DONE/CANCELLED`, reject `DONE → OPEN`, and require manager and employee to be different.

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/lib/coaching.test.ts`
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement workbench and coaching APIs**

Use the existing employee subtree semantics. Accept `managerId` and subordinate IDs from the current demo context, aggregate the five queues, and preserve links to source records.

- [ ] **Step 4: Implement manager UI**

Add summary cards, queue tabs, employee breakdown, deep links, coaching creation modal, and completion action. Add “创建辅导行动” to an evaluated/exception visit where appropriate.

- [ ] **Step 5: Verify GREEN**

Run: `npx tsx --test src/lib/coaching.test.ts && npm run lint && npm run build`
Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/coaching* src/app/api/manager src/app/api/coaching-actions src/app/manager src/app/evaluations src/components/app-shell.tsx
git commit -m "feat: add manager coaching workbench"
```

### Task 5: Sample Receive, Distribute, Return, and Count

**Files:**
- Create: `src/lib/sample-inventory.ts`
- Create: `src/lib/sample-inventory.test.ts`
- Modify: `src/app/api/samples/inventory/route.ts`
- Create: `src/app/api/samples/transactions/route.ts`
- Modify: `src/app/api/visits/route.ts`
- Modify: `src/app/samples/page.tsx`
- Modify: `src/components/visit-form.tsx`

**Interfaces:**
- Consumes: `calculateInventory`
- Produces: `signedQuantity(type: string, quantity: number): number`
- Produces transaction list/create endpoint.

- [ ] **Step 1: Write failing inventory tests**

Test signed quantities for all four types, reject zero, reject negative RECEIVE/DISTRIBUTE/RETURN input, and allow signed ADJUST.

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/lib/sample-inventory.test.ts`
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement atomic transaction API**

List by employee with lot/product/HCP/visit. Create RECEIVE, RETURN, and ADJUST transactions. Compute the selected lot balance inside the transaction and reject operations that would make it negative. DISTRIBUTE remains visit-owned and follows the same helper.

- [ ] **Step 4: Implement sample UI**

Add operation modal, lot selector, projected balance, reason, count mode that calculates ADJUST from physical count, and chronological transaction table. Add demo signature confirmation to visit sample rows.

- [ ] **Step 5: Verify GREEN**

Run: `npx tsx --test src/lib/sample-inventory.test.ts && npm run lint && npm run build`
Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sample-inventory* src/app/api/samples src/app/api/visits src/app/samples src/components/visit-form.tsx
git commit -m "feat: complete sample inventory workflow"
```

### Task 6: Event Creation, Attendance, and Batch Follow-up

**Files:**
- Create: `src/lib/event-workflow.ts`
- Create: `src/lib/event-workflow.test.ts`
- Modify: `src/app/api/events/route.ts`
- Modify: `src/app/api/events/[id]/route.ts`
- Create: `src/app/api/events/[id]/attendees/[attendanceId]/route.ts`
- Create: `src/app/api/events/[id]/follow-up-tasks/route.ts`
- Modify: `src/app/events/page.tsx`

**Interfaces:**
- Produces: `EVENT_TRANSITIONS`
- Produces: `canMarkAttendance(eventStatus: string): boolean`
- Produces batch follow-up response `{ created: number; skipped: number }`.

- [ ] **Step 1: Write failing event workflow tests**

Test `DRAFT → OPEN/CANCELLED`, `OPEN → COMPLETED/CANCELLED`, attendance only while open, and no transition out of completed/cancelled.

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/lib/event-workflow.test.ts`
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement event routes**

Create draft events with invited attendees; patch status with transition validation; mark invitation checked-in/absent only while open; batch-create tasks for checked-in attendees after completion and skip matching open duplicates.

- [ ] **Step 4: Implement event UI**

Add create modal, HCP selection, status actions, attendance controls, completion action, and batch follow-up form with title and due date.

- [ ] **Step 5: Verify GREEN**

Run: `npx tsx --test src/lib/event-workflow.test.ts && npm run lint && npm run build`
Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/event-workflow* src/app/api/events src/app/events
git commit -m "feat: complete event follow-up workflow"
```

### Task 7: Deterministic Demo Data

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `src/lib/constants.ts`
- Create: `src/lib/demo-scenarios.test.ts`

**Interfaces:**
- Consumes all Prisma models created above.
- Produces deterministic records discoverable by stable employee/customer codes and descriptive titles.

- [ ] **Step 1: Write a failing seed verification test**

The test runs seed against a temporary SQLite database and asserts the required counts: three plan states, three task states/timings, four sample transaction types, two event scenarios, and two coaching states.

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/lib/demo-scenarios.test.ts`
Expected: FAIL because the current seed lacks the scenarios.

- [ ] **Step 3: Extend seed**

Delete records in dependency order, then create stable scenarios using the existing demo employees, HCPs, products, and sample lots. Use relative dates based on the current week so the UI always contains current and overdue records.

- [ ] **Step 4: Verify idempotence and GREEN**

Run: `npx prisma db seed && npx prisma db seed && npx tsx --test src/lib/demo-scenarios.test.ts`
Expected: both seed runs exit 0 and the verification test passes.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts src/lib/constants.ts src/lib/demo-scenarios.test.ts
git commit -m "chore: seed complete pharma sales demo"
```

### Task 8: End-to-End Verification and Documentation

**Files:**
- Modify: `README.md`
- Create: `docs/product/pharma-sales-p0-demo-script.md`
- Modify: `docs/product/2026-07-28-pharma-sales-functional-audit.md`

**Interfaces:**
- Produces a repeatable demo script and an updated capability verdict.

- [ ] **Step 1: Run automated verification**

Run: `npx tsx --test 'src/lib/*.test.ts' && npm run lint && npm run build`
Expected: all tests pass; lint and build exit 0.

- [ ] **Step 2: Start the app and run browser flows**

Run: `npm run dev`

Verify in a real browser:

1. Create, submit, approve a plan and turn one item into a submitted visit.
2. Generate a task from the visit and create a follow-up visit.
3. Create and complete a coaching action from the manager workbench.
4. Receive, distribute, return, and count sample inventory without negative stock.
5. Create an event, check in an HCP, complete it, and generate a follow-up task.

- [ ] **Step 3: Update documentation**

Document exact demo users, click path, expected state changes, setup commands, and known demo-only limitations. Change the audit matrix only for capabilities verified in Step 2.

- [ ] **Step 4: Re-run final verification**

Run: `git diff --check && npx tsx --test 'src/lib/*.test.ts' && npm run lint && npm run build`
Expected: diff check, tests, lint, and build all succeed.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/product
git commit -m "docs: add pharma sales P0 demo guide"
```
