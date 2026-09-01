from __future__ import annotations

import shutil
from pathlib import Path

from scripts.access import main

FIXTURES = Path(__file__).parent / "fixtures"


def _repository(tmp_path: Path) -> Path:
    recipe_root = tmp_path / "access" / "recipes" / "official"
    recipe_root.mkdir(parents=True)
    shutil.copy(FIXTURES / "valid" / "hkapi-001.yml", recipe_root)
    catalogue_root = tmp_path / "catalog" / "official"
    catalogue_root.mkdir(parents=True)
    (catalogue_root / "hkapi-001.yml").write_text(
        "sourceReference: HKAPI-001\npublicationStatus: published\n",
        encoding="utf-8",
    )
    return tmp_path


def test_repository_commands_validate_generate_and_detect_drift(
    tmp_path: Path, capsys: object
) -> None:
    root = _repository(tmp_path)

    assert main(["validate"], repository_root=root) == 0
    assert main(["generate"], repository_root=root) == 0
    assert main(["check"], repository_root=root) == 0

    generated = root / "access" / "generated" / "recipes.json"
    generated.write_text("{}\n", encoding="utf-8")

    assert main(["check"], repository_root=root) == 1
