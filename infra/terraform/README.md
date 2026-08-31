# Optional Terraform deployment contract

The `modules/platform` module records vendor-neutral inputs for operators who choose to deploy the
self-hosted runtime outside Docker Compose. It creates no cloud resources. Runtime and raw-evidence
features default to disabled; raw evidence additionally requires explicit source-approval
references, versioning and object lock.

This module is an integration example, not a hosted-service blueprint, security certification or
legal approval. The operator remains responsible for infrastructure, upstream terms, retention and
applicable law. `tests/contract/test_terraform_contract.py` provides a local structural gate.
