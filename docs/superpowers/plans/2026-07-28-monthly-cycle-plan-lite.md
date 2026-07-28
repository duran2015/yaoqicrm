# Monthly Cycle Plan Lite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stable monthly HCP coverage target snapshot that connects customer tiering, completed visits, weekly planning, and the manager workbench.

**Architecture:** Persist one `CyclePlan` per employee and month with immutable customer-tier target items. Calculate completion from submitted visits at read time, and reuse the existing weekly plan flow for scheduling remaining coverage.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 6, SQLite, Node test runner via `tsx --test`, Tailwind CSS.

## Global Constraints

- Preserve the existing Next.js, SQLite, and visual style.
- Use monthly plans only; store the first day of the month.
- Default tier frequency is A/B/C/D = 4/2/1/0.
- Count only submitted visits for the same employee, HCP, and calendar month.
- Reuse `TourPlan` for scheduling; do not create a second scheduling workflow.
- Do not implement approval, plan versions, quarterly planning, forecasting, WorkBuddy/MCP, PostgreSQL, SSO, or a new permission framework.
- Follow strict red-green-refactor TDD for each behavior.

---

### Task 1: Monthly cycle calculations

**Files:**
- Create: `src/lib/cycle-plan.ts`
- Test: `src/lib/cycle-plan.test.ts`

**Interfaces:**
- Produces: `parseCycleMonth(value: string): { start: Date; end: Date } | null`
- Produces: `frequencyForTier(tier: string | null, frequencies: TierFrequencies): number`
- Produces: `summarizeCycleItems(items: CycleProgressItem[]): CycleSummary`
- Produces: `sortCycleGaps(items: CycleProgressItem[]): CycleProgressItem[]`

- [ ] **Step 1: Write failing tests for month parsing, tier defaults, capped completion, zero targets, and A/B gap ordering**

```ts
test("parseCycleMonth returns Shanghai month boundaries", () => {
  assert.deepEqual(parseCycleMonth("2026-07"), {
    start: new Date("2026-06-30T16:00:00.000Z"),
    end: new Date("2026-07-31T16:00:00.000Z"),
  });
});
```

- [ ] **Step 2: Run `npx tsx --test src/lib/cycle-plan.test.ts` and verify it fails because the module is missing**

- [ ] **Step 3: Implement the four pure helpers with `TierFrequencies`, `CycleProgressItem`, and `CycleSummary` types**

```ts
export type TierFrequencies = { A: number; B: number; C: number; D: number };
export type CycleProgressItem = {
  tierSnapshot: string;
  targetVisits: number;
  completedVisits: number;
};
```

- [ ] **Step 4: Run the focused test and then `npm test`; both must pass**

- [ ] **Step 5: Commit `test: define monthly cycle plan calculations`**

### Task 2: Cycle plan persistence and creation API

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260728150000_monthly_cycle_plan/migration.sql`
- Create: `src/app/api/cycle-plans/route.ts`
- Modify: `src/lib/cycle-plan.ts`
- Test: `src/lib/cycle-plan.test.ts`

**Interfaces:**
- Consumes: `parseCycleMonth`, `frequencyForTier`
- Produces: Prisma models `CyclePlan` and `CyclePlanItem`
- Produces: `validateFrequencies(value: unknown): TierFrequencies | null`
- Produces: `POST /api/cycle-plans`

- [ ] **Step 1: Add failing validation tests for integer frequencies 0–31 and rejection of missing, negative, fractional, or oversized values**

- [ ] **Step 2: Run the focused test and verify the expected assertion failure**

- [ ] **Step 3: Implement `validateFrequencies`, the Prisma models/relations/indexes, and SQL migration**

```prisma
@@unique([employeeId, month])
@@unique([cyclePlanId, hcpId])
```

- [ ] **Step 4: Implement POST validation, verify employee and creator exist, load OWNER HCP assignments, and create the plan plus snapshot items in one Prisma call**

- [ ] **Step 5: Run `npx prisma generate`, `npx prisma validate`, the focused test, and `npm test`**

- [ ] **Step 6: Commit `feat: create monthly cycle plan snapshots`**

### Task 3: Progress query API

**Files:**
- Modify: `src/app/api/cycle-plans/route.ts`
- Modify: `src/lib/cycle-plan.ts`
- Test: `src/lib/cycle-plan.test.ts`

**Interfaces:**
- Consumes: month boundaries and summary helpers
- Produces: `attachCycleProgress(items, visitsByHcp): CycleProgressItem[]`
- Produces: `GET /api/cycle-plans?employeeId=&month=`

- [ ] **Step 1: Add a failing test proving visit counts attach by HCP and remaining visits never become negative**

- [ ] **Step 2: Run the focused test and verify the missing helper failure**

- [ ] **Step 3: Implement `attachCycleProgress` and GET query validation**

- [ ] **Step 4: Query only `SUBMITTED` visits within the parsed month and return `{ plan, summary, items }`**

- [ ] **Step 5: Run the focused test and `npm test`**

- [ ] **Step 6: Commit `feat: report monthly coverage progress`**

### Task 4: Representative Cycle Plan page and weekly-plan handoff

**Files:**
- Create: `src/app/cycle-plans/page.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/app/tour-plans/page.tsx`
- Modify: `src/components/tour-plan-editor.tsx`
- Test: `src/lib/cycle-plan.test.ts`

**Interfaces:**
- Consumes: cycle-plan GET/POST response and existing `apiGet`/`apiPost`
- Produces: `/cycle-plans`
- Produces: `/tour-plans?hcpId=<id>` preselection

- [ ] **Step 1: Add a failing pure-helper test for `cyclePlanToTourPlanHref(hcpId)` returning an encoded `/tour-plans?hcpId=...` URL**

- [ ] **Step 2: Run the focused test and verify it fails because the helper is absent**

- [ ] **Step 3: Implement the link helper and create the page with month/employee filters, creation dialog, summary cards, and gap table**

- [ ] **Step 4: Add the navigation item and read `hcpId` from search params so the existing plan editor starts with that HCP selected**

- [ ] **Step 5: Run focused tests, `npm test`, and `npm run lint`**

- [ ] **Step 6: Commit `feat: add monthly coverage workspace`**

### Task 5: Team coverage and manager workbench

**Files:**
- Create: `src/app/api/cycle-plans/team/route.ts`
- Modify: `src/app/api/manager/workbench/route.ts`
- Modify: `src/app/manager/page.tsx`
- Modify: `src/lib/cycle-plan.ts`
- Test: `src/lib/cycle-plan.test.ts`

**Interfaces:**
- Consumes: descendant employee scope pattern from manager workbench
- Produces: `summarizeTeamCycles(rows): TeamCycleSummary`
- Produces: `GET /api/cycle-plans/team?managerId=&month=`
- Extends manager workbench response with `cycleCoverage`

- [ ] **Step 1: Add a failing test for team aggregation across high, in-progress, and lagging representatives**

- [ ] **Step 2: Run the focused test and verify the missing team summary behavior**

- [ ] **Step 3: Implement team aggregation and API response with team totals, employee rows, and A/B uncovered customers**

- [ ] **Step 4: Load current-month cycle coverage in the manager workbench and render team coverage, lagging employees, and priority uncovered customers**

- [ ] **Step 5: Run focused tests, `npm test`, and `npm run lint`**

- [ ] **Step 6: Commit `feat: add team cycle coverage workbench`**

### Task 6: Deterministic demo data

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `src/lib/demo-scenarios.test.ts`

**Interfaces:**
- Consumes: CyclePlan schema and July 2026 visit data
- Produces: deterministic OWNER assignments and 2026-07 cycle plans for at least three representatives

- [ ] **Step 1: Add failing demo-scenario source assertions for cycle-plan deletion order, OWNER assignment creation, and July cycle-plan creation**

- [ ] **Step 2: Run `npx tsx --test src/lib/demo-scenarios.test.ts` and verify the new assertions fail**

- [ ] **Step 3: Update deletion order and assign each HCP to a deterministic same-division MR**

- [ ] **Step 4: Seed July plans with A/B/C/D = 4/2/1/0 and choose assignments so visits produce high, in-progress, and lagging examples**

- [ ] **Step 5: Run focused tests, `npm test`, `npx prisma db seed`, and query the database to verify all three states**

- [ ] **Step 6: Commit `chore: seed monthly coverage demo`**

### Task 7: Full verification and demo documentation

**Files:**
- Modify: `docs/product/pharma-sales-p0-demo-script.md`

**Interfaces:**
- Consumes: complete Cycle Plan workflow
- Produces: repeatable monthly coverage demo path

- [ ] **Step 1: Add the exact manager-create, representative-gap, weekly-handoff, and manager-downstream demo steps**

- [ ] **Step 2: Run `npm test` and verify zero failures**

- [ ] **Step 3: Run `npm run lint` and verify zero errors**

- [ ] **Step 4: Run `npx prisma validate` and verify the schema is valid**

- [ ] **Step 5: Run `npm run build` and verify exit code 0**

- [ ] **Step 6: Start the app and browser-check `/cycle-plans`, weekly-plan handoff, and manager coverage**

- [ ] **Step 7: Commit `docs: add monthly coverage demo flow`**

