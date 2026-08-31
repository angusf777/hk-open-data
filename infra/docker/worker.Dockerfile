FROM ghcr.io/astral-sh/uv:0.8.14 AS uv
FROM python:3.12.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1
WORKDIR /app
RUN apt-get update \
    && apt-get upgrade --yes \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home app
COPY --from=uv /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY --chown=10001:10001 services/worker services/worker
COPY --chown=10001:10001 packages/schemas/contracts/p01-source-groups.csv /contracts/p01-source-groups.csv
COPY --chown=10001:10001 packages/schemas/contracts/p14-monitor-targets.csv /contracts/p14-monitor-targets.csv
ENV PYTHONPATH=/app/services/worker
USER 10001:10001
CMD ["/app/.venv/bin/python", "-m", "hk_data_worker.service"]
