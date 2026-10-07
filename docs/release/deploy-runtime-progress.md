# Deploy runtime progress — 2026-10-07

Not customer launch readiness. Foundation PR: https://github.com/axxes-club/developer.axxes.club/pull/5.

Provisioned resources:
- Project `axxes-customer-hosting` (number `447016917238`), linked to existing billing account. Cloud Run, Cloud Build, Artifact Registry, Secret Manager enabled.
- Removed default compute `roles/editor` and legacy Cloud Build `roles/cloudbuild.builds.builder` project grants.
- `customer-runtime@axxes-customer-hosting.iam.gserviceaccount.com`: no project grants.
- `customer-build@axxes-customer-hosting.iam.gserviceaccount.com`: project logging writer; writer ONLY on `hosting-pilot` Artifact Registry repo; viewer ONLY on private `axxes-source-pilot-447016917238` bucket. These resources are exclusively for compatibility fixtures. Customer build identities must get separate per-job/project resources.
- Pilot source bucket uses uniform access and public access prevention.

Implemented: signed bounded GitHub webhook, immutable receipt/commit identities, atomic deduplicated project-bound intents awaiting admission, user installation repository-access verification and internal scoped binding, controlled digest-pinned Next standalone build planner.

Not configured/exposed: GitHub App OAuth acquisition, App credentials, customer repository binding UI, admission worker, source preparation/extraction, customer runtimes, domain publishing, rollback, Jose personal binding, usage collection, payment collection. Owned-table migrations and two verified beneficiary bindings were subsequently applied as recorded below. The webhook fails closed without its dedicated secret. No public navigation advertises deployment.

Linux verification: Cloud Build `8e393090-dbb1-4490-981f-d99e6f8656f3` in `gravy-meta/us-west1` succeeded with pure/HTTP tests, real disposable PostgreSQL tests (including immutable SQL identities and tenant-owned binding), TypeScript and production build. Later build-plan edits require a new final check.

Independent reviewer found no remaining Critical/Important issues within implemented internal boundaries after source immutability fix; explicitly did not certify OAuth, admission or launch.

Verified live runtime (private fixture, not customer deployment):
- Isolated Cloud Build `949ab194-b026-425e-9dfb-eab3b29cf9d0` succeeded with explicit customer-build identity.
- Image digest `sha256:88aa49efaff551bd428d28b8a0528b8e2550650cb2f402e089f00453bea6ffdb`.
- Cloud Run `hosting-next-fixture-00001-7l5`: runtime account above, 1 vCPU/512MiB, scale-zero, max instances 1, concurrency 10, request timeout 30s; no secrets attached, authenticated access only.
- Live checks passed: dynamic API timestamps, server-rendered page, public asset, framework JS asset, denial of anonymous requests. Streaming and staged promotion/rollback verification follow separately.
- Current-head Linux AXXES CI passed: https://github.com/axxes-club/developer.axxes.club/actions/runs/37581157202 (`d92f36d`, 25 pure/HTTP + 21 PostgreSQL tests).

Production owned-table setup and approved exemptions:
- Applied ONLY `001-foundation.sql` and `002-source-intake.sql` to existing developer database through authenticated Cloud SQL proxy. No shared table migration or app redeployment.
- Bayamón Municipal tenant `1655ea4c-d5dd-4905-a5b9-a61fc6b7cd4d`, grant `d0ea6b1b-8f1a-409d-b79b-02c36819e0b3`.
- Colección Reyes-Veray tenant `97043d3c-08dc-4f9c-857a-de3a69a5d269`, Otto grant `17619bf1-22eb-4c83-aedd-44c0f1e65f93`.
- Jose's email resolves to multiple organizations, including two primary memberships (AXXES and Crativo). Asked for personal exemption scope rather than treating every membership as free.
- Stripe account was queried read-only on 2026-10-07: `charges_enabled=false`, `payouts_enabled=false`, `details_submitted=false`. Paid hosting cannot be opened yet.

Streaming and traffic verification:
- Second isolated build `ca8a6284-ce4c-4275-b173-9e3d8cd12349` succeeded using source object generation `1791354630897486`.
- Artifact digest `sha256:7ddb30fb95f49c69adb53d13c6988500b4faf34b9e17da746b66b6a8a2531a8e`; revision `hosting-next-fixture-00002-qit` staged with zero traffic and a temporary private tag.
- Authenticated staged checks passed SSR/API/assets and streaming (first chunk before the delayed final chunk); identical checks passed after promoting revision 2 to 100% traffic.
- Rolled back to `hosting-next-fixture-00001-7l5`; healthy API and absence of the newly added streaming route confirmed the original artifact was serving again. Removed temporary preview tag afterward.
- These manual provider lifecycle checks do not establish the unfinished tenant outbox worker, stale-job guard, custom domains or customer rollback UI.

Final administrative verification:
- Independent review caught concurrent exemption retries using transaction-start time and differently cased UUID lock keys. Fixed by canonical lowercase UUID validation and post-lock `statement_timestamp()` interval checks.
- Synchronized PostgreSQL regressions reproduced both defects in RED build `55d20d51-5129-49dd-bd44-3b213ec14a2a`.
- Final GREEN Linux build `7b30bbd6-2e2d-43fd-9e8b-6522a51bcc88` passed 25 pure/HTTP plus 23 real PostgreSQL tests, TypeScript and production build. Existing platform-access suite passed 3 tests locally and was added to required Linux CI.
- Read-only production audit confirmed exactly one Bayamón grant and one Otto grant. Dedicated local Cloud SQL proxy was shut down after administration.
- Reviewer confirmed the race fix; no remaining Critical/Important finding within reviewed implementation boundaries. OAuth/customer admission/publishing UI and public launch remain unfinished.
