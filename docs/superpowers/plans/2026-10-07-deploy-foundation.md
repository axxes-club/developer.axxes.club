# AXXES.dev Deploy Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Native execution is recommended for this foundation; Native execution approved by the owner on 2026-10-07.

**Goal:** Deliver durable hosting billing policy, explicit free exemptions, and safe migration inspection without provisioning customer infrastructure or collecting money.

**Architecture:** Add satellite-owned deploy_* tables and small hosting modules to the current developer portal. Separate pure pricing/inspection logic from authenticated persistence. Hosting entitlement is additive to gateFor and never inherits the API superadmin-membership exemption.

**Tech Stack:** Existing Next.js 16.3.6, TypeScript, Zod, Drizzle, PostgreSQL/pg, tsx and Node test runner; Linux AXXES CI with disposable PostgreSQL.

**Spec:** ../specs/2026-10-07-customer-hosting-design.md (approved 2026-10-07).

## Global Constraints

- Jose (viscasillas@me.com), Bayamón municipal projects, and Otto Reyes projects receive free hosting and related services; usage and cost remain visible.
- Match exemptions by verified stable tenant/project IDs, never display names, email domains or superadmin membership.
- Existing API plan keys free/build/scale and their behavior remain unchanged.
- Proposed Launch $15/month with $5 retail usage credit, three projects/three deployers; Team $39/month with $15 retail credit, fifteen projects/ten deployers. Keep unpublished until cost validation.
- Target at least 40% gross margin on fully allocated customer-serving cost. No public price or paid activation without measured rate validation.
- Use append-only durable deduplicated usage; integer monetary micro-units; round invoice lines only.
- No cloud provisioning, production migrations, payment collection, shared-schema modification or public launcher entry in this foundation.
- Read installed Next.js documentation before writing route code. Run meaningful Linux/database checks before completion claims.

## Review Focus

- A revoked project exemption must preserve historical zero charges while making only future usage chargeable (Task 2/4).
- An unrelated tenant containing Jose as a member must remain chargeable (Task 2).
- Replaying a usage source ID with changed payload must return a conflict, not silently change a bill (Task 4).
- A manifest containing prototype-like object keys or excessive size must be rejected without executing code (Task 5).
- Concurrent budget reservations and duplicate cancellations must preserve a nonnegative balance and idempotency (Task 4).

## Delivery boundaries

This plan implements spec increment 1 only. Increment 2 needs a separate written plan for GitHub integration, isolated builds/runtime, deployment orchestration, secrets, previews, DNS/TLS and rollback. Increment 3 needs a separate written plan for payment collection, provider cost reconciliation, near-real-time runtime budget enforcement and paid onboarding. Foundation is not a usable hosting launch and must not be described as one.

## Task 1: Current baseline and Linux test harness

**Files:** Modify package.json, package-lock.json, .github/workflows/ci-verify.yml; create tests/deploy/helpers/postgres.ts and tests/deploy/baseline.test.ts. Preserve current GitHub main CI steps.

**Interfaces:** Produce `withDeployDatabase(run: (connectionString: string) => Promise<void>): Promise<void>` using a uniquely named temporary schema in a disposable test database. Reject production-looking targets unless an explicit test-only opt-in is supplied; CI supplies a local PostgreSQL URL. This helper never uses application DATABASE_URL.

- [x] Fetch origin and create an isolated feature branch from origin/main (observed b244ec1be241b3c320314bf26bf5f61a8a2fbeda; recheck at execution). Bring the approved spec and this plan into the branch without merging the stale local application tree. Preserve the existing untracked .worktrees directory.
- [x] Inspect current AGENTS.md, package scripts, CI and installed Next.js docs; record baseline CI commands and run them. Report baseline failures before attributing failures to this work.
- [x] Write baseline.test.ts: helper creates an isolated schema, can create/read a fixture table, cleans up after a thrown callback, and rejects missing/production-looking DEPLOY_TEST_DATABASE_URL. Run `npx tsx --test tests/deploy/baseline.test.ts`; expect failure until helper exists.
- [x] Implement helper with pg, using quoted generated schema identifiers, a bounded connection pool and finally cleanup. Add `test:deploy` and `test:deploy:db` scripts with explicit pure and database test files; database tests fail if their dedicated URL is absent rather than skip silently.
- [x] Run both scripts against disposable Linux PostgreSQL and existing CI checks. Commit `test: add isolated deployment foundation test harness`.

## Task 2: Explicit exemption policy and scoped authorization

**Files:** Create src/lib/deploy/types.ts, policy.ts, exemptions.ts, authorization.ts, src/lib/db/schema/deploy.ts, db/deploy/001-foundation.sql, tests/deploy/policy.test.ts and exemptions.db.test.ts; modify src/lib/db/schema/index.ts, src/lib/plans/gate.ts.

**Interfaces:** `HostingSubject = {tenantId: string; projectId: string}`; `ExemptionGrant = {id: string; tenantId: string; projectId: string | null; beneficiary: 'jose' | 'bayamon' | 'otto'; startsAt: Date; endsAt: Date | null}`. `resolveHostingPolicy(subject: HostingSubject, at: Date, grants: readonly ExemptionGrant[]): HostingPolicy`; policy returns exempt, grantId, paymentRequired, chargeUsage and enforceBillingBudget. `requireHostingAccess(ctx: AppContext, operation: 'inspect' | 'usage' | 'billing' | 'deploy'): void` rejects unauthorized roles. Gate gains `hostingFor(projectId: string): Promise<HostingPolicy>` using tenant-scoped persistence; it must verify project ownership.

- [x] Write failing pure tests: all three beneficiaries exempt only with an active scoped grant; grant from another tenant/project never matches; startsAt inclusive/endsAt exclusive; membership or email alone irrelevant; exempt chargeUsage/paymentRequired/enforceBillingBudget all false. Viewer inspect/billing denied, owner/admin allowed; manager deploy allowed; member/viewer usage allowed.
- [x] Run `npx tsx --test tests/deploy/policy.test.ts`; expect missing exports. Implement types, pure policy and role checks, with clock passed explicitly and invalid time/grant data rejected.
- [x] Create additive SQL and Drizzle declarations for deploy_projects, deploy_billing_accounts and append-only deploy_exemption_grants with revocation audit rows. All rows tenant-scoped; composite tenant/project references reject cross-tenant grants. Grant validity is a derived interval from issuance/revocation, not destructive updates. Migration changes no shared table. Include a scoped migration ledger for repeat application.
- [x] Write database tests for cross-tenant project/grant insertion, concurrent grants/revocation, preserved issuance history, and unrelated tenant with a superadmin member. Apply migration to disposable DB only and verify repeat application succeeds.
- [x] Implement tenant-scoped exemption loader and additive gate hostingFor adapter. Preserve all existing gate properties and API outcomes. Run pure/database tests and typecheck; commit `feat: add explicit hosting billing exemptions`.

## Task 3: Versioned pricing and margin validation

**Files:** Create src/lib/deploy/pricing.ts, cost-model.ts and tests/deploy/pricing.test.ts; extend schema/deploy.ts and db/deploy/001-foundation.sql with deploy_rate_versions.

**Interfaces:** `HostingTierKey = 'launch' | 'team'`; `HostingTier` includes feeMicroUsd, includedCreditMicroUsd, maxProjects, maxDeployers and published=false. `ResourceUnit = 'vcpu_ms' | 'gib_ms' | 'request' | 'egress_byte' | 'build_ms' | 'artifact_byte_ms' | 'log_byte'`. `RateVersion` identifies region, runtimeClass, effectiveAt and rational unit prices as numerator/denominator bigints. `priceQuantity(quantity: bigint, rate: {numerator: bigint; denominator: bigint}): bigint` uses a defined half-up rounding only when materializing final line totals; accumulate rational subtotals before that boundary. `assessMargin(input: MarginScenario): {passed: boolean; grossMarginBps: number; deficitMicroUsd: bigint}` accounts for fees, credit redemption, resource costs, allocated support/control-plane cost, percentage/fixed payment fees and budget buffer.

- [x] Write failing tests for exact $15/$5/3/3 and $39/$15/15/10 values; unpublished status; $6 cost at 40% margin needs $10 revenue; rational tiny units aggregate before rounding; invalid/negative quantities and zero denominators rejected. Validate fee+credit exhaustion under zero/typical/high resource consumption and maximum project counts. Provider free-tier credit must not lower recurring cost assumptions.
- [x] Run `npx tsx --test tests/deploy/pricing.test.ts`; expect missing exports. Implement pure modules using bigint quantities and explicit rate IDs; never set universal retail rates without SKU evidence.
- [x] Persist immutable rate snapshots in deploy_rate_versions. Reject modifying referenced snapshots; enforce version references from the next task. Run pure/database tests, typecheck and commit `feat: add draft hosting pricing and margin gate`.

## Task 4: Durable usage ledger and atomic budget reservations

**Files:** Create src/lib/deploy/ledger.ts, budget.ts, postgres.ts, tests/deploy/ledger.db.test.ts and budget.db.test.ts; extend schema/deploy.ts and db/deploy/001-foundation.sql for deploy_usage_entries, deploy_budget_reservations and deploy_billing_adjustments.

**Interfaces:** `appendUsage(input: HostingUsageInput): Promise<{id: string; duplicate: boolean}>`; input contains provider/source/sourceId, subject, occurredAt, nonnegative integer quantity, ResourceUnit, rateVersionId and project deployment reference when known. Amount and exemption decision are computed server-side and stored with grant ID and immutable rate reference. `reserveBudget(input: {subject: HostingSubject; operationId: string; amountMicroUsd: bigint}): Promise<{reservationId: string; status: 'reserved' | 'exempt' | 'insufficient'}>`; `settleReservation(id: string, actualMicroUsd: bigint): Promise<void>` and `cancelReservation(id: string): Promise<void>` execute tenant-scoped atomic state transitions. Settlement beyond reservation fails and queues a control-plane incident; foundation has no runtime overage path. `summarizeHostingUsage(subject: HostingSubject, from: Date, to: Date): Promise<HostingUsageSummary>` uses [from,to) and includes chargeable/exempt consumption separately.

- [x] Write failing PostgreSQL tests: same event replay billed once; same ID/different payload conflicts; different tenants cannot claim another tenant's source ID; zero/negative/large quantities; pinned historical exemption and rate after revocation/rate change; append-only corrections; unrelated project reads rejected. Include money beyond Number.MAX_SAFE_INTEGER without conversion to Number.
- [x] Add budget tests: ten concurrent $2 reservations against $10 allow exactly five; duplicate operation cannot double reserve; cancel twice refunds once; settle/cancel race has one terminal outcome; exempt reservations track consumption without requiring funds; historical exempt usage remains zero-charge after revocation.
- [x] Run `npm run test:deploy:db`; expect absent tables/modules. Implement SQL constraints and transaction-scoped pg adapter. Do not use the existing best-effort record() or cast a Neon HTTP client to a transactional PostgreSQL client. Reserve with row locks or conditional balance updates and unique operation IDs.
- [x] Implement append-only usage and adjustment APIs; corrections require audited server identity and original-entry reference. Ledger persistence failure fails the provisionable operation; no best-effort financial writes. There is no payment provider call in this task.
- [x] Run concurrent database tests repeatedly in Linux, pure tests and typecheck; inspect query tenant scopes and commit `feat: add durable hosting usage and budget reservations`.

## Task 5: Safe repository manifest inspection and authenticated API

**Files:** Create src/lib/deploy/migration/manifest.ts, inspect.ts, src/app/api/deploy/inspect/route.ts, tests/deploy/inspect.test.ts, inspect-route.test.ts and fixtures/deploy/manifests/*.json.

**Interfaces:** `MigrationManifest` is JSON with packageJson, lockfileKind, rootDirectory, optional bounded vercelConfig and pre-extracted capability flags; no secret values or repository URL fetch. `inspectMigration(manifest: MigrationManifest): MigrationReport` returns candidateRuntime ('static' | 'nextjs' | 'unsupported'), readiness ('action_required' | 'unsupported'; never 'verified' until runtime fixtures pass), findings `{code,status,message,resolution}[]`, and environment variable names only. POST /api/deploy/inspect accepts up to 256 KiB JSON from authenticated owner/admin, validates active tenant membership and performs no code execution, subprocess or network fetch. Manager/member/viewer denied for this foundation because migration setup may include privileged configuration.

- [x] Write failing fixture tests: static build candidate; Next.js candidate requires runtime checks; missing lockfile; multiple locks; monorepo root escaping via ../ rejected; Vercel Blob/KV/Postgres and edge configuration flagged; unknown cron/routing/ISR/image options never silently supported; malicious object keys and oversize nesting rejected; secret-valued fields rejected and absent from report.
- [x] Run `npx tsx --test tests/deploy/inspect.test.ts`; expect missing modules. Implement bounded Zod manifest parsing and declarative capability findings. Do not execute next.config files or scripts; script strings are inspected only. Remote repository inspection and Vercel token import remain increment 2.
- [x] Write route tests for unauthenticated access, role denial, malformed JSON, actual streamed payload exceeding 256 KiB despite a lying/missing Content-Length, tenant mismatch, and successful inspection without secrets. Route rejects at the streaming body boundary before parsing.
- [x] Read installed Next.js route/body documentation; implement route using the current authenticated context pattern and generic sanitized error messages. Check session authorization before expensive inspection; require same-origin protection for authenticated mutation-style POST.
- [x] Run pure/route/database tests, typecheck and existing Linux CI; commit `feat: add authenticated hosting migration inspection`.

## Task 6: Foundation review and next-release handoff

**Files:** Create docs/release/deploy-foundation-verification.md and docs/release/deploy-exemption-binding.md.

- [ ] Inspect actual changes against the approved spec and this plan. Verify there is no public Deploy launcher, published pricing, production migration, real payment request or placeholder deployment success. No runtime-hosting claim is made.
- [ ] Run `npm run test:deploy`, `npm run test:deploy:db` in Linux, `npx tsc --noEmit`, and the current AXXES CI workflow. Record exact commit, commands, results and limits; failed/skipped tests are reported, not hidden. Build under Linux using existing Cloud Build/CI facilities without redeploying production.
- [ ] Document an exemption binding runbook: administrative identity verification, exact tenant/project IDs, beneficiary, effective time, grant issuer and audit review. Do not guess bindings or query/print secrets. Confirm no account is marked chargeable during intended exempt pilot setup before binding verification.
- [ ] Conduct code review appropriate to the selected execution method; fix substantive findings and rerun affected checks. Prepare a draft PR with problem, concrete behavior, validation and remaining hosting prerequisites. Do not merge or publish without subsequent authorization.
- [ ] Commit verification artifacts and report the foundation's actual capabilities and limitations. Present separate increment-2 and increment-3 planning scopes with infrastructure and payment prerequisites, before authorizing a public paid launch.

## Self-review

Spec mapping: purpose, alternatives and product identity remain in the approved design; identity/exemptions map to Task 2; commercial model to Task 3; durable ledger and provisionable-work budgets to Task 4; migration compatibility to Task 5; security, Linux evidence and honest reporting to Tasks 1/6. Runtime isolation/builds/GitHub import/previews/domains/rollback and runtime budget enforcement are deliberately deferred to increments 2/3, not treated as completed by this foundation. Payments and exact public SKU rates require measured costs and verified production collection. All five Review Focus conditions have named tests above. No shared migrations or launch step is authorized by this plan.
