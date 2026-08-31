CREATE TABLE scheduler_job (
  job_id text PRIMARY KEY,
  job_type text NOT NULL CHECK (job_type IN ('connector', 'monitor')),
  target_id text NOT NULL,
  due_at timestamptz NOT NULL,
  cadence_seconds integer NOT NULL CHECK (cadence_seconds > 0),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX scheduler_job_due_idx
  ON scheduler_job (due_at, job_id)
  WHERE lease_expires_at IS NULL;
