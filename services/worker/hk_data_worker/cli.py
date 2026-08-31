from __future__ import annotations

import argparse
from pathlib import Path

from .registry import load_monitor_targets, load_source_groups


def main() -> int:
    parser = argparse.ArgumentParser(prog="hk-data-worker")
    parser.add_argument("source_groups", type=Path)
    parser.add_argument("monitor_targets", type=Path)
    arguments = parser.parse_args()
    groups = load_source_groups(arguments.source_groups)
    targets = load_monitor_targets(arguments.monitor_targets)
    print(f"validated {len(groups)} source groups and {len(targets)} monitor targets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
