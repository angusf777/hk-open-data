from pathlib import Path

ROOT = Path(__file__).parents[2]
MODULE = ROOT / "infra/terraform/modules/platform"


def test_vendor_neutral_module_covers_every_deployment_dependency() -> None:
    main = (MODULE / "main.tf").read_text(encoding="utf-8")
    variables = (MODULE / "variables.tf").read_text(encoding="utf-8")
    assert 'required_version = ">= 1.8.0"' in main
    assert 'resource "terraform_data" "deployment_contract"' in main
    assert "!var.enable_raw_evidence" in main
    assert "length(var.source_approval_inputs) > 0" in main
    assert 'variable "enable_runtime"' in variables
    assert 'variable "enable_raw_evidence"' in variables
    assert variables.count("default     = false") >= 2
    for name in ("network", "database", "object_store", "identity", "domains", "telemetry"):
        assert f'variable "{name}"' in variables
    for provider in ("aws_", "azurerm_", "google_", "cloudflare_"):
        assert provider not in (main + variables).lower()
