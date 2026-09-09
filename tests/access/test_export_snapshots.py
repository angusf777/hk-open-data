import csv
import json
import sqlite3
from pathlib import Path

from scripts.export_snapshots import generate_snapshots


def test_exports_publish_catalogue_and_access_metadata_without_provider_payloads(
    tmp_path: Path,
) -> None:
    generate_snapshots(tmp_path)

    assert {path.name for path in tmp_path.iterdir()} == {
        "README.txt",
        "SHA256SUMS",
        "catalogue.json",
        "datasets.csv",
        "hk-open-data.sqlite",
        "provider-resources.csv",
        "provider-resources.json",
        "sources.csv",
    }
    with (tmp_path / "sources.csv").open(encoding="utf-8", newline="") as stream:
        assert len(list(csv.DictReader(stream))) == 521
    with (tmp_path / "provider-resources.csv").open(encoding="utf-8", newline="") as stream:
        resources = list(csv.DictReader(stream))
    assert len(resources) == 5_862
    assert sum(row["verification_status"] == "live-verified" for row in resources) == 234
    assert "body" not in resources[0]

    with sqlite3.connect(tmp_path / "hk-open-data.sqlite") as database:
        assert database.execute("select count(*) from catalogue_sources").fetchone() == (521,)
        assert database.execute("select count(*) from datasets").fetchone() == (350,)
        assert database.execute("select count(*) from provider_resources").fetchone() == (5_862,)
        tables = {
            row[0]
            for row in database.execute(
                "select name from sqlite_master where type = 'table'"
            ).fetchall()
        }
        assert tables == {"metadata", "catalogue_sources", "datasets", "provider_resources"}

    exported = json.loads((tmp_path / "provider-resources.json").read_text(encoding="utf-8"))
    assert exported["resources"][0]["verification"]["status"] in {
        "live-verified",
        "failed",
        "metadata-only",
    }
