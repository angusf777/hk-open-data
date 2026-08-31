from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).parents[1]
WORKFLOW_ROOT = ROOT / ".github"
USE = re.compile(
    r"^(?P<prefix>\s*(?:-\s+)?uses:\s*)"
    r"(?P<repository>[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)"
    r"(?P<subpath>(?:/[A-Za-z0-9_.-]+)*)@"
    r"(?P<reference>[^\s#]+)(?P<suffix>.*)$"
)
SHA = re.compile(r"[0-9a-f]{40}")


def resolve_action_tag(owner: str, repository: str, tag: str) -> str:
    url = f"https://github.com/{owner}/{repository}.git"
    refs = subprocess.check_output(
        ["git", "ls-remote", url, f"refs/tags/{tag}", f"refs/tags/{tag}^{{}}"],
        text=True,
    ).splitlines()
    candidates = dict(line.split("\t", 1)[::-1] for line in refs)
    sha = candidates.get(f"refs/tags/{tag}^{{}}") or candidates.get(f"refs/tags/{tag}")
    if sha is None or SHA.fullmatch(sha) is None:
        raise RuntimeError(f"cannot resolve {owner}/{repository}@{tag}")
    return sha


def pin(path: Path) -> bool:
    changed = False
    output: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        match = USE.match(line)
        if match is None or SHA.fullmatch(match["reference"]):
            output.append(line)
            continue
        owner, repository = match["repository"].split("/", 1)
        reference = match["reference"]
        digest = resolve_action_tag(owner, repository, reference)
        suffix = match["suffix"].rstrip()
        comment = suffix if "#" in suffix else f"  # {reference}"
        output.append(
            f"{match['prefix']}{owner}/{repository}{match['subpath']}@{digest}{comment}"
        )
        changed = True
    if changed:
        path.write_text("\n".join(output) + "\n", encoding="utf-8")
    return changed


def main() -> None:
    paths = sorted((*WORKFLOW_ROOT.rglob("*.yml"), *WORKFLOW_ROOT.rglob("*.yaml")))
    changed = [path for path in paths if pin(path)]
    print(f"pinned external actions in {len(changed)} file(s)")


if __name__ == "__main__":
    main()
