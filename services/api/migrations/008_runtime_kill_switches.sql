CREATE OR REPLACE FUNCTION apply_connector_kill_switch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.enabled = false THEN
    UPDATE scheduler_job
    SET active = false, lease_owner = NULL, lease_expires_at = NULL,
        last_error_code = 'CONNECTOR_NOT_ACTIVE', updated_at = clock_timestamp()
    WHERE job_type = 'connector' AND target_id = NEW.connector_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER connector_kill_switch
AFTER UPDATE OF enabled ON connector_definition
FOR EACH ROW EXECUTE FUNCTION apply_connector_kill_switch();

CREATE OR REPLACE FUNCTION apply_monitor_kill_switch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.activation_status <> 'approved' THEN
    UPDATE scheduler_job
    SET active = false, lease_owner = NULL, lease_expires_at = NULL,
        last_error_code = 'MONITOR_NOT_ACTIVE', updated_at = clock_timestamp()
    WHERE job_type = 'monitor' AND target_id = NEW.monitor_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER monitor_kill_switch
AFTER UPDATE OF activation_status ON monitor_target
FOR EACH ROW EXECUTE FUNCTION apply_monitor_kill_switch();
