import { loadAccessRecipeIndex, parseOperatingProfile } from "@hk-open-data/schemas";
import { Pool } from "pg";

import { buildApp } from "./app.js";
import { createOidcTokenVerifier } from "./auth.js";
import { createPostgresRepository } from "./postgres-repository.js";
import { PostgresWebhookStore, WebhookSecretProtector } from "./webhooks/postgres-store.js";
import { deliverDueBatch } from "./webhooks/delivery.js";
import { SafeWebhookSender } from "./webhooks/endpoint.js";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is required`);
  }
  return value;
}

const pool = new Pool({ connectionString: required("DATABASE_URL") });
const deliveryPool = new Pool({ connectionString: required("WEBHOOK_DATABASE_URL") });
const webhookStore = new PostgresWebhookStore(
  pool,
  new WebhookSecretProtector(required("WEBHOOK_SECRET_ENCRYPTION_KEY")),
);
const deliveryStore = new PostgresWebhookStore(
  deliveryPool,
  new WebhookSecretProtector(required("WEBHOOK_SECRET_ENCRYPTION_KEY")),
);
const trustedProxies = (process.env.TRUSTED_PROXY_CIDRS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);
const app = buildApp({
  repository: createPostgresRepository(pool),
  webhookStore,
  verifier: createOidcTokenVerifier({
    issuer: required("OIDC_ISSUER"),
    audience: required("OIDC_AUDIENCE"),
    jwksUrl: required("OIDC_JWKS_URL"),
  }),
  operatingProfile: parseOperatingProfile(process.env.HKOD_PROFILE),
  trustedProxies,
  accessRecipes: loadAccessRecipeIndex().recipes,
});

const webhookSender = new SafeWebhookSender();
const deliveryIntervalMs = Number.parseInt(
  process.env.WEBHOOK_DELIVERY_INTERVAL_MS ?? "5000",
  10,
);
if (!Number.isInteger(deliveryIntervalMs) || deliveryIntervalMs < 1000) {
  throw new Error("WEBHOOK_DELIVERY_INTERVAL_MS must be an integer of at least 1000");
}
let delivering = false;
const deliveryTimer = setInterval(() => {
  if (delivering) return;
  delivering = true;
  void deliverDueBatch(deliveryStore, webhookSender, () => new Date())
    .then((summary) => {
      if (summary.delivered + summary.retried + summary.deadLettered > 0) {
        console.info(JSON.stringify({ event: "webhook.delivery_batch", ...summary }));
      }
    })
    .catch(() => console.error(JSON.stringify({ event: "webhook.delivery_batch_failed" })))
    .finally(() => {
      delivering = false;
    });
}, deliveryIntervalMs);
deliveryTimer.unref();

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
await app.listen({ host: process.env.HOST ?? "127.0.0.1", port });

async function shutdown(): Promise<void> {
  clearInterval(deliveryTimer);
  await app.close();
  await pool.end();
  await deliveryPool.end();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
