import { randomBytes } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { HttpError } from "../errors.js";
import { performWebhookChallenge, type WebhookSender } from "../webhooks/delivery.js";
import type { WebhookStore } from "../webhooks/outbox.js";
import type { RouteContext } from "./context.js";

const inputSchema = z.object({
  endpoint: z.url().refine((value) => value.startsWith("https://"), "endpoint must use HTTPS"),
  event_types: z.array(z.string().min(1)).min(1),
  source_ids: z.array(z.string().min(1)).optional(),
});

export function registerWebhookRoutes(
  app: FastifyInstance,
  context: RouteContext,
  store: WebhookStore,
  validateEndpoint: (endpoint: string) => Promise<void>,
  sender: WebhookSender,
): void {
  app.get("/v1/webhook-subscriptions", async (request) => {
    const principal = await context.authenticate(
      request.headers.authorization,
      ["webhooks:manage"],
      false,
    );
    if (principal === null || principal.tenantId === null) {
      throw new HttpError(403, "FORBIDDEN", "Webhook subscriptions require a tenant identity");
    }
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(request.query);
    const items = await store.listSubscriptions(principal.tenantId, query.limit);
    return { items: items.map((item) => ({
      subscription_id: item.subscriptionId,
      state: item.state,
      endpoint: item.endpoint,
      event_types: item.eventTypes,
      source_ids: item.sourceIds,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    })) };
  });

  app.get("/v1/webhook-deliveries", async (request) => {
    const principal = await context.authenticate(
      request.headers.authorization,
      ["webhooks:manage"],
      false,
    );
    if (principal === null || principal.tenantId === null) {
      throw new HttpError(403, "FORBIDDEN", "Webhook deliveries require a tenant identity");
    }
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(request.query);
    const items = await store.listDeliveries(principal.tenantId, query.limit);
    return { items: items.map((item) => ({
      delivery_attempt_id: item.deliveryAttemptId,
      subscription_id: item.subscriptionId,
      endpoint: item.endpoint,
      event_id: item.eventId,
      event_type: item.eventType,
      attempt_number: item.attemptNumber,
      status: item.status,
      next_attempt_at: item.nextAttemptAt,
      first_attempt_at: item.firstAttemptAt,
      completed_at: item.completedAt,
      response_status: item.responseStatus,
    })) };
  });

  app.post("/v1/webhook-subscriptions", async (request, reply) => {
    const principal = await context.authenticate(
      request.headers.authorization,
      ["webhooks:manage"],
      false,
    );
    if (principal === null || principal.tenantId === null) {
      throw new HttpError(403, "FORBIDDEN", "Webhook subscriptions require a tenant identity");
    }
    const idempotencyKey = z
      .string()
      .min(16)
      .max(128)
      .parse(request.headers["idempotency-key"]);
    const body = inputSchema.parse(request.body);
    try {
      await validateEndpoint(body.endpoint);
    } catch {
      throw new HttpError(
        400,
        "INVALID_REQUEST",
        "Webhook endpoint must resolve to a public HTTPS address",
      );
    }
    const subscription = await store.createSubscription({
      tenantId: principal.tenantId,
      endpoint: body.endpoint,
      eventTypes: body.event_types,
      sourceIds: body.source_ids ?? [],
      idempotencyKey,
      secret: randomBytes(32).toString("base64url"),
      now: context.clock().toISOString(),
    });
    return reply.status(201).send({
      subscription_id: subscription.subscriptionId,
      state: subscription.state,
      endpoint: subscription.endpoint,
      event_types: subscription.eventTypes,
    });
  });

  app.post("/v1/webhook-subscriptions/:subscription_id/verify", async (request) => {
    const principal = await context.authenticate(
      request.headers.authorization,
      ["webhooks:manage"],
      false,
    );
    if (principal === null || principal.tenantId === null) {
      throw new HttpError(403, "FORBIDDEN", "Webhook subscriptions require a tenant identity");
    }
    const params = z.object({ subscription_id: z.string().min(1).max(128) }).parse(request.params);
    const subscription = await store.getSubscription(params.subscription_id, principal.tenantId);
    if (subscription === null) {
      throw new HttpError(404, "NOT_FOUND", "Webhook subscription was not found");
    }
    const active = await performWebhookChallenge(
      store,
      sender,
      subscription,
      context.clock().toISOString(),
    );
    return {
      subscription_id: active.subscriptionId,
      state: active.state,
      endpoint: active.endpoint,
      event_types: active.eventTypes,
    };
  });
}
