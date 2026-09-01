# Narrow security risk acceptances

This file records release-scan findings that cannot be remediated without breaking required
behaviour. It is not a general allowlist. Each entry is path-scoped and expires for reassessment.

## AVD-DS-0002 — PostGIS bootstrap user

- **Scope:** `infra/docker/postgres.Dockerfile` only
- **Accepted until:** 2027-08-31
- **Observed control:** The official PostGIS entrypoint initially runs as root to initialize and set
  ownership on a fresh database volume, then executes PostgreSQL under the unprivileged `postgres`
  account.
- **Reason:** Adding a non-root `USER` directive prevents correct clean-volume initialization on the
  supported Compose path.
- **Compensating controls:** No public database port; internal data network; least-privileged
  application and webhook roles; no broad host mount; pinned base image; runtime container and image
  vulnerability scans.
- **Reassessment:** Recheck whether the original image offers a supported rootless initialization
  path before the expiry date.

This acceptance does not qualify a deployment or waive an operator's responsibility to secure the
host, volumes, secrets, backups, and network.
