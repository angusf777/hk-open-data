# Self-host the developer toolkit

[繁體中文版](runtime.zh-HK.md)

The optional toolkit lets you normalize data from selected sources or monitor their API health on
infrastructure you control. This project does not run a hosted API or grant permission to use any
listed source. The static catalogue works without Docker and remains the default.

## Choose what to run

The profile names below are command-line settings. All external data connections start switched off.

| Mode | Command | Requests to external providers | What is stored |
| --- | --- | --- | --- |
| Catalogue only (`catalogue`) | `make runtime-catalogue` | None | Nothing; serves files included in the repository |
| API health checks (`observe`) | `make runtime-observe` | Only after you enable an individual source | SHA-256 fingerprint and summary quality measurements; no response content |
| Data access with full-response storage (`fabric`) | `make runtime-fabric` | Only after you enable both the source and its connector | Complete source responses for sources whose terms and storage settings you have reviewed |

Plain `docker compose up` enables only `catalog`. Runtime, database, worker, MCP, admin, telemetry,
and object-store services require an explicit Compose profile. API health check mode has no object
store. Full-response storage will not start until you opt in and provide a complete object-store
configuration.

## 1. Run the catalogue safely

```bash
make runtime-catalogue
open http://127.0.0.1:8080/hk-open-data/
```

This path does not read `.env`, contact external providers, start PostgreSQL, or start the data and
health-check workers.

## 2. Prepare a runtime environment

Only continue if you intend to run the toolkit and have reviewed the sources you may enable.

```bash
cp .env.example .env
python - <<'PY'
import base64, secrets
print("POSTGRES_PASSWORD=" + secrets.token_urlsafe(32))
print("POSTGRES_APP_PASSWORD=" + secrets.token_urlsafe(32))
print("POSTGRES_WEBHOOK_PASSWORD=" + secrets.token_urlsafe(32))
print("WEBHOOK_SECRET_ENCRYPTION_KEY=" + base64.b64encode(secrets.token_bytes(32)).decode())
print("OBJECT_STORE_ACCESS_KEY=" + secrets.token_hex(12))
print("OBJECT_STORE_SECRET_KEY=" + secrets.token_urlsafe(40))
PY
```

Copy the generated values into the ignored `.env`. Do not commit or paste it into an issue. The
example identity URLs are deliberately non-functional; configure your own OIDC provider before
using authenticated administration outside isolated local evaluation.

## 3. Start API health checks

```bash
make runtime-observe
```

Local endpoints bind to loopback only:

- API: `http://127.0.0.1:3000`
- read-only MCP: `http://127.0.0.1:3100/mcp`
- public runtime portal: `http://127.0.0.1:4174`
- administration UI: `http://127.0.0.1:4175`
- Prometheus: `http://127.0.0.1:9090`

Starting `observe` makes health checks available, but every included source, check, and connector
remains disabled. When you enable a source, the worker stores a `digest://sha256/...` fingerprint
plus summary measurements and discards the response content. Enabling a connection is a separate,
logged action; a catalogue terms-review label never enables a source or grants permission to use it.

## 4. Start data access with full-response storage

```bash
make runtime-fabric
```

`fabric` starts a version-pinned RustFS object store, enables versioning and object lock, blocks
public access, and then starts the full-response worker. The worker checks the exact source and
connector settings before every job. You are responsible for choosing an appropriate retention
period and handling any legal hold; object lock can make deletion intentionally difficult.

## Stop and clean up

```bash
make runtime-stop
```

This removes containers and networks but preserves named volumes. To delete runtime databases or
evidence volumes, inspect the exact Compose project first and remove them deliberately; the project
does not automate destructive volume deletion.

## Verification

```bash
make verify-runtime       # unit, contract, types, builds, lint, static security checks
make verify-integrated    # catalogue and API health containers; no live source is enabled
make verify-all           # catalogue, site, runtime, browser, boundary and secret checks
```

Integrated tests use synthetic fixtures declared in `tests/fixtures/connectors/manifest.json`.
They start no source connector and do not make a live provider request. Passing local tests proves
only the checked-out code and test environment. It does not prove an internet deployment is ready
for production, grant permission to use a source, or establish commercial-use, caching,
redistribution, scraping, privacy, or other legal rights.

## Operating boundaries

- Verify current provider and dataset-specific terms before enabling a source.
- Use a source-specific request rate, retention period, attribution, and purpose.
- Keep the toolkit on a private network unless you add real OIDC, TLS, gateway policy, backups,
  monitoring, and a security review for your deployment.
- Treat `termsEvidenceState` as a dated terms review, not permission or legal advice.
- Use the runbooks in `docs/runbooks/` for local incidents, revocation, correction, and restore.
