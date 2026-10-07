BEGIN;
SELECT pg_advisory_xact_lock(hashtext(current_schema() || ':deploy-owner-only'));
CREATE TABLE IF NOT EXISTS deploy_free_deployment_owner (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 user_id text NOT NULL UNIQUE REFERENCES "user"(id),
 bound_by text NOT NULL CHECK(length(bound_by)>0), reason text NOT NULL CHECK(length(reason)>0),
 bound_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
DROP TRIGGER IF EXISTS deploy_free_owner_immutable ON deploy_free_deployment_owner;
CREATE TRIGGER deploy_free_owner_immutable BEFORE UPDATE OR DELETE ON deploy_free_deployment_owner FOR EACH ROW EXECUTE FUNCTION deploy_deny_change();
CREATE OR REPLACE FUNCTION deploy_owner_only_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.beneficiary <> 'jose' THEN RAISE EXCEPTION 'Only the verified owner may receive free deployment grants'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS deploy_owner_only_grant_insert ON deploy_exemption_grants;
CREATE TRIGGER deploy_owner_only_grant_insert BEFORE INSERT ON deploy_exemption_grants FOR EACH ROW EXECUTE FUNCTION deploy_owner_only_grant();
-- Refuse to silently preserve a scheduled non-owner exemption. Existing
-- append-only revocations must be resolved explicitly before rollout.
DO $$ BEGIN
 IF EXISTS (
  SELECT 1 FROM deploy_exemption_grants g
  JOIN deploy_exemption_revocations r ON r.grant_id=g.id
  WHERE g.beneficiary <> 'jose' AND r.ends_at > statement_timestamp()
 ) THEN RAISE EXCEPTION 'Scheduled non-owner revocation requires explicit policy cutoff before migration'; END IF;
END $$;
-- Preserve issued grants/history. Revoke prospectively; never back-charge old usage.
INSERT INTO deploy_exemption_revocations(grant_id,tenant_id,ends_at,issued_by,reason)
 SELECT id,tenant_id,greatest(statement_timestamp(),starts_at),'migration:owner-only-free-deploy',
 'Owner changed policy: free app deployments exclusive to Jose on 2026-10-07'
 FROM deploy_exemption_grants WHERE beneficiary <> 'jose'
 ON CONFLICT(grant_id) DO NOTHING;
INSERT INTO deploy_schema_migrations(version) VALUES('003-owner-only-free-deploy') ON CONFLICT DO NOTHING;
COMMIT;
