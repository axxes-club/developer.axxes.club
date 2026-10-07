# Deploy runtime progress — 2026-10-07

Not customer launch readiness. Foundation PR: https://github.com/axxes-club/developer.axxes.club/pull/5.

Provisioned resources:
- Project `axxes-customer-hosting` (number `447016917238`), linked to existing billing account. Cloud Run, Cloud Build, Artifact Registry, Secret Manager enabled.
- Removed default compute `roles/editor` and legacy Cloud Build `roles/cloudbuild.builds.builder` project grants.
- `customer-runtime@axxes-customer-hosting.iam.gserviceaccount.com`: no project grants.
- `customer-build@axxes-customer-hosting.iam.gserviceaccount.com`: project logging writer; writer ONLY on `hosting-pilot` Artifact Registry repo; viewer ONLY on private `axxes-source-pilot-447016917238` bucket. These resources are exclusively for compatibility fixtures. Customer build identities must get separate per-job/project resources.
- Pilot source bucket uses uniform access and public access prevention.

Implemented: signed bounded GitHub webhook, immutable receipt/commit identities, atomic deduplicated project-bound intents awaiting admission, user installation repository-access verification and internal scoped binding, controlled digest-pinned Next standalone build planner.

Not configured/exposed: GitHub App OAuth acquisition, App credentials, customer repository binding UI, admission worker, source preparation/extraction, customer runtimes, domain publishing, rollback, actual beneficiary bindings, usage collection, payment collection. No migration applied to production. The webhook fails closed without its dedicated secret. No public navigation advertises deployment.

Linux verification: Cloud Build `8e393090-dbb1-4490-981f-d99e6f8656f3` in `gravy-meta/us-west1` succeeded with pure/HTTP tests, real disposable PostgreSQL tests (including immutable SQL identities and tenant-owned binding), TypeScript and production build. Later build-plan edits require a new final check.

Independent reviewer found no remaining Critical/Important issues within implemented internal boundaries after source immutability fix; explicitly did not certify OAuth, admission or launch.
