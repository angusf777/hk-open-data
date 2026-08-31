# Worker service

Python worker for approval-gated P01 connectors and P14 monitor jobs. PostgreSQL leases use
`FOR UPDATE SKIP LOCKED`; each claim first reconciles approval/activation expiry. Successful
provider bytes are content-addressed and stored before parsing. Quarantined runs publish no
canonical output.

The shared fetch runtime allows only HTTPS registry hosts, revalidates redirects and DNS answers,
caps compressed/expanded bodies, bounds timeouts and retries only eligible transient failures.
Monitor jobs reuse qualifying recent connector evidence and fetch independently only when needed.

```sh
uv run pytest tests/contract tests/integration tests/security -q
uv run mypy services/worker
uv run ruff check services/worker
```

The integrated runtime requires `DATABASE_URL`, `SOURCE_GROUPS_PATH`, `MONITOR_TARGETS_PATH`,
`OBJECT_STORE_ENDPOINT`, `OBJECT_STORE_BUCKET`, `OBJECT_STORE_ACCESS_KEY` and
`OBJECT_STORE_SECRET_KEY`. Docker Compose supplies these and a dedicated provider-egress network.
