FROM ghcr.io/astral-sh/uv:0.12.9 AS uv
FROM node:22.22.0-alpine3.22 AS build
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache python3
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY --from=uv /uv /uvx /bin/
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json pyproject.toml uv.lock ./
COPY apps/catalog/package.json apps/catalog/package.json
RUN pnpm install --frozen-lockfile --filter @hk-open-data/catalog...
RUN uv sync --frozen
COPY apps/catalog apps/catalog
COPY catalog catalog
COPY access/generated access/generated
COPY access/verification/data-gov-resources/manifest.json access/verification/data-gov-resources/manifest.json
COPY packages/schemas/contracts packages/schemas/contracts
COPY scripts/catalog.py scripts/catalog.py
COPY scripts/export_snapshots.py scripts/export_snapshots.py
COPY llms.txt llms.txt
RUN pnpm --filter @hk-open-data/catalog build && cp -R apps/catalog/dist /site

FROM nginxinc/nginx-unprivileged:1.31.5-alpine
USER root
RUN apk upgrade --no-cache
COPY infra/docker/catalog.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site /usr/share/nginx/html/hk-open-data
USER 101:101
EXPOSE 8080
