# Sales Intelligence Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a demonstrable internet-fed sales intelligence center that turns policies, competitor updates, industry news, and shared product/disease knowledge into traceable CRM context and WorkBuddy MCP actions.

**Architecture:** Add focused Prisma entities for sources, collection runs, normalized intelligence, competitor products, associations, and usage. Implement collectors behind a small adapter interface, keep verification/relevance rules in pure domain modules, expose thin Next.js routes and existing-style pages, then compose those reads through the current user-bound MCP server.

**Tech Stack:** Next.js 15.5, React 19, TypeScript 5, Prisma 6, SQLite, Node built-in `fetch`/`crypto`, existing MCP SDK and Zod, Node test runner through `tsx`.

## Global Constraints

- Preserve the existing Next.js, SQLite, UI style, JWT-bound MCP identity, idempotency, and audit implementation.
- `ProductMaterial` remains the only externally presentable approved-content object; `SalesIntelligence` is internal preparation material.
- White-listed sources are primary; search supplementation always creates `PENDING_REVIEW` records.
- Every Agent result carries source URL, source name, publication/collection time, verification status, and confidence.
- Do not add a vector database, knowledge graph, object storage, OCR platform, browser-automation crawler, paid data provider, or general-purpose crawl scheduler.
- Do not bypass authentication, CAPTCHA, robots restrictions, anti-bot controls, or paywalls.
- Read the relevant route-handler and page documentation under `node_modules/next/dist/docs/` before modifying Next.js routes or pages, as required by `AGENTS.md`.
- Use TDD for every domain rule and MCP behavior; commit after every independently testable task.
- Do not add or commit the unrelated untracked `audit-output/` directory.

## Planned File Structure

- `src/lib/sales-intelligence.ts`: validation, verification transitions, safety and relevance rules.
- `src/lib/intelligence-normalization.ts`: canonical URL, normalized text and SHA-256 content fingerprints.
- `src/lib/intelligence-collector.ts`: collector contracts and collection orchestration.
- `src/lib/intelligence-collectors/rss.ts`: RSS/Atom extraction.
- `src/lib/intelligence-collectors/html-list.ts`: configured list/detail-page extraction.
- `src/lib/intelligence-collectors/search.ts`: optional search-provider adapter; never auto-verifies.
- `src/lib/intelligence-query.ts`: Prisma query construction and response shaping for CRM/Agent consumers.
- `src/lib/product-battlecard.ts`: deterministic battlecard composition with citations and compliance boundaries.
- `src/app/api/sales-intelligence/**`: list, detail and review endpoints.
- `src/app/api/intelligence-sources/**`: source management endpoints.
- `src/app/api/intelligence-collection/**`: run creation and status endpoints.
- `src/app/api/agent/sales-intelligence/search/route.ts`: Agent search composition.
- `src/app/api/agent/product-battlecard/route.ts`: Agent product battlecard composition.
- `src/app/sales-intelligence/page.tsx`: intelligence center, review queue and collection controls.
- `src/components/sales-intelligence-card.tsx`: reusable provenance-first intelligence card.
- `src/components/intelligence-review-dialog.tsx`: verification action UI.
- `scripts/collect-sales-intelligence.ts`: scheduler/CLI entry point.

---

### Task 1: Persist the intelligence domain

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260729090000_sales_intelligence/migration.sql`
- Modify: `prisma/seed.ts`
- Create: `src/lib/sales-intelligence.test.ts`
- Create: `src/lib/sales-intelligence.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `IntelligenceType`, `VerificationStatus`, `Confidence`, `Priority`, `validateIntelligenceReview(value)`, `canTransitionIntelligence(from, to)`, `isIntelligenceUsable(item, asOf)`.
- Produces Prisma models exactly named `IntelligenceSource`, `CollectionRun`, `SalesIntelligence`, `CompetitorProduct`, `IntelligenceProduct`, `IntelligenceTherapeuticArea`, `IntelligenceCompetitor`, and `IntelligenceUsage`.

- [ ] **Step 1: Write failing domain tests**

```ts
test("only reviewable intelligence can be verified or rejected", () => {
  assert.equal(canTransitionIntelligence("PENDING_REVIEW", "VERIFIED"), true);
  assert.equal(canTransitionIntelligence("PENDING_REVIEW", "REJECTED"), true);
  assert.equal(canTransitionIntelligence("REJECTED", "VERIFIED"), false);
});

test("expired or non-verified intelligence is not a verified fact", () => {
  const asOf = new Date("2026-07-29T00:00:00Z");
  assert.equal(isIntelligenceUsable({ verificationStatus: "VERIFIED", validUntil: "2026-07-30" }, asOf), true);
  assert.equal(isIntelligenceUsable({ verificationStatus: "PENDING_REVIEW", validUntil: null }, asOf), false);
  assert.equal(isIntelligenceUsable({ verificationStatus: "VERIFIED", validUntil: "2026-07-28" }, asOf), false);
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npx tsx --test src/lib/sales-intelligence.test.ts`  
Expected: FAIL because `sales-intelligence.ts` does not exist.

- [ ] **Step 3: Add the models and migration**

Implement the fields, enums-as-strings, unique constraints and indexes from the approved spec. Use explicit relation names where `Product`, `Employee`, `Hcp`, `Visit`, or self-referencing `SalesIntelligence.supersedes` has more than one relation.

- [ ] **Step 4: Implement minimal pure rules and public TypeScript types**

Use closed sets for the five intelligence types and four verification states. `validateIntelligenceReview` accepts only `{status: "VERIFIED" | "REJECTED" | "ARCHIVED", reviewNote?: string}` and trims the note.

- [ ] **Step 5: Add deterministic demo seed records**

Seed one source and record for each required type, one competitor, product/therapy associations, a mix of `VERIFIED` and `PENDING_REVIEW`, and no external network calls.

- [ ] **Step 6: Verify schema, migration and tests**

Run:

```bash
npx prisma validate
npx prisma generate
npx tsx --test src/lib/sales-intelligence.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260729090000_sales_intelligence/migration.sql prisma/seed.ts src/lib/sales-intelligence.ts src/lib/sales-intelligence.test.ts src/lib/types.ts
git commit -m "feat: add sales intelligence domain"
```

### Task 2: Normalize, classify and deduplicate collected documents

**Files:**
- Create: `src/lib/intelligence-normalization.ts`
- Create: `src/lib/intelligence-normalization.test.ts`

**Interfaces:**
- Consumes: intelligence/source types from Task 1.
- Produces: `canonicalizeSourceUrl(value: string): string | null`, `normalizeIntelligenceText(value: string): string`, `fingerprintIntelligence(value: string): string`, `classifyCollectedDocument(document, vocabulary)`, `decideCollectedDocument(existing, incoming)`.

- [ ] **Step 1: Write failing normalization tests**

Cover tracking-parameter removal, fragment removal, query sorting, rejection of non-HTTP(S), whitespace normalization, stable SHA-256, same-content deduplication and same-URL changed-content versioning.

```ts
assert.equal(
  canonicalizeSourceUrl("https://example.cn/policy?id=2&utm_source=x#top"),
  "https://example.cn/policy?id=2"
);
assert.deepEqual(decideCollectedDocument(
  { canonicalUrl: "https://a.cn/1", contentHash: "old", version: 1 },
  { canonicalUrl: "https://a.cn/1", contentHash: "new" }
), { action: "VERSION", version: 2 });
```

- [ ] **Step 2: Verify the focused test fails**

Run: `npx tsx --test src/lib/intelligence-normalization.test.ts`  
Expected: FAIL on missing exports.

- [ ] **Step 3: Implement the minimal functions**

Use `URL`, remove `utm_*`, `spm`, `from`, `source`, and fragments; retain meaningful query parameters. Use `node:crypto` SHA-256. Classification returns matched product IDs, competitor IDs, therapeutic-area names, and a suggested type but never invents an association without a configured alias match.

- [ ] **Step 4: Run focused and root tests**

Run:

```bash
npx tsx --test src/lib/intelligence-normalization.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/intelligence-normalization.ts src/lib/intelligence-normalization.test.ts
git commit -m "feat: normalize collected intelligence"
```

### Task 3: Build bounded collectors and collection orchestration

**Files:**
- Create: `src/lib/intelligence-collector.ts`
- Create: `src/lib/intelligence-collector.test.ts`
- Create: `src/lib/intelligence-collectors/rss.ts`
- Create: `src/lib/intelligence-collectors/html-list.ts`
- Create: `src/lib/intelligence-collectors/search.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: normalization and domain rules from Tasks 1–2.
- Produces: `CollectedDocument`, `IntelligenceCollector`, `collectSource(input, dependencies)`, `persistCollectedDocuments(input, prisma)`.
- `IntelligenceCollector.collect` returns at most the requested limit and never writes to Prisma directly.

- [ ] **Step 1: Write failing orchestration tests using injected fake collectors**

Test per-source timeout, `PARTIAL` run status, one-source failure isolation, deduplication counts, official-source automatic verification, media/search pending review, and a hard item limit.

- [ ] **Step 2: Verify failure**

Run: `npx tsx --test src/lib/intelligence-collector.test.ts`  
Expected: FAIL because collector contracts are missing.

- [ ] **Step 3: Add only the parsing dependency required for XML/HTML**

Choose one maintained small parser that handles RSS/Atom and server-side HTML without browser automation. Record it in `package.json`/lockfile; do not add a crawling framework.

- [ ] **Step 4: Implement collectors**

`rss.ts` parses feed entries. `html-list.ts` uses configured selectors for bounded list/detail extraction. `search.ts` accepts an injected provider endpoint/key from environment and returns no results with a structured warning when unconfigured. All network calls use `AbortSignal.timeout`, an explicit user agent, a maximum response size, and HTTP(S)-only URLs.

- [ ] **Step 5: Implement persistence orchestration**

Create/update `CollectionRun`, call enabled collectors independently, normalize/classify, create associations transactionally, apply automatic verification only to authoritative white-listed sources, and update exact found/new/updated/failed counters.

- [ ] **Step 6: Verify**

Run:

```bash
npx tsx --test src/lib/intelligence-collector.test.ts
npm test
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/intelligence-collector.ts src/lib/intelligence-collector.test.ts src/lib/intelligence-collectors
git commit -m "feat: collect trusted sales intelligence"
```

### Task 4: Expose source, intelligence, review and collection APIs

**Files:**
- Create: `src/app/api/sales-intelligence/route.ts`
- Create: `src/app/api/sales-intelligence/[id]/route.ts`
- Create: `src/app/api/sales-intelligence/[id]/review/route.ts`
- Create: `src/app/api/intelligence-sources/route.ts`
- Create: `src/app/api/intelligence-sources/[id]/route.ts`
- Create: `src/app/api/intelligence-collection/runs/route.ts`
- Create: `src/app/api/intelligence-collection/runs/[id]/route.ts`
- Create: `src/lib/intelligence-query.ts`
- Create: `src/lib/intelligence-query.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `buildIntelligenceWhere(filters, actor)`, `shapeIntelligenceItem(record)`, paginated list payload `{items, page, pageSize, total}`, collection-run creation with `{confirmed, idempotencyKey}`.

- [ ] **Step 1: Read bundled Next.js route-handler documentation**

Run: `rg -n "Route Handlers|route.ts|params" node_modules/next/dist/docs -g '*.md' | head -40`, then read the matching documents before editing routes.

- [ ] **Step 2: Write failing query/response tests**

Test type/status/product/date/text filters, exclusion of rejected/archived by default, pagination cap, provenance fields, safe URL validation, and idempotent run creation.

- [ ] **Step 3: Verify failure**

Run: `npx tsx --test src/lib/intelligence-query.test.ts`  
Expected: FAIL on missing module.

- [ ] **Step 4: Implement pure query building and response shaping**

Keep route handlers thin. Clamp `pageSize` to 50. Return only a reasonable excerpt, never an entire mirrored news article.

- [ ] **Step 5: Implement routes**

Use existing `err()` and Prisma patterns. Review writes `reviewedById`, time and note. Collection run creation requires `confirmed: true`; derive the actor from the existing demo request pattern and prevent duplicate task creation for the same actor/key.

- [ ] **Step 6: Verify**

Run:

```bash
npx tsx --test src/lib/intelligence-query.test.ts
npm test
npx tsc --noEmit
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/sales-intelligence src/app/api/intelligence-sources src/app/api/intelligence-collection src/lib/intelligence-query.ts src/lib/intelligence-query.test.ts
git commit -m "feat: expose intelligence management APIs"
```

### Task 5: Build the sales intelligence center UI

**Files:**
- Create: `src/app/sales-intelligence/page.tsx`
- Create: `src/components/sales-intelligence-card.tsx`
- Create: `src/components/intelligence-review-dialog.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: Task 4 APIs.
- Produces: `/sales-intelligence` with Latest, Policy, Competitor, News, Knowledge, Pending Review and Collection Runs views.

- [ ] **Step 1: Read bundled Next.js page/link documentation**

Read the relevant App Router page, client-component, navigation and Link documents located in Task 4’s documentation search.

- [ ] **Step 2: Add the navigation entry and minimal loading shell**

Add `{ href: "/sales-intelligence", label: "销售情报", icon: "🧠" }` under daily work. Keep page client-side data access consistent with existing screens and `apiUrl`/API helpers.

- [ ] **Step 3: Implement reusable provenance card**

The card always shows source, publication/collection time, verification badge, confidence, associations and original link. Use distinct labels “内部参考” and “批准材料”; this card only renders the former.

- [ ] **Step 4: Implement filtering, review and collection controls**

Managers see Verify/Reject/Archive and “立即采集”; representatives see read-only content. Disable repeated submission while a request is active and surface API errors inline.

- [ ] **Step 5: Verify browser behavior**

Run the seeded app and check at desktop width:

- navigation and active state;
- all category tabs;
- keyword/product/status filters;
- pending review transition;
- collection run statistics;
- long title/summary wrapping;
- empty, loading and error states.

- [ ] **Step 6: Run static verification**

Run:

```bash
npx tsc --noEmit
npm run lint
NEXT_PUBLIC_BASE_PATH=/pharma npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/sales-intelligence/page.tsx src/components/sales-intelligence-card.tsx src/components/intelligence-review-dialog.tsx src/components/app-shell.tsx src/lib/types.ts
git commit -m "feat: add sales intelligence center"
```

### Task 6: Embed relevant intelligence into CRM selling workflows

**Files:**
- Modify: `src/lib/representative-workbench.ts`
- Modify: `src/lib/representative-workbench.test.ts`
- Modify: `src/components/representative-workbench.tsx`
- Modify: `src/app/products/page.tsx`
- Modify: `src/app/hcp/[id]/page.tsx`
- Modify: `src/app/api/agent/my-day/route.ts`
- Modify: `src/app/api/agent/prepare-visit/route.ts`
- Create: `src/lib/intelligence-relevance.test.ts`

**Interfaces:**
- Consumes: `buildIntelligenceWhere`, `shapeIntelligenceItem`.
- Produces: `relevantIntelligence` in my-day and `verifiedIntelligence`, `pendingLeads`, `suggestedQuestions`, `citations` in prepare-visit.

- [ ] **Step 1: Write failing relevance tests**

Test exact product matches before therapeutic-area matches, HCP specialty/recent-products relevance, verified-before-pending sorting, valid-until filtering, and maximum-five home results.

- [ ] **Step 2: Verify failure**

Run: `npx tsx --test src/lib/intelligence-relevance.test.ts src/lib/representative-workbench.test.ts`  
Expected: FAIL until ranking is integrated.

- [ ] **Step 3: Implement deterministic relevance**

Use the approved order: product/molecule, HCP specialty/therapy, recent visit products, representative division, then text. No LLM call occurs in CRM routes.

- [ ] **Step 4: Extend composite routes**

Keep `prepare-visit` bounded: at most five verified items, three pending leads, five suggested questions and a deduplicated citations array. Continue returning existing HCP, visits, tasks, plans, materials and inventory unchanged.

- [ ] **Step 5: Add UI sections**

Add the five-item representative panel, grouped product intelligence and HCP preparation panel. Reuse `SalesIntelligenceCard`; keep existing approved-material controls visually separate.

- [ ] **Step 6: Verify focused and full behavior**

Run:

```bash
npx tsx --test src/lib/intelligence-relevance.test.ts src/lib/representative-workbench.test.ts
npm test
npx tsc --noEmit
npm run lint
```

Then inspect the representative home, one product and one HCP in the browser.

- [ ] **Step 7: Commit**

```bash
git add src/lib/representative-workbench.ts src/lib/representative-workbench.test.ts src/lib/intelligence-relevance.test.ts src/components/representative-workbench.tsx src/app/products/page.tsx src/app/hcp/[id]/page.tsx src/app/api/agent/my-day/route.ts src/app/api/agent/prepare-visit/route.ts
git commit -m "feat: surface intelligence in sales workflows"
```

### Task 7: Add Agent search and product battlecards

**Files:**
- Create: `src/lib/product-battlecard.ts`
- Create: `src/lib/product-battlecard.test.ts`
- Create: `src/app/api/agent/sales-intelligence/search/route.ts`
- Create: `src/app/api/agent/product-battlecard/route.ts`
- Modify: `src/lib/agent-demo.ts`
- Modify: `src/lib/agent-demo.test.ts`

**Interfaces:**
- Produces: `buildProductBattlecard(input)`, `AgentCitation`, search response with `items`, `querySummary`, `citations`, `warnings`.
- Battlecard sections: product, verified policies, competitor updates, shared knowledge, objection-preparation prompts, approved materials, citations, compliance notice.

- [ ] **Step 1: Write failing battlecard tests**

Assert that pending results never appear as verified facts, citations deduplicate by intelligence ID, every fact has a citation ID, approved materials are separated, source conflicts create a warning, and empty evidence produces “未找到已核验信息”.

- [ ] **Step 2: Verify failure**

Run: `npx tsx --test src/lib/product-battlecard.test.ts src/lib/agent-demo.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement deterministic battlecard composition**

Do not call an LLM in the CRM backend. Compose concise evidence-based sections from stored summaries, and label objection preparation as internal questions rather than external claims.

- [ ] **Step 4: Implement Agent routes**

Require `employeeId` as existing composite routes do; MCP remains responsible for deriving it from session identity. Enforce result limits and default `includePending=false`.

- [ ] **Step 5: Verify**

Run:

```bash
npx tsx --test src/lib/product-battlecard.test.ts src/lib/agent-demo.test.ts
npm test
npx tsc --noEmit
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/product-battlecard.ts src/lib/product-battlecard.test.ts src/lib/agent-demo.ts src/lib/agent-demo.test.ts src/app/api/agent/sales-intelligence src/app/api/agent/product-battlecard
git commit -m "feat: compose sourced product battlecards"
```

### Task 8: Expose intelligence through user-bound MCP tools

**Files:**
- Modify: `mcp-server/src/index.ts`
- Create: `mcp-server/src/intelligence-tools.test.ts`
- Modify: `src/app/api/agent/my-day/route.ts`
- Modify: `src/app/api/agent/prepare-visit/route.ts`
- Modify: `src/lib/mcp-operation.ts`
- Modify: `src/lib/mcp-operation.test.ts`

**Interfaces:**
- Consumes: Task 7 Agent routes and Task 4 collection endpoint.
- Produces MCP tools `search_sales_intelligence`, `get_product_battlecard`, `refresh_product_intelligence`; enhances existing `get_my_day` and `prepare_hcp_visit` pass-through results.

- [ ] **Step 1: Write failing MCP contract tests**

Assert exact tool names/schemas, JWT-session employee binding, search limits, `includePending=false` default, refresh confirmation requirement, stable idempotency key requirement, and refresh audit metadata.

- [ ] **Step 2: Verify failure**

Run: `cd mcp-server && npm test`  
Expected: FAIL because the three tools are not registered.

- [ ] **Step 3: Register the two read tools**

`search_sales_intelligence` accepts query/types/productId/hcpId/includePending/limit. `get_product_battlecard` accepts productId/hcpId/asOf. Both pass only `requireEmployee(context)` to CRM.

- [ ] **Step 4: Register the write tool**

`refresh_product_intelligence` requires `confirmed: true`, `productId`, and an 8–128 character idempotency key. Reuse the existing MCP operation hashing/audit behavior; retries return the original collection-run result.

- [ ] **Step 5: Verify CRM and MCP**

Run:

```bash
npm test
cd mcp-server && npm test && npm run build
```

Expected: PASS and HTTP tool count increases by three while stdio retains its existing identity-development difference.

- [ ] **Step 6: Commit**

```bash
git add mcp-server/src/index.ts mcp-server/src/intelligence-tools.test.ts src/app/api/agent/my-day/route.ts src/app/api/agent/prepare-visit/route.ts src/lib/mcp-operation.ts src/lib/mcp-operation.test.ts
git commit -m "feat: expose sales intelligence through MCP"
```

### Task 9: Add scheduled collection, deployment configuration and demo proof

**Files:**
- Create: `scripts/collect-sales-intelligence.ts`
- Create: `scripts/collect-sales-intelligence.test.ts`
- Modify: `package.json`
- Modify: `deploy/ecosystem.config.cjs`
- Modify: `deploy/DEPLOY.md`
- Modify: `prisma/seed.ts`
- Create: `docs/product/sales-intelligence-agent-demo-script.md`

**Interfaces:**
- Produces: `npm run intelligence:collect`, PM2 cron app `pharma-crm-intelligence`, documented optional search provider variables, reproducible WorkBuddy demo.

- [ ] **Step 1: Write failing CLI argument tests**

Test `--all`, `--source <id>`, `--product <id>`, invalid combinations, bounded limit and non-zero exit on total failure.

- [ ] **Step 2: Verify failure**

Run: `npx tsx --test scripts/collect-sales-intelligence.test.ts`  
Expected: FAIL because the CLI module is absent.

- [ ] **Step 3: Implement CLI and npm script**

Export argument parsing separately from the executable main function. Load Prisma only in `main()`. Print a compact run ID/status/count JSON line and never print provider secrets.

- [ ] **Step 4: Add deployment scheduling**

Add a PM2 process that runs the built/tsx collection command once daily with `cron_restart`, `autorestart: false`, and the same absolute SQLite URL. Document white-list configuration, optional search endpoint/key, manual invocation, logs and failure recovery.

- [ ] **Step 5: Complete fixed demo data and script**

Use one existing重点 SKU, competitor and HCP. Document the exact CRM pages and WorkBuddy prompts for discovery → review → home alert → search → battlecard → visit preparation.

- [ ] **Step 6: Run full local verification**

Run:

```bash
npx prisma validate
npx prisma generate
npm test
npm run lint
npx tsc --noEmit
NEXT_PUBLIC_BASE_PATH=/pharma npm run build
cd mcp-server && npm test && npm run build
```

Expected: every command exits 0.

- [ ] **Step 7: Run end-to-end HTTP smoke**

Start CRM and MCP against a migrated, seeded disposable database. Verify:

- at least two configured real white-list sources can be collected when reachable;
- search supplementation creates `PENDING_REVIEW`;
- review changes only the selected record;
- Agent search and battlecard include citations;
- enhanced visit preparation includes intelligence and approved materials separately;
- refresh replay returns the same run ID;
- two JWT identities remain isolated.

- [ ] **Step 8: Deploy and verify remote demo**

Back up the remote SQLite database, deploy source/build artifacts, apply migration, restart CRM/MCP/scheduler, inspect PM2 status, then run the public nginx MCP initialize/tools/call smoke and CRM page checks. Do not overwrite the remote database with local seed data.

- [ ] **Step 9: Commit**

```bash
git add scripts/collect-sales-intelligence.ts scripts/collect-sales-intelligence.test.ts package.json package-lock.json deploy/ecosystem.config.cjs deploy/DEPLOY.md prisma/seed.ts docs/product/sales-intelligence-agent-demo-script.md
git commit -m "docs: ship sales intelligence demo loop"
```

### Task 10: Final review and repository delivery

**Files:**
- Modify only files required by verified defects.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: reviewed, tested and pushed `yaoqicrm/main`.

- [ ] **Step 1: Inspect changes and commit history**

Run:

```bash
git status --short
git log --oneline --decorate -15
git diff yaoqicrm/main...HEAD --check
```

Confirm `audit-output/` remains unrelated and uncommitted.

- [ ] **Step 2: Perform focused code review**

Check source trust boundaries, SSRF controls, response-size/time limits, copyright-safe excerpts, verification transitions, actor identity, idempotency, audit, query bounds, and absence of secrets in repository/logs.

- [ ] **Step 3: Fix only evidenced defects with TDD**

For each defect, first add a failing focused test, verify the failure, implement the minimal correction, rerun focused/full relevant tests, and commit with a scoped `fix:` message.

- [ ] **Step 4: Run fresh final verification**

Repeat Task 9 Step 6 from a clean process and run the remote smoke once more. Record exact command outcomes and public endpoint results in the handoff.

- [ ] **Step 5: Push the completed branch**

Run:

```bash
git push yaoqicrm HEAD:main
```

Expected: remote `main` advances to the final verified commit.

