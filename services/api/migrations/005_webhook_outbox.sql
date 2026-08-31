ALTER TABLE subscription
  ADD COLUMN source_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN idempotency_key text,
  ADD COLUMN challenge text;

CREATE UNIQUE INDEX subscription_tenant_idempotency_idx
  ON subscription (tenant_id, idempotency_key);

ALTER TABLE delivery_attempt
  ADD COLUMN raw_body bytea,
  ADD COLUMN occurred_at timestamptz,
  ADD COLUMN api_version text,
  ADD COLUMN first_attempt_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX delivery_attempt_due_idx
  ON delivery_attempt (status, next_attempt_at, created_at);

CREATE OR REPLACE FUNCTION enqueue_webhook_event(
  webhook_event_type text,
  webhook_source_id text,
  webhook_occurred_at timestamptz,
  webhook_payload jsonb
) RETURNS void AS $$
DECLARE
  webhook_event_id text := 'EV-' || gen_random_uuid()::text;
  webhook_body bytea;
BEGIN
  webhook_payload := webhook_payload || jsonb_build_object(
    'event_id', webhook_event_id,
    'event_type', webhook_event_type,
    'occurred_at', webhook_occurred_at,
    'api_version', 'v1',
    'source_id', webhook_source_id
  );
  webhook_body := convert_to(webhook_payload::text, 'UTF8');
  INSERT INTO delivery_attempt (
    delivery_attempt_id, subscription_id, tenant_id, event_id, event_type, payload_hash,
    raw_body, occurred_at, api_version, attempt_number, status, next_attempt_at,
    first_attempt_at, created_at, updated_at
  )
  SELECT
    'DEL-' || substr(encode(digest(s.subscription_id || ':' || webhook_event_id, 'sha256'), 'hex'), 1, 24),
    s.subscription_id,
    s.tenant_id,
    webhook_event_id,
    webhook_event_type,
    encode(digest(webhook_body, 'sha256'), 'hex'),
    webhook_body,
    webhook_occurred_at,
    'v1',
    1,
    'pending',
    webhook_occurred_at,
    webhook_occurred_at,
    webhook_occurred_at,
    webhook_occurred_at
  FROM subscription s
  WHERE s.status = 'active'
    AND webhook_event_type = ANY(s.event_types)
    AND (cardinality(s.source_ids) = 0 OR webhook_source_id = ANY(s.source_ids));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION source_approval_webhook() RETURNS trigger AS $$
BEGIN
  PERFORM enqueue_webhook_event(
    'source.changed',
    NEW.source_id,
    NEW.decided_at,
    jsonb_build_object('approval_id', NEW.approval_id, 'decision', NEW.decision,
                       'source_version', NEW.source_version)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER source_approval_webhook_outbox
AFTER INSERT ON source_approval
FOR EACH ROW EXECUTE FUNCTION source_approval_webhook();

CREATE OR REPLACE FUNCTION incident_webhook() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.public_state IS DISTINCT FROM OLD.public_state THEN
    PERFORM enqueue_webhook_event(
      'incident.updated',
      NEW.source_id,
      NEW.updated_at,
      jsonb_build_object('incident_id', NEW.incident_id, 'status', NEW.status,
                         'public_state', NEW.public_state, 'version', NEW.audit_version)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER incident_webhook_outbox
AFTER UPDATE OF status, public_state ON incident
FOR EACH ROW EXECUTE FUNCTION incident_webhook();
