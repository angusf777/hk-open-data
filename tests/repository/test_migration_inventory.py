from pathlib import Path

from scripts.migration_inventory import classify


def test_classification_imports_only_allowlisted_source_paths() -> None:
    assert classify(Path("apps/portal/src/App.tsx")) == "import"
    assert classify(Path("packages/schemas/src/index.ts")) == "import"
    assert classify(Path("services/worker/hk_data_worker/service.py")) == "import"


def test_classification_excludes_generated_local_and_private_planning_state() -> None:
    assert classify(Path("apps/portal/dist/index.html")) == "exclude"
    assert classify(Path("services/worker/hk_data_worker/__pycache__/x.pyc")) == "exclude"
    assert classify(Path("artifacts/sbom.cdx.json")) == "exclude"
    assert classify(Path("docs/superpowers/plans/private-plan.md")) == "exclude"
    assert classify(Path("tests/results.sqlite")) == "exclude"


def test_classification_leaves_unknown_roots_for_review() -> None:
    assert classify(Path("README.md")) == "review"
    assert classify(Path("docs/architecture/private.md")) == "review"
