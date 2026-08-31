# Optional self-hosted runtime

[繁體中文版](runtime.zh-HK.md)

The P01/P14 runtime is an optional local toolkit for operators who want normalized read access or
API-quality observations. It is not a hosted service, data resale product, upstream authorization,
or legal conclusion. The static catalogue works without Docker and remains the safe default.

## Fail-closed profiles

| Profile | Supported command | Provider traffic | Evidence retained |
| --- | --- | --- | --- |
| `catalogue` | `make runtime-catalogue` | None | None; serves committed catalogue artifacts |
| `observe` | `make runtime-observe` | Possible only after an operator activates a source | SHA-256 digest and derived quality metadata; no response body |
| `fabric` | `make runtime-fabric` | Possible only after source and connector activation | Raw evidence only where the operator has recorded compatible source approval |

Plain `docker compose up` enables only `catalog`. Runtime, database, worker, MCP, admin, telemetry,
and object-store services all have explicit Compose profiles. The `observe` topology has no object
store. The `fabric` worker refuses to start without both raw-evidence opt-in and complete object-store
configuration.

## 1. Run the catalogue safely

```bash
make runtime-catalogue
open http://127.0.0.1:8080/hk-open-data/
```

This path does not read `.env`, contact providers, start PostgreSQL, or start the P01/P14 workers.

## 2. Prepare a runtime environment

Only continue if you intend to operate the runtime and have reviewed the sources you may activate.

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
example identity URLs are deliberately non-functional; configure an operator-owned OIDC provider
before using authenticated administration outside isolated local evaluation.

## 3. Start digest-only observation

```bash
make runtime-observe
```

Local endpoints bind to loopback only:

- API: `http://127.0.0.1:3000`
- read-only MCP: `http://127.0.0.1:3100/mcp`
- public runtime portal: `http://127.0.0.1:4174`
- operator UI: `http://127.0.0.1:4175`
- Prometheus: `http://127.0.0.1:9090`

Starting `observe` opts the worker into provider-capable mode, but all seeded sources, monitor
targets, and connectors remain pending activation. The worker keeps no provider response body: it
stores a `digest://sha256/...` reference plus derived observation metadata. Source activation is a
separate, audited operator action and must not be inferred from a catalogue terms-evidence label.

## 4. Start raw-evidence fabric mode

```bash
make runtime-fabric
```

`fabric` starts a digest-pinned RustFS object store, enables versioning and object lock, blocks
public access, and then starts the raw-evidence worker. The worker still checks the exact source and
connector activation before every job. Retention and legal holds remain the operator's
responsibility; object lock can make deletion intentionally difficult.

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
make verify-integrated    # catalogue and opted-in observe containers; no live source activation
make verify-all           # catalogue, site, runtime, browser, boundary and secret checks
```

Integrated tests use synthetic fixtures declared in `tests/fixtures/connectors/manifest.json`.
They start no approved connector and do not make a live provider request. Local green tests prove
only the checked-out code and test environment. They do not qualify an internet deployment,
approve a source, or establish commercial-use, caching, redistribution, scraping, privacy, or
other legal rights.

## Operating boundaries

- Verify current provider and dataset-specific terms before enabling a source.
- Use a source-specific request rate, retention period, attribution, and purpose.
- Keep the runtime on a private network unless you add real OIDC, TLS, gateway policy, backups,
  monitoring, and an operator-owned security review.
- Treat `termsEvidenceState` as dated research, not permission or legal advice.
- Use the runbooks in `docs/runbooks/` for local incidents, revocation, correction, and restore.
