BEGIN;
-- No shared schema is created or modified. Run with a scoped DDL identity only.
SELECT pg_advisory_xact_lock(hashtext(current_schema() || ':deploy-foundation'));
CREATE TABLE IF NOT EXISTS deploy_schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS deploy_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120), region text NOT NULL DEFAULT 'us-west1', runtime_class text NOT NULL DEFAULT 'static', created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS deploy_billing_accounts (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(id), available_micro_usd bigint NOT NULL DEFAULT 0 CHECK(available_micro_usd>=0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS deploy_exemption_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), project_id uuid,
 beneficiary text NOT NULL CHECK(beneficiary IN ('jose','bayamon','otto')), starts_at timestamptz NOT NULL,
 issued_by text NOT NULL CHECK(length(issued_by)>0), reason text NOT NULL CHECK(length(reason)>0),
 issued_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,project_id) REFERENCES deploy_projects(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS deploy_exemption_revocations (
 grant_id uuid PRIMARY KEY, tenant_id uuid NOT NULL, ends_at timestamptz NOT NULL,
 issued_by text NOT NULL CHECK(length(issued_by)>0), reason text NOT NULL CHECK(length(reason)>0),
 issued_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,grant_id) REFERENCES deploy_exemption_grants(tenant_id,id)
);
CREATE OR REPLACE FUNCTION deploy_deny_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Deployment financial records are append-only'; END;
$$;
CREATE OR REPLACE FUNCTION deploy_validate_revocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.ends_at < (SELECT starts_at FROM deploy_exemption_grants WHERE id=NEW.grant_id AND tenant_id=NEW.tenant_id) THEN
   RAISE EXCEPTION 'Revocation precedes grant';
 END IF;
 IF NEW.ends_at < transaction_timestamp() THEN
   RAISE EXCEPTION 'Revocation must be prospective';
 END IF;
 -- Long-lived transactions cannot move effective time behind the issuing statement.
 NEW.issued_at := statement_timestamp();
 NEW.ends_at := greatest(NEW.ends_at, NEW.issued_at);
 -- Node timestamps have millisecond precision. Round up, never expire a grant early.
 NEW.ends_at := date_trunc('milliseconds', NEW.ends_at) +
   CASE WHEN NEW.ends_at > date_trunc('milliseconds', NEW.ends_at)
     THEN interval '1 millisecond' ELSE interval '0' END;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS deploy_revocation_interval ON deploy_exemption_revocations;
CREATE TRIGGER deploy_revocation_interval BEFORE INSERT ON deploy_exemption_revocations FOR EACH ROW EXECUTE FUNCTION deploy_validate_revocation();
DROP TRIGGER IF EXISTS deploy_grant_immutable ON deploy_exemption_grants;
CREATE TRIGGER deploy_grant_immutable BEFORE UPDATE OR DELETE ON deploy_exemption_grants FOR EACH ROW EXECUTE FUNCTION deploy_deny_change();
DROP TRIGGER IF EXISTS deploy_revocation_immutable ON deploy_exemption_revocations;
CREATE TRIGGER deploy_revocation_immutable BEFORE UPDATE OR DELETE ON deploy_exemption_revocations FOR EACH ROW EXECUTE FUNCTION deploy_deny_change();
CREATE TABLE IF NOT EXISTS deploy_rate_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), region text NOT NULL CHECK(length(region)>0), runtime_class text NOT NULL CHECK(length(runtime_class)>0),
 unit text NOT NULL CHECK(unit IN ('vcpu_ms','gib_ms','request','egress_byte','build_ms','artifact_byte_ms','log_byte')),
 numerator bigint NOT NULL CHECK(numerator>=0), denominator bigint NOT NULL CHECK(denominator>0),
 effective_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS deploy_rate_immutable ON deploy_rate_versions;
CREATE TRIGGER deploy_rate_immutable BEFORE UPDATE OR DELETE ON deploy_rate_versions FOR EACH ROW EXECUTE FUNCTION deploy_deny_change();
CREATE TABLE IF NOT EXISTS deploy_usage_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 provider text NOT NULL, source text NOT NULL, source_id text NOT NULL, payload_hash text NOT NULL,
 occurred_at timestamptz NOT NULL, quantity bigint NOT NULL CHECK(quantity>=0), unit text NOT NULL,
 rate_version_id uuid NOT NULL REFERENCES deploy_rate_versions(id), exemption_grant_id uuid,
 price_numerator numeric(78,0) NOT NULL CHECK(price_numerator>=0), price_denominator numeric(78,0) NOT NULL CHECK(price_denominator>0),
 recorded_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,source,source_id), UNIQUE(tenant_id,project_id,id),
 FOREIGN KEY(tenant_id,project_id) REFERENCES deploy_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,exemption_grant_id) REFERENCES deploy_exemption_grants(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS deploy_usage_subject_time ON deploy_usage_entries(tenant_id,project_id,occurred_at);
CREATE TABLE IF NOT EXISTS deploy_billing_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, usage_entry_id uuid NOT NULL,
 source_id text NOT NULL, amount_micro_usd bigint NOT NULL CHECK(amount_micro_usd<=0), payload_hash text NOT NULL,
 issued_by text NOT NULL CHECK(length(issued_by)>0), reason text NOT NULL CHECK(length(reason)>0), occurred_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,project_id,source_id),
 FOREIGN KEY(tenant_id,project_id,usage_entry_id) REFERENCES deploy_usage_entries(tenant_id,project_id,id)
);
CREATE TABLE IF NOT EXISTS deploy_budget_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, operation_id text NOT NULL,
 amount_micro_usd bigint NOT NULL CHECK(amount_micro_usd>=0), exemption_grant_id uuid,
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','settled','cancelled')),
 actual_micro_usd bigint, charged_micro_usd bigint, created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 UNIQUE(tenant_id,project_id,operation_id), UNIQUE(tenant_id,project_id,id), FOREIGN KEY(tenant_id,project_id) REFERENCES deploy_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,exemption_grant_id) REFERENCES deploy_exemption_grants(tenant_id,id),
 CHECK(actual_micro_usd IS NULL OR (actual_micro_usd>=0 AND (actual_micro_usd<=amount_micro_usd OR exemption_grant_id IS NOT NULL))),
 CHECK(charged_micro_usd IS NULL OR (charged_micro_usd>=0 AND charged_micro_usd<=amount_micro_usd)),
 CHECK(state='reserved' OR (actual_micro_usd IS NOT NULL AND charged_micro_usd IS NOT NULL AND finished_at IS NOT NULL))
);
DROP TRIGGER IF EXISTS deploy_usage_immutable ON deploy_usage_entries;
CREATE TRIGGER deploy_usage_immutable BEFORE UPDATE OR DELETE ON deploy_usage_entries FOR EACH ROW EXECUTE FUNCTION deploy_deny_change();
DROP TRIGGER IF EXISTS deploy_adjustment_immutable ON deploy_billing_adjustments;
CREATE TRIGGER deploy_adjustment_immutable BEFORE UPDATE OR DELETE ON deploy_billing_adjustments FOR EACH ROW EXECUTE FUNCTION deploy_deny_change();
CREATE TABLE IF NOT EXISTS deploy_budget_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, reservation_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind='reservation_exceeded'), actual_micro_usd bigint NOT NULL CHECK(actual_micro_usd>=0),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,project_id,reservation_id,kind),
 FOREIGN KEY(tenant_id,project_id,reservation_id) REFERENCES deploy_budget_reservations(tenant_id,project_id,id)
);
DROP TRIGGER IF EXISTS deploy_incident_immutable ON deploy_budget_incidents;
CREATE TRIGGER deploy_incident_immutable BEFORE UPDATE OR DELETE ON deploy_budget_incidents FOR EACH ROW EXECUTE FUNCTION deploy_deny_change();
INSERT INTO deploy_schema_migrations(version) VALUES('001-foundation') ON CONFLICT DO NOTHING;
COMMIT;
