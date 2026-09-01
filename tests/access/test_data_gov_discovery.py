from hk_data_worker.access.data_gov_discovery import (
    DataGovDataset,
    DataGovDirectory,
    parse_data_gov_directory,
    rank_data_gov_datasets,
    select_unambiguous_dataset,
)

DIRECTORY_ROWS = (
    {
        "Data Provider": "Transport Department",
        "Dataset Name": "Road Network (2nd Generation)",
        "Resource Name": "Road centerline",
        "Data Format": "KML",
        "Dataset ID": "hk-td-tis_15-road-network-v2",
    },
    {
        "Data Provider": "Transport Department",
        "Dataset Name": "Road Network (2nd Generation)",
        "Resource Name": "Delta change of road centerline",
        "Data Format": "CSV",
        "Dataset ID": "hk-td-tis_15-road-network-v2",
    },
    {
        "Data Provider": "Transport Department",
        "Dataset Name": "Traffic Data of Strategic / Major Roads",
        "Resource Name": "Road Network Segments",
        "Data Format": "CSV",
        "Dataset ID": "hk-td-sm_4-traffic-data-strategic-major-roads",
    },
)


def test_ranking_groups_resources_and_matches_version_aliases() -> None:
    ranked = rank_data_gov_datasets(
        name="Road Network Data version 2",
        provider="Transport Department",
        search_query="Road Network Data Version 2",
        directory_rows=DIRECTORY_ROWS,
    )

    assert ranked[0] == DataGovDataset(
        dataset_id="hk-td-tis_15-road-network-v2",
        dataset_name="Road Network (2nd Generation)",
        provider="Transport Department",
        resources=(
            ("Road centerline", "KML"),
            ("Delta change of road centerline", "CSV"),
        ),
        score=1.0,
    )


def test_selection_rejects_an_ambiguous_top_match() -> None:
    ranked = (
        DataGovDataset("first", "Traffic locations", "Transport Department", (), 0.82),
        DataGovDataset("second", "Traffic location data", "Transport Department", (), 0.80),
    )

    assert select_unambiguous_dataset(ranked) is None


def test_directory_parser_accepts_the_official_utf8_bom() -> None:
    payload = (
        '\ufeff{"As of Date":"2026-09-01","Counts":1,"Data":'
        '[{"Data Provider":"Provider","Dataset Name":"Dataset",'
        '"Resource Name":"Resource","Data Format":"JSON","Dataset ID":"dataset-id"}]}'
    ).encode()

    assert parse_data_gov_directory(payload) == (
        {
            "Data Provider": "Provider",
            "Dataset Name": "Dataset",
            "Resource Name": "Resource",
            "Data Format": "JSON",
            "Dataset ID": "dataset-id",
        },
    )


def test_directory_index_can_rank_multiple_sources_without_reloading_rows() -> None:
    directory = DataGovDirectory.from_rows(DIRECTORY_ROWS)

    road = directory.rank(
        name="Road Network Data version 2",
        provider="Transport Department",
        search_query="Road Network Data Version 2",
    )
    traffic = directory.rank(
        name="Strategic road traffic data",
        provider="Transport Department",
        search_query="Traffic Data Strategic Major Roads",
    )

    assert road[0].dataset_id == "hk-td-tis_15-road-network-v2"
    assert traffic[0].dataset_id == "hk-td-sm_4-traffic-data-strategic-major-roads"


def test_selection_handles_plural_and_more_specific_official_titles() -> None:
    rows = (
        {
            "Data Provider": "Hong Kong Tramways, Limited",
            "Dataset Name": "Tramways Tram Stops",
            "Resource Name": "Tramways Tram Stops (English Version)",
            "Data Format": "CSV",
            "Dataset ID": "hktramways-hktramways-tram-stops",
        },
        *DIRECTORY_ROWS,
    )
    ranked = DataGovDirectory.from_rows(rows).rank(
        name="Hong Kong Tramways stop data",
        provider="Hong Kong Tramways",
        search_query="Hong Kong Tramways stops",
    )

    assert select_unambiguous_dataset(ranked).dataset_id == (
        "hktramways-hktramways-tram-stops"
    )
