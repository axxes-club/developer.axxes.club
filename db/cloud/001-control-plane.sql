BEGIN;
SELECT pg_advisory_xact_lock(hashtext(current_schema()||':cloud-migrate'));
CREATE TABLE IF NOT EXISTS cloud_schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT statement_timestamp());
CREATE TABLE IF NOT EXISTS cloud_projects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 deploy_project_id uuid NOT NULL UNIQUE,created_by text NOT NULL REFERENCES "user"(id),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,deploy_project_id) REFERENCES deploy_projects(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS cloud_resources(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,project_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('app','server','database','bucket','cluster','network')),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),spec jsonb NOT NULL CHECK(jsonb_typeof(spec)='object'),generation bigint NOT NULL DEFAULT 1 CHECK(generation>0),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','building','staged','ready','failed','deleting','deleted','reconciling')),provider_binding jsonb,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,project_id,id),FOREIGN KEY(tenant_id,project_id) REFERENCES cloud_projects(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS cloud_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,resource_id uuid NOT NULL,generation bigint NOT NULL CHECK(generation>0),actor_id text NOT NULL REFERENCES "user"(id),
 operation text NOT NULL CHECK(operation IN('deploy','rollback','delete')),idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),desired jsonb NOT NULL,
 quote jsonb NOT NULL,reservation_id uuid,state text NOT NULL DEFAULT 'queued' CHECK(state IN('queued','running','succeeded','failed','cancel_requested','reconciling')),
 lease_token uuid,lease_until timestamptz,provider_request_id text,provider_result jsonb,error_code text,attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,idempotency_key),
 FOREIGN KEY(tenant_id,resource_id) REFERENCES cloud_resources(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS cloud_jobs_dispatch ON cloud_jobs(state,lease_until,created_at);
CREATE TABLE IF NOT EXISTS cloud_audit_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),actor_id text NOT NULL REFERENCES "user"(id),kind text NOT NULL,resource_id uuid,payload jsonb NOT NULL,recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),FOREIGN KEY(tenant_id,resource_id) REFERENCES cloud_resources(tenant_id,id));
CREATE TABLE IF NOT EXISTS cloud_sessions(token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),user_id text NOT NULL REFERENCES "user"(id),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT statement_timestamp());
CREATE TABLE IF NOT EXISTS cloud_oidc_transactions(state_hash text PRIMARY KEY,nonce text NOT NULL,verifier text NOT NULL,return_path text NOT NULL,expires_at timestamptz NOT NULL,used_at timestamptz);
CREATE TABLE IF NOT EXISTS cloud_github_connections(tenant_id uuid NOT NULL REFERENCES tenants(id),user_id text NOT NULL REFERENCES "user"(id),encrypted_credentials text NOT NULL,expires_at timestamptz NOT NULL,PRIMARY KEY(tenant_id,user_id));
CREATE TABLE IF NOT EXISTS cloud_domain_claims(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,resource_id uuid NOT NULL,domain text NOT NULL UNIQUE,challenge_hash text NOT NULL,state text NOT NULL CHECK(state IN('pending','verified','ready','failed')),expires_at timestamptz NOT NULL,FOREIGN KEY(tenant_id,resource_id) REFERENCES cloud_resources(tenant_id,id));
CREATE TABLE IF NOT EXISTS cloud_provider_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,resource_id uuid NOT NULL,provider text NOT NULL,source_id text NOT NULL,payload_hash text NOT NULL,recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),UNIQUE(provider,source_id),FOREIGN KEY(tenant_id,resource_id) REFERENCES cloud_resources(tenant_id,id));
CREATE TABLE IF NOT EXISTS cloud_api_keys(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),user_id text NOT NULL REFERENCES "user"(id),name text NOT NULL,secret_hash text NOT NULL UNIQUE,scopes text[] NOT NULL,expires_at timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT statement_timestamp());
CREATE OR REPLACE FUNCTION cloud_deny_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Cloud audit records are append-only'; END $$;
CREATE OR REPLACE FUNCTION cloud_immutable_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='cloud_projects' THEN
 IF ROW(NEW.id,NEW.tenant_id,NEW.deploy_project_id,NEW.created_by) IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.deploy_project_id,OLD.created_by) THEN RAISE EXCEPTION 'Cloud project identity is immutable'; END IF;
 END IF;
 IF TG_TABLE_NAME='cloud_resources' THEN
  IF ROW(NEW.id,NEW.tenant_id,NEW.project_id,NEW.kind) IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.project_id,OLD.kind) OR (OLD.provider_binding IS NOT NULL AND NEW.provider_binding IS DISTINCT FROM OLD.provider_binding) THEN RAISE EXCEPTION 'Cloud resource identity is immutable'; END IF;
  IF NEW.generation<OLD.generation OR NEW.generation>OLD.generation+1 OR (NEW.spec IS DISTINCT FROM OLD.spec AND NEW.generation<>OLD.generation+1) THEN RAISE EXCEPTION 'Invalid resource generation'; END IF;
 END IF;
 IF TG_TABLE_NAME='cloud_jobs' THEN
 IF ROW(NEW.id,NEW.tenant_id,NEW.resource_id,NEW.generation,NEW.actor_id,NEW.operation,NEW.idempotency_key,NEW.input_hash,NEW.desired,NEW.quote,NEW.reservation_id) IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.resource_id,OLD.generation,OLD.actor_id,OLD.operation,OLD.idempotency_key,OLD.input_hash,OLD.desired,OLD.quote,OLD.reservation_id) THEN RAISE EXCEPTION 'Cloud job admission is immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cloud_projects_identity ON cloud_projects;CREATE TRIGGER cloud_projects_identity BEFORE UPDATE ON cloud_projects FOR EACH ROW EXECUTE FUNCTION cloud_immutable_identity();
DROP TRIGGER IF EXISTS cloud_resources_identity ON cloud_resources;CREATE TRIGGER cloud_resources_identity BEFORE UPDATE ON cloud_resources FOR EACH ROW EXECUTE FUNCTION cloud_immutable_identity();
DROP TRIGGER IF EXISTS cloud_jobs_identity ON cloud_jobs;CREATE TRIGGER cloud_jobs_identity BEFORE UPDATE ON cloud_jobs FOR EACH ROW EXECUTE FUNCTION cloud_immutable_identity();
DROP TRIGGER IF EXISTS cloud_audit_immutable ON cloud_audit_events;CREATE TRIGGER cloud_audit_immutable BEFORE UPDATE OR DELETE ON cloud_audit_events FOR EACH ROW EXECUTE FUNCTION cloud_deny_change();
DROP TRIGGER IF EXISTS cloud_provider_events_immutable ON cloud_provider_events;CREATE TRIGGER cloud_provider_events_immutable BEFORE UPDATE OR DELETE ON cloud_provider_events FOR EACH ROW EXECUTE FUNCTION cloud_deny_change();
INSERT INTO cloud_schema_migrations(version) VALUES('001-control-plane') ON CONFLICT DO NOTHING;
COMMIT;
