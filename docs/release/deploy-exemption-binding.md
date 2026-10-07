# Hosting exemption binding

This foundation has not migrated production or granted live billing exemptions.
The owner requires free hosting and related services for Jose
(viscasillas@me.com), Bayamón municipal projects and Otto Reyes projects.
Do not activate a paid pilot for these projects before verified binding.

A platform administrator verifies the actual owner and organization membership,
records stable tenant and project UUIDs, and chooses project-level or tenant-wide
scope. Jose's email locates his identity for verification; it never acts as a
runtime exemption rule. Bayamón and Otto display names are not identity evidence.
An unrelated client organization stays chargeable when Jose or Otto helps it.

Use the scoped financial administrative identity to issue a
`deploy_exemption_grants` record containing tenant_id, optional project_id,
beneficiary (`jose`, `bayamon`, `otto`), starts_at, issued_by and a reviewable reason.
Keep a separately approved binding record outside source control when it contains
private identity information. Issue before the first pilot operation; use the
current database timestamp, not a retroactive interval. Review both tenant and
project UUIDs, then verify `loadHostingPolicy()` against the exact project and
against an unrelated fixture. Record the returned grant ID in the administrative
audit. Never distribute customer secrets or production database URLs in commands,
logs or this document.

An exemption disables payment requirements, usage charges and billing-budget
suspension. It does not disable technical capacity, authorization or security
controls. Usage still records resource quantities and the accepted retail rate;
final actual provider cost attribution arrives with the later reconciliation
release. Exempt operations need no funded billing account.

Revocation is a separate append-only `deploy_exemption_revocations` record.
Use now() in the issuing SQL statement; the database rejects backdating and normalizes effective time to at least its issuing statement timestamp. Require ends_at >= starts_at, preserve the
original grant and give a reason/issuer. Do not backdate or rewrite either record.
Historical ledger entries keep their original grant ID and zero charge. Operations
reserved while exempt settle without a charge. A later chargeable operation needs
a separately accepted paid plan and funds; revocation does not collect money.

Before a paid launch, restrict the application runtime database identity:
no grant/revocation issuance, no rate creation, no migration privileges, and no
updates/deletes on usage, credits, grants, revocations or rate snapshots.
A narrowly scoped billing worker performs audited credits and budget transitions.
The isolated test harness uses its own temporary schemas and synthetic tenants.

Deployment prerequisites for the next release: explicitly authorized additive
production migration, verified stable exemption bindings, accepted rate snapshots,
isolated runtime project/identities, scoped GitHub App and preview domain.
No schema push from the satellite against shared tables.
