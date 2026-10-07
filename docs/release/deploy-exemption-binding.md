# Hosting exemption binding — current policy

The owner changed the policy on 2026-10-07: **only Jose may deploy apps for free**. Earlier Bayamón and Otto grants are revoked prospectively by migration 003; keep their audit history and previous usage intact.

Verify Jose's actual account using viscasillas@me.com administratively, then bind its stable user ID in `deploy_free_deployment_owner` with issuer/reason. Do not use names, email comparisons, superadmin status, or coworker membership as runtime eligibility. That identity record is immutable.

Only beneficiary `jose` is accepted for new grants. Use reviewed tenant/project UUIDs and audited scope; issuing a grant never gives other organization members free deployment permission. `authorizeHostingDeployment()` requires the authenticated actor, active tenant context and scoped policy; `reserveBudget()` also requires the verified owner actor for free reservations/retries. Automatic GitHub events cannot receive free builds without verified AXXES owner mapping.

Exempt operations still retain technical/security capacity limits and usage records. Paid users need accepted pricing and funded accounts. Never print database credentials or customer secrets. Restrict financial mutation and migration privileges to audited administrative identities. See [owner-only rollout](owner-only-free-deployment.md).
