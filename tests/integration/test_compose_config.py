from __future__ import annotations

import json
import os
import subprocess
import textwrap
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).parents[2]


def compose() -> dict[str, object]:
    return yaml.safe_load((ROOT / "docker-compose.yml").read_text(encoding="utf-8"))


def mcp_recipe_probe() -> str:
    return textwrap.dedent(
        """
        const endpoint = 'http://127.0.0.1:3100/mcp';
        const protocol = '2025-11-25';
        function parse(text) {
          if (text.length === 0) return null;
          if (!text.startsWith('event:') && !text.startsWith('data:')) return JSON.parse(text);
          const values = text.split('\\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trim())
            .filter(value => value !== '' && value !== '[DONE]');
          return values.length === 0 ? null : JSON.parse(values.at(-1));
        }
        async function post(message, session) {
          const headers = {
            'content-type': 'application/json',
            'accept': 'application/json, text/event-stream',
            'mcp-protocol-version': protocol,
          };
          if (session) headers['mcp-session-id'] = session;
          const response = await fetch(endpoint, {
            method: 'POST', headers, body: JSON.stringify(message),
            signal: AbortSignal.timeout(10000),
          });
          const text = await response.text();
          if (!response.ok) throw new Error(`MCP ${response.status}: ${text}`);
          return {
            value: parse(text),
            session: response.headers.get('mcp-session-id') || session,
          };
        }
        const initialized = await post({
          jsonrpc: '2.0', id: 1, method: 'initialize',
          params: {
            protocolVersion: protocol,
            capabilities: {},
            clientInfo: { name: 'compose-check', version: '1.0.0' },
          },
        });
        await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, initialized.session);
        const result = await post({
          jsonrpc: '2.0', id: 2, method: 'tools/call',
          params: {
            name: 'access_recipe_get',
            arguments: { source_reference: 'HKAPI-001' },
          },
        }, initialized.session);
        const item = result.value?.result?.structuredContent?.data?.item;
        if (!item) throw new Error('MCP recipe result is missing');
        process.stdout.write(JSON.stringify(item));
        """
    )


def test_generated_access_recipe_matches_the_catalogue_projection() -> None:
    access = json.loads(
        (ROOT / "access" / "generated" / "recipes.json").read_text(encoding="utf-8")
    )
    catalogue = json.loads(
        (ROOT / "catalog" / "generated" / "official.json").read_text(encoding="utf-8")
    )
    expected = {
        recipe["sourceReference"]: recipe
        for recipe in access["recipes"]
    }
    projected = {
        resource["sourceReference"]: resource["accessRecipe"]
        for resource in catalogue["resources"]
    }

    assert len(expected) == 265
    assert projected == expected


def test_local_smoke_checks_the_access_api_and_both_recipe_tools() -> None:
    script = (ROOT / "scripts" / "smoke-local.mjs").read_text(encoding="utf-8")

    assert '"http://127.0.0.1:3000/v1"' in script
    assert "/access-recipes/HKAPI-001" in script
    assert "access_recipes_list" in script
    assert "access_recipe_get" in script
    assert "recipe_sha256" in script


def test_default_compose_surface_is_catalogue_only() -> None:
    value = compose()
    services = value["services"]
    assert "catalog" in services
    assert "profiles" not in services["catalog"]
    assert set(services) == {
        "catalog",
        "postgres",
        "migrate",
        "api",
        "worker-observe",
        "worker-fabric",
        "mcp",
        "admin",
        "portal",
        "object-store",
        "object-store-init",
        "otel-collector",
        "prometheus",
    }
    for name, service in services.items():
        if name != "catalog":
            assert service.get("profiles"), name


def test_observe_profile_has_digest_only_provider_access() -> None:
    services = compose()["services"]
    worker = services["worker-observe"]
    assert worker["profiles"] == ["observe"]
    assert worker["environment"]["HKOD_PROFILE"] == "observe"
    assert worker["environment"]["HKOD_ENABLE_PROVIDER_ACCESS"] == "true"
    assert worker["environment"]["HKOD_ENABLE_RAW_EVIDENCE"] == "false"
    assert all(not key.startswith("OBJECT_STORE_") for key in worker["environment"])
    assert "object-store" not in worker.get("depends_on", {})


def test_fabric_profile_requires_raw_evidence_store() -> None:
    services = compose()["services"]
    worker = services["worker-fabric"]
    assert worker["profiles"] == ["fabric"]
    assert worker["environment"]["HKOD_PROFILE"] == "fabric"
    assert worker["environment"]["HKOD_ENABLE_PROVIDER_ACCESS"] == "true"
    assert worker["environment"]["HKOD_ENABLE_RAW_EVIDENCE"] == "true"
    assert worker["depends_on"]["object-store-init"]["condition"] == (
        "service_completed_successfully"
    )
    assert services["object-store"]["profiles"] == ["fabric"]
    assert services["object-store-init"]["profiles"] == ["fabric"]


def test_runtime_containers_are_bounded_non_root_and_read_only() -> None:
    services = compose()["services"]
    checked = {
        "catalog",
        "api",
        "worker-observe",
        "worker-fabric",
        "mcp",
        "admin",
        "portal",
    }
    for name in checked:
        service = services[name]
        assert service["read_only"] is True, name
        assert service["cap_drop"] == ["ALL"], name
        assert service["security_opt"] == ["no-new-privileges:true"], name
        assert service["pids_limit"] <= 256, name
        assert service["mem_limit"], name
        assert service["cpus"] <= 2, name
        assert str(service["user"]).split(":")[0] not in {"", "0", "root"}, name


def test_provider_workers_do_not_join_the_public_edge() -> None:
    value = compose()
    for name in ("worker-observe", "worker-fabric"):
        networks = value["services"][name]["networks"]
        assert "egress" in networks
        assert "edge" not in networks
    assert value["networks"]["data"]["internal"] is True
    assert value["networks"]["egress"].get("internal") is not True


def test_only_fixed_web_proxies_supply_forwarded_client_addresses() -> None:
    value = compose()
    services = value["services"]
    assert value["networks"]["edge"]["ipam"]["config"] == [
        {"subnet": "172.30.250.0/24"}
    ]
    assert services["admin"]["networks"]["edge"]["ipv4_address"] == "172.30.250.30"
    assert services["portal"]["networks"]["edge"]["ipv4_address"] == "172.30.250.31"
    assert services["api"]["environment"]["TRUSTED_PROXY_CIDRS"] == (
        "172.30.250.30,172.30.250.31"
    )
    nginx = (ROOT / "infra/docker/web.nginx.conf").read_text(encoding="utf-8")
    assert "proxy_set_header X-Forwarded-For $remote_addr;" in nginx
    assert "$proxy_add_x_forwarded_for" not in nginx


def test_runtime_images_are_pinned_and_plaintext_secrets_are_absent() -> None:
    services = compose()["services"]
    expected_local_images = {
        "catalog": "hk-open-data-catalog:0.1.0",
        "api": "hk-open-data-api:0.1.0",
        "worker-observe": "hk-open-data-worker:0.1.0",
        "worker-fabric": "hk-open-data-worker:0.1.0",
        "mcp": "hk-open-data-mcp:0.1.0",
        "admin": "hk-open-data-admin:0.1.0",
        "portal": "hk-open-data-portal:0.1.0",
    }
    for name, image in expected_local_images.items():
        assert services[name]["image"] == image, name
    for name in {"object-store", "otel-collector", "prometheus"}:
        image = services[name]["image"]
        assert "@sha256:" in image, name
    compose_text = (ROOT / "docker-compose.yml").read_text(encoding="utf-8").lower()
    assert "password: postgres" not in compose_text
    assert "minio123" not in compose_text
    assert "change-me" not in compose_text


def test_compose_renders_without_runtime_secrets_and_enables_only_catalogue() -> None:
    result = subprocess.run(
        ["docker", "compose", "config", "--format", "json"],
        cwd=ROOT,
        capture_output=True,
        check=False,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    rendered = json.loads(result.stdout)
    assert set(rendered["services"]) == {"catalog"}


@pytest.mark.skipif(
    os.environ.get("RUN_DOCKER_TESTS") != "1",
    reason="set RUN_DOCKER_TESTS=1 to build the safe default container",
)
def test_catalogue_container_builds_and_becomes_healthy() -> None:
    project = "hk-open-data-catalogue-test"
    base = [
        "docker",
        "compose",
        "--file",
        str(ROOT / "docker-compose.yml"),
        "--file",
        str(ROOT / "tests/fixtures/docker-compose.no-ports.yml"),
        "--project-name",
        project,
    ]
    try:
        result = subprocess.run(
            [*base, "up", "--build", "--detach", "--wait", "--wait-timeout", "90"],
            cwd=ROOT,
            capture_output=True,
            check=False,
            text=True,
            timeout=180,
        )
    finally:
        subprocess.run(
            [*base, "down", "--volumes", "--remove-orphans"],
            cwd=ROOT,
            capture_output=True,
            check=False,
            text=True,
            timeout=60,
        )
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.skipif(
    os.environ.get("RUN_DOCKER_TESTS") != "1",
    reason="set RUN_DOCKER_TESTS=1 to build the opted-in observe runtime",
)
def test_observe_stack_is_healthy_digest_only_and_has_no_object_store() -> None:
    project = "hk-open-data-observe-test"
    environment = os.environ.copy()
    environment.update(
        {
            "COMPOSE_PARALLEL_LIMIT": "2",
            "HKOD_PROFILE": "observe",
            "POSTGRES_PASSWORD": "observe-admin-6ebf68c0",
            "POSTGRES_APP_PASSWORD": "observe-app-9d649c3d",
            "POSTGRES_WEBHOOK_PASSWORD": "observe-webhook-6172d519",
            "WEBHOOK_SECRET_ENCRYPTION_KEY": (
                "Y2ktb25seS0zMi1ieXRlLWtleS0wMTIzNDU2Nzg5MDE="
            ),
        }
    )
    base = [
        "docker",
        "compose",
        "--file",
        str(ROOT / "docker-compose.yml"),
        "--file",
        str(ROOT / "tests/fixtures/docker-compose.no-ports.yml"),
        "--profile",
        "observe",
        "--project-name",
        project,
    ]
    try:
        result = subprocess.run(
            [*base, "up", "--build", "--detach", "--wait", "--wait-timeout", "180"],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=420,
        )
        health = subprocess.run(
            [
                *base,
                "exec",
                "--no-TTY",
                "api",
                "node",
                "-e",
                (
                    "fetch('http://127.0.0.1:3000/health/live')"
                    ".then(r=>r.json()).then(v=>process.stdout.write(JSON.stringify(v)))"
                ),
            ],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=30,
        )
        api_recipe = subprocess.run(
            [
                *base,
                "exec",
                "--no-TTY",
                "api",
                "node",
                "-e",
                (
                    "fetch('http://127.0.0.1:3000/v1/access-recipes/HKAPI-001')"
                    ".then(r=>r.json()).then(v=>process.stdout.write(JSON.stringify(v)))"
                ),
            ],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=30,
        )
        mcp_recipe = subprocess.run(
            [
                *base,
                "exec",
                "--no-TTY",
                "mcp",
                "node",
                "--input-type=module",
                "-e",
                mcp_recipe_probe(),
            ],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=30,
        )
        running = subprocess.run(
            [*base, "ps", "--services", "--status", "running"],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=30,
        )
        worker_logs = subprocess.run(
            [*base, "logs", "--no-color", "worker-observe"],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=30,
        )
    finally:
        subprocess.run(
            [*base, "down", "--volumes", "--remove-orphans"],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=90,
        )

    assert result.returncode == 0, result.stdout + result.stderr + worker_logs.stdout
    assert health.returncode == 0, health.stdout + health.stderr
    assert json.loads(health.stdout)["operating_profile"] == "observe"
    expected = json.loads(
        (ROOT / "access" / "generated" / "recipes.json").read_text(encoding="utf-8")
    )["recipes"][0]
    assert api_recipe.returncode == 0, api_recipe.stdout + api_recipe.stderr
    api_value = json.loads(api_recipe.stdout)
    assert api_value["source_reference"] == expected["sourceReference"]
    assert api_value["recipe_sha256"] == expected["recipeSha256"]
    assert api_value["effective_status"] == expected["effectiveStatus"]
    assert mcp_recipe.returncode == 0, mcp_recipe.stdout + mcp_recipe.stderr
    mcp_value = json.loads(mcp_recipe.stdout)
    assert mcp_value["source_reference"] == expected["sourceReference"]
    assert mcp_value["recipe_sha256"] == expected["recipeSha256"]
    assert mcp_value["effective_status"] == expected["effectiveStatus"]
    running_services = set(running.stdout.splitlines())
    assert "worker-observe" in running_services
    assert "worker-fabric" not in running_services
    assert "object-store" not in running_services
    assert '"evidence_mode":"digest"' in worker_logs.stdout


@pytest.mark.skipif(
    os.environ.get("RUN_DOCKER_TESTS") != "1",
    reason="set RUN_DOCKER_TESTS=1 to build the opted-in full-response runtime",
)
def test_fabric_stack_is_healthy_with_private_object_storage_and_no_active_sources() -> None:
    project = "hk-open-data-fabric-test"
    environment = os.environ.copy()
    environment.update(
        {
            "COMPOSE_PARALLEL_LIMIT": "2",
            "HKOD_PROFILE": "fabric",
            "POSTGRES_PASSWORD": "fabric-admin-e0f29b20",
            "POSTGRES_APP_PASSWORD": "fabric-app-f66cf65e",
            "POSTGRES_WEBHOOK_PASSWORD": "fabric-webhook-d8f0b318",
            "WEBHOOK_SECRET_ENCRYPTION_KEY": (
                "Y2ktb25seS0zMi1ieXRlLWtleS0wMTIzNDU2Nzg5MDE="
            ),
            "OBJECT_STORE_ACCESS_KEY": "fabric-test-access-02b4",
            "OBJECT_STORE_SECRET_KEY": "fabric-test-secret-8ef1a35b4d59408e",
        }
    )
    base = [
        "docker",
        "compose",
        "--file",
        str(ROOT / "docker-compose.yml"),
        "--file",
        str(ROOT / "tests/fixtures/docker-compose.no-ports.yml"),
        "--profile",
        "fabric",
        "--project-name",
        project,
    ]
    try:
        result = subprocess.run(
            [*base, "up", "--build", "--detach", "--wait", "--wait-timeout", "240"],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=600,
        )
        running = subprocess.run(
            [*base, "ps", "--services", "--status", "running"],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=30,
        )
        inactive = subprocess.run(
            [
                *base,
                "exec",
                "--no-TTY",
                "postgres",
                "psql",
                "--username",
                "hk_admin",
                "--dbname",
                "hk_open_data",
                "--tuples-only",
                "--no-align",
                "--command",
                (
                    "SELECT json_build_object("
                    "'enabled_connectors', (SELECT count(*) FROM connector_definition "
                    "WHERE enabled = true), "
                    "'active_monitors', (SELECT count(*) FROM monitor_target "
                    "WHERE activation_status = 'active'));"
                ),
            ],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=30,
        )
        worker_logs = subprocess.run(
            [*base, "logs", "--no-color", "worker-fabric"],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=30,
        )
    finally:
        subprocess.run(
            [*base, "down", "--volumes", "--remove-orphans"],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=120,
        )

    assert result.returncode == 0, result.stdout + result.stderr + worker_logs.stdout
    running_services = set(running.stdout.splitlines())
    assert "worker-fabric" in running_services
    assert "worker-observe" not in running_services
    assert "object-store" in running_services
    assert inactive.returncode == 0, inactive.stdout + inactive.stderr
    assert json.loads(inactive.stdout) == {
        "enabled_connectors": 0,
        "active_monitors": 0,
    }
    assert '"evidence_mode":"raw"' in worker_logs.stdout
