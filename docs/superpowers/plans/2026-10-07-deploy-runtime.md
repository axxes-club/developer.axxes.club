# AXXES Deploy runtime implementation

Owner authorized implementation and release work with “just do it”. Continue in the existing isolated worktree; do not introduce another design approval gate.

1. Provision separate `axxes-customer-hosting` GCP project. Dedicated build and runtime identities have no platform/database permissions. Grant artifact access per job/project, not globally to customer code.
2. Authenticate GitHub App installation ownership, explicitly bind selected repository IDs to tenant/project, and ingest bounded signed push events into an atomic deduplicated outbox. Pin immutable commit SHA. Never execute repository-provided build configurations or Dockerfiles.
3. Admit builds only after price/rate validation and budget reservation (or explicit audited exemption). Prepare source outside untrusted build; do not pass GitHub credentials into customer scripts.
4. Build supported static and Next standalone fixtures in Linux, deploy staged revisions with scale-zero/capacity caps, probe readiness, serialize promotion and reject stale jobs. Record artifact digest, historical runtime/rates, and rollback target.
5. Add authenticated project/import/deployment UI, preview expiry, verified domain ownership, publishing and rollback. No simulated success or visible unavailable actions.
6. Bind approved free beneficiaries to verified tenant/project IDs. Measure real costs, verify active payment provider, reconcile usage and publish paid tiers only when margin checks and spend enforcement pass.
7. Verify Linux fixture deployments and authenticated end-to-end flow. Independent review before merging. Document actual deployed resources and remaining launch constraints.

GitHub App credentials/installation setup are not present in developer configuration as of this inspection. Customer source integration must fail closed until configured. Existing production services and secrets remain outside the customer project.
