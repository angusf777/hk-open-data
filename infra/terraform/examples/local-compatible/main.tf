module "platform_contract" {
  source              = "../../modules/platform"
  environment         = "local"
  enable_runtime      = false
  enable_raw_evidence = false
  network = {
    network_id         = "local"
    private_subnet_ids = ["data-a", "data-b"]
    ingress_gateway_id = "local-gateway"
    egress_policy_id   = "approved-hosts-only"
  }
  database = {
    endpoint         = "postgres"
    port             = 5432
    database_name    = "hk_public_data"
    secret_reference = "env:DATABASE_URL"
    tls_required     = true
    backup_policy_id = "local-drill"
  }
  object_store = {
    endpoint             = "object-store.internal"
    bucket               = "raw-snapshots"
    region               = "local"
    credential_reference = "env:OBJECT_STORE_SECRET_KEY"
    versioning_enabled   = true
    object_lock_enabled  = true
    retention_policy_id  = "beta-evidence"
  }
  identity = {
    issuer                 = "https://identity.example.invalid/"
    audience               = "https://api.example.invalid"
    jwks_url               = "https://identity.example.invalid/.well-known/jwks.json"
    phishing_resistant_mfa = true
    admin_group_claim      = "groups"
  }
  domains = {
    api    = "api.example.invalid"
    admin  = "admin.example.invalid"
    portal = "status.example.invalid"
    mcp    = "mcp.example.invalid"
  }
  telemetry = {
    otlp_endpoint  = "http://otel-collector:4318"
    retention_days = 60
    alert_route_id = "local"
  }
}
