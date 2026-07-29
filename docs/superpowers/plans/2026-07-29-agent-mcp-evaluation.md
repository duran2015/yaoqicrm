# Agent/MCP Automatic Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic evaluation suite and CRM dashboard that exercises the real MCP protocol, identity boundary, sales-intelligence search, product battlecard, refresh confirmation, idempotency, and audit behavior.

**Architecture:** Prisma stores immutable run/result/assertion snapshots. A focused Streamable HTTP client and scenario runner execute the fixed suite against the configured MCP endpoint; Next.js APIs authorize managers, persist runs, and expose summaries. A separate `/agent-evaluations` page presents operational evidence without changing the existing visit-evaluation workflow.

**Tech Stack:** Next.js 15, TypeScript, Prisma 6, SQLite, Node test runner, Streamable HTTP MCP JSON-RPC, existing CRM UI components.

## Global Constraints

- Do not use an external LLM or model-based scoring.
- Never persist JWTs, signing secrets, cookies, authorization headers, or MCP session IDs.
- Keep the fixed suite at 9 cases and run sequentially with a 15-second per-request timeout.
- Only `ADMIN`, `RSM`, and `ASM` may start runs.
- Reuse the current UI language, layout, components, and deployment base path.

---

### Task 1: Evaluation domain and persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260729130000_agent_evaluations/migration.sql`
- Create: `src/lib/agent-evaluation.ts`
- Test: `src/lib/agent-evaluation.test.ts`

**Interfaces:**
- Produces: `scoreEvaluation(results)`, `redactEvaluationValue(value)`, `canRunAgentEvaluation(role)`.

- [ ] Write failing tests proving required assertion aggregation, optional assertion behavior, role authorization, and secret redaction.
- [ ] Run `npx tsx --test src/lib/agent-evaluation.test.ts`; expect missing-module failure.
- [ ] Implement the minimal pure domain functions and four Prisma models from the approved spec.
- [ ] Run the focused tests and `npx prisma validate`; expect PASS.
- [ ] Commit with `feat: add agent evaluation domain`.

### Task 2: MCP protocol client and deterministic scenarios

**Files:**
- Create: `src/lib/agent-evaluation-mcp.ts`
- Test: `src/lib/agent-evaluation-mcp.test.ts`
- Create: `src/lib/agent-evaluation-cases.ts`
- Test: `src/lib/agent-evaluation-cases.test.ts`

**Interfaces:**
- Produces: `McpEvaluationClient`, `FIXED_EVALUATION_CASES`, `evaluateToolDiscovery`, `evaluateSearchResult`, `evaluateBattlecardResult`.

- [ ] Write failing tests using a local HTTP server to prove initialize/session reuse, tools call parsing, timeout/error shaping, discovery assertions, citation checks, and battlecard grouping.
- [ ] Run both focused tests; expect missing-module failures.
- [ ] Implement a bounded JSON-RPC client and nine fixed case definitions with pure output evaluators.
- [ ] Run both focused tests; expect PASS.
- [ ] Commit with `feat: add deterministic mcp evaluation cases`.

### Task 3: Run orchestration and APIs

**Files:**
- Create: `src/lib/agent-evaluation-runner.ts`
- Test: `src/lib/agent-evaluation-runner.test.ts`
- Create: `src/app/api/agent-evaluations/summary/route.ts`
- Create: `src/app/api/agent-evaluations/runs/route.ts`
- Create: `src/app/api/agent-evaluations/runs/[id]/route.ts`

**Interfaces:**
- Consumes: domain scoring, MCP client, and fixed cases.
- Produces: `runAgentEvaluationSuite(options)` and summary/run HTTP contracts.

- [ ] Write failing runner tests proving a failed case does not stop later cases and stored summaries contain no bearer token.
- [ ] Run the focused test; expect missing implementation failure.
- [ ] Implement sequential execution, short-lived HS256 test JWT creation, mutual exclusion, persistence, run listing/detail, and manager authorization.
- [ ] Run focused and root tests; expect PASS.
- [ ] Commit with `feat: run and persist mcp evaluations`.

### Task 4: Results dashboard

**Files:**
- Create: `src/app/agent-evaluations/page.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: summary, run list, run detail, and start-run APIs.

- [ ] Add a failing contract test for summary shaping if UI needs derived grouping.
- [ ] Implement the independent Agent evaluation page with run-all, rerun-case, KPI strip, capability matrix, assertion detail, failures, and recent history.
- [ ] Add the “Agent 评测” navigation item while preserving “拜访评定”.
- [ ] Run lint, TypeScript, and production build; expect PASS.
- [ ] Commit with `feat: add agent evaluation dashboard`.

### Task 5: Seed, deploy, and prove the loop

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `docs/product/sales-intelligence-agent-demo-script.md`

**Interfaces:**
- Produces: idempotently seeded fixed cases and a repeatable demo procedure.

- [ ] Add a failing seed test proving all 9 stable case keys exist.
- [ ] Seed the cases idempotently and document configuration/run/failure interpretation.
- [ ] Run Prisma migration against a disposable SQLite database.
- [ ] Run full CRM tests, MCP tests, lint, TypeScript, and production builds.
- [ ] Push `yaoqicrm/main`, back up the server database, deploy, migrate, restart, and run the real suite.
- [ ] Verify the public dashboard, stored assertions, MCP process, and absence of secrets in evaluation snapshots.
- [ ] Commit with `docs: ship agent mcp evaluation loop`.

