CREATE TABLE source_group (
  source_group_id text PRIMARY KEY,
  name text NOT NULL,
  provider text NOT NULL,
  source_ids text[] NOT NULL,
  operator_hint text NOT NULL,
  status text NOT NULL CHECK (status IN ('specified_pending_approval', 'approved', 'retired')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE source_definition (
  source_id text PRIMARY KEY,
  catalogue_id text,
  catalogue_verified_at date,
  terms_evidence_state text,
  source_group_id text REFERENCES source_group(source_group_id),
  projects text[] NOT NULL,
  name text NOT NULL,
  provider text NOT NULL,
  authority_class text NOT NULL,
  approval_status text NOT NULL CHECK (approval_status IN ('specified_pending_approval', 'approved', 'restricted', 'rejected', 'revoked', 'expired')),
  visibility text NOT NULL CHECK (visibility IN ('public', 'private')),
  freshness_status text NOT NULL CHECK (freshness_status IN ('fresh', 'stale', 'unknown', 'not_applicable')),
  last_success_at timestamptz,
  documentation_url text,
  cadence text NOT NULL,
  approved_uses text[] NOT NULL DEFAULT '{}',
  limitations text[] NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE source_approval (
  approval_id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES source_definition(source_id),
  decision text NOT NULL CHECK (decision IN ('approved', 'restricted', 'rejected', 'revoked')),
  projects text[] NOT NULL,
  purposes text[] NOT NULL,
  storage_policy text NOT NULL,
  retention_policy text NOT NULL,
  redistribution_policy text NOT NULL,
  attribution_policy text NOT NULL,
  evidence_urls text[] NOT NULL,
  reason text NOT NULL,
  actor text NOT NULL,
  decided_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  source_version integer NOT NULL
);

CREATE TABLE connector_definition (
  connector_id text PRIMARY KEY,
  source_group_id text NOT NULL REFERENCES source_group(source_group_id),
  code_version text NOT NULL,
  supported_source_ids text[] NOT NULL,
  configuration_schema jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1
);

CREATE TABLE raw_object (
  raw_object_id text PRIMARY KEY,
  object_uri text NOT NULL UNIQUE,
  sha256 text NOT NULL UNIQUE CHECK (length(sha256) = 64),
  media_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  encryption_state text NOT NULL,
  retention_class text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE connector_run (
  connector_run_id text PRIMARY KEY,
  connector_id text NOT NULL REFERENCES connector_definition(connector_id),
  source_id text NOT NULL REFERENCES source_definition(source_id),
  code_version text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  request_fingerprint text NOT NULL,
  response_metadata jsonb NOT NULL,
  raw_object_ids text[] NOT NULL DEFAULT '{}',
  error_code text,
  created_at timestamptz NOT NULL
);

CREATE TABLE source_record (
  source_record_id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES source_definition(source_id),
  connector_run_id text NOT NULL REFERENCES connector_run(connector_run_id),
  raw_object_id text NOT NULL REFERENCES raw_object(raw_object_id),
  approval_reference text NOT NULL,
  schema_version text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL,
  published_at timestamptz,
  language text,
  freshness_status text NOT NULL,
  quality_flags text[] NOT NULL DEFAULT '{}',
  record_data jsonb NOT NULL,
  record_hash text NOT NULL CHECK (length(record_hash) = 64),
  parent_source_record_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL
);

CREATE TABLE transform_definition (
  transform_id text PRIMARY KEY,
  code_version text NOT NULL,
  input_contract_hash text NOT NULL,
  output_contract_hash text NOT NULL,
  mapping jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE canonical_entity (
  canonical_entity_id text PRIMARY KEY,
  entity_type text NOT NULL,
  entity_version integer NOT NULL,
  values_json jsonb NOT NULL,
  field_lineage jsonb NOT NULL,
  conflict_state text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (canonical_entity_id, entity_version)
);

CREATE TABLE canonical_event (
  canonical_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  event_version integer NOT NULL,
  status text NOT NULL,
  severity text,
  observed_at timestamptz NOT NULL,
  effective_at timestamptz,
  expires_at timestamptz,
  event_data jsonb NOT NULL,
  geometry_json jsonb,
  evidence_source_record_ids text[] NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE monitor_target (
  monitor_id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES source_definition(source_id),
  source_group_id text NOT NULL,
  provider text NOT NULL,
  name text NOT NULL,
  method text NOT NULL CHECK (method IN ('GET', 'POST')),
  request_template text NOT NULL,
  request_body_json jsonb,
  cadence_seconds integer NOT NULL CHECK (cadence_seconds > 0),
  timeout_ms integer NOT NULL CHECK (timeout_ms > 0),
  freshness_rule text NOT NULL,
  required_checks text[] NOT NULL,
  public_visibility text NOT NULL,
  activation_status text NOT NULL,
  documentation_url text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE monitor_baseline (
  baseline_id text PRIMARY KEY,
  monitor_id text NOT NULL REFERENCES monitor_target(monitor_id),
  baseline_version integer NOT NULL,
  schema_fingerprint text,
  content_rules jsonb NOT NULL,
  freshness_rule text NOT NULL,
  evidence_observation_ids text[] NOT NULL,
  operator_identity text NOT NULL,
  activated_at timestamptz NOT NULL,
  retired_at timestamptz,
  UNIQUE (monitor_id, baseline_version)
);

CREATE TABLE monitor_observation (
  observation_id text PRIMARY KEY,
  monitor_id text NOT NULL REFERENCES monitor_target(monitor_id),
  connector_run_id text REFERENCES connector_run(connector_run_id),
  baseline_id text REFERENCES monitor_baseline(baseline_id),
  outcome text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL,
  latency_ms integer NOT NULL,
  http_status integer,
  schema_fingerprint text,
  provider_timestamp timestamptz,
  evidence_json jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE incident (
  incident_id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES source_definition(source_id),
  status text NOT NULL,
  severity text NOT NULL,
  category text NOT NULL,
  monitor_ids text[] NOT NULL,
  observation_ids text[] NOT NULL,
  opened_at timestamptz NOT NULL,
  last_observed_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  acknowledged_by text,
  suppression_expires_at timestamptz,
  resolved_at timestamptz,
  resolved_by text,
  suppression_reason text,
  internal_summary text,
  public_state text NOT NULL,
  public_summary jsonb,
  cause text,
  correction_reference text,
  audit_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE subscription (
  subscription_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  callback_url text NOT NULL,
  event_types text[] NOT NULL,
  secret_reference text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1
);

CREATE TABLE delivery_attempt (
  delivery_attempt_id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES subscription(subscription_id),
  tenant_id text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  attempt_number integer NOT NULL,
  status text NOT NULL,
  response_status integer,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  UNIQUE (subscription_id, event_id, attempt_number)
);

CREATE TABLE audit_entry (
  audit_id text PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  before_hash text NOT NULL CHECK (length(before_hash) = 64),
  after_hash text NOT NULL CHECK (length(after_hash) = 64),
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL
);

CREATE INDEX source_definition_visibility_idx ON source_definition (visibility, approval_status, source_id);
CREATE INDEX source_record_source_observed_idx ON source_record (source_id, observed_at DESC);
CREATE INDEX canonical_event_observed_idx ON canonical_event (event_type, observed_at DESC);
CREATE INDEX monitor_observation_target_time_idx ON monitor_observation (monitor_id, started_at DESC);
CREATE INDEX incident_status_time_idx ON incident (status, opened_at DESC);
CREATE INDEX audit_target_time_idx ON audit_entry (target_id, occurred_at DESC);
