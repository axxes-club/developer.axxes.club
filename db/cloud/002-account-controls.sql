BEGIN;
SELECT pg_advisory_xact_lock(hashtext(current_schema()||':cloud-migrate'));
CREATE TABLE IF NOT EXISTS cloud_api_keys(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),actor_id text NOT NULL REFERENCES "user"(id),
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 scopes text[] NOT NULL CHECK(cardinality(scopes) BETWEEN 1 AND 2 AND scopes <@ ARRAY['read','operate']::text[]),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),expires_at timestamptz NOT NULL,revoked_at timestamptz,
 window_started_at timestamptz NOT NULL DEFAULT statement_timestamp(),window_requests integer NOT NULL DEFAULT 0 CHECK(window_requests BETWEEN 0 AND 120),
 UNIQUE(tenant_id,id),CHECK(expires_at>created_at AND expires_at<=created_at+interval '90 days')
);
CREATE TABLE IF NOT EXISTS cloud_releases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,resource_id uuid NOT NULL,job_id uuid NOT NULL,
 generation bigint NOT NULL CHECK(generation>0),revision text NOT NULL,image text NOT NULL,previous_revision text,created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(tenant_id,resource_id,revision),FOREIGN KEY(tenant_id,resource_id) REFERENCES cloud_resources(tenant_id,id),FOREIGN KEY(tenant_id,job_id) REFERENCES cloud_jobs(tenant_id,id)
);
DROP TRIGGER IF EXISTS cloud_releases_immutable ON cloud_releases;
CREATE TRIGGER cloud_releases_immutable BEFORE UPDATE OR DELETE ON cloud_releases FOR EACH ROW EXECUTE FUNCTION cloud_deny_change();
INSERT INTO cloud_schema_migrations(version) VALUES('002-account-controls') ON CONFLICT DO NOTHING;
COMMIT;
