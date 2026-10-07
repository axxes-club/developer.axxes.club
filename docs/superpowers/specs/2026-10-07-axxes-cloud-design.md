# AXXES Cloud: cloud platform design

Status: concrete proposal for owner review. No new cloud service, resource or product launch is claimed.

## Intent and branding

Build an AXXES-branded developer cloud with the functional product breadth of DigitalOcean. Proposed name: **AXXES Cloud**, host **cloud.axxes.app**. This is a cloud provisioning product, not an imitation dashboard filled with demo resources. It extends the AXXES.dev line; retain existing product key `developer`, developer URLs, developer documentation, shared identity and organization model. Do not rename existing catalog keys or repurpose Atelier/Keel. The new console is a distinct Cloud Run service and deploy target so its releases cannot accidentally overwrite developer documentation.

Use AXXES typography, lime developer accent and product terminology: Apps, Servers, Databases, Storage, Kubernetes, Networking. Customer screens show their actual organization resources, jobs, logs and spending. Empty accounts show honest empty states. Capabilities without a verified provisioning adapter stay out of customer navigation and the Create menu; an owner-only roadmap can expose delivery status. No fake resource counts, generated invoices or success notifications for an unsubmitted job.

## Baseline verified on 2026-10-07

- Developer PR #7 merged and deployed; it is documentation and hosting groundwork, not a functioning customer cloud console.
- `axxes-customer-hosting` is active (project number 447016917238). Existing private Next compatibility fixture proved a limited Cloud Run build/publish/rollback path.
- Existing `deploy_*` schema owns hosting grants, immutable usage/rates, prepaid reservations, audited overruns, source bindings and webhook intents. Actual customer admission, OAuth setup, runtime worker, domain management and payment collection are unfinished.
- Owner identity is bound in `deploy_free_deployment_owner`; non-Jose grants were revoked prospectively. Never restore Bayamón/Otto exceptions or grant teammates access to free deployment.
- Last verified Stripe state could not collect payments. Recheck the live account before launch; until activated and verified, paid provisioning is unavailable. Never turn a browser redirect, manual balance edit or unsigned callback into spendable customer credit.
- `cloud.axxes.app` resolves to the shared load balancer IP, but DNS resolution alone does not establish a routed service, certificate or working sign-in. Confirm exact host routing/certificate ownership before publishing.

## Approaches and selection

1. **GCP first, provider adapters later (recommended).** Reuse isolated infrastructure already provisioned; Cloud Run for apps/functions, Compute Engine for servers/volumes, Cloud SQL for PostgreSQL/MySQL, GCS for object storage, Artifact Registry, GKE, Cloud DNS/VPC/firewalls/load balancers. This minimizes initial setup and maintains operational control. Classic server/database pricing may not beat DigitalOcean after margin; offer only costed viable tiers and emphasize managed integration where it adds value.
2. **DigitalOcean-backed.** AXXES owns the console and billing while provider APIs manage resources. Closer product correspondence and simpler DigitalOcean-shaped tiers, but introduces a new account/credentials, provider terms assessment and billing integration. Retail price must exceed our full provider cost; reselling identical resources cannot honestly claim universally cheaper pricing.
3. **Multiple providers from launch.** Enables economical resource placement, but multiplies identity, reconciliation, networking and recovery work. Retain adapter interfaces now; avoid implementing simultaneous providers before the first real product works.

Provider choice was requested from the owner. Default proposal is GCP first if no preference is supplied; no irreversible provider commitments are authorized by this draft.

## Full product coverage and order

The reference scope is [DigitalOcean's current product documentation](https://docs.digitalocean.com/products/), checked 2026-10-07. This is the full delivery roadmap, not a claim that completing milestone 1 provides full parity.

| Milestone | Customer capabilities | Initial GCP realization | Proof required before exposure |
|---|---|---|---|
| 1: console and app hosting | Projects, organization switching, API authentication, GitHub imports, static/Next apps, environment secrets, deployments/rollback, domains, logs, metrics, billing/spend controls | Existing hosting foundation plus isolated Cloud Run/Build, Secret Manager, GCS, certificate/domain integration | Signed-in tenant workflows; real app build/release/rollback; verified payment or owner-only free admission; costs and isolation |
| 2: infrastructure | Linux servers, SSH keys, start/stop/reboot/resize/delete, images, persistent volumes, snapshots/backups, VPC, firewalls, addresses, DNS, load balancers | Compute Engine, disks/snapshots, VPC and Cloud DNS/load balancing | Real provider operations and async completion; data preservation; ownership checks; stop/delete billing semantics |
| 3: data and storage | Managed PostgreSQL/MySQL, cache, object buckets/access keys, lifecycle policies, database backup/restore, container registry | Cloud SQL, managed cache, GCS/Artifact Registry | Private connectivity; tenant credentials; actual restore; storage/egress metering; compatibility tests |
| 4: orchestration | Managed Kubernetes, node pools, autoscaling, serverless functions, deployment automation, templates/marketplace | GKE and Cloud Run functions; reviewed image templates | Cluster access isolation, quota controls, upgrades, lifecycle and provider invoice reconciliation |
| 5: expanded parity | Additional database engines, GPU instances/inference, model hosting, file storage, uptime alerts, advanced HA/replicas, regional expansion | Explicit engine/GPU/file-storage adapters chosen after cost and availability review | Product-specific functionality, recovery, profitability and capacity evidence |

Marketplace images, MongoDB/Kafka/OpenSearch/Valkey, AI agents and GPU models are separate capabilities, not implied by providing PostgreSQL or a single server. Regional availability and supported configurations are capability data, never hardcoded promises of global parity. Maintain a versioned capability matrix with functional tests and provider evidence for each service.

## Architecture and ownership

Separate trusted control plane from customer execution. The console may read shared identity/tenant data but has no authority to migrate shared tables. New resource inventory/jobs/provider bindings/API credentials/audit tables use `cloud_*` and explicit owned SQL migrations. Existing hosting tables remain authoritative for app deployment financial records; no duplicate grants or balances.

A server-side application service resolves authenticated identity and active membership, applies the same entitlement/policy primitives as the existing hosting foundation, obtains a versioned quote and reserves funds, then writes a durable job/outbox in one transaction. The browser cannot supply actor identity, beneficiary, provider project, reservation success or resource ownership. Resource mutation requires a matching tenant-owned inventory row.

The console runs in company infrastructure. A separately deployed provisioning worker holds narrow, resource-specific provider privileges only in customer infrastructure. Builds have per-project or per-job isolated source/artifact identities; customer runtimes get no AXXES account secret, shared database DSN, platform API credential or project-wide service account. Full root-access VMs/Kubernetes tenants need stronger project/network isolation than unprivileged app containers; use tenant-owned provider projects or rigorously isolated network/IAM boundaries, verified before launch.

Resource identity is `(tenant_id, resource_id)` with immutable provider binding. Inventory is scoped to one tenant at query time, not filtered after a platform-wide provider listing. Never expose internal provider credentials in the browser or customer logs. Provider adapters expose quote/create/read/update/delete and operation polling with explicit capabilities; interfaces do not claim interchangeable semantics where providers differ.

## Identity and permissions

`cloud.axxes.app` cannot consume `.axxes.club` cookies. Use a proven first-party AXXES cross-domain flow: Handshake OIDC authorization-code exchange with exact callback URL, PKCE, state/nonce, server-side token exchange and host-only session. Register the specific client through the owning Handshake integration; do not enable public client registration, loosen redirect allowlists or rotate the shared Better Auth secret. If a verified platform-wide handoff is already live, assess it instead of inventing a second mechanism. Test sign-in, return URL, sign-out, suspension and org switching with disposable identities across both domains.

Roles: owner/admin manage billing and credentials; owner/admin/manager deploy or operate resources; member/viewer read only according to product permissions. Destructive operations require contextual resource confirmation. Immutable audit records capture actor, organization, requested change, job identity and provider outcome. API keys are hashed, scoped, revocable and rate limited; never reuse Nexus personal tokens as cloud infrastructure API keys.

Free app deployment requires Jose's registered stable user ID plus an explicitly scoped active project grant. Other people, including organization co-owners, must never inherit it. GitHub automatic deployments require verified owner mapping before receiving free build admission. Do not infer free access from email strings, organization names, API Free plan or superadmin membership. New non-app infrastructure services require their own explicit policy; this design does not silently widen an app deployment grant to unlimited VM/database/GPU consumption.

## Operations and failure recovery

Jobs record a customer idempotency key, immutable desired spec/quote/reservation, authenticated actor and monotonic resource generation. States are queued, running, succeeded, failed, cancel_requested and reconciliating. `ready` is set only after verified provider readiness. Provider request IDs/labels correlate retries; an ambiguous timeout triggers read/reconciliation before another create. A lease prevents two workers from dispatching one job. Stale generations cannot publish over a newer deployment.

Build admission rejects unsupported source/features before incurring spend. Upload/source archives are size bounded, path safe and commit pinned; no arbitrary customer Dockerfile or privileged build execution in the initial supported app path. Secrets are scoped to the runtime and redacted from logs. A failed build preserves the last healthy revision. App publishing stages zero-traffic revisions, checks readiness, serializes promotion and records rollback targets.

Delete remains pending until provider deletion is confirmed. Enumerate disks, public IPs, snapshots and backups retained after server stop/delete so ongoing charges remain visible. Backup retention/data deletion choices are explicit; never label a stopped server as zero cost while disks or addresses still bill. Reconciliation detects orphaned, missing and drifting resources; incidents preserve financial and operational evidence.

## Billing and competitiveness

Use USD integer micro-units, immutable rate versions and append-only deduplicated usage. The quote records provider, region, shape, estimated duration, compute, storage, egress, build, monitoring/control-plane allocation, backup/address costs, payment fees and support allocation. Retail must cover fully allocated cost and profit; the existing 40% margin target gives a pre-fee floor `ceil(cost / 0.60)`, with fees modeled explicitly rather than hidden. Do not publish price points until current provider data and representative workloads validate the margin.

Expose clear estimates, hourly/unit prices, applicable monthly caps and paid add-ons. Compare like-for-like delivered capabilities against [DigitalOcean pricing](https://www.digitalocean.com/pricing), [GCP VM pricing](https://cloud.google.com/products/compute/pricing) and [Cloud Run pricing](https://cloud.google.com/run/pricing). Favor scale-to-zero apps for low usage; do not sell loss-making VM tiers to imitate a competitor's headline.

Funding is prepaid and credited only by verified, replay-safe processor events. Provisioning requires a reservation before any provider spend. Continuous services renew bounded funding windows before exhaustion. Account spending alerts, creation freeze and service-specific suspension work with outstanding reservations and eventual provider metering. Provider budgets/alerts are not hard caps; reserve termination lag/residual costs and enforce maximum shapes/instances/quotas independently. A platform reconciliation incident blocks further discretionary spend. Financial history remains immutable and no previously free usage is retroactively charged.

## First implementation specification: operational foundation

The first subproject comprises the cloud console, canonical project/resource/job model, provider capability catalog, role/tenant policy, quote/admission interface, durable outbox worker, account audit, real app deployment and verified funding or owner-only free entry. Other milestones get separate specs and implementations against these interfaces; do not ship inert product tabs as substitutes.

Use the current developer repo as the source for this first subproject and build a separate console service/image target; `/cloud` is the internal console route root, with host-aware entry at `/` on cloud.axxes.app. Preserve developer.axxes.club landing and dashboard behavior. Extract only the shared hosting/application-service pieces actually needed; do not clone the whole developer app into an unrelated identity/billing fork. Cloud inventory uses owned tables, and all spending entry points call the existing financial admission policy through the shared server library. Worker deployment is separate from the HTTP console.

Initial app support remains static artifacts and the verified Node/Next standalone subset, with explicit reject messages for unsupported Vercel integrations. GitHub App setup and verified payment collection are operational dependencies. Without them, an owner-only real private fixture path can be tested, while customer provisioning remains closed. External GitHub/payment configuration cannot be replaced with mocked successful connections.

First acceptance tests: two distinct tenant/user fixtures prove no resource/job/secret/usage leakage; owner-only free admission and coworker denial; paid reservation/verified-credit flow and unaffordable rejection; duplicate creates and ambiguous provider timeouts; stale deployment prevention; actual build/preview/promote/rollback; streaming/static/SSR fixtures; safe cancellation/delete reconciliation; provider loss/overrun incidents; .app OIDC and suspension; all visible routes and usable controls; Linux CI and live disposable pilot checks. Real provider tests clean up only resources they created and record outstanding billable resources.

## Delivery and review

Each milestone is implemented, independently reviewed, verified in Linux and exercised against disposable real provider resources before release. Publish a capability only after its end-to-end acceptance checks pass. The console can launch as a verified limited beta, but must never be called a full DigitalOcean replacement while the matrix still contains unimplemented categories. Update AXXES knowledge and product catalog only with observed live behavior.

Before implementation, the owner reviews this architectural design, then receives the concrete implementation plan for the first subproject. Routine branch work and read-only verification remain authorized; billing/provider/identity operational blockers must be reported accurately. Existing developer deployment authorization does not imply permission to rotate unrelated shared secrets or remove existing customer resources.
