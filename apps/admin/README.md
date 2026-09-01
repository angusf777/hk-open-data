# Admin application

Responsive administration workspace for reviewing sources, enabling connectors and health checks,
monitoring incidents, and viewing the audit history. The UI never bypasses server safeguards:
writes carry an expected version and reason, while OIDC/MFA/scope enforcement remains in the API.

```sh
pnpm --filter @hk-open-data/admin dev
pnpm --filter @hk-open-data/admin test
pnpm --filter @hk-open-data/admin build
```

By default the browser uses the same-origin `/v1` gateway. Production must provide the approved
SSO integration and TLS gateway; no browser token is embedded in the bundle.
