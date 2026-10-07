# AXXES.dev Deploy — customer hosting design

Date: 2026-10-07. Status: approved by the owner on 2026-10-07; foundation implemented on a feature branch, no infrastructure provisioned and no billing changed.

## Purpose and owner requirements

Make it easy for customers coming from Vercel to deploy websites and applications on AXXES. Every service that increases AXXES costs must be priced with profit while keeping the offering competitive and attractive. Jose (viscasillas@me.com), Bayamón municipal projects, and Otto Reyes projects receive free hosting and related services. Their costs remain visible internally. The owner authorized proceeding creatively; prices below are design proposals, not published promises.

Success means a supported repository can become a working preview without the customer managing cloud infrastructure; migration identifies incompatibilities before cutover; every bill is reproducible from durable usage and the accepted rate version; exempt projects are never charged.

## Approach and alternatives

Recommended: add Deploy to AXXES.dev, with a separate worker and isolated customer runtime infrastructure. Reuse AXXES Account and organization membership, but do not give customer code access to shared databases, sessions, credentials, or platform service accounts. Atelier remains the visual website studio; Keel remains source control. Deploy is a capability under the developer line, not a rebrand of either product.

Alternative: extend Atelier to run arbitrary code. Rejected because its vetted renderer and platform-domain cookie isolation serve a different security contract.

Alternative: wrap a third-party hosting reseller. Faster initially, but provider limits, two billing layers, and reduced control make margin and migration less predictable. Reconsider only if measured in-house operating costs defeat the commercial model.

## First release and later phases

First release supports static builds and supported Next.js applications packaged for Node.js standalone execution. The compatibility checker determines actual support from fixtures, rather than promising every Next.js version. Plain Node.js services and user Dockerfiles are later additions. Databases, queues, persistent volumes, GPU jobs, and managed Vercel-service replacements are not sold in the first release. Customers may retain existing external services and provide credentials.

Deliver in three independently reviewable increments: (1) durable billing policy, cost model, explicit exemptions, and migration inspection; (2) isolated build/runtime, previews, publish, domains and rollback; (3) payments, reconciliation and paid onboarding. A paid public launch requires all three. A private exempt pilot may precede payment activation, but still requires complete security and cost telemetry.

## Customer experience

The developer sidebar gains Deploy: projects, deployments, domains, usage and billing. Start by connecting a GitHub App to selected repositories. Choose repository, branch and organization. Detect framework, package manager, root directory and scripts. Show a migration checklist, estimated monthly range and assumptions, never a guaranteed estimate from source code alone.

Optional Vercel import uses an explicitly granted short-lived token to read project configuration, variable names, environment scopes and domain names. Import secret values only when the provider actually permits reading them and the customer opts in. Otherwise ask the customer to supply them privately. Never log or persist the import token after the import finishes. Do not automatically transfer DNS or cancel Vercel.

The checker flags Vercel Blob/KV/Postgres integrations, edge-specific behavior, routing rules, middleware, image optimization, ISR/cache semantics, monorepos, region assumptions and scheduled work. Each result is supported, action required, or unsupported, with a concrete resolution. Blocking items prevent a ready-for-cutover claim. Source-derived values are proposals; customer confirms environment scopes.

Build a preview on a dedicated hosting domain in a separate registrable domain from platform auth. Exact domain is chosen and verified during infrastructure setup; until available, previews use the isolated Cloud Run service hostname. Runtime cookies must never share the AXXES Account cookie domain. Deployments show actual queued/building/ready/failed state and sanitized logs. Publish promotes a verified immutable image or static artifact. Rollback selects a retained verified artifact. Custom-domain cutover happens only after ownership, TLS and health checks, with a displayed DNS change for the customer to apply.

## Runtime and deployment isolation

Use a dedicated customer-hosting GCP project and billing labels per tenant/project/deployment. Production AXXES project gravy-meta is the control-plane integration source, not the location for untrusted customer workloads. Provisioning requires a later explicit production infrastructure authorization.

Builds run with dedicated low-privilege identities, bounded CPU/memory/time/concurrency, no platform secrets, no shared persistent workspace, and repository credentials scoped to source checkout. Dependency and build scripts are untrusted. Build execution cannot obtain the deploy worker identity. Dependency caches are isolated or content-addressed without private cross-tenant contents.

A worker with narrow deployment permissions consumes an outbox, creates staged Cloud Run revisions, probes them, and promotes traffic only after success. Idempotency keys prevent duplicate builds, promotions or domain provisioning. Lock publication per project; a newer successful deployment cannot be overwritten by an older worker. Customer runtime identity has no default access to project resources or metadata-issued privileged credentials. Secret injection is scoped to project and environment, and excluded from build contexts unless explicitly required.

Static outputs use private object storage with controlled HTTPS delivery. Reuse Atelier implementation patterns, not its database identity or renderer service. Dynamic services scale to zero by default; warm instances require an explicit priced option. Each project has maximum instances, request limits and outbound abuse controls. Failed deployments preserve the last healthy production version. Previews expire after seven days by default; retained production artifacts have bounded storage and retention.

## Identity, data and entitlement

Server verifies active tenant membership for every operation. Owners/admins manage billing, repository connections and secrets; managers can deploy; members view deployments and logs; viewers have read-only access. GitHub webhooks require signature verification, delivery deduplication and installation/repository ownership checks. Fork previews never receive production secrets and do not deploy automatically without a trusted authorization policy.

New satellite-owned tables use deploy_*: projects, repository_connections, deployments, domains, operations, outbox, usage_entries, rate_versions, billing_accounts, exemptions, cost_allocations and reconciliations. All operational rows include tenant_id; foreign keys and queries enforce tenant/project relationships. Shared subscription or product-catalog changes originate in the members portal and are copied to satellites; no satellite schema push against shared tables.

Keep API plan keys free/build/scale unchanged. Hosting is a separately versioned subscription/add-on. Expose hosting entitlements through the existing gateFor interface via a dedicated resolver; do not infer free hosting from the current any-superadmin-member API exemption. Existing API behavior remains unchanged in this project.

Exemptions are explicit audited records for verified Jose-owned projects, verified Bayamón municipal tenants/projects and verified Otto Reyes tenants/projects. Email is only an identity lookup for initial administrative binding; runtime checks use stable IDs. Names, email domains and superadmin membership do not grant exemptions. Exempt status means no payment requirement, subscription charge, usage charge, auto-recharge or billing-budget suspension; technical capacity and security limits remain. Revocation is prospective and never retroactively invoices exempt usage. Missing bindings keep public billing disabled for those intended pilot projects until administrative verification.

## Proposed commercial model

Monthly per-workspace fee with collaborators included, plus usage at published resource rates. Candidate tiers: Launch $15/month, three active production projects, three deploying collaborators and $5 of retail usage credit; Team $39/month, fifteen active production projects, ten deploying collaborators and $15 retail usage credit. Viewer seats are included. Credits expire monthly and cover hosting usage only, not the subscription, taxes or unrelated products. These tiers must pass the cost gate before publication; project count does not include unlimited runtime or unlimited support. No annual discount or unbounded free public plan initially. Migration inspection is included for subscribers; hands-on migration is separately quoted to cover labor with margin.

Version resource prices by region, runtime class and unit. Meter allocated billable vCPU time, memory time, requests, transferred bytes, build machine time, artifact byte-time, and log ingestion/retention. Image optimization consumes and bills actual compute/transfer instead of an unexplained extra fee. Failed customer builds incur infrastructure costs and count toward usage; verified AXXES-caused failures receive credits. Avoid billing the same delivery bytes twice when provider charges represent alternative paths.

Target at least 40% gross margin on fully allocated customer-serving cost. Rate floor is allocated cost / (1 - target margin), including payment fees, support, shared load balancing/CDN, worker/control-plane costs and a measured safety reserve. Evaluate payment fees on total collected amounts. Model both included-credit exhaustion and multiple project counts; never assume unused credits will fund losses. Shared provider free tiers and temporary credits are not repeatable per customer and do not set retail rates. Exempt projects are a separately reported owner-funded cost center, not hidden in another customer's usage.

Publish exact rates only after representative static and dynamic benchmarks and SKU-based cost allocation. If the candidate tier misses margin, reduce its allowance or adjust its fee before launch. Present monthly estimates using low/typical/high traffic and disclosed cold-start and resource assumptions. Competitiveness is evaluated on total representative bills, not the subscription sticker alone.

## Durable usage, budgets and collection

The existing best-effort API usage record function is not a financial ledger. Hosting uses append-only deduplicated usage entries with source IDs, event time, quantity, unit, tenant/project/deployment and rate version. Corrections are additive adjustments. Store monetary values in integer micro-units; round only invoice line totals. Lock accepted rates for the billing period and notify customers before prospective changes.

Reserve budget atomically before builds and other provisionable work. Running workloads use near-real-time conservative consumption estimates and enforced capacity limits; delayed cloud billing exports reconcile costs but cannot enforce a hard spend cap. Track pending reservations and telemetry delays. Prepaid usage is the default after included credits; auto-recharge is off until explicitly enabled. No surprise postpaid overages. Warn at 50%, 80% and 95%; before the allowance/prepaid balance is exhausted, block new builds and shed or suspend chargeable runtime traffic while preserving artifacts, DNS and recovery UI. A bounded documented enforcement buffer is absorbed by AXXES, not silently billed beyond the customer limit. The cost model funds that buffer.

Invoice generation, payment submission and callbacks use stable idempotency keys; signed payment callbacks are deduplicated. Never collect payments until provider production capability is verified; the existing Stripe-related schema is not evidence that checkout is active. Reconciliation separates cost estimates, finalized vendor costs, customer charges and exemptions. Unattributed cost stays in an exception queue and is not assigned arbitrarily to a customer. Customers can export usage and see projects responsible for spending. No secrets or raw request bodies in billing logs.

## Failure behavior and verification

Provider outages retry with bounded backoff; stale operations time out visibly. A failed payment prevents additional paid consumption but does not delete data. Exempt workloads bypass collection failures. Domain collision, missing authorization and unsupported framework fail with actionable errors. Worker crashes and webhook replays cannot duplicate side effects.

Required tests: cross-tenant access denial; all three explicit exemption groups versus unrelated tenants; Jose membership alone does not exempt a customer; exemption prevents invoice/payment/budget suspension while preserving usage; ledger duplicates/replays/adjustments/rounding; concurrent reservations; bounded telemetry lag; price-version changes; preview secret isolation; malicious build credential access; stale publication order; failed rollout and rollback; DNS ownership and certificate state; expired previews; missing payment integration keeps paid launch unavailable.

Run end-to-end supported Next.js and static fixtures in production-like Linux. Exercise a compatibility matrix for SSR, routes, streaming, middleware, ISR/cache, assets and image handling; restrict support claims to passing combinations. Before public release, measure low/high traffic, cache misses, repeated builds, preview proliferation and abuse; demonstrate the margin floor and bounded budget buffer. An authenticated browser must complete GitHub import through preview, approved domain cutover and rollback. Pilot telemetry and reconciled costs must remain available after fixture cleanup.

## Evidence and remaining deployment prerequisites

Inspected developer src/lib/plans/catalog.ts, gate.ts, usage/meter.ts and database schema. API plans currently cost $0/$49/$299; hosting proposals do not replace them. Current API gate exempts any workspace with a superadmin member, motivating explicit hosting grants. No existing hosting worker or durable hosting ledger was found in the inspected developer source.

Infrastructure prerequisites are verified organization IDs for exemptions, a dedicated customer runtime project and identities, a separate preview domain, a scoped GitHub App, and an operational payment provider. Resolve each before its dependent release step; do not invent credentials or expose placeholder success.

Sources checked 2026-10-07:
- https://vercel.com/docs/plans/pro-plan — $20 platform fee, one deploying seat, $20 usage credit; extra deploying seats $20/month. Pro also includes CDN capacity, so comparisons must model bandwidth as well as seats.
- https://cloud.google.com/run/pricing — region/billing-mode-dependent compute and requests, network costs and billing-account-aggregated free tier.
- https://cloud.google.com/build/pricing — machine-class build pricing; use the selected isolated build class for cost calculations.
