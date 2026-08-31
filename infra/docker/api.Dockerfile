FROM node:22.22.0-alpine3.22 AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/schemas/package.json packages/schemas/package.json
COPY services/api/package.json services/api/package.json
RUN pnpm install --frozen-lockfile --filter @hk-open-data/api... --filter @hk-open-data/schemas...
COPY packages/schemas packages/schemas
COPY services/api services/api
COPY catalog/generated catalog/generated
RUN pnpm --filter @hk-open-data/schemas build && pnpm --filter @hk-open-data/api build

FROM node:22.22.0-alpine3.22 AS prod-deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/schemas/package.json packages/schemas/package.json
COPY services/api/package.json services/api/package.json
RUN pnpm install --frozen-lockfile --prod --filter @hk-open-data/api... --filter @hk-open-data/schemas...

FROM node:22.22.0-alpine3.22
ENV NODE_ENV=production
WORKDIR /app
RUN apk upgrade --no-cache \
    && addgroup -g 10001 app \
    && adduser -D -u 10001 -G app app \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/pnpm /usr/local/bin/pnpx
COPY --from=prod-deps --chown=10001:10001 /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=10001:10001 /app/services/api/node_modules /app/services/api/node_modules
COPY --from=prod-deps --chown=10001:10001 /app/packages/schemas/node_modules /app/packages/schemas/node_modules
COPY --from=build --chown=10001:10001 /app/services/api/package.json /app/services/api/package.json
COPY --from=build --chown=10001:10001 /app/services/api/dist /app/services/api/dist
COPY --from=build --chown=10001:10001 /app/services/api/migrations /app/services/api/migrations
COPY --from=build --chown=10001:10001 /app/packages/schemas/package.json /app/packages/schemas/package.json
COPY --from=build --chown=10001:10001 /app/packages/schemas/dist /app/packages/schemas/dist
COPY --from=build --chown=10001:10001 /app/packages/schemas/contracts /app/packages/schemas/contracts
COPY --from=build --chown=10001:10001 /app/catalog/generated /app/catalog/generated
USER 10001:10001
EXPOSE 3000
CMD ["node", "services/api/dist/server.js"]
