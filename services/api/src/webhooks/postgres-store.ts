import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import type { QueryResultRow } from "pg";

import type { PostgresClient, PostgresPool } from "../postgres.js";
import type {
  CreateSubscriptionInput,
  DeliveryState,
  DeliveryView,
  DueDelivery,
  SubscriptionState,
  WebhookStore,
  WebhookSubscription,
} from "./outbox.js";
import { assertWebhookPayloadSafe } from "./outbox.js";

interface SubscriptionRow extends QueryResultRow {
  subscription_id: string;
  tenant_id: string;
  callback_url: string;
  event_types: string[];
  source_ids: string[];
  secret_reference: string;
  status: SubscriptionState;
  challenge: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface DeliveryRow extends QueryResultRow {
  delivery_attempt_id: string;
  subscription_id: string;
  callback_url: string;
  secret_reference: string;
  event_id: string;
  event_type: string;
  occurred_at: Date | string;
  api_version: string;
  payload_hash: string;
  raw_body: Buffer;
  attempt_number: number;
  status: DeliveryState;
  response_status: number | null;
  next_attempt_at: Date | string | null;
  first_attempt_at: Date | string;
  completed_at: Date | string | null;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function subscription(row: SubscriptionRow): WebhookSubscription {
  return {
    subscriptionId: row.subscription_id,
    tenantId: row.tenant_id,
    endpoint: row.callback_url,
    eventTypes: row.event_types,
    sourceIds: row.source_ids,
    state: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export class WebhookSecretProtector {
  readonly #key: Buffer;

  constructor(base64Key: string) {
    this.#key = Buffer.from(base64Key, "base64");
    if (this.#key.length !== 32) {
      throw new Error("Webhook secret encryption key must decode to exactly 32 bytes");
    }
  }

  protect(secret: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.#key, nonce);
    const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
  }

  reveal(reference: string): string {
    const [version, nonce, tag, ciphertext] = reference.split(".");
    if (version !== "v1" || nonce === undefined || tag === undefined || ciphertext === undefined) {
      throw new Error("Webhook secret reference is invalid");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.#key, Buffer.from(nonce, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
}

export class PostgresWebhookStore implements WebhookStore {
  readonly #pool: PostgresPool;
  readonly #protector: WebhookSecretProtector;

  constructor(pool: PostgresPool, protector: WebhookSecretProtector) {
    this.#pool = pool;
    this.#protector = protector;
  }

  async #withTenant<T>(
    tenantId: string,
    operation: (client: PostgresClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the tenant-scoped operation failure.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<WebhookSubscription> {
    const subscriptionId = `SUB-${randomBytes(12).toString("hex")}`;
    const challenge = randomBytes(24).toString("base64url");
    const result = await this.#withTenant(input.tenantId, (client) => client.query<SubscriptionRow>(
      `INSERT INTO subscription (
         subscription_id, tenant_id, callback_url, event_types, source_ids, secret_reference,
         status, idempotency_key, challenge, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'pending_challenge', $7, $8, $9, $9)
       ON CONFLICT (tenant_id, idempotency_key) DO UPDATE
         SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING *`,
      [
        subscriptionId,
        input.tenantId,
        input.endpoint,
        input.eventTypes,
        input.sourceIds,
        this.#protector.protect(input.secret),
        input.idempotencyKey,
        challenge,
        input.now,
      ],
    ));
    return subscription(result.rows[0]!);
  }

  async getSubscription(subscriptionId: string, tenantId: string): Promise<WebhookSubscription | null> {
    const result = await this.#withTenant(tenantId, (client) => client.query<SubscriptionRow>(
      "SELECT * FROM subscription WHERE subscription_id = $1 AND tenant_id = $2",
      [subscriptionId, tenantId],
    ));
    return result.rows[0] === undefined ? null : subscription(result.rows[0]);
  }

  async listSubscriptions(tenantId: string, limit: number): Promise<WebhookSubscription[]> {
    const result = await this.#withTenant(tenantId, (client) => client.query<SubscriptionRow>(
      "SELECT * FROM subscription WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2",
      [tenantId, limit],
    ));
    return result.rows.map(subscription);
  }

  async listDeliveries(tenantId: string, limit: number): Promise<DeliveryView[]> {
    const result = await this.#withTenant(tenantId, (client) => client.query<DeliveryRow>(
      `SELECT da.*, s.callback_url, s.secret_reference
       FROM delivery_attempt da JOIN subscription s USING (subscription_id)
       WHERE da.tenant_id = $1 ORDER BY da.created_at DESC LIMIT $2`,
      [tenantId, limit],
    ));
    return result.rows.map((row) => this.#deliveryView(row));
  }

  async getPendingChallenge(subscriptionId: string, tenantId: string): Promise<string> {
    const result = await this.#withTenant(tenantId, (client) => client.query<SubscriptionRow>(
      "SELECT * FROM subscription WHERE subscription_id = $1 AND status = 'pending_challenge'",
      [subscriptionId],
    ));
    const challenge = result.rows[0]?.challenge;
    if (challenge === null || challenge === undefined) {
      throw new Error("Pending webhook challenge was not found");
    }
    return challenge;
  }

  async activateSubscription(
    subscriptionId: string,
    tenantId: string,
    challengeResponse: string,
    now: string,
  ): Promise<WebhookSubscription> {
    const result = await this.#withTenant(tenantId, (client) => client.query<SubscriptionRow>(
      `UPDATE subscription SET status = 'active', challenge = NULL, updated_at = $3
       WHERE subscription_id = $1 AND status = 'pending_challenge' AND challenge = $2
       RETURNING *`,
      [subscriptionId, challengeResponse, now],
    ));
    if (result.rows[0] === undefined) {
      throw new Error("Webhook challenge response did not match");
    }
    return subscription(result.rows[0]);
  }

  async enqueue(subscriptionId: string, event: Record<string, unknown>, now: string): Promise<void> {
    assertWebhookPayloadSafe(event);
    const eventId = event["event_id"];
    const eventType = event["event_type"];
    const sourceId = event["source_id"];
    const occurredAt = event["occurred_at"];
    const apiVersion = event["api_version"];
    if (
      typeof eventId !== "string" ||
      typeof eventType !== "string" ||
      typeof occurredAt !== "string" ||
      typeof apiVersion !== "string"
    ) {
      throw new Error("Webhook event requires event_id, event_type, occurred_at and api_version");
    }
    const subscriptions = await this.#pool.query<SubscriptionRow>(
      "SELECT * FROM subscription WHERE subscription_id = $1 AND status = 'active'",
      [subscriptionId],
    );
    const target = subscriptions.rows[0];
    if (target === undefined) {
      throw new Error("Webhook subscription is not active");
    }
    if (!target.event_types.includes(eventType) || (target.source_ids.length > 0 && (typeof sourceId !== "string" || !target.source_ids.includes(sourceId)))) {
      return;
    }
    const rawBody = Buffer.from(JSON.stringify(event), "utf8");
    const deliveryAttemptId = `DEL-${createHash("sha256").update(`${subscriptionId}:${eventId}`).digest("hex").slice(0, 24)}`;
    await this.#pool.query(
      `INSERT INTO delivery_attempt (
         delivery_attempt_id, subscription_id, tenant_id, event_id, event_type, payload_hash,
         raw_body, occurred_at, api_version, attempt_number, status, next_attempt_at,
         first_attempt_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, 'pending', $10, $10, $10, $10)
       ON CONFLICT (delivery_attempt_id) DO NOTHING`,
      [deliveryAttemptId, subscriptionId, target.tenant_id, eventId, eventType, createHash("sha256").update(rawBody).digest("hex"), rawBody, occurredAt, apiVersion, now],
    );
  }

  async enqueueMatching(event: Record<string, unknown>, now: string): Promise<number> {
    const eventType = event["event_type"];
    const sourceId = event["source_id"];
    if (typeof eventType !== "string") {
      throw new Error("Webhook event requires event_type");
    }
    const result = await this.#pool.query<SubscriptionRow>(
      `SELECT * FROM subscription
       WHERE status = 'active' AND $1 = ANY(event_types)
         AND (cardinality(source_ids) = 0 OR $2::text = ANY(source_ids))`,
      [eventType, typeof sourceId === "string" ? sourceId : null],
    );
    await Promise.all(
      result.rows.map((row) => this.enqueue(row.subscription_id, event, now)),
    );
    return result.rows.length;
  }

  async claimDue(now: string, limit: number): Promise<DueDelivery[]> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<DeliveryRow>(
        `SELECT da.*, s.callback_url, s.secret_reference
         FROM delivery_attempt da JOIN subscription s USING (subscription_id)
         WHERE (
           da.status IN ('pending', 'retry') AND COALESCE(da.next_attempt_at, da.created_at) <= $1
         ) OR (
           da.status = 'processing' AND da.updated_at <= $1::timestamptz - interval '2 minutes'
         )
         ORDER BY COALESCE(da.next_attempt_at, da.created_at), da.delivery_attempt_id
         FOR UPDATE OF da SKIP LOCKED LIMIT $2`,
        [now, limit],
      );
      if (result.rows.length > 0) {
        await client.query(
          "UPDATE delivery_attempt SET status = 'processing', updated_at = $2 WHERE delivery_attempt_id = ANY($1::text[])",
          [result.rows.map((row) => row.delivery_attempt_id), now],
        );
      }
      await client.query("COMMIT");
      return result.rows.map((row) => ({
        deliveryAttemptId: row.delivery_attempt_id,
        subscriptionId: row.subscription_id,
        endpoint: row.callback_url,
        secret: this.#protector.reveal(row.secret_reference),
        eventId: row.event_id,
        eventType: row.event_type,
        occurredAt: iso(row.occurred_at),
        apiVersion: row.api_version,
        payloadHash: row.payload_hash,
        rawBody: row.raw_body,
        attemptNumber: row.attempt_number,
        firstAttemptAt: iso(row.first_attempt_at),
      }));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async markDelivered(id: string, responseStatus: number, now: string): Promise<void> {
    await this.#update(id, "delivered", responseStatus, now, now, false);
  }

  async markRetry(id: string, responseStatus: number, nextAttemptAt: string): Promise<void> {
    await this.#update(id, "retry", responseStatus, nextAttemptAt, null, true);
  }

  async markDeadLetter(id: string, responseStatus: number, now: string): Promise<void> {
    await this.#update(id, "dead_letter", responseStatus, now, now, false);
  }

  async #update(id: string, status: DeliveryState, responseStatus: number, nextAttemptAt: string, completedAt: string | null, increment: boolean): Promise<void> {
    const result = await this.#pool.query(
      `UPDATE delivery_attempt SET status = $2, response_status = $3, next_attempt_at = $4,
         completed_at = $5, updated_at = $4,
         attempt_number = attempt_number + CASE WHEN $6::boolean THEN 1 ELSE 0 END
       WHERE delivery_attempt_id = $1`,
      [id, status, responseStatus, nextAttemptAt, completedAt, increment],
    );
    if ((result.rowCount ?? 0) !== 1) {
      throw new Error("Delivery attempt was not found");
    }
  }

  #deliveryView(row: DeliveryRow): DeliveryView {
    return {
      deliveryAttemptId: row.delivery_attempt_id,
      subscriptionId: row.subscription_id,
      endpoint: row.callback_url,
      eventId: row.event_id,
      eventType: row.event_type,
      attemptNumber: row.attempt_number,
      status: row.status,
      nextAttemptAt: row.next_attempt_at === null ? null : iso(row.next_attempt_at),
      firstAttemptAt: iso(row.first_attempt_at),
      completedAt: row.completed_at === null ? null : iso(row.completed_at),
      responseStatus: row.response_status,
    };
  }
}
