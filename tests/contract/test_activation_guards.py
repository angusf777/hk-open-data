from pathlib import Path

ROOT = Path(__file__).parents[2]


def test_source_connector_and_monitor_kill_switches_clear_active_leases() -> None:
    source = (ROOT / "services/api/migrations/006_operational_activation.sql").read_text()
    runtime = (ROOT / "services/api/migrations/008_runtime_kill_switches.sql").read_text()
    combined = source + runtime

    for trigger in ("source_kill_switch", "connector_kill_switch", "monitor_kill_switch"):
        assert f"CREATE TRIGGER {trigger}" in combined
    assert combined.count("SET active = false") >= 3
    assert combined.count("lease_owner = NULL") >= 3
    assert combined.count("lease_expires_at = NULL") >= 3
