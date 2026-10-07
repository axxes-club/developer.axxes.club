BEGIN;
SELECT pg_advisory_xact_lock(hashtext(current_schema()||':cloud-migrate'));
ALTER TABLE cloud_api_keys ADD COLUMN IF NOT EXISTS window_started_at timestamptz NOT NULL DEFAULT statement_timestamp();
ALTER TABLE cloud_api_keys ADD COLUMN IF NOT EXISTS window_requests integer NOT NULL DEFAULT 0;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=current_schema() AND t.relname='cloud_api_keys' AND c.conname='cloud_api_keys_bounds') THEN
 ALTER TABLE cloud_api_keys ADD CONSTRAINT cloud_api_keys_bounds CHECK(secret_hash ~ '^[a-f0-9]{64}$' AND length(name) BETWEEN 1 AND 80 AND cardinality(scopes) BETWEEN 1 AND 2 AND scopes <@ ARRAY['read','operate']::text[] AND expires_at>created_at AND expires_at<=created_at+interval '90 days' AND window_requests BETWEEN 0 AND 120);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS cloud_releases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,resource_id uuid NOT NULL,job_id uuid NOT NULL,
 generation bigint NOT NULL CHECK(generation>0),revision text NOT NULL,image text NOT NULL,previous_revision text,created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(tenant_id,resource_id,revision),FOREIGN KEY(tenant_id,resource_id) REFERENCES cloud_resources(tenant_id,id),FOREIGN KEY(tenant_id,job_id) REFERENCES cloud_jobs(tenant_id,id)
);
DROP TRIGGER IF EXISTS cloud_releases_immutable ON cloud_releases;
CREATE TRIGGER cloud_releases_immutable BEFORE UPDATE OR DELETE ON cloud_releases FOR EACH ROW EXECUTE FUNCTION cloud_deny_change();
INSERT INTO cloud_schema_migrations(version) VALUES('002-account-controls') ON CONFLICT DO NOTHING;
COMMIT;
