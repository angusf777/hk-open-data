from __future__ import annotations

import argparse
import json

RUNBOOKS = {
    "provider-outage": ["provider reachability", "latest observations", "reviewed incident"],
    "schema-drift": ["raw evidence hash", "baseline diff", "quarantine state"],
    "stale-source": ["freshness rule", "provider timestamp", "scheduler lease"],
    "credential-rotation": ["secret reference", "overlap window", "authentication probe"],
    "raw-revocation": ["approval decision", "object retention hold", "downstream lineage"],
    "restore": ["backup identifier", "isolated target", "row and object hashes"],
    "correction": ["source evidence", "replacement record", "correction reference"],
    "mcp-revocation": ["client identity", "gateway token", "post-revocation denial"],
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a P01/P14 operational runbook")
    parser.add_argument("runbook", choices=sorted(RUNBOOKS))
    parser.add_argument("--dry-run", action="store_true", required=True)
    arguments = parser.parse_args()
    print(
        json.dumps(
            {
                "runbook": arguments.runbook,
                "mode": "dry-run",
                "checks": RUNBOOKS[arguments.runbook],
                "mutations": False,
            },
            separators=(",", ":"),
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
