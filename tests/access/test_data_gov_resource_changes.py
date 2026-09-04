import json
from pathlib import Path

from scripts.data_gov_resource_changes import build_change_report, render_markdown


def _inventory(resources: list[dict[str, object]]) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "checkedAt": "2026-09-04T00:00:00Z",
        "packageEndpoint": "https://data.gov.hk/example",
        "datasets": [],
        "resources": resources,
    }


def test_change_report_identifies_added_removed_and_changed_resources() -> None:
    baseline = _inventory(
        [
            {"datasetId": "one", "resourceId": "same", "urlTemplate": "https://a.example/old"},
            {"datasetId": "one", "resourceId": "removed", "urlTemplate": "https://a.example/x"},
        ]
    )
    current = _inventory(
        [
            {"datasetId": "one", "resourceId": "same", "urlTemplate": "https://a.example/new"},
            {"datasetId": "two", "resourceId": "added", "urlTemplate": "https://b.example/x"},
        ]
    )
    probe = {
        "checkedAt": "2026-09-04T00:01:00Z",
        "uniqueDatasets": 2,
        "successes": 1,
        "failures": 1,
        "notProbeable": 0,
    }

    report = build_change_report(baseline, current, probe)

    assert report["summary"]["resources"] == {"added": 1, "removed": 1, "changed": 1}
    assert report["summary"]["probeFailures"] == 1
    assert report["resources"]["changed"] == ["one:same"]
    assert "Provider-resource inventory report" in render_markdown(report)
    assert "does not grant permission" in render_markdown(report)


def test_cli_outputs_contain_no_provider_payloads(tmp_path: Path) -> None:
    report = build_change_report(_inventory([]), _inventory([]), {"failures": 0})
    output = tmp_path / "report.json"
    output.write_text(json.dumps(report), encoding="utf-8")

    assert "body" not in output.read_text(encoding="utf-8").lower()
