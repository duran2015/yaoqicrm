# Product Materials Lite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight approved product-material versioning and preserve exact material versions used during visits.

**Architecture:** Keep availability and transition rules in a pure domain module. Persist versioned metadata in `ProductMaterial` and immutable visit snapshots in `VisitMaterialUsage`; reuse existing product and visit pages rather than building a generic content system.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma 6, SQLite, Node test runner.

## Global Constraints

- Preserve the current UI style and SQLite stack.
- Store links only; do not upload files.
- Only `APPROVED` materials inside their effective interval may be used.
- Validate material availability again in the visit creation transaction.
- Preserve title, version, and approval-code snapshots on historical visits.
- Do not modify or commit `audit-output/`.

---

### Task 1: Material domain rules

**Files:**
- Create: `src/lib/product-material.ts`
- Create: `src/lib/product-material.test.ts`

**Interfaces:**
- Produces: `canTransitionMaterial(from,to)`, `isMaterialAvailable(material,onDate)`, `validateMaterialInput(value)`, `validateMaterialSelection(materials, selectedProductIds, visitDate)`.

- [ ] Write failing tests for transitions, interval boundaries, approval code, URL protocol, date order, duplicate IDs, and cross-product selection.
- [ ] Run `npx tsx --test src/lib/product-material.test.ts`; verify failure because the module is absent.
- [ ] Implement the four pure functions with four fixed material types and the three-state graph.
- [ ] Run focused then full `npm test`; verify all pass.
- [ ] Commit with `git commit -m "test: define product material rules"`.

### Task 2: Data model, API, and seed

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260728200000_product_materials_lite/migration.sql`
- Modify: `prisma/seed.ts`
- Modify: `src/lib/demo-scenarios.test.ts`
- Create: `src/app/api/product-materials/route.ts`
- Create: `src/app/api/product-materials/[id]/route.ts`

**Interfaces:**
- Produces: Prisma `ProductMaterial`, `VisitMaterialUsage`, list/create/update routes.

- [ ] Add a failing seed assertion for approved, expiring, retired, and snapshotted-use scenarios.
- [ ] Run the demo test; verify RED because Prisma has no material delegate.
- [ ] Add models, relations, indexes, and migration.
- [ ] Implement `GET/POST/PATCH`; use domain validation and reject invalid transitions with 409.
- [ ] Seed deterministic materials and one historical usage.
- [ ] Run migration, generate, seed, Prisma validation, and all tests.
- [ ] Commit with `git commit -m "feat: add approved product materials"`.

### Task 3: Product material workspace

**Files:**
- Modify: `src/app/products/page.tsx`
- Create: `src/components/product-material-editor.tsx`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: product-material routes.
- Produces: material list, create draft, approve, and retire controls inside existing product cards.

- [ ] Add presentation-helper tests for status/expiry labels and verify RED.
- [ ] Implement helpers, response types, material cards, and editor dialog.
- [ ] Ensure APPROVED active, expiring, DRAFT, and RETIRED states are visually distinct.
- [ ] Run tests, lint, and build.
- [ ] Commit with `git commit -m "feat: manage product material versions"`.

### Task 4: Visit material selection and snapshots

**Files:**
- Modify: `src/components/visit-form.tsx`
- Modify: `src/app/api/visits/route.ts`
- Modify: visit/HCP response includes in existing API routes
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: available-material query and `validateMaterialSelection`.
- Produces: `materialIds` in visit creation and immutable `materialUsages` in visit/HCP views.

- [ ] Add failing tests proving draft, expired, and cross-product materials are rejected and valid duplicates are deduplicated.
- [ ] Load available materials after product selection; clear selections when a product is removed.
- [ ] Validate and create usage snapshots in the existing Prisma visit transaction.
- [ ] Include usage snapshots in visit/HCP responses and render them near product feedback.
- [ ] Run focused/full tests, lint, and build.
- [ ] Commit with `git commit -m "feat: record approved materials in visits"`.

### Task 5: Demo documentation and end-to-end verification

**Files:**
- Modify: `docs/product/pharma-sales-p0-demo-script.md`

**Interfaces:**
- Produces: repeatable product-material demo flow.

- [ ] Document valid, expiring, retired, new-draft, approval, visit selection, and HCP history scenarios.
- [ ] Run `npm test`, `npm run lint`, `npx prisma validate`, `npm run build`, and `git diff --check`.
- [ ] Use Playwright to create/approve a material, select it in a visit, submit, and verify its snapshot in HCP 360.
- [ ] Reseed, rerun all verification, and commit with `git commit -m "docs: add approved material demo flow"`.

