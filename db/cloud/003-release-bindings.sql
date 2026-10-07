BEGIN;
SELECT pg_advisory_xact_lock(hashtext(current_schema()||':cloud-migrate'));
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='cloud_jobs'::regclass AND conname='cloud_job_release_identity') THEN
  ALTER TABLE cloud_jobs ADD CONSTRAINT cloud_job_release_identity UNIQUE(tenant_id,id,resource_id,generation);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='cloud_releases'::regclass AND conname='cloud_release_job_binding') THEN
  ALTER TABLE cloud_releases ADD CONSTRAINT cloud_release_job_binding FOREIGN KEY(tenant_id,job_id,resource_id,generation) REFERENCES cloud_jobs(tenant_id,id,resource_id,generation);
 END IF;
END $$;
INSERT INTO cloud_schema_migrations(version) VALUES('003-release-bindings') ON CONFLICT DO NOTHING;
COMMIT;
