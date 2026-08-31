from __future__ import annotations

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).parents[1]
SHA = re.compile(r"[0-9a-f]{40}")


def check_file(path: Path) -> list[str]:
    errors: list[str] = []
    yaml.safe_load(path.read_text(encoding="utf-8"))
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        stripped = line.strip()
        if not stripped.startswith("uses:") and not stripped.startswith("- uses:"):
            continue
        value = stripped.split("uses:", 1)[1].strip().split()[0]
        if value.startswith("./"):
            continue
        if "@" not in value or SHA.fullmatch(value.rsplit("@", 1)[1]) is None:
            errors.append(f"{path.relative_to(ROOT)}:{number}: action is not pinned: {value}")
    return errors


def main() -> None:
    paths = sorted((*ROOT.glob(".github/**/*.yml"), *ROOT.glob(".github/**/*.yaml")))
    errors = [error for path in paths for error in check_file(path)]
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"workflow policy passed ({len(paths)} YAML files)")


if __name__ == "__main__":
    main()
