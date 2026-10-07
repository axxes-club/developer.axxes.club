# Owner-only free app deployment

Owner changed the policy on 2026-10-07: nobody besides Jose may deploy apps for free. This supersedes the earlier Bayamón/Otto exemptions and any organization-wide interpretation that would let coworkers deploy for free.

- Bind Jose's stable account ID once in immutable, audited `deploy_free_deployment_owner`. Email is used only for administrative identity lookup, never as a runtime rule.
- Migration 003 prospectively revokes all non-Jose grants and rejects new non-Jose grants. Existing future-dated non-owner revocations cause an explicit migration abort, so an old scheduled end cannot silently preserve free access. Original grants, old usage and previously settled charges remain unchanged; no retroactive collection.
- Free deployment permission requires verified account identity plus an active tenant membership and scoped project exemption. Coworkers, other owners/admins, and superadmin membership cannot inherit free deployment access.
- Free budget reservations, including retries, require `actorUserId` matching that bound identity. The actor must come from authenticated server context, not a browser payload. Future execution entry points must call `authorizeHostingDeployment()` before reserving/dispatching work.
- Automatic GitHub events do not prove the AXXES actor. They cannot enqueue exempt builds until verified owner identity mapping is implemented; paid projects still enqueue for budget admission.
- Paid deployments remain subject to prepaid funding and pricing controls. Read-only usage and migration inspection retain their existing role permissions.

Operational rollout: verified tests/review, apply own migration 003, bind the exact Jose account ID with issuer/reason, confirm all non-Jose grants are inactive, deploy the guard change to production and staging. No public customer deployment UI or worker is implied by this policy change.
