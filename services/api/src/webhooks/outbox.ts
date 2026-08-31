import { createHash, randomBytes } from "node:crypto";

export type SubscriptionState = "pending_challenge" | "active" | "suspended" | "revoked";
export type DeliveryState = "pending" | "processing" | "retry" | "delivered" | "dead_letter";

export interface WebhookSubscription {
  subscriptionId: string;
  tenantId: string;
  endpoint: string;
  eventTypes: string[];
  sourceIds: string[];
  state: SubscriptionState;
  createdAt: string;
  updatedAt: string;
}

interface StoredSubscription extends WebhookSubscription {
  idempotencyKey: string;
  secret: string;
  challenge: string;
}

export interface CreateSubscriptionInput {
  tenantId: string;
  endpoint: string;
  eventTypes: string[];
  sourceIds: string[];
  idempotencyKey: string;
  secret: string;
  now: string;
}

export interface DueDelivery {
  deliveryAttemptId: string;
  subscriptionId: string;
  endpoint: string;
  secret: string;
  eventId: string;
  eventType: string;
  occurredAt: string;
  apiVersion: string;
  payloadHash: string;
  rawBody: Uint8Array;
  attemptNumber: number;
  firstAttemptAt: string;
}

export interface DeliveryView {
  deliveryAttemptId: string;
  subscriptionId: string;
  endpoint: string;
  eventId: string;
  eventType: string;
  attemptNumber: number;
  status: DeliveryState;
  nextAttemptAt: string | null;
  firstAttemptAt: string;
  completedAt: string | null;
  responseStatus: number | null;
}

interface StoredDelivery extends DueDelivery {
  status: DeliveryState;
  nextAttemptAt: string;
  completedAt: string | null;
  responseStatus: number | null;
}

export interface WebhookStore {
  createSubscription(input: CreateSubscriptionInput): Promise<WebhookSubscription>;
  getSubscription(subscriptionId: string, tenantId: string): Promise<WebhookSubscription | null>;
  listSubscriptions(tenantId: string, limit: number): Promise<WebhookSubscription[]>;
  listDeliveries(tenantId: string, limit: number): Promise<DeliveryView[]>;
  getPendingChallenge(subscriptionId: string, tenantId: string): Promise<string>;
  activateSubscription(
    subscriptionId: string,
    tenantId: string,
    challengeResponse: string,
    now: string,
  ): Promise<WebhookSubscription>;
  enqueue(subscriptionId: string, event: Record<string, unknown>, now: string): Promise<void>;
  enqueueMatching(event: Record<string, unknown>, now: string): Promise<number>;
  claimDue(now: string, limit: number): Promise<DueDelivery[]>;
  markDelivered(deliveryAttemptId: string, responseStatus: number, now: string): Promise<void>;
  markRetry(
    deliveryAttemptId: string,
    responseStatus: number,
    nextAttemptAt: string,
  ): Promise<void>;
  markDeadLetter(deliveryAttemptId: string, responseStatus: number, now: string): Promise<void>;
}

const sensitiveWebhookKey = /(?:^|_)(?:authorization|cookie|password|secret|token|raw_body|raw_payload|raw_storage_uri)(?:$|_)/i;

export function assertWebhookPayloadSafe(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertWebhookPayloadSafe);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (sensitiveWebhookKey.test(key)) {
      throw new Error("Webhook payload contains a prohibited sensitive field");
    }
    assertWebhookPayloadSafe(child);
  }
}

function publicSubscription(value: StoredSubscription): WebhookSubscription {
  const { idempotencyKey: _idempotencyKey, secret: _secret, challenge: _challenge, ...result } = value;
  return structuredClone(result);
}

export class MemoryWebhookStore implements WebhookStore {
  readonly #subscriptions = new Map<string, StoredSubscription>();
  readonly #idempotency = new Map<string, string>();
  readonly #deliveries = new Map<string, StoredDelivery>();

  async createSubscription(input: CreateSubscriptionInput): Promise<WebhookSubscription> {
    const idempotencyIdentity = `${input.tenantId}:${input.idempotencyKey}`;
    const existingId = this.#idempotency.get(idempotencyIdentity);
    if (existingId !== undefined) {
      return publicSubscription(this.#subscriptions.get(existingId)!);
    }
    const subscriptionId = `SUB-${String(this.#subscriptions.size + 1).padStart(8, "0")}`;
    const subscription: StoredSubscription = {
      subscriptionId,
      tenantId: input.tenantId,
      endpoint: input.endpoint,
      eventTypes: [...input.eventTypes],
      sourceIds: [...input.sourceIds],
      state: "pending_challenge",
      idempotencyKey: input.idempotencyKey,
      secret: input.secret,
      challenge: randomBytes(24).toString("base64url"),
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.#subscriptions.set(subscriptionId, subscription);
    this.#idempotency.set(idempotencyIdentity, subscriptionId);
    return publicSubscription(subscription);
  }

  async getSubscription(
    subscriptionId: string,
    tenantId: string,
  ): Promise<WebhookSubscription | null> {
    const subscription = this.#subscriptions.get(subscriptionId);
    return subscription === undefined || subscription.tenantId !== tenantId
      ? null
      : publicSubscription(subscription);
  }

  async listSubscriptions(tenantId: string, limit: number): Promise<WebhookSubscription[]> {
    return [...this.#subscriptions.values()]
      .filter((subscription) => subscription.tenantId === tenantId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map(publicSubscription);
  }

  async listDeliveries(tenantId: string, limit: number): Promise<DeliveryView[]> {
    return [...this.#deliveries.values()]
      .filter(
        (delivery) => this.#subscriptions.get(delivery.subscriptionId)?.tenantId === tenantId,
      )
      .sort((left, right) => right.firstAttemptAt.localeCompare(left.firstAttemptAt))
      .slice(0, limit)
      .map((delivery) => ({
        deliveryAttemptId: delivery.deliveryAttemptId,
        subscriptionId: delivery.subscriptionId,
        endpoint: delivery.endpoint,
        eventId: delivery.eventId,
        eventType: delivery.eventType,
        attemptNumber: delivery.attemptNumber,
        status: delivery.status,
        nextAttemptAt: delivery.nextAttemptAt,
        firstAttemptAt: delivery.firstAttemptAt,
        completedAt: delivery.completedAt,
        responseStatus: delivery.responseStatus,
      }));
  }

  async getPendingChallenge(subscriptionId: string, tenantId: string): Promise<string> {
    const subscription = this.#subscriptions.get(subscriptionId);
    if (
      subscription === undefined ||
      subscription.tenantId !== tenantId ||
      subscription.state !== "pending_challenge"
    ) {
      throw new Error("Pending webhook challenge was not found");
    }
    return subscription.challenge;
  }

  async activateSubscription(
    subscriptionId: string,
    tenantId: string,
    challengeResponse: string,
    now: string,
  ): Promise<WebhookSubscription> {
    const subscription = this.#subscriptions.get(subscriptionId);
    if (
      subscription === undefined ||
      subscription.tenantId !== tenantId ||
      subscription.state !== "pending_challenge" ||
      challengeResponse !== subscription.challenge
    ) {
      throw new Error("Webhook challenge response did not match");
    }
    const active: StoredSubscription = { ...subscription, state: "active", updatedAt: now };
    this.#subscriptions.set(subscriptionId, active);
    return publicSubscription(active);
  }

  async createActiveFixture(input: {
    endpoint: string;
    secret: string;
    now: string;
  }): Promise<WebhookSubscription> {
    const pending = await this.createSubscription({
      tenantId: "fixture-tenant",
      endpoint: input.endpoint,
      eventTypes: ["source.changed"],
      sourceIds: [],
      idempotencyKey: randomBytes(16).toString("hex"),
      secret: input.secret,
      now: input.now,
    });
    return this.activateSubscription(
      pending.subscriptionId,
      pending.tenantId,
      await this.getPendingChallenge(pending.subscriptionId, pending.tenantId),
      input.now,
    );
  }

  async enqueue(
    subscriptionId: string,
    event: Record<string, unknown>,
    now: string,
  ): Promise<void> {
    assertWebhookPayloadSafe(event);
    const subscription = this.#subscriptions.get(subscriptionId);
    if (subscription === undefined || subscription.state !== "active") {
      throw new Error("Webhook subscription is not active");
    }
    const eventId = event["event_id"];
    const eventType = event["event_type"];
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
    const deliveryAttemptId = `DEL-${createHash("sha256").update(`${subscriptionId}:${eventId}`).digest("hex").slice(0, 24)}`;
    if (this.#deliveries.has(deliveryAttemptId)) {
      return;
    }
    const rawBody = Buffer.from(JSON.stringify(event), "utf8");
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    this.#deliveries.set(deliveryAttemptId, {
      deliveryAttemptId,
      subscriptionId,
      endpoint: subscription.endpoint,
      secret: subscription.secret,
      eventId,
      eventType,
      occurredAt,
      apiVersion,
      payloadHash,
      rawBody,
      attemptNumber: 1,
      firstAttemptAt: now,
      status: "pending",
      nextAttemptAt: now,
      completedAt: null,
      responseStatus: null,
    });
  }

  async enqueueMatching(event: Record<string, unknown>, now: string): Promise<number> {
    const eventType = event["event_type"];
    const sourceId = event["source_id"];
    if (typeof eventType !== "string") {
      throw new Error("Webhook event requires event_type");
    }
    const subscriptions = [...this.#subscriptions.values()].filter(
      (subscription) =>
        subscription.state === "active" &&
        subscription.eventTypes.includes(eventType) &&
        (subscription.sourceIds.length === 0 ||
          (typeof sourceId === "string" && subscription.sourceIds.includes(sourceId))),
    );
    await Promise.all(
      subscriptions.map((subscription) =>
        this.enqueue(subscription.subscriptionId, event, now),
      ),
    );
    return subscriptions.length;
  }

  async claimDue(now: string, limit: number): Promise<DueDelivery[]> {
    return [...this.#deliveries.values()]
      .filter(
        (delivery) =>
          (delivery.status === "pending" || delivery.status === "retry") &&
          delivery.nextAttemptAt <= now,
      )
      .sort((left, right) => left.nextAttemptAt.localeCompare(right.nextAttemptAt))
      .slice(0, limit)
      .map((delivery) => structuredClone(delivery));
  }

  async markDelivered(
    deliveryAttemptId: string,
    responseStatus: number,
    now: string,
  ): Promise<void> {
    this.#update(deliveryAttemptId, {
      status: "delivered",
      responseStatus,
      completedAt: now,
    });
  }

  async markRetry(
    deliveryAttemptId: string,
    responseStatus: number,
    nextAttemptAt: string,
  ): Promise<void> {
    const current = this.#deliveries.get(deliveryAttemptId);
    if (current === undefined) {
      throw new Error("Delivery attempt was not found");
    }
    this.#update(deliveryAttemptId, {
      status: "retry",
      responseStatus,
      nextAttemptAt,
      attemptNumber: current.attemptNumber + 1,
    });
  }

  async markDeadLetter(
    deliveryAttemptId: string,
    responseStatus: number,
    now: string,
  ): Promise<void> {
    this.#update(deliveryAttemptId, {
      status: "dead_letter",
      responseStatus,
      completedAt: now,
    });
  }

  async forceDue(now: string): Promise<void> {
    for (const [id, delivery] of this.#deliveries) {
      if (delivery.status === "retry") {
        this.#deliveries.set(id, { ...delivery, nextAttemptAt: now });
      }
    }
  }

  #update(deliveryAttemptId: string, update: Partial<StoredDelivery>): void {
    const delivery = this.#deliveries.get(deliveryAttemptId);
    if (delivery === undefined) {
      throw new Error("Delivery attempt was not found");
    }
    this.#deliveries.set(deliveryAttemptId, { ...delivery, ...update });
  }
}
