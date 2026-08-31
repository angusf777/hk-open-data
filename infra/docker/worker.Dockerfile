FROM ghcr.io/astral-sh/uv:0.8.14 AS uv
FROM python:3.12.11-alpine3.22
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1
WORKDIR /app
RUN apk upgrade --no-cache \
    && addgroup -g 10001 app \
    && adduser -D -u 10001 -G app app
COPY --from=uv /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY --chown=10001:10001 services/worker services/worker
COPY --chown=10001:10001 packages/schemas/contracts/p01-source-groups.csv /contracts/p01-source-groups.csv
COPY --chown=10001:10001 packages/schemas/contracts/p14-monitor-targets.csv /contracts/p14-monitor-targets.csv
ENV PYTHONPATH=/app/services/worker
USER 10001:10001
CMD ["/app/.venv/bin/python", "-m", "hk_data_worker.service"]
