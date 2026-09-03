from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
from hk_data_sdk.cli import main
from hk_data_worker.access.resources import DataGovResourceInventory, build_resource
from hk_data_worker.fetch import RetryExhausted, SafeFetcher
from hk_data_worker.models import ApprovedRequest, FetchResult

FIXTURES = Path(__file__).parent / "fixtures"


def _repository(tmp_path: Path) -> Path:
    recipes = tmp_path / "access" / "recipes" / "official"
    recipes.mkdir(parents=True)
    shutil.copy(FIXTURES / "valid" / "hkapi-001.yml", recipes)
    return tmp_path


def _resource_inventory(root: Path, *, url: str = "https://public.example/data.csv") -> None:
    inventory = DataGovResourceInventory(
        schema_version=1,
        checked_at="2026-09-03T00:00:00Z",
        package_endpoint="https://data.gov.hk/en-data/api/3/action/package_show",
        resources=(
            build_resource(
                "dataset-one",
                ("HKAPI-001",),
                {
                    "id": "resource-one",
                    "name": "Current data",
                    "format": "CSV",
                    "url": url,
                },
            ),
        ),
    )
    path = root / "access" / "generated" / "data-gov-resources.json"
    path.parent.mkdir(parents=True)
    path.write_text(inventory.model_dump_json(by_alias=True), encoding="utf-8")


class FixtureFetcher:
    def fetch(self, request: ApprovedRequest) -> FetchResult:
        return FetchResult(
            status_code=200,
            headers={"content-type": "application/json"},
            body=b'{"success":true,"result":[{"id":"one"}]}',
            final_url=request.url,
            elapsed_ms=12,
        )


class UnavailableFetcher:
    def fetch(self, request: ApprovedRequest) -> FetchResult:
        del request
        raise RetryExhausted("provider details are not public evidence")


def test_recipe_command_is_offline(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    root = _repository(tmp_path)
    monkeypatch.setattr(SafeFetcher, "fetch", lambda *_: pytest.fail("network used"))

    assert main(["recipe", "HKAPI-001", "--format", "json"], repository_root=root) == 0

    assert json.loads(capsys.readouterr().out)["sourceReference"] == "HKAPI-001"


def test_example_command_prints_bounded_offline_code(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _repository(tmp_path)

    assert main(["example", "HKAPI-001", "curl"], repository_root=root) == 0

    captured = capsys.readouterr()
    assert "curl" in captured.out
    assert "limit=10&offset=0" in captured.out
    assert captured.err == ""


def test_fetch_writes_data_to_stdout_and_diagnostics_to_stderr(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _repository(tmp_path)

    code = main(
        ["fetch", "HKAPI-001", "--allow-unverified", "--output", "ndjson"],
        repository_root=root,
        fetcher=FixtureFetcher(),
    )

    captured = capsys.readouterr()
    assert code == 0
    assert json.loads(captured.out.splitlines()[0])["source_id"] == "HKAPI-001"
    assert "responseSha256" in captured.err


def test_fetch_maps_invalid_input_to_stable_exit_code(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _repository(tmp_path)

    code = main(
        ["fetch", "HKAPI-001", "--allow-unverified", "--param", "unknown=value"],
        repository_root=root,
        fetcher=FixtureFetcher(),
    )

    assert code == 2
    assert "INVALID_PARAMETER" in capsys.readouterr().err


def test_verify_writes_metadata_only_evidence(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _repository(tmp_path)

    assert (
        main(
            ["verify", "HKAPI-001"],
            repository_root=root,
            fetcher=FixtureFetcher(),
        )
        == 0
    )

    evidence = root / "access" / "verification" / "hkapi-001.json"
    assert evidence.exists()
    assert '"outcome": "success"' in evidence.read_text(encoding="utf-8")
    assert "verified HKAPI-001" in capsys.readouterr().err


def test_verify_all_records_failure_evidence_and_returns_a_stable_exit_code(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _repository(tmp_path)

    code = main(
        ["verify", "--all-anonymous"],
        repository_root=root,
        fetcher=UnavailableFetcher(),
    )

    evidence = root / "access" / "verification" / "hkapi-001.json"
    assert code == 4
    assert '"outcome": "failure"' in evidence.read_text(encoding="utf-8")
    assert "provider details" not in evidence.read_text(encoding="utf-8")
    assert "SOURCE_UNAVAILABLE" in capsys.readouterr().err


def test_resources_lists_current_provider_endpoints_offline(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    root = _repository(tmp_path)
    _resource_inventory(root)
    monkeypatch.setattr(SafeFetcher, "fetch", lambda *_: pytest.fail("network used"))

    assert main(["resources", "HKAPI-001"], repository_root=root) == 0

    output = json.loads(capsys.readouterr().out)
    assert output[0]["resourceId"] == "resource-one"
    assert output[0]["urlTemplate"] == "https://public.example/data.csv"


def test_cli_uses_repository_environment_outside_checkout(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    root = _repository(tmp_path / "repository")
    _resource_inventory(root)
    outside = tmp_path / "outside"
    outside.mkdir()
    monkeypatch.chdir(outside)

    assert (
        main(
            ["resources", "HKAPI-001"],
            environ={"HK_OPEN_DATA_REPOSITORY": str(root)},
        )
        == 0
    )

    assert json.loads(capsys.readouterr().out)[0]["resourceId"] == "resource-one"


def test_resource_example_uses_selected_provider_endpoint(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _repository(tmp_path)
    _resource_inventory(root)

    assert (
        main(
            ["resource-example", "HKAPI-001", "resource-one", "python"],
            repository_root=root,
        )
        == 0
    )

    assert "https://public.example/data.csv" in capsys.readouterr().out


def test_fetch_resource_writes_provider_bytes_without_overwriting(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _repository(tmp_path)
    _resource_inventory(root)
    output = tmp_path / "download.csv"

    assert (
        main(
            [
                "fetch-resource",
                "HKAPI-001",
                "resource-one",
                "--output",
                str(output),
            ],
            repository_root=root,
            fetcher=FixtureFetcher(),
        )
        == 0
    )
    assert output.read_bytes() == b'{"success":true,"result":[{"id":"one"}]}'
    diagnostics = json.loads(capsys.readouterr().err)
    assert diagnostics["resourceId"] == "resource-one"
    assert diagnostics["responseSha256"]

    assert (
        main(
            [
                "fetch-resource",
                "HKAPI-001",
                "resource-one",
                "--output",
                str(output),
            ],
            repository_root=root,
            fetcher=FixtureFetcher(),
        )
        == 2
    )
    assert "OUTPUT_EXISTS" in capsys.readouterr().err
