from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
from hk_data_sdk.cli import main
from hk_data_worker.fetch import SafeFetcher
from hk_data_worker.models import ApprovedRequest, FetchResult

FIXTURES = Path(__file__).parent / "fixtures"


def _repository(tmp_path: Path) -> Path:
    recipes = tmp_path / "access" / "recipes" / "official"
    recipes.mkdir(parents=True)
    shutil.copy(FIXTURES / "valid" / "hkapi-001.yml", recipes)
    return tmp_path


class FixtureFetcher:
    def fetch(self, request: ApprovedRequest) -> FetchResult:
        return FetchResult(
            status_code=200,
            headers={"content-type": "application/json"},
            body=b'{"success":true,"result":[{"id":"one"}]}',
            final_url=request.url,
            elapsed_ms=12,
        )


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

    assert main(
        ["verify", "HKAPI-001"],
        repository_root=root,
        fetcher=FixtureFetcher(),
    ) == 0

    evidence = root / "access" / "verification" / "hkapi-001.json"
    assert evidence.exists()
    assert '"outcome": "success"' in evidence.read_text(encoding="utf-8")
    assert "verified HKAPI-001" in capsys.readouterr().err
