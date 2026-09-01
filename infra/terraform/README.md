# Optional Terraform deployment contract

The `modules/platform` module records vendor-neutral inputs for people who deploy the self-hosted
toolkit outside Docker Compose. It creates no cloud resources. Data connections and full-response
storage default to disabled; full-response storage also requires a review reference for every
enabled source, plus versioning and object lock.

This module is an integration example, not a hosted-service blueprint, security certification or
permission to use a source. You remain responsible for infrastructure, provider terms, retention,
and applicable law. `tests/contract/test_terraform_contract.py` provides a local structural check.
