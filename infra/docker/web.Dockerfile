FROM node:26.3.0-alpine3.22 AS build
ARG APP
ARG API_BASE_URL=/v1
ARG HKOD_PROFILE=catalogue
ENV VITE_API_BASE_URL=$API_BASE_URL
ENV VITE_HKOD_PROFILE=$HKOD_PROFILE
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ui/package.json packages/ui/package.json
COPY packages/sdk-typescript/package.json packages/sdk-typescript/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/portal/package.json apps/portal/package.json
RUN pnpm install --frozen-lockfile --filter "@hk-open-data/${APP}..."
COPY packages/ui packages/ui
COPY packages/sdk-typescript packages/sdk-typescript
COPY apps apps
RUN pnpm --filter "@hk-open-data/${APP}..." build && cp -R "apps/${APP}/dist" /site

FROM nginxinc/nginx-unprivileged:1.27.4-alpine
USER root
RUN apk upgrade --no-cache
COPY infra/docker/web.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site /usr/share/nginx/html
USER 101:101
EXPOSE 8080
