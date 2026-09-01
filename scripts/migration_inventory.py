"""Inventory the curated P01/P14 source boundary without publishing source paths."""

from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path

IMPORT_ROOTS = (
    "apps/admin",
    "apps/portal",
    "packages",
    "services",
    "infra",
    "tests",
    "scripts",
)
EXCLUDED_PARTS = {
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".terraform",
    ".venv",
    "__pycache__",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
}
EXCLUDED_FILES = {
    "artifacts/sbom.cdx.json",
    "RELEASE_EVIDENCE.md",
}
EXCLUDED_SUFFIXES = {".db", ".pyc", ".sqlite", ".sqlite3"}


def classify(relative: Path) -> str:
    """Return ``import``, ``exclude`` or ``review`` for a source-relative path."""

    posix = relative.as_posix()
    if (
        posix in EXCLUDED_FILES
        or any(part in EXCLUDED_PARTS for part in relative.parts)
        or relative.suffix.lower() in EXCLUDED_SUFFIXES
        or posix.startswith("docs/superpowers/")
    ):
        return "exclude"
    if any(posix == root or posix.startswith(f"{root}/") for root in IMPORT_ROOTS):
        return "import"
    return "review"


def _source_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for current, directories, names in os.walk(root):
        current_path = Path(current)
        relative_directory = current_path.relative_to(root)
        directories[:] = sorted(
            name
            for name in directories
            if classify(relative_directory / name) != "exclude"
        )
        for name in sorted(names):
            files.append(relative_directory / name)
    return sorted(files, key=lambda item: item.as_posix())


def inventory(root: Path) -> dict[str, list[str]]:
    """Return a deterministic, source-relative migration inventory."""

    if not root.is_dir():
        raise FileNotFoundError(f"source root does not exist: {root}")

    imported: list[str] = []
    excluded: list[str] = []
    review: list[str] = []
    for relative in _source_files(root):
        decision = classify(relative)
        if decision == "import":
            imported.append(relative.as_posix())
        elif decision == "exclude":
            excluded.append(relative.as_posix())
        else:
            review.append(relative.as_posix())

    missing = [path for path in IMPORT_ROOTS if not (root / path).exists()]
    return {
        "source": ["explicit CLI source; absolute path intentionally omitted"],
        "imported": imported,
        "excluded": excluded,
        "review": review,
        "missing": missing,
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def render_ledger(root: Path) -> str:
    report = inventory(root)
    if report["missing"]:
        raise RuntimeError(f"required import roots are missing: {', '.join(report['missing'])}")

    lines = [
        "# Migration record for the data access and API health tools",
        "",
        "This historical ledger records source-relative files selected by a fixed migration list.",
        "Absolute source paths and source payloads are intentionally omitted.",
        "A hash identifies each mechanical input. Later publication-safety edits are reviewable",
        "in Git. The `P01` and `P14` prefixes below are legacy file and contract identifiers.",
        "They are retained so recorded paths and hashes remain accurate and refer to the data",
        "access and API health components, respectively.",
        "",
        "## Imported source inventory",
        "",
        "| Source-relative path | Target-relative path | Source SHA-256 | Decision | Reason |",
        "| --- | --- | --- | --- | --- |",
    ]
    for relative in report["imported"]:
        lines.append(
            f"| `{relative}` | `{relative}` | `{sha256(root / relative)}` | import | "
            "Project-authored runtime source or test selected by the fixed migration list. |"
        )

    lines.extend(
        [
            "",
            "## Exclusion policy",
            "",
            "Generated builds, dependency trees, virtual environments, caches, test output,",
            "Terraform state, SBOM artifacts, old release evidence, compiled Python, local",
            "databases,",
            "planning documents are excluded. Root manifests and documentation require an explicit",
            "human merge and are not copied by this inventory.",
            "",
            f"Imported files: **{len(report['imported'])}**. Files requiring explicit review: "
            f"**{len(report['review'])}**.",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--ledger", type=Path)
    args = parser.parse_args()

    content = render_ledger(args.source.resolve())
    if args.ledger is None:
        print(content, end="")
    else:
        args.ledger.parent.mkdir(parents=True, exist_ok=True)
        args.ledger.write_text(content, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
