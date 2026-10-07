# Deploy foundation verification

Base: `b244ec1` from GitHub main. Feature branch: `feat/deploy-foundation`.
Scope: foundation increment only. No production migration, hosting deployment,
DNS change, payment collection or public pricing publication.

Implemented: explicit audited exemption policy and additive gate adapter;
unpublished Launch/Team candidates and fully allocated margin calculations;
durable deduplicated exact-quantity usage, immutable rates and bounded audited
credits; atomic funded/exempt reservations with idempotent settlement/cancellation;
bounded authenticated same-origin manifest inspection.

Linux verification uses disposable PostgreSQL in Cloud Build because mercelle
doctor found Lima but no QEMU on this macOS host. Cloud Build a76d6d81-2ed1-467e-82e6-671e9396e7a9 passed 17 harness, grant, policy and pricing tests plus TypeScript.
Build 566745fc-9b93-4c43-ac59-29f01bc4c9ad passed budget concurrency tests but rejected
future-dated ledger fixtures; the fixtures were moved to historical dates without
relaxing production timestamp validation. Build 5fe54dc1-3010-4da4-a22f-2bec71bfa18b passed all 18 pure/HTTP and 14 PostgreSQL tests, TypeScript and the Next.js production build. Independent review then found three financial correctness gaps; the synchronized PostgreSQL regressions reproduced all three in Linux build 84333e54-3b10-4f4c-aedf-d838f851e6af before the fixes. Final post-review evidence follows below.

Local pure/HTTP suite: 18 tests passed. TypeScript passed after correcting a test-only
header-map union type. Financial PostgreSQL tests are verified under Linux, not
claimed verified from macOS.

Baseline checks: check-app-catalog passed; check-org-context failed because its mock
loader lacks the existing platform-access dependency; check-organization-open
failed its fixed landing expectation; check-all-apps-ui and check-sidebar-ui could
not load the undeclared playwright-core dependency. These predate this change.
Existing npm audit reported high/critical dependency advisories; no dependency
upgrade is bundled into this feature. A separate dependency remediation is needed
before public paid hosting launch.

Limits: inspection consumes a sanitized configuration manifest, not a connected
GitHub/Vercel project. No build, runtime preview, domain cutover, invoice or payment
provider is implemented. Candidate prices are not measured production rate
commitments. Explicit exemption bindings are intentionally not guessed or applied.

Next release plans: isolated runtime/GitHub integration and deployment orchestration
(increment 2); provider reconciliation, verified payment integration, runtime
budget enforcement and paid onboarding (increment 3).

Independent review: three Important findings, no Critical findings. Fixed snapshot consistency with a repeatable-read summary; enforced prospective revocation in the database; persisted scoped over-reservation incidents before reporting errors. Free settlement overruns record consumption and incidents without charging or refusing on a billing budget. The regression suite uses real PostgreSQL clients and a synchronized scheduling barrier.

Post-review build d0909264-d4de-46a6-b60b-64c4b4118d9b passed 36 tests (18 pure/HTTP, 18 PostgreSQL), TypeScript, and the production Next.js build. A further timestamp regression pins the PostgreSQL microsecond/JavaScript millisecond boundary; revocation cutoffs round upward so events before the requested cutoff remain exempt.

Final Cloud Build: [b77fa101-c0a8-44ff-98c6-0e2f96335f2c](https://console.cloud.google.com/cloud-build/builds;region=us-west1/b77fa101-c0a8-44ff-98c6-0e2f96335f2c?project=777200802352) — SUCCESS. Mutation verification first removed the millisecond normalization in the disposable build copy and reproduced the expected cutoff failure, then restored it. The restored source passed 18 pure/HTTP tests, 19 PostgreSQL tests, TypeScript and the Next.js production build. No tests were skipped in the green suites.

All three Important review findings are closed with Linux regression evidence. Remaining system scopes listed above are deliberately deferred, not counted as working hosting.
