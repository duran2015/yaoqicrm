# Sales Results Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic demo flow for monthly sales targets, actuals, trends, dimension drilldowns, activity association, and validated CSV imports.

**Architecture:** Store one normalized `SalesResult` per month/product/HCO/employee and one lightweight `SalesImportBatch` per confirmed import. Keep calculations, CSV parsing, and activity association in focused domain/data modules; expose them through small REST routes consumed by one analysis page plus compact dashboard summaries.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 6, SQLite, Recharts, `csv-parse`, Node test runner via `tsx --test`.

## Global Constraints

- Preserve the existing Next.js, SQLite, Prisma, component library, and visual style.
- Store money as non-negative integer cents and quantities as non-negative integers.
- Use Shanghai business-month boundaries.
- One business key is month + product + HCO + employee; confirmed imports upsert rather than accumulate.
- A preview never writes sales facts; confirmation is transactional.
- Limit CSV input to 5,000 data rows.
- Treat activity as association only; do not claim causal attribution.
- Do not implement orders, flow reconciliation, forecasting, approval, async jobs, Excel, multi-currency, or production authorization.
- Do not modify or commit `audit-output/`.

---

### Task 1: Sales calculation and CSV domain rules

**Files:**
- Create: `src/lib/sales-results.ts`
- Create: `src/lib/sales-results.test.ts`

**Interfaces:**
- Produces: `parseSalesMonth(value)`, `yuanToCents(value)`, `attainment(actual, target)`, `monthOverMonth(current, previous)`, `parseSalesCsv(text)`, and `dedupeSalesRows(rows)`.

- [ ] **Step 1: Write failing tests**

Cover `2026-07` Shanghai bounds, exact decimal-to-cents conversion, invalid/negative numbers, zero-target attainment, zero-baseline MoM, fixed headers, invalid rows, 5,001-row rejection, and last-row-wins duplicate keys.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test src/lib/sales-results.test.ts`  
Expected: FAIL because `src/lib/sales-results.ts` does not exist.

- [ ] **Step 3: Implement the minimum pure functions**

Use these public shapes:

```ts
export type SalesCsvRow = {
  line: number;
  month: string;
  productCode: string;
  hcoCode: string;
  employeeCode: string;
  targetAmountCents: number;
  actualAmountCents: number;
  targetQuantity: number;
  actualQuantity: number;
};

export type MonthOverMonth =
  | { kind: "RATE"; value: number }
  | { kind: "NEW"; value: null };
```

Parse CSV with `csv-parse/sync`, require the exact eight headers, trim codes, and return `{ validRows, errors, warnings }`.

- [ ] **Step 4: Run focused and full tests**

Run: `npx tsx --test src/lib/sales-results.test.ts`  
Expected: all sales-result tests PASS.

Run: `npm test`  
Expected: complete suite PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sales-results.ts src/lib/sales-results.test.ts
git commit -m "test: define sales result rules"
```

### Task 2: Prisma sales facts and deterministic seed

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260728190000_sales_results_loop/migration.sql`
- Modify: `prisma/seed.ts`
- Modify: `src/lib/demo-data.test.ts`

**Interfaces:**
- Produces: Prisma models `SalesResult` and `SalesImportBatch`, unique input `month_productId_hcoId_employeeId`, and six deterministic months ending 2026-07.

- [ ] **Step 1: Add failing seed assertions**

Assert that seed data contains six distinct months, at least three products/HCOs/employees, and the three scenarios: steady growth, one-month delayed improvement, and persistent under-target performance.

- [ ] **Step 2: Run the seed test and verify RED**

Run: `npx tsx --test src/lib/demo-data.test.ts`  
Expected: FAIL because `SalesResult` does not exist.

- [ ] **Step 3: Add schema, migration, and relations**

Add non-null integer amount/quantity fields, optional batch relation, timestamps, the composite unique constraint, and reverse relations on `Product`, `Hco`, and `Employee`.

- [ ] **Step 4: Add fixed seed facts**

Generate exactly six Shanghai business months from 2026-02 through 2026-07. Use existing products, strategic HCOs, and representatives so activity data can be associated without creating parallel master data.

- [ ] **Step 5: Apply and validate**

Run: `npx prisma migrate deploy`  
Expected: migration applied.

Run: `npx prisma db seed`  
Expected: seed summary includes sales result rows.

Run: `npm test`  
Expected: complete suite PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260728190000_sales_results_loop/migration.sql prisma/seed.ts src/lib/demo-data.test.ts
git commit -m "feat: add monthly sales result facts"
```

### Task 3: Aggregation and activity-association data service

**Files:**
- Create: `src/lib/sales-results-data.ts`
- Modify: `src/lib/sales-results.test.ts`
- Create: `src/app/api/sales-results/summary/route.ts`
- Create: `src/app/api/sales-results/breakdown/route.ts`
- Create: `src/app/api/sales-results/detail/route.ts`

**Interfaces:**
- Produces: `getSalesSummary({ month, employeeIds? })`, `getSalesBreakdown({ month, dimension, employeeIds? })`, and `getSalesDetail({ month, dimension, id, employeeIds? })`.

- [ ] **Step 1: Add failing aggregation tests**

Test total consistency, weighted attainment from summed amounts, product/HCO/employee grouping, previous-month comparison, submitted-visit filtering, HCP deduplication, started-meeting filtering, and completed-milestone filtering.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx tsx --test src/lib/sales-results.test.ts`  
Expected: FAIL on missing aggregation helpers.

- [ ] **Step 3: Implement data service**

Return cents and raw ratios from the service. For detail return six chronological rows:

```ts
type SalesDetailMonth = {
  month: string;
  targetAmountCents: number;
  actualAmountCents: number;
  attainment: number | null;
  monthOverMonth: MonthOverMonth | null;
  targetQuantity: number;
  actualQuantity: number;
  activity: {
    visits: number;
    coveredHcps: number;
    meetings: number;
    completedMilestones: number;
  };
};
```

- [ ] **Step 4: Add read-only API routes**

Validate `month` and `dimension` before database access. Use current query-parameter identity conventions: optional `employeeId` for personal scope and `managerId` resolved through `collectSubtreeIds` for team scope.

- [ ] **Step 5: Verify**

Run: `npm test`  
Expected: complete suite PASS.

Run: `npm run lint`  
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sales-results.ts src/lib/sales-results.test.ts src/lib/sales-results-data.ts src/app/api/sales-results
git commit -m "feat: expose sales result analysis"
```

### Task 4: CSV preview and transactional confirmation

**Files:**
- Create: `src/lib/sales-import.ts`
- Create: `src/app/api/sales-results/import-template/route.ts`
- Create: `src/app/api/sales-results/import-preview/route.ts`
- Create: `src/app/api/sales-results/import-confirm/route.ts`
- Create: `src/app/api/sales-results/import-batches/route.ts`
- Modify: `src/lib/sales-results.test.ts`

**Interfaces:**
- Produces: `validateSalesRows(rows)`, a signed-content-free preview payload with normalized rows, and transactional `confirmSalesImport`.

- [ ] **Step 1: Add failing validation/import tests**

Cover missing master codes, division mismatch, no-write preview, invalid-row confirmation rejection, composite-key upsert, and rollback semantics.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx tsx --test src/lib/sales-results.test.ts`  
Expected: FAIL on missing import service.

- [ ] **Step 3: Implement template and preview**

The template route returns UTF-8 CSV. Preview accepts multipart field `file`, parses text, resolves codes in bulk, and returns normalized IDs plus row-level errors. Do not create a batch during preview.

- [ ] **Step 4: Implement confirmation and batch listing**

Confirmation accepts `{ fileName, importedById, rows }`, revalidates every normalized row, then creates one `COMPLETED` batch and upserts all facts inside `prisma.$transaction`. On failure, write one separate `FAILED` batch without partial facts.

- [ ] **Step 5: Verify**

Run: `npm test`  
Expected: complete suite PASS.

Run: `npm run lint`  
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sales-import.ts src/lib/sales-results.test.ts src/app/api/sales-results
git commit -m "feat: import sales results from csv"
```

### Task 5: Sales analysis and import UI

**Files:**
- Create: `src/app/sales-results/page.tsx`
- Create: `src/app/sales-results/import/page.tsx`
- Create: `src/components/sales-result-cards.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: summary, breakdown, detail, preview, confirmation, batch, and template routes.
- Produces: navigation item `销售结果`, analysis UI, and import UI.

- [ ] **Step 1: Add shared response types and focused formatting tests**

Add types matching Task 3 exactly. Test currency, attainment, and MoM presentation helpers in `src/lib/sales-results.test.ts`.

- [ ] **Step 2: Run test and verify RED**

Run: `npx tsx --test src/lib/sales-results.test.ts`  
Expected: FAIL until presentation helpers exist.

- [ ] **Step 3: Implement overview and drilldown**

Use existing `PageHeader`, `Card`, `Select`, `Badge`, `Loading`, `ErrorBox`, and Recharts patterns. Keep dimension and selected ID in URL search parameters. Display all monetary amounts in yuan and label activity cards “活动关联”.

- [ ] **Step 4: Implement import page**

Use a native file input, preview table, row errors, disabled confirmation when errors exist, template download link, success notice, and recent batch table.

- [ ] **Step 5: Verify**

Run: `npm test`  
Expected: complete suite PASS.

Run: `npm run lint`  
Expected: zero errors.

Run: `npm run build`  
Expected: production build PASS with both new pages.

- [ ] **Step 6: Commit**

```bash
git add src/app/sales-results src/components/sales-result-cards.tsx src/components/app-shell.tsx src/lib/types.ts src/lib/sales-results.ts src/lib/sales-results.test.ts
git commit -m "feat: add sales result workspace"
```

### Task 6: Dashboard summaries, demo guide, and end-to-end verification

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/manager/page.tsx`
- Modify: `docs/product/pharma-sales-p0-demo-script.md`

**Interfaces:**
- Consumes: `GET /api/sales-results/summary`.
- Produces: personal/team summary cards and a repeatable sales-results demo story.

- [ ] **Step 1: Add compact dashboard summaries**

MR requests summary with `employeeId=current.id`. Manager requests summary with `managerId=current.id`. Both show target, actual, attainment, MoM, and one link to `/sales-results`; do not duplicate trend or breakdown tables.

- [ ] **Step 2: Extend the demo guide**

Document the three fixed scenarios, product/HCO/employee drilldown, activity-association wording, invalid preview, valid confirmation, and seed reset.

- [ ] **Step 3: Run full automated verification**

Run: `npx prisma validate`  
Expected: schema valid.

Run: `npm test`  
Expected: all tests PASS.

Run: `npm run lint`  
Expected: zero errors.

Run: `npm run build`  
Expected: production build PASS.

Run: `git diff --check`  
Expected: no output.

- [ ] **Step 4: Run browser acceptance**

Start the production server and use Playwright to verify:

1. Sales overview loads six months and all three dimensions.
2. One detail view shows sales and activity association.
3. Invalid CSV displays row errors and disables confirmation.
4. Valid CSV confirms and changes the selected month.
5. MR and manager summaries match the analysis totals.

After the write-flow check, rerun `npx prisma db seed` to restore deterministic data.

- [ ] **Step 5: Re-run verification after reset**

Run: `npm test && npm run lint && npx prisma validate && npm run build && git diff --check`  
Expected: every command exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/manager/page.tsx docs/product/pharma-sales-p0-demo-script.md
git commit -m "feat: surface sales outcomes in workbenches"
```

