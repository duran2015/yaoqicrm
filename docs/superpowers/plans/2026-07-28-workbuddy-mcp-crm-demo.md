# WorkBuddy → MCP → CRM Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a user-bound WorkBuddy → MCP → CRM demo flow with three composite tools, idempotent visit completion, and minimal audit.

**Architecture:** Extract JWT/session identity from the current MCP monolith into focused modules, while retaining stdio development behavior. Add focused Agent read/write endpoints to Next.js; the write endpoint owns the Prisma transaction and idempotency record so retries cannot duplicate CRM facts.

**Tech Stack:** TypeScript, Node.js crypto/http, MCP SDK, Next.js 15 route handlers, Prisma 6, SQLite, Node test runner.

## Global Constraints

- Keep the existing Next.js, SQLite, MCP Streamable HTTP transport, and UI style.
- Demo scope is one company and one organization.
- HTTP JWT sessions use immutable CRM employee identity; stdio keeps local identity switching.
- Use HS256 JWT with validated issuer, audience, signature, and expiration; do not build JWKS administration.
- Do not add a generic approval engine, event bus, multi-tenant administration, or unrelated CRM features.
- Every behavior change follows red-green-refactor and receives a focused commit.
- Never add or modify `audit-output/`.

---

### Task 1: JWT Verification and CRM Employee Mapping

**Files:**
- Create: `mcp-server/src/auth.ts`
- Create: `mcp-server/src/auth.test.ts`
- Modify: `mcp-server/package.json`

**Interfaces:**
- Produces: `WorkBuddyClaims`, `SessionActor`, `verifyWorkBuddyJwt(token, config, now?)`, and `mapClaimsToEmployee(claims, employee)`.

- [ ] **Step 1: Write failing tests** for valid HS256 verification and rejection of bad signature, expired token, wrong issuer/audience, missing claims, missing employee, and role mismatch.
- [ ] **Step 2: Run** `npm test --prefix mcp-server` and verify failure because `auth.ts` does not exist.
- [ ] **Step 3: Implement** strict base64url parsing, timing-safe HS256 signature verification, claim validation, and CRM employee mapping using Node crypto only.
- [ ] **Step 4: Run** `npm test --prefix mcp-server` and verify all auth tests pass.
- [ ] **Step 5: Commit** `test/feat: verify WorkBuddy user JWT`.

### Task 2: Immutable HTTP Session Identity

**Files:**
- Create: `mcp-server/src/session-auth.ts`
- Create: `mcp-server/src/session-auth.test.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `SessionActor` and JWT verification from Task 1.
- Produces: `SessionContext`, `assertSessionRequestActor(context, actor)`, and actor-aware `createMcpServer(context)`.

- [ ] **Step 1: Write failing tests** proving same-actor continuation succeeds, cross-actor continuation fails, and explicit actor override fails in HTTP mode.
- [ ] **Step 2: Run** the focused test and verify the expected missing-module failure.
- [ ] **Step 3: Implement** per-session actor context; authenticate initialize, resolve the CRM employee, authenticate every existing-session request, and hide `set_current_employee` in JWT mode.
- [ ] **Step 4: Replace global actor reads in tool handlers** with the server instance context and enforce `requireEmployee` equality in HTTP mode.
- [ ] **Step 5: Run** MCP tests and TypeScript build.
- [ ] **Step 6: Commit** `fix: isolate MCP user identity by session`.

### Task 3: Agent Read Models and Composite Read Tools

**Files:**
- Create: `src/app/api/agent/my-day/route.ts`
- Create: `src/app/api/agent/prepare-visit/route.ts`
- Create: `src/lib/agent-demo.ts`
- Create: `src/lib/agent-demo.test.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Produces: `GET /api/agent/my-day?employeeId=&asOf=`, `GET /api/agent/prepare-visit?employeeId=&hcpId=`, MCP tools `get_my_day` and `prepare_hcp_visit`.

- [ ] **Step 1: Write failing unit tests** for deterministic approved-material filtering and safe composite response shaping.
- [ ] **Step 2: Run** `npm test -- src/lib/agent-demo.test.ts` and verify failure.
- [ ] **Step 3: Implement** the pure read-model helpers and two route handlers using existing representative workbench, HCP, visit, inventory, Account Plan, and material tables.
- [ ] **Step 4: Register** both MCP tools with session-only employee identity.
- [ ] **Step 5: Run** focused CRM tests, MCP tests, and TypeScript checks.
- [ ] **Step 6: Commit** `feat: add WorkBuddy composite read tools`.

### Task 4: Idempotent Visit Completion and Minimal Audit

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260728230000_mcp_operations/migration.sql`
- Create: `src/lib/mcp-operation.ts`
- Create: `src/lib/mcp-operation.test.ts`
- Create: `src/app/api/agent/complete-visit/route.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Produces: Prisma `McpOperation`, `hashAgentPayload(payload)`, `POST /api/agent/complete-visit`, and MCP tool `complete_hcp_visit`.

- [ ] **Step 1: Write failing tests** for stable payload hashing, confirmation rejection, same-key/same-payload replay, and same-key/different-payload conflict.
- [ ] **Step 2: Run** focused tests and verify failure because the operation module/model is absent.
- [ ] **Step 3: Add** the migration/model and pure operation helpers.
- [ ] **Step 4: Implement** the Agent route transaction by reusing the existing visit validation rules, creating the visit/relations/follow-up and completing `McpOperation` atomically.
- [ ] **Step 5: Register** `complete_hcp_visit`; force actor identity, `source: AI`, `confirmed: true`, request ID, and idempotency key.
- [ ] **Step 6: Generate Prisma client and run** focused tests plus schema validation.
- [ ] **Step 7: Commit** `feat: complete visits idempotently through MCP`.

### Task 5: WorkBuddy Configuration and End-to-End Demo

**Files:**
- Modify: `mcp-server/README.md`
- Modify: `mcp-server/scripts/smoke-test-http.mjs`
- Create: `mcp-server/scripts/create-demo-jwt.mjs`
- Create: `docs/product/workbuddy-mcp-crm-demo-script.md`

**Interfaces:**
- Consumes: all prior HTTP/JWT/tool contracts.
- Produces: reproducible local commands and an automated three-tool HTTP smoke test.

- [ ] **Step 1: Update the smoke test** to generate/use a user JWT, initialize two actor sessions, check isolation, call both read tools, complete a visit twice with one idempotency key, and assert the same visit ID is returned.
- [ ] **Step 2: Run the smoke test before services** and confirm it reports the unavailable boundary clearly.
- [ ] **Step 3: Document** WorkBuddy MCP endpoint, environment variables, JWT claims, token generator, tool confirmation behavior, and the three-round demo conversation.
- [ ] **Step 4: Start CRM and MCP**, seed a known database, and run the complete smoke test.
- [ ] **Step 5: Run fresh full verification:** root tests, MCP tests/build, lint, Next TypeScript, Prisma validate, production build, and HTTP smoke.
- [ ] **Step 6: Inspect git diff/status**, confirm `audit-output/` is the only unrelated untracked path, and commit `docs: add WorkBuddy MCP CRM demo runbook`.

