variable "environment" {
  description = "Operator-selected environment label."
  type        = string
  validation {
    condition     = contains(["local", "development", "staging", "production"], var.environment)
    error_message = "environment must be local, development, staging, or production."
  }
}

variable "enable_runtime" {
  description = "Explicitly enable the self-hosted runtime contract."
  type        = bool
  default     = false
}

variable "enable_raw_evidence" {
  description = "Explicitly enable raw evidence storage for the fabric profile."
  type        = bool
  default     = false
}

variable "source_approval_inputs" {
  description = "Operator-maintained source approval references required for raw evidence."
  type        = list(string)
  default     = []
}

variable "network" {
  description = "Network placement supplied by the self-hosting operator."
  type = object({
    network_id         = string
    private_subnet_ids = list(string)
    ingress_gateway_id = string
    egress_policy_id   = string
  })
}

variable "database" {
  description = "PostgreSQL connection metadata; credentials stay outside Terraform state."
  type = object({
    endpoint         = string
    port             = number
    database_name    = string
    secret_reference = string
    tls_required     = bool
    backup_policy_id = string
  })
  sensitive = true
}

variable "object_store" {
  description = "S3-compatible immutable raw-evidence store."
  type = object({
    endpoint             = string
    bucket               = string
    region               = string
    credential_reference = string
    versioning_enabled   = bool
    object_lock_enabled  = bool
    retention_policy_id  = string
  })
  sensitive = true
}

variable "identity" {
  description = "Optional OIDC metadata and administrative assurance."
  type = object({
    issuer                 = string
    audience               = string
    jwks_url               = string
    phishing_resistant_mfa = bool
    admin_group_claim      = string
  })
}

variable "domains" {
  description = "Operator-controlled origins. Public deployments must terminate TLS."
  type = object({
    api    = string
    admin  = string
    portal = string
    mcp    = string
  })
}

variable "telemetry" {
  description = "OpenTelemetry destination and evidence retention."
  type = object({
    otlp_endpoint  = string
    retention_days = number
    alert_route_id = string
  })
}
