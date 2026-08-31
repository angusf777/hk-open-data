output "runtime_contract" {
  description = "Validated non-secret deployment contract for provider-specific roots."
  value = {
    environment                       = var.environment
    network_id                        = var.network.network_id
    domains                           = var.domains
    oidc_issuer                       = var.identity.issuer
    oidc_audience                     = var.identity.audience
    oidc_jwks_url                     = var.identity.jwks_url
    otlp_endpoint                     = var.telemetry.otlp_endpoint
    database_secret_reference         = var.database.secret_reference
    object_store_credential_reference = var.object_store.credential_reference
  }
  sensitive = true
}
