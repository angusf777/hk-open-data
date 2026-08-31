# Docker infrastructure

The Compose topology includes PostgreSQL/PostGIS, a versioned/object-locked RustFS local S3 test store, migrations, API,
worker, MCP, admin, portal, OpenTelemetry Collector and Prometheus. Application containers run as
non-root with read-only roots, dropped capabilities, bounded CPU/memory/PIDs and health checks.

The worker alone joins the `egress` network for approved provider calls; the safe-fetch runtime
enforces registry host allowlists. `data` and `telemetry` remain internal networks. Internet-facing
self-hosted deployments should add network-level egress controls and an external secret manager.

Do not mount broad host paths or place real secrets in Compose, image layers or `.env.example`.
