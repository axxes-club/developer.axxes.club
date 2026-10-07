# AXXES Cloud operational foundation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Native execution in the current session; one independent whole-branch review before merge.

**Goal:** Deliver a separately deployed AXXES Cloud console at cloud.axxes.app with real tenant-owned projects, resource inventory, authenticated provisioning jobs and a verified app deployment lifecycle.

**Architecture:** Extend the developer source repository while keeping the existing developer service and routes intact. A separate cloud console target authenticates through Handshake; a private provisioning worker acts only in customer infrastructure. Existing hosting policy/ledger remains authoritative, with additive `cloud_*` resource/job/session/audit tables and durable outbox dispatch.

**Tech Stack:** Existing Next.js 16.3.6/React 19/TypeScript, Node 24/Linux, PostgreSQL 17 with pg, shared AXXES identity, Handshake OIDC, GCP Cloud Run/Build/GCS/Secret Manager/Artifact Registry. Exact new dependencies are locked and reviewed before use.

**Spec:** `docs/superpowers/specs/2026-10-07-axxes-cloud-design.md` — approved by the owner with “that works”. This plan implements the first operational subproject; later infrastructure/data/orchestration/parity milestones remain separate deliverables.

## Global constraints

- Name AXXES Cloud; proposed host approved as part of the spec: cloud.axxes.app. Keep product key `developer` and existing developer URLs.
- GCP first; customer project axxes-customer-hosting (447016917238); no customer code in gravy-meta.
- No migrations to shared identity/organization tables. Only explicit owned `cloud_*` migrations; preserve existing `deploy_*` authority.
- Only Jose's exact registered identity can receive free app deployment, with an explicitly scoped active grant. No organization-wide inheritance; no automatic extension to VM/database/GPU consumption.
- Real persisted inventory/jobs and observed provider completion; no fabricated counters, invoices, resource success or inert customer tools.
- Paid provisioning stays disabled until verified payment collection, costed prices and metering are available. Configuration gaps must fail closed, not switch to simulation.
- Existing developer behavior, Better Auth version/shared secret, current grants and settled financial history remain unchanged.
- Customer builds/runtime identities receive no shared database or AXXES auth credentials; resource-specific least privilege and capacity ceilings remain enforced for free accounts.
- Verify every visible route and control on Linux; review before merge; smoke-test production with disposable resources/identities.

## Review focus

1. A job lease expires during a provider timeout: reconcile provider request identity before retry; never create twice or allow a stale worker to publish.
2. A revoked/suspended owner has a still-live cloud cookie or pending free job: reject membership/session and reauthorize before dispatch.
3. A failed cancellation/deletion leaves storage/IP/provider charges: show outstanding resources and reservation reconciliation, never report free/zero cost.
4. The browser submits tenant, actor, provider-project, price or exemption overrides: reject unknown fields and derive all authority server-side.
5. A customer archive contains traversal, symlinks, oversized decompression or build secrets: reject before upload/dispatch and keep previous healthy deployment.

## Delivery boundaries

This plan is complete when the console and controlled app lifecycle are verified and deployed, including the explicit configuration gates below. It does not claim VM/database/Kubernetes parity. Those subsequent stages must use the same inventory/job/quote interfaces and get their own provider acceptance checks.

Operational dependencies: exact Handshake OIDC client registration/secret, GitHub App credentials/installations and a payment account that can collect funds. Read-only discovery comes first. If a dependency is missing, finish and verify its code/configuration contract and report the specific external setup required; keep dependent provisioning closed. A private owner-only fixture can verify provider lifecycle independently, but cannot certify customer repository onboarding or payment collection.

## Task 1 — Canonical cloud resource model and capability gates

Files: `src/lib/cloud/types.ts`, `src/lib/cloud/capabilities.ts`, `tests/cloud/capabilities.test.ts`.

- [ ] Write failing tests for unsupported kind/region/shape, unknown request fields, owner-only app exemption eligibility, and capabilities not exposed until their adapter passes verification.
- [ ] Define `CloudContext` using the existing `AppContext` shape, `ResourceKind = 'app' | 'server' | 'database' | 'bucket' | 'cluster' | 'network'`, and `JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancel_requested' | 'reconciling'`.
- [ ] Define `ResourceSpec` as a discriminated strict schema. Initial enabled kind is `app`; supported runtimes are `static` and `next-standalone`, region us-west1, 1 CPU/512 MiB, min instances 0/max 1 in the private pilot. Other kinds remain unavailable.
- [ ] Implement `availableCapabilities(config: CloudConfiguration): Capability[]`; require provider verification plus product-specific setup, never merely a configured project name.
- [ ] Run pure tests and commit.

## Task 2 — Owned inventory, jobs, audit and session schema

Files: `db/cloud/001-control-plane.sql`, `scripts/cloud-migrate.mjs`, `src/lib/cloud/store.ts`, `tests/cloud/store.db.test.ts`.

- [ ] Write PostgreSQL tests for cross-tenant foreign keys, immutable bindings/job desired input/audit, duplicate idempotency key conflicts, and repeated migration safety.
- [ ] Create `cloud_projects(id,tenant_id,name,deploy_project_id,created_by,created_at)`, `cloud_resources(id,tenant_id,project_id,kind,name,spec,generation,state,provider_binding,created_at)`, `cloud_jobs(id,tenant_id,resource_id,generation,actor_id,operation,idempotency_key,input_hash,quote,reservation_id,state,lease_token,lease_until,provider_request_id,error_code,created_at,updated_at)`, `cloud_audit_events`, `cloud_sessions`, `cloud_oidc_transactions`, `cloud_github_connections`, `cloud_domain_claims`, `cloud_provider_events`, and `cloud_schema_migrations`.
- [ ] Composite ownership constraints bind every project/resource/job/domain to the same tenant. One immutable provider binding per resource; mutable operational state is separate from immutable desired input/audit.
- [ ] Implement scoped project creation/list and resource/job lookup methods; create the backing `deploy_projects` row in the same transaction. No table-wide query then filtering in JavaScript.
- [ ] Explicit migration script applies only whitelisted cloud-owned SQL with DATABASE_URL and --apply. Execute against disposable test DB first; commit.

## Task 3 — Host-specific cloud routing and AXXES session

Files: `src/lib/cloud/session.ts`, `src/lib/cloud/context.ts`, `src/lib/cloud/oidc.ts`, `src/app/api/cloud/auth/{start,callback,sign-out}/route.ts`, `src/app/cloud/layout.tsx`, host-routing integration, `tests/cloud/auth.test.ts`, `tests/cloud/auth.db.test.ts`.

- [ ] Reproduce .club cookie invisibility on .app in a disposable cross-domain fixture. Read the installed Next routing docs and current Handshake OIDC implementation before selecting the supported integration API.
- [ ] Test exact callback allowlisting, PKCE/state/nonce, expired/used transactions, forged claims, ID-versus-email identity, suspension, deleted membership and safe return paths.
- [ ] Implement OIDC authorization-code exchange using verified issuer/JWKS or the platform's already verified handoff if live discovery establishes it. Bind only existing shared user IDs; no email-based account creation.
- [ ] Store hashed session identifiers in cloud_sessions; set Secure/HttpOnly/SameSite=Lax host-only `__Host-axxes-cloud` cookie. `getCloudContext()` revalidates platform access/membership and uses `axxes_cloud_org` only as a preference.
- [ ] Register the exact cloud OIDC client through the owning Handshake repository without rotating the shared auth secret. .app auth remains fail-closed until configuration exists.
- [ ] Route cloud host root to /cloud; preserve developer host root/dashboard/sign-in unchanged. Reject untrusted forwarded hosts and open redirects. Verify original developer regressions and commit.

## Task 4 — Transactional admission, quotes and API boundary

Files: `src/lib/cloud/{authorization,quotes,admission,http}.ts`, `src/app/api/cloud/{projects,resources,jobs}/route.ts`, `tests/cloud/admission.db.test.ts`, `tests/cloud/http.test.ts`.

- [ ] RED tests: unauthenticated requests, role denial, foreign resource IDs, overridden actor/tenant/price/provider fields, unfunded paid requests, coworker free requests, changed idempotent payload and suspended pending-job actor.
- [ ] `quoteResource(ctx: CloudContext, spec: ResourceSpec): Promise<CloudQuote>` resolves a server-selected immutable rate/cost snapshot. Money serializes as decimal integer strings; no client-created retail price or float arithmetic.
- [ ] `requestOperation(ctx, {resourceId,operation,idempotencyKey,expectedGeneration})` locks the owned resource, derives its backing HostingSubject, invokes existing hosting authorization and financial admission, and inserts job/audit atomically. Refactor existing reservation helper to accept the same transaction client without nested BEGIN; preserve existing tests.
- [ ] Explicit scoped owner-free grant issuance requires registered owner identity and owner/admin membership, records issuer/reason and project ID, and never grants a coworker free reservation.
- [ ] Continuous-runtime quote/admission remains disabled until bounded funding windows and all supported units can be metered. Paid request fails before any provider request if processor/prices/metering are unverified.
- [ ] HTTP mutations require same-origin/session or scoped server API auth, bounded bodies, strict schemas and sanitized errors. Pure/DB tests GREEN; commit.

## Task 5 — Durable worker leases and provider contract

Files: `src/lib/cloud/jobs.ts`, `src/lib/cloud/providers/{types,gcp}.ts`, `src/lib/cloud/worker.ts`, `scripts/cloud-worker.mjs`, `tests/cloud/jobs.db.test.ts`, `tests/cloud/provider.test.ts`.

- [ ] Test two workers competing, lease expiry, stale lease/generation completion, canceled queued job, provider timeout with an existing resource, and retry payload identity conflicts.
- [ ] `claimJob(workerId, leaseSeconds=60)` uses FOR UPDATE SKIP LOCKED and returns a fenced lease token; heartbeat and completion compare that token/generation. Revoked/suspended actors are rejected before dispatch.
- [ ] Provider methods `create/read/update/delete/poll/reconcile` take immutable tenant binding and server-controlled configuration. Allow only axxes-customer-hosting destinations; no shell invocation containing customer commands or arbitrary endpoint URLs.
- [ ] Persist stable provider request identity before dispatch; ambiguous outcome enters reconciling. Verify existing resources before retrying creation. Pending provider work never becomes succeeded on submission alone.
- [ ] Worker runs as a separate private service with a narrow provider service account; browser routes cannot invoke unrestricted provider admin APIs. Build a standalone Node 24 worker bundle with explicit production dependencies; do not assume Next alias resolution or dev-only tsx exists in the runtime image. Commit after DB/provider tests.

## Task 6 — Verified GitHub connection and safe source intake

Files: `src/lib/cloud/github/{oauth,installation,source,archive}.ts`, `src/app/api/cloud/github/{connect,callback,repositories,bind}/route.ts`, tests under `tests/cloud/github*` and `tests/cloud/archive*`.

- [ ] Test OAuth state bound to user/tenant and one-time callback; unauthorized repository/installation; branch change/force push; archive traversal/symlink/decompression bomb; credential redaction and missing App configuration.
- [ ] Obtain authenticated App user token server-side and reuse existing repository-access verifier/bindRepository. Encrypt stored refresh credentials using a dedicated Secret Manager key; never persist unencrypted tokens in job input/logs.
- [ ] Server constructs immutable commit/source identity. Fetch only GitHub-controlled archive URLs for the verified repository/commit, with 50 MiB compressed/200 MiB extracted/20,000 file limits and 30-second download deadline. Reject absolute/parent paths, links, special files and invalid encodings; extraction stays within a new private job directory.
- [ ] Prepare controlled artifact plus trusted Dockerfile outside source. Per-job source/artifact IAM is isolated; current shared pilot bucket/account cannot be reused as a multi-customer boundary.
- [ ] Webhook remains signature validated and deduplicated; exempt automatic builds remain blocked until verified owner mapping exists. Commit only after pure HTTP/archive and PG regressions.

## Task 7 — Real build, preview, release, rollback and delete

Files: `src/lib/cloud/runtime/{build,static,publish,rollback,delete}.ts`, fixtures and `tests/cloud/runtime*`, `scripts/cloud-verify-pilot.mjs`.

- [ ] Test missing immutable source/digest, build failure retaining old traffic, unhealthy preview, stale publish, concurrent publish, rollback to a known owned artifact, and deletion timeout with retained chargeable assets.
- [ ] Reuse controlled Next build-plan; static builds emit inspected static artifacts served by an unprivileged fixed runtime, never a customer-controlled production Dockerfile. Time limit 600 seconds; digest-pinned bases and least-privilege runtime identity.
- [ ] Submit real builds only after reserved admission and resource-scoped IAM setup. Poll actual completion and verify the resulting immutable image digest.
- [ ] Create zero-traffic revisions; private preview checks SSR/API/assets/streaming or static fixture as appropriate. Acquire generation fence before promoting; record previous digest/revision. Rollback uses only verified owned revisions.
- [ ] Delete confirms provider absence, inventories retained resources, settles/reconciles reservations and audits outcomes. Logs are bounded/redacted and scoped by provider binding.
- [ ] Run real disposable pilot in customer project with max instances 1, then clean up only pilot-created resources. Preserve evidence of build/release/rollback/delete; commit.

## Task 8 — Customer domains, environment secrets and observable usage

Files: `src/lib/cloud/{domains,secrets,observability}.ts`, associated cloud API routes, `tests/cloud/domains.test.ts`, `tests/cloud/secrets.test.ts`, `tests/cloud/usage.db.test.ts`.

- [ ] Test domain reuse across tenants, pending/expired challenges, invalid certificates, forbidden platform domains, secret values in errors/logs, overlapping meter windows and delayed usage after grant revocation.
- [ ] Require random DNS TXT ownership challenge and recheck on assignment; domain stays pending until routing/certificate/healthy serving are verified. Never repoint AXXES platform domains through customer API.
- [ ] Store runtime secrets only in tenant/resource-owned Secret Manager references. API can set/replace/delete values but never returns plaintext values; names/status/version metadata only.
- [ ] Ingest real deduplicated provider events into the existing immutable ledger and reconcile cost units/invoice coverage. Display an unavailable measurement honestly, not as zero. Paid continuous serving stays closed until billing coverage and suspension/residual cost tests pass.
- [ ] Verify real certificate serving on a disposable domain only when DNS credentials/control are available; otherwise that capability remains hidden. Commit.

## Task 9 — Payment credits, runtime funding and API credentials

Files: `src/lib/cloud/billing/{processor,funding,limits}.ts`, `src/lib/cloud/api-keys.ts`, payment webhook/API routes, `tests/cloud/billing.db.test.ts`, `tests/cloud/api-keys.test.ts`.

- [ ] Test signed/replayed/mismatched processor events, canceled checkout, unsupported currency, overlapping hourly renewal, insufficient funds, termination lag, and revoked/wrong-tenant key.
- [ ] Use AXXES Pay's verified processor integration where available; credits follow signed settled events only. Pin immutable customer/reference/currency/amount mapping; never credit from the checkout browser return.
- [ ] Retail quote includes compute, storage, egress, builds, backups/addresses, monitoring/support and processor costs. Verify integer pricing and 40% gross-margin target against current provider data and measured pilot workloads before publication.
- [ ] Renew funding windows before the current window expires; freeze new spend and perform service-appropriate suspension with residual-cost reserve. Incidents block further discretionary spending. Alerts are not represented as hard provider caps.
- [ ] Cloud API credentials are scoped/hashed/revocable with bounded lifetime and rate limits; do not accept Nexus-format personal tokens. Browser authorization and API key permissions both resolve live membership and resource scope.
- [ ] Paid capability turns on only after real payment/metering/suspension verification. Owner-only exemption uses the existing owner policy, not a fake prepaid credit. Commit.

## Task 10 — Working cloud console and end-to-end flows

Files: `src/app/cloud/{page,projects,apps,activity,billing,settings}`, `src/components/cloud/*`, `tests/cloud/navigation.test.ts`, Linux browser tests under `tests/cloud/e2e`.

- [ ] Browser RED tests for project create/select, real inventory/empty state, GitHub connection, quote/admission, job progress/error, preview/release/rollback, secret replacement, domain verification, role/tenant switch and token revocation.
- [ ] Build responsive AXXES Cloud shell with family-aware All Apps/org switcher, visible verified capabilities, real empty/error/loading states and no inert controls. Back every action with the completed application services above.
- [ ] App create flow shows runtime/region/shape/estimated costs before reservation; owner exemption is visible only to the verified eligible identity. Unsupported Vercel features explain the blocker before spend.
- [ ] Project/activity/billing views show scoped real data with precise unavailable statuses. Owner/admin billing controls; manager mutation controls; member/viewer permitted read-only surfaces. Every bookmarked route either works or has explicit recovery.
- [ ] Verify keyboard/mobile flows and real signed-in two-tenant Linux browser fixtures, then commit.

## Task 11 — Dedicated deploy target and live release

Files: `cloudbuild-cloud.yaml`, `cloudbuild-cloud-worker.yaml`, `.github/workflows/gcp-cloud.yml`, provisioning/release scripts and `docs/release/axxes-cloud-verification.md`.

- [ ] Extend Linux CI with disposable PostgreSQL and cloud pure/HTTP/DB/browser suites, original developer/deploy regressions and a production build. Verify credential-free image layers.
- [ ] Create dedicated console/worker service accounts and secret configuration; migrate owned cloud tables only. Verify deployment cannot alter developer/developer-v2 release targets or expose provider credentials.
- [ ] Configure explicit cloud.axxes.app URL-map/backend/certificate and exact OIDC callback. Stage console revision, perform readiness/cross-domain session tests, promote and verify rollback. Worker endpoint is private and requires its trusted dispatcher identity.
- [ ] Request one independent whole-branch code review under requesting-code-review; resolve all Critical/Important findings. Merge/deploy within the owner's authorized cloud work after required checks pass.
- [ ] Run a disposable real end-to-end app lifecycle and two-tenant authorization probes; verify billing/setup gates and all visible routes. Record actual revision/digest, enabled capability matrix, unresolved external configuration, costs and cleanup.
- [ ] Update AXXES canonical knowledge/product visibility only for capabilities actually verified. Report what is running without claiming full DigitalOcean parity.

## Plan self-review

Checked against the approved spec: identity/domain routing (3/11), owned tenant model (1/2), quote/financial admission and owner exclusivity (4/9), fenced jobs/provider reconciliation (5), verified source/build lifecycle (6/7), domains/secrets/metering (8), actual customer flows (10), and deployment/review/evidence (11). The five listed failure classes have explicit tests in tasks 3–9. No broad shared schema migration, automatic free infrastructure expansion or unimplemented product claim is included. Later service milestones remain separately scoped; completing this plan delivers verified app-hosting capability rather than asserting full parity.
