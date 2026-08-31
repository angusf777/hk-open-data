from __future__ import annotations

import hashlib
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).parents[2]


def package_release(version: str, output: Path) -> list[Path]:
    environment = os.environ.copy()
    environment["HKOD_RELEASE_ALLOW_DIRTY"] = "test-only"
    subprocess.run(
        ["sh", "scripts/package-release.sh", version, str(output)],
        cwd=ROOT,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )
    return sorted(output.iterdir())


def test_release_package_contains_metadata_not_provider_data(tmp_path: Path) -> None:
    result = package_release("0.1.0", tmp_path)
    names = {path.name for path in result}
    assert names == {
        "hk-open-data-catalogue-v0.1.0.json",
        "hk-open-data-sbom-v0.1.0.cdx.json",
        "SHA256SUMS",
    }
    checksums = {
        line.split(maxsplit=1)[1].lstrip("*"): line.split(maxsplit=1)[0]
        for line in (tmp_path / "SHA256SUMS").read_text(encoding="utf-8").splitlines()
    }
    for path in result:
        if path.name == "SHA256SUMS":
            continue
        assert hashlib.sha256(path.read_bytes()).hexdigest() == checksums[path.name]
    catalogue = (tmp_path / "hk-open-data-catalogue-v0.1.0.json").read_text(
        encoding="utf-8"
    )
    assert '"resources"' in catalogue
    assert "provider payload" not in catalogue.lower()

    sbom_path = tmp_path / "hk-open-data-sbom-v0.1.0.cdx.json"
    sbom_text = sbom_path.read_text(encoding="utf-8")
    sbom = json.loads(sbom_text)
    assert sbom["bomFormat"] == "CycloneDX"
    assert sbom["specVersion"] == "1.6"
    assert len(sbom["components"]) >= 400
    assert all(component.get("licenses") for component in sbom["components"])
    assert str(ROOT) not in sbom_text


def test_normal_packaging_requires_a_clean_tree() -> None:
    script = (ROOT / "scripts/package-release.sh").read_text(encoding="utf-8")
    assert "git status --porcelain" in script
    assert 'HKOD_RELEASE_ALLOW_DIRTY:-' in script
