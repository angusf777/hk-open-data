DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hk_platform') THEN
    GRANT USAGE ON SCHEMA public TO hk_platform;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hk_platform;
    GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO hk_platform;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO hk_platform;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hk_platform;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO hk_platform;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT EXECUTE ON FUNCTIONS TO hk_platform;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hk_webhook_worker') THEN
    GRANT USAGE ON SCHEMA public TO hk_webhook_worker;
    GRANT SELECT, INSERT, UPDATE, DELETE ON subscription, delivery_attempt
      TO hk_webhook_worker;
  END IF;
END;
$$;

ALTER FUNCTION enqueue_webhook_event(text, text, timestamptz, jsonb)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION enqueue_webhook_event(text, text, timestamptz, jsonb) FROM PUBLIC;
