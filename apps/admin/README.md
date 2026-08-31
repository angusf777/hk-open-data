# Admin application

Responsive operator workspace for source/connector approval evidence, monitor activation,
observability and audited incident operations. The UI never bypasses server gates: writes carry an
expected version and reason, while OIDC/MFA/scope enforcement remains in the API.

```sh
pnpm --filter @hk-open-data/admin dev
pnpm --filter @hk-open-data/admin test
pnpm --filter @hk-open-data/admin build
```

By default the browser uses the same-origin `/v1` gateway. Production must provide the approved
SSO integration and TLS gateway; no browser token is embedded in the bundle.
