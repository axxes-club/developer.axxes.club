# AXXES Cloud execution ledger

Approved spec and implementation plan: 2026-10-07. Native execution; no customer cloud launch claimed.

- Task 1: capability/schema tests reproduced missing implementation, using node --import tsx --test.
- Environment: managed sandbox denies CLI tsx IPC listeners and external DNS. Ruling: use node --import tsx for pure test execution, keep all deployment/DB verification explicitly pending, and continue authorized local implementation. Do not request an unavailable escalation or claim remote checks passed.
- Provider adapters/capabilities must stay closed until release verification. Configuration values alone are operator release gates, not customer proof of working capabilities.

- Task 1: 2 pure tests and TypeScript passed. Task 2: owned SQL migration, scoped store and PostgreSQL regression written; DB execution pending because local listeners/external connections are blocked. No database migration has been applied.

- Tasks 3–5 in progress: host-only OIDC session/auth routes, same-origin bounded API handlers, inventory APIs, transactional quote/admission, existing budget helper transaction support, owner-project grant endpoint, fenced job leases and narrowly scoped GCP REST transport. 8 pure security/HTTP/provider tests pass; TypeScript verification follows each change. Handshake client registration and DB/browser/provider tests remain pending.
- Ruling: current Handshake signs HS256 ID tokens with the registered client's secret, matching the existing Office implementation; pin HS256 and verify required issuer/audience/nonce/subject/iat/exp instead of assuming an unconfigured RSA JWKS provider.
- Ruling: Cloud Build create has no documented request-id deduplication parameter. A dispatched timeout stays reconciling and searches stable build tags; never blindly resubmit an ambiguous build. Source: https://docs.cloud.google.com/build/docs/api/reference/rest/v1/projects.locations.builds/create .

- Ruling: each cloud app receives its own backing deployment project, source binding and scoped grant; cloud projects group apps for navigation. Reusing one project-wide repository binding would let one app change another app's source. Owner-free selection is therefore explicit per app, not inherited by all project members.

## Local checkpoint — 2026-10-07

Implemented locally: encrypted GitHub App user connection and immutable source/archive intake; per-app source/financial isolation; protected Cloud console routes for overview, projects, apps, activity, billing and settings; real project creation, organization selection and sign-out; tenant-scoped inventory counts and integer financial display. Cloud readiness requires valid OIDC configuration, a reachable database and the exact owned migration record. Unverified provisioning stays hidden.

Verification: TypeScript passed. Combined Cloud, developer hosting, platform access and navigation suite passed 50/50 tests, including 16 Cloud pure tests. `git diff --check` passed. Five real PostgreSQL tests are authored (tenant isolation, single-use identity transaction, hashed/revocable session, exclusive worker lease/cancellation/generation, revoked scoped grant); execution is pending. The attempted DB command failed because DEPLOY_TEST_DATABASE_URL is unavailable. No SQL behavior is represented as verified.

Independent fresh-context review found revoked grant authority and stale/canceled job completion defects. Fixed by checking the reservation's exact active scoped Jose grant and locking the resource before completion/publication. Reviewer confirmed the fixes by inspection; DB execution remains required.

Production build attempted with fixture configuration and webpack; it failed fetching the existing Geist/Geist Mono Google fonts because fonts.googleapis.com cannot resolve. GitHub access also fails DNS resolution. Network restrictions and unavailable local listeners prevent Linux/PostgreSQL/browser/provider verification, pushing, merging and deploying from this session.

Remaining implementation: standalone worker and actual build/preview/release/rollback/delete adapters; complete app launch controls; domains/runtime secrets/logs/usage ingestion; verified payments, funding renewal, suspension and API credentials; dedicated deploy targets and live routing/OIDC registration. The approved plan is not complete. No new service, cloud migration, production traffic change or paid provisioning was launched. Release gates must remain closed until required implementation and real verification pass.
