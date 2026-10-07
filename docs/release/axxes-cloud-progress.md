# AXXES Cloud execution ledger

Approved spec and implementation plan: 2026-10-07. Native execution; no customer cloud launch claimed.

- Task 1: capability/schema tests reproduced missing implementation, using node --import tsx --test.
- Environment: managed sandbox denies CLI tsx IPC listeners and external DNS. Ruling: use node --import tsx for pure test execution, keep all deployment/DB verification explicitly pending, and continue authorized local implementation. Do not request an unavailable escalation or claim remote checks passed.
- Provider adapters/capabilities must stay closed until release verification. Configuration values alone are operator release gates, not customer proof of working capabilities.

- Task 1: 2 pure tests and TypeScript passed. Task 2: owned SQL migration, scoped store and PostgreSQL regression written; DB execution pending because local listeners/external connections are blocked. No database migration has been applied.

- Tasks 3–5 in progress: host-only OIDC session/auth routes, same-origin bounded API handlers, inventory APIs, transactional quote/admission, existing budget helper transaction support, owner-project grant endpoint, fenced job leases and narrowly scoped GCP REST transport. 8 pure security/HTTP/provider tests pass; TypeScript verification follows each change. Handshake client registration and DB/browser/provider tests remain pending.
- Ruling: current Handshake signs HS256 ID tokens with the registered client's secret, matching the existing Office implementation; pin HS256 and verify required issuer/audience/nonce/subject/iat/exp instead of assuming an unconfigured RSA JWKS provider.
- Ruling: Cloud Build create has no documented request-id deduplication parameter. A dispatched timeout stays reconciling and searches stable build tags; never blindly resubmit an ambiguous build. Source: https://docs.cloud.google.com/build/docs/api/reference/rest/v1/projects.locations.builds/create .
