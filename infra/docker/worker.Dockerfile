FROM ghcr.io/astral-sh/uv:0.12.9 AS uv
FROM python:3.14.5-alpine3.22
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1
WORKDIR /app
RUN apk upgrade --no-cache \
    && addgroup -g 10001 app \
    && adduser -D -u 10001 -G app app
COPY --from=uv /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
COPY services/worker/pyproject.toml services/worker/pyproject.toml
COPY packages/sdk-python/pyproject.toml packages/sdk-python/pyproject.toml
RUN uv sync --frozen --no-dev --package hk-data-worker --no-install-package hk-data-worker
COPY --chown=10001:10001 services/worker services/worker
COPY --chown=10001:10001 access/recipes access/recipes
COPY --chown=10001:10001 access/schemas access/schemas
COPY --chown=10001:10001 packages/schemas/contracts/p01-source-groups.csv /contracts/p01-source-groups.csv
COPY --chown=10001:10001 packages/schemas/contracts/p14-monitor-targets.csv /contracts/p14-monitor-targets.csv
ENV PYTHONPATH=/app/services/worker
USER 10001:10001
CMD ["/app/.venv/bin/python", "-m", "hk_data_worker.service"]
