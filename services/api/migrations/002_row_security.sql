ALTER TABLE subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_attempt ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_tenant_isolation ON subscription
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY delivery_attempt_tenant_isolation ON delivery_attempt
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
