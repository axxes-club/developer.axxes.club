BEGIN;
SELECT pg_advisory_xact_lock(hashtext(current_schema() || ':deploy-source-intake'));
CREATE TABLE IF NOT EXISTS deploy_source_bindings (
 tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 installation_id bigint NOT NULL CHECK(installation_id>0), repository_id bigint NOT NULL CHECK(repository_id>0),
 branch text NOT NULL CHECK(length(branch) BETWEEN 1 AND 1013),
 verified_by text NOT NULL CHECK(length(verified_by)>0), verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,project_id),
 FOREIGN KEY(tenant_id,project_id) REFERENCES deploy_projects(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS deploy_webhook_receipts (
 delivery_id uuid PRIMARY KEY, payload_hash text NOT NULL CHECK(length(payload_hash)=64), received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS deploy_build_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 delivery_id uuid NOT NULL REFERENCES deploy_webhook_receipts(delivery_id),
 installation_id bigint NOT NULL, repository_id bigint NOT NULL,
 commit_sha text NOT NULL CHECK(commit_sha ~ '^[0-9a-f]{40}$'),
 state text NOT NULL DEFAULT 'pending_admission' CHECK(state IN ('pending_admission','admitted','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(delivery_id,tenant_id,project_id),
 FOREIGN KEY(tenant_id,project_id) REFERENCES deploy_projects(tenant_id,id)
);
DROP TRIGGER IF EXISTS deploy_receipt_immutable ON deploy_webhook_receipts;
CREATE TRIGGER deploy_receipt_immutable BEFORE UPDATE OR DELETE ON deploy_webhook_receipts FOR EACH ROW EXECUTE FUNCTION deploy_deny_change();
CREATE OR REPLACE FUNCTION deploy_preserve_intent_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Deployment source identity is immutable'; END IF;
 IF ROW(NEW.id,NEW.tenant_id,NEW.project_id,NEW.delivery_id,NEW.installation_id,NEW.repository_id,NEW.commit_sha,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.project_id,OLD.delivery_id,OLD.installation_id,OLD.repository_id,OLD.commit_sha,OLD.created_at)
 THEN RAISE EXCEPTION 'Deployment source identity is immutable'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS deploy_intent_source_immutable ON deploy_build_intents;
CREATE TRIGGER deploy_intent_source_immutable BEFORE UPDATE OR DELETE ON deploy_build_intents FOR EACH ROW EXECUTE FUNCTION deploy_preserve_intent_source();
-- Intake alone cannot authorize spending or execute a build. Admission must reserve
-- budget and bind an immutable rate/technical cap before dispatching provider work.
INSERT INTO deploy_schema_migrations(version) VALUES('002-source-intake') ON CONFLICT DO NOTHING;
COMMIT;
