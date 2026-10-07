# AXXES Cloud execution ledger

Approved scope: the 2026-10-07 design and foundation plan. Existing owner authorization covers implementation, review, merge and deployment. Free app deployment remains Jose-only; paid provisioning and other infrastructure capabilities stay closed.

## Verified implementation

The console implements organization-owned projects, real inventory/activity/billing views, organization switching, host-only sessions, suspension checks, scoped read API credentials, expiration/revocation and atomic per-key rate limiting. Bearer credentials cannot call browser mutation routes. Handshake's exact confidential Cloud client was merged in PR #9 and deployed as handshake-00050-cij, without rotating shared authentication secrets.

Linux CI 37694764596 passed the original hosting/platform suites, Cloud pure tests, 12 PostgreSQL tests, a production build, and a Chromium HTTPS fixture. Browser checks cover anonymous gating, real project creation, tenant/role switching, one-time API credentials and use/revocation, suspended users and mobile sign-in. The browser fixture mints its own disposable sessions; it does not certify the real production Handshake exchange.

Independent review identified recovery, cancellation, stale publication, mutable source binding, checkpoint loss, fail-open readiness, storage isolation and release binding defects. Regression tests reproduced them before fixes. Release binding RED: CI 37694610995; GREEN: 37694764596. Resource storage now rejects foreign projects, public/retained/versioned buckets and unexpected build-account grants. Releases have a composite job/tenant/resource/generation reference.

## Production preparation

Applied only owned Cloud migrations 001-control-plane, 002-account-controls and 003-release-bindings through an authenticated Cloud SQL proxy. Shared identity/organization tables were not migrated. Added a dedicated cloud-env secret and cloud-console service account with secret access and Cloud SQL client permissions. GCP approved the gravy-meta service-account quota increase from 100 to 200; the earlier quota blocker is resolved.

Cloud Build d4a89403-238b-430c-9522-ef844240f8e1 succeeded, including image-layer secret scanning. Runtime image: us-west1-docker.pkg.dev/gravy-meta/ci-developer/cloud@sha256:2a6ce1a40a242666942de8d2b7ea98cd13eb490f54d833631e206413e572d5ac. This console image was built at fa9fcf9; later changes correct worker-only isolation checks, add the owned release-binding migration and repair the browser harness. The console runtime code is unchanged by those corrections.

Cloud DNS already targets the atelier-sites load balancer at 34.107.128.192 with existing wildcard TLS. A dedicated console deployment and additive exact-host route are being prepared. Record final revision, routing and live probes in axxes-cloud-verification.md after they pass.

## Remaining operational work

App provisioning stays disabled. The bounded worker engine and provider stage/build/readiness/publication/deletion contracts exist, but the standalone worker, lifecycle integration and app launch controls remain incomplete. Runtime secrets, customer domains, logs, metering, payments and funding suspension require further implementation/verification. Servers, databases, storage, Kubernetes and networking are later milestones.

There is no AXXES Cloud GitHub App installed in the organization. An operator-only manifest setup script prepares read-only repository permissions, exact Cloud OAuth callback and disabled webhooks; GitHub requires the owner's authenticated registration and installation action. Generated credentials are saved privately, never displayed in the browser or logs. Paid provisioning also requires verified payment collection, measured usage and approved costed prices; candidate prices are not published.

The approved operational plan is not complete. A deployed closed-capability console must not be reported as working customer app hosting or full DigitalOcean parity.
