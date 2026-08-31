ALTER TABLE monitor_target
  ADD COLUMN operator_identity text,
  ADD COLUMN rule_version text;

ALTER TABLE scheduler_job
  ADD COLUMN active boolean NOT NULL DEFAULT true;

DROP INDEX scheduler_job_due_idx;
CREATE INDEX scheduler_job_due_idx
  ON scheduler_job (due_at, job_id)
  WHERE active = true AND lease_expires_at IS NULL;

CREATE OR REPLACE FUNCTION enforce_monitor_activation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.activation_status = 'approved' AND
     (TG_OP = 'INSERT' OR OLD.activation_status IS DISTINCT FROM 'approved') THEN
    IF NEW.operator_identity IS NULL OR btrim(NEW.operator_identity) = '' THEN
      RAISE EXCEPTION 'monitor activation requires an operator identity';
    END IF;
    IF NEW.rule_version IS NULL OR btrim(NEW.rule_version) = '' THEN
      RAISE EXCEPTION 'monitor activation requires a rule version';
    END IF;
    IF NEW.public_visibility NOT IN ('public', 'private') THEN
      RAISE EXCEPTION 'monitor activation requires a final visibility decision';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM source_approval AS approval
      WHERE approval.source_id = NEW.source_id
        AND approval.decision IN ('approved', 'restricted')
        AND approval.decided_at <= clock_timestamp()
        AND approval.expires_at > clock_timestamp()
        AND 'P14' = ANY(approval.projects)
        AND 'quality-monitoring' = ANY(approval.purposes)
    ) THEN
      RAISE EXCEPTION 'monitor activation requires an effective P14 source approval';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM monitor_baseline AS baseline
      WHERE baseline.monitor_id = NEW.monitor_id AND baseline.retired_at IS NULL
    ) THEN
      RAISE EXCEPTION 'monitor activation requires an active baseline';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER monitor_activation_guard
BEFORE INSERT OR UPDATE OF activation_status ON monitor_target
FOR EACH ROW EXECUTE FUNCTION enforce_monitor_activation();

CREATE OR REPLACE FUNCTION enforce_connector_activation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  configured_source text;
  configured_project text;
  configured_purpose text;
BEGIN
  IF NEW.enabled = true AND (TG_OP = 'INSERT' OR OLD.enabled IS DISTINCT FROM true) THEN
    configured_source := NEW.configuration_schema ->> 'source_id';
    configured_project := NEW.configuration_schema ->> 'project';
    configured_purpose := NEW.configuration_schema ->> 'purpose';
    IF configured_source IS NULL OR configured_project IS NULL OR configured_purpose IS NULL THEN
      RAISE EXCEPTION 'connector activation requires source, project and purpose configuration';
    END IF;
    IF NOT configured_source = ANY(NEW.supported_source_ids) THEN
      RAISE EXCEPTION 'connector configured source is outside supported sources';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM source_approval AS approval
      WHERE approval.source_id = configured_source
        AND approval.decision IN ('approved', 'restricted')
        AND approval.decided_at <= clock_timestamp()
        AND approval.expires_at > clock_timestamp()
        AND configured_project = ANY(approval.projects)
        AND configured_purpose = ANY(approval.purposes)
    ) THEN
      RAISE EXCEPTION 'connector activation requires an effective source approval';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER connector_activation_guard
BEFORE INSERT OR UPDATE OF enabled ON connector_definition
FOR EACH ROW EXECUTE FUNCTION enforce_connector_activation();

CREATE OR REPLACE FUNCTION apply_source_kill_switch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.approval_status IN ('rejected', 'revoked', 'expired') THEN
    UPDATE scheduler_job
    SET active = false, lease_owner = NULL, lease_expires_at = NULL,
        last_error_code = 'APPROVAL_NOT_EFFECTIVE', updated_at = clock_timestamp()
    WHERE (
      job_type = 'connector' AND target_id IN (
        SELECT connector_id FROM connector_definition
        WHERE NEW.source_id = ANY(supported_source_ids)
      )
    ) OR (
      job_type = 'monitor' AND target_id IN (
        SELECT monitor_id FROM monitor_target WHERE source_id = NEW.source_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER source_kill_switch
AFTER UPDATE OF approval_status ON source_definition
FOR EACH ROW EXECUTE FUNCTION apply_source_kill_switch();
