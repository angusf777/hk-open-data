from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).parents[2]


def workflow(name: str) -> dict[str, object]:
    value = yaml.safe_load((ROOT / ".github/workflows" / name).read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def test_ci_has_read_only_permissions_and_required_jobs() -> None:
    ci = workflow("ci.yml")
    assert ci["permissions"] == {"contents": "read"}
    jobs = ci["jobs"]
    assert isinstance(jobs, dict)
    assert {"catalogue", "typescript", "python", "browser", "boundary"} <= set(jobs)


def test_setup_installs_all_python_workspace_packages() -> None:
    setup = yaml.safe_load(
        (ROOT / ".github/actions/setup/action.yml").read_text(encoding="utf-8")
    )
    install = next(
        step for step in setup["runs"]["steps"] if step.get("name") == "Install dependencies"
    )
    assert "uv sync --frozen --all-packages --all-groups" in install["run"]


def test_pages_uploads_only_static_catalogue_dist() -> None:
    pages = workflow("pages.yml")
    jobs = pages["jobs"]
    assert isinstance(jobs, dict)
    build = jobs["build"]
    deploy = jobs["deploy"]
    assert isinstance(build, dict) and isinstance(deploy, dict)
    steps = build["steps"]
    assert isinstance(steps, list)
    upload = next(step for step in steps if "upload-pages-artifact" in str(step.get("uses", "")))
    assert upload["with"]["path"] == "apps/catalog/dist"
    assert deploy["permissions"] == {"pages": "write", "id-token": "write"}


def test_release_verifies_checksums_from_the_artifact_directory() -> None:
    release = workflow("release.yml")
    jobs = release["jobs"]
    assert isinstance(jobs, dict)
    package = jobs["package"]
    assert isinstance(package, dict)
    steps = package["steps"]
    assert isinstance(steps, list)
    checksum = next(step for step in steps if "shasum -a 256 -c" in str(step.get("run", "")))
    assert checksum["run"] == "shasum -a 256 -c SHA256SUMS"
    assert checksum["working-directory"] == "artifacts"


def test_external_actions_are_pinned_to_full_commits() -> None:
    for path in sorted((ROOT / ".github").rglob("*.yml")):
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped.startswith("uses:") or "./" in stripped:
                continue
            reference = stripped.split("@", 1)[-1].split()[0]
            assert len(reference) == 40 and all(char in "0123456789abcdef" for char in reference)
