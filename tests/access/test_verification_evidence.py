from __future__ import annotations

import json
import stat
from datetime import UTC, datetime
from pathlib import Path

from hk_data_worker.access.evidence import write_evidence_atomic
from hk_data_worker.access.execution import verify_recipe
from hk_data_worker.access.registry import load_recipes
from hk_data_worker.models import ApprovedRequest, FetchResult

FIXTURES = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 9, 1, 12, tzinfo=UTC)


class FixtureFetcher:
    def __init__(self, body: bytes) -> None:
        self.body = body

    def fetch(self, request: ApprovedRequest) -> FetchResult:
        return FetchResult(
            status_code=200,
            headers={"content-type": "application/json"},
            body=self.body,
            final_url=request.url,
            elapsed_ms=12,
        )


def test_verification_evidence_contains_hashes_not_body(tmp_path: Path) -> None:
    body = b'{"success":true,"result":[]}'
    recipe = load_recipes(FIXTURES / "valid")[0]
    evidence = verify_recipe(recipe, fetcher=FixtureFetcher(body), now=NOW)
    path = tmp_path / "hkapi-001.json"

    write_evidence_atomic(path, evidence)

    text = path.read_text(encoding="utf-8")
    value = json.loads(text)
    assert value["responseSha256"]
    assert value["schemaFingerprint"]
    assert value["parsedRecordCount"] == 0
    assert body.decode() not in text
    assert stat.S_IMODE(path.stat().st_mode) == 0o600


def test_schema_fingerprint_is_stable_across_values() -> None:
    recipe = load_recipes(FIXTURES / "valid")[0]

    first = verify_recipe(
        recipe,
        fetcher=FixtureFetcher(b'{"success":true,"result":[{"id":1,"name":"a"}]}'),
        now=NOW,
    )
    second = verify_recipe(
        recipe,
        fetcher=FixtureFetcher(b'{"success":true,"result":[{"id":2,"name":"b"}]}'),
        now=NOW,
    )

    assert first.schema_fingerprint == second.schema_fingerprint
