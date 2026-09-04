FROM node:26.3.0-alpine3.22 AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY services/mcp/package.json services/mcp/package.json
RUN pnpm install --frozen-lockfile --filter @hk-open-data/mcp...
COPY services/mcp services/mcp
RUN pnpm --filter @hk-open-data/mcp build

FROM node:26.3.0-alpine3.22 AS prod-deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/mcp/package.json services/mcp/package.json
RUN pnpm install --frozen-lockfile --prod --filter @hk-open-data/mcp...

FROM node:26.3.0-alpine3.22
ENV NODE_ENV=production
WORKDIR /app
RUN apk upgrade --no-cache \
    && addgroup -g 10001 app \
    && adduser -D -u 10001 -G app app \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/pnpm /usr/local/bin/pnpx
COPY --from=prod-deps --chown=10001:10001 /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=10001:10001 /app/services/mcp/node_modules /app/services/mcp/node_modules
COPY --from=build --chown=10001:10001 /app/services/mcp/package.json /app/services/mcp/package.json
COPY --from=build --chown=10001:10001 /app/services/mcp/dist /app/services/mcp/dist
USER 10001:10001
EXPOSE 3100
CMD ["node", "services/mcp/dist/http.js"]
