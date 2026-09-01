terraform {
  required_version = ">= 1.8.0"
}

resource "terraform_data" "deployment_contract" {
  input = {
    enable_runtime      = var.enable_runtime
    enable_raw_evidence = var.enable_raw_evidence
    source_approvals    = var.source_approval_inputs
    environment         = var.environment
    network             = var.network
    database            = var.database
    object_store        = var.object_store
    identity            = var.identity
    domains             = var.domains
    telemetry           = var.telemetry
  }

  lifecycle {
    precondition {
      condition = !var.enable_raw_evidence || (
        var.enable_runtime &&
        length(var.source_approval_inputs) > 0 &&
        var.object_store.versioning_enabled &&
        var.object_store.object_lock_enabled
      )
      error_message = "Full-response storage requires versioning and object lock."
    }
    precondition {
      condition     = !var.enable_runtime || var.database.tls_required
      error_message = "An enabled runtime database connection must require TLS."
    }
  }
}
