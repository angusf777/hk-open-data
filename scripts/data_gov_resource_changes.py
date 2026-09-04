from __future__ import annotations

import argparse
import json
from collections.abc import Mapping
from pathlib import Path


def _keyed(values: object, fields: tuple[str, ...]) -> dict[str, dict[str, object]]:
    if not isinstance(values, list):
        return {}
    keyed: dict[str, dict[str, object]] = {}
    for value in values:
        if not isinstance(value, dict):
            continue
        parts = [value.get(field) for field in fields]
        if not all(isinstance(part, str) and part for part in parts):
            continue
        keyed[":".join(str(part) for part in parts)] = value
    return keyed


def _changes(
    baseline: dict[str, dict[str, object]],
    current: dict[str, dict[str, object]],
) -> dict[str, list[str]]:
    baseline_keys = set(baseline)
    current_keys = set(current)
    return {
        "added": sorted(current_keys - baseline_keys),
        "removed": sorted(baseline_keys - current_keys),
        "changed": sorted(
            key
            for key in baseline_keys & current_keys
            if baseline[key] != current[key]
        ),
    }


def build_change_report(
    baseline: Mapping[str, object],
    current: Mapping[str, object],
    probe: Mapping[str, object],
) -> dict[str, object]:
    resource_changes = _changes(
        _keyed(baseline.get("resources"), ("datasetId", "resourceId")),
        _keyed(current.get("resources"), ("datasetId", "resourceId")),
    )
    dataset_changes = _changes(
        _keyed(baseline.get("datasets"), ("datasetId",)),
        _keyed(current.get("datasets"), ("datasetId",)),
    )
    return {
        "schemaVersion": 1,
        "baselineCheckedAt": baseline.get("checkedAt"),
        "currentCheckedAt": current.get("checkedAt"),
        "probeCheckedAt": probe.get("checkedAt"),
        "summary": {
            "resources": {key: len(value) for key, value in resource_changes.items()},
            "datasets": {key: len(value) for key, value in dataset_changes.items()},
            "probeSuccesses": int(probe.get("successes", 0)),
            "probeFailures": int(probe.get("failures", 0)),
            "notProbeable": int(probe.get("notProbeable", 0)),
        },
        "resources": resource_changes,
        "datasets": dataset_changes,
    }


def render_markdown(report: Mapping[str, object]) -> str:
    summary = report.get("summary")
    if not isinstance(summary, dict):
        raise ValueError("change report summary is missing")
    resource_summary = summary.get("resources")
    dataset_summary = summary.get("datasets")
    if not isinstance(resource_summary, dict) or not isinstance(dataset_summary, dict):
        raise ValueError("change report counts are missing")
    lines = [
        "# Provider-resource inventory report",
        "",
        f"Baseline metadata: {report.get('baselineCheckedAt') or 'unknown'}",
        f"Current metadata: {report.get('currentCheckedAt') or 'unknown'}",
        f"Payload probes: {report.get('probeCheckedAt') or 'unknown'}",
        "",
        "| Check | Added | Removed | Changed |",
        "| --- | ---: | ---: | ---: |",
        (
            f"| Datasets | {dataset_summary.get('added', 0)} | "
            f"{dataset_summary.get('removed', 0)} | {dataset_summary.get('changed', 0)} |"
        ),
        (
            f"| Files and endpoints | {resource_summary.get('added', 0)} | "
            f"{resource_summary.get('removed', 0)} | {resource_summary.get('changed', 0)} |"
        ),
        "",
        (
            f"Bounded representative probes: {summary.get('probeSuccesses', 0)} succeeded; "
            f"{summary.get('probeFailures', 0)} failed; "
            f"{summary.get('notProbeable', 0)} were not probeable."
        ),
        "",
        "The workflow stores metadata and bounded technical evidence only. It does not commit",
        "provider response bodies or automatically change the catalogue.",
        "",
        "Technical reachability does not grant permission for commercial use, caching, scraping,",
        "or redistribution. Review provider terms before acting on this report.",
        "",
    ]
    for collection in ("datasets", "resources"):
        values = report.get(collection)
        if not isinstance(values, dict):
            continue
        lines.extend((f"## Changed {collection}", ""))
        any_values = False
        for status in ("added", "removed", "changed"):
            entries = values.get(status)
            if not isinstance(entries, list) or not entries:
                continue
            any_values = True
            lines.append(f"**{status.title()} ({len(entries)}):**")
            lines.extend(f"- `{entry}`" for entry in entries[:100])
            if len(entries) > 100:
                lines.append(f"- …and {len(entries) - 100} more in the JSON artifact")
            lines.append("")
        if not any_values:
            lines.extend(("No metadata changes detected.", ""))
    return "\n".join(lines)


def _load(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain an object")
    return value


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Compare provider-resource inventory snapshots")
    parser.add_argument("baseline", type=Path)
    parser.add_argument("current", type=Path)
    parser.add_argument("probe", type=Path)
    parser.add_argument("--json-output", type=Path, required=True)
    parser.add_argument("--markdown-output", type=Path, required=True)
    args = parser.parse_args(argv)
    report = build_change_report(_load(args.baseline), _load(args.current), _load(args.probe))
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.markdown_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    args.markdown_output.write_text(render_markdown(report), encoding="utf-8")
    print(json.dumps(report["summary"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
