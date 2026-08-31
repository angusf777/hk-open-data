from __future__ import annotations

import json
from pathlib import Path

import pytest
from hk_data_worker.registry import load_monitor_targets, load_source_groups
from pydantic import ValidationError

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_ROOT = WORKSPACE_ROOT / "packages" / "schemas" / "contracts"


def test_loads_ten_groups_and_fifty_sequential_targets() -> None:
    groups = load_source_groups(CONTRACT_ROOT / "p01-source-groups.csv")
    targets = load_monitor_targets(CONTRACT_ROOT / "p14-monitor-targets.csv")

    assert len(groups) == 10
    assert [target.monitor_id for target in targets] == [
        f"P14-M{index:03d}" for index in range(1, 51)
    ]
    known_groups = {group.source_group_id for group in groups} | {"P14-ONLY-01"}
    assert all(target.source_group_id in known_groups for target in targets)
    assert all(target.activation_status == "specified_pending_approval" for target in targets)

    catalogue = json.loads(
        (WORKSPACE_ROOT / "catalog" / "generated" / "catalogue.json").read_text()
    )
    references = {resource["sourceReference"] for resource in catalogue["resources"]}
    registry_references = {
        source_id for group in groups for source_id in group.source_ids
    } | {target.source_id for target in targets}
    assert registry_references <= references


def test_rejects_non_https_and_invalid_post_json(tmp_path: Path) -> None:
    path = tmp_path / "targets.csv"
    path.write_text(
        "monitor_id,source_id,source_group_id,provider,name,method,request_template,"
        "request_body_json,cadence_seconds,timeout_ms,freshness_rule,required_checks,"
        "public_visibility,activation_status,documentation_url,notes\n"
        "P14-M001,HKAPI-001,P01-SG-01,Provider,Target,POST,http://example.com,{bad,"
        "60,1000,retrieval_only,availability,pending_review,"
        "specified_pending_approval,https://example.com/docs,test\n",
        encoding="utf-8",
    )

    with pytest.raises((ValidationError, ValueError)):
        load_monitor_targets(path)


def test_rejects_duplicate_source_group_ids(tmp_path: Path) -> None:
    source = CONTRACT_ROOT / "p01-source-groups.csv"
    rows = source.read_text(encoding="utf-8").splitlines()
    path = tmp_path / "groups.csv"
    path.write_text("\n".join([rows[0], rows[1], rows[1]]) + "\n", encoding="utf-8")

    with pytest.raises(ValueError, match="duplicate source_group_id"):
        load_source_groups(path)
