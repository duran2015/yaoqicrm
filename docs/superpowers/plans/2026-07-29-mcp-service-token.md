# MCP Service Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CRM-issued, revocable long-lived MCP credentials bound to a full-access ADMIN service identity without changing WorkBuddy JWT authentication.

**Architecture:** CRM owns opaque-token generation, SHA-256 persistence, lifecycle APIs and an internal verification endpoint. MCP dispatches `phmcp_live_` credentials to that endpoint on every request and keeps JWT verification unchanged. A manager-only CRM page creates, copies, rotates and revokes credentials.

**Tech Stack:** Next.js 15, Prisma/SQLite, Node crypto, TypeScript MCP server, existing CRM UI.

## Global Constraints

- Never persist or log a full service token.
- Token plaintext is returned only on create/rotate.
- Existing sessions fail on their next request after revocation.
- Service credentials only authenticate MCP, never ordinary CRM APIs.
- Keep all existing JWT tests and behavior green.

---

### Task 1: Token domain and persistence

**Files:** `src/lib/mcp-service-token.test.ts`, `src/lib/mcp-service-token.ts`, `prisma/schema.prisma`, `prisma/migrations/20260729160000_mcp_service_tokens/migration.sql`

- [ ] Write failing tests for prefix, hash, hint, status and client JSON.
- [ ] Run focused tests and confirm RED.
- [ ] Implement pure token functions and Prisma models.
- [ ] Run tests and Prisma validation; commit `feat: add mcp service token domain`.

### Task 2: CRM lifecycle and internal verification APIs

**Files:** `src/app/api/mcp-service-tokens/route.ts`, `src/app/api/mcp-service-tokens/[id]/revoke/route.ts`, `src/app/api/mcp-service-tokens/[id]/rotate/route.ts`, `src/app/api/internal/mcp-service-tokens/verify/route.ts`

- [ ] Write failing authorization/verification tests.
- [ ] Implement manager lifecycle APIs, ADMIN service identity, no-store responses, rotation transaction and internal-secret verification.
- [ ] Run focused/root tests; commit `feat: manage long-lived mcp service tokens`.

### Task 3: MCP dual authentication

**Files:** `mcp-server/src/service-token-auth.test.ts`, `mcp-server/src/service-token-auth.ts`, `mcp-server/src/index.ts`

- [ ] Write failing tests for credential dispatch and service actor mapping.
- [ ] Implement service-token verification on every HTTP request while retaining JWT verification.
- [ ] Verify revocation invalidates an existing session and JWT tests stay green.
- [ ] Commit `feat: authenticate mcp service tokens`.

### Task 4: CRM token management page

**Files:** `src/app/mcp-tokens/page.tsx`, `src/components/app-shell.tsx`

- [ ] Implement create/list/copy-config/revoke/rotate using existing UI components.
- [ ] Ensure plaintext only lives in page state for the current response.
- [ ] Run lint, TypeScript and production build; commit `feat: add mcp token management`.

### Task 5: Deploy and issue first token

**Files:** `deploy/ecosystem.config.cjs`, `prisma/seed.ts`, `docs/product/workbuddy-mcp-crm-demo-script.md`

- [ ] Configure the shared internal secret and public MCP URL.
- [ ] Seed the ADMIN service identity idempotently.
- [ ] Run full CRM/MCP verification and disposable migration.
- [ ] Push, back up production DB, deploy/migrate/restart.
- [ ] Create one long-lived token, initialize/list tools, revoke it, prove the same session fails, rotate/create the final token, and verify JWT remains valid.

