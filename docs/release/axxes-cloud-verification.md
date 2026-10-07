# AXXES Cloud release verification — 2026-10-07

## Running console

- Host: https://cloud.axxes.app
- Cloud Run: gravy-meta / us-west1 / cloud
- Initial revision: cloud-00001-gdl
- Initial verified image: us-west1-docker.pkg.dev/gravy-meta/ci-developer/cloud@sha256:2a6ce1a40a242666942de8d2b7ea98cd13eb490f54d833631e206413e572d5ac
- Build: d4a89403-238b-430c-9522-ef844240f8e1, SUCCESS, runtime image-layer secret scan passed.
- Runtime identity: cloud-console@gravy-meta.iam.gserviceaccount.com; cloud-env version 2; shared Cloud SQL mount gravy-meta:us-west1:axxes-prod-db.
- Capacity: 1 CPU / 512 MiB, instances 0–2, concurrency 40, request timeout 60 seconds.
- Ingress: internal and Cloud Load Balancing; public invoker for the public console.
- DNS: unchanged 34.107.128.192. Existing atelier-sites HTTPS proxy/certificate map reused; additive exact Cloud host maps to cloud-be and cloud-neg. Google URL-map validation passed for /api/cloud/health. Existing host rules/path matchers preserved.
- Applied owned migrations: 001-control-plane, 002-account-controls, 003-release-bindings. No shared schema migrations.

## Verified public probes

- GET /api/cloud/health: 200, ready=true, real production database migration check.
- GET /: redirects to /cloud/sign-in; sign-in returns 200 and configured Continue with AXXES control.
- GET /api/cloud/auth/start: redirects to Handshake's authorization endpoint, client cloud, exact https://cloud.axxes.app/api/cloud/auth/callback, PKCE S256 and Secure/HttpOnly/SameSite=Lax __Host transaction cookie.
- Following the authorization URL anonymously: real Handshake sign-in, no invalid_client/invalid_redirect_uri.
- GET /api/cloud/projects without session: 401.
- Forged callback state/code: 401.
- Existing developer root: 200. Existing Atelier root: 307.

A signed-in production authorization-code exchange has not been completed by a real user in this release session. Browser CI uses its own disposable sessions and cannot substitute for that check.

## Linux verification

CI 37694764596 passed PostgreSQL ownership, session, job recovery, checkpoint and release-binding tests, pure Cloud/hosting/platform tests, Next production build and HTTPS Chromium flows. CI 37695497163 also passed operator credential-output preflight/persistence-retry regressions. The browser fixture covers project creation, membership/role changes, organization isolation, read API credential issue/use/revoke, suspended user denial and mobile sign-in. No production user/tenant fixture was created.

## Enabled capabilities

| Capability | Status |
|---|---|
| AXXES Cloud console and sign-in entry | Running; actual user OIDC completion still required |
| Organization projects, inventory, activity, billing records | Verified in two-organization Linux browser fixture |
| Scoped read API credentials | Verified in PostgreSQL and browser fixture |
| Customer app provisioning | Disabled; worker/lifecycle and GitHub installation incomplete |
| Paid provisioning | Disabled; payment, metering and price verification incomplete |
| Domains, runtime secrets, logs and usage controls | Hidden/incomplete |
| Servers, databases, storage, Kubernetes, networking | Later milestones, unavailable |

This is the closed-capability console/control-plane checkpoint, not completion of the full operational app-hosting plan. Customer workloads have not been created by this release. Free deployments remain Jose-only; the release grants no free VM/database/GPU capability.

## Dedicated release pipeline

The dedicated GCP Cloud console workflow, cb-cloud/gh-cloud identities, ci-cloud artifact repository and gravy-meta-ci-cloud source bucket passed real release verification. PR #8 merged as 1a19df6cc71adeb813640fcb15a45125ab321af5. Exact-main Linux CI 37696633601 and automatic Cloud release 37696860417 succeeded. Cloud Build 7bb860cc-1c0a-4beb-84d7-380269b8d461 passed the runtime-layer secret scan and staged rollout, publishing image sha256:05187432a755a7b16121fe6902ce94ad1e0e96546cc91147f0d38a968caa7d05 in ci-cloud. The build target can update only the cloud console service through its scoped release identity and uses cloud-env. It does not select developer or developer-v2 release targets. It stages a revision, checks provider readiness, guards against concurrent traffic changes, probes the database-backed public Cloud health endpoint after promotion and restores the prior revision on failed promotion checks. The first main release uses exact-commit CI gating before GCP authentication. Federation permits workflow_run only for this repository/main/exact Cloud workflow, preserving existing push/manual conditions. Source upload uses the bucket-scoped axxesSourceUploader role. The temporary developer-builder access to cloud-env was removed after migration to cb-cloud.

The independent review findings were fixed before merge. Provisioning remains closed, and the operational app-hosting plan remains incomplete; user GitHub registration alone does not certify worker/lifecycle or payment readiness.
