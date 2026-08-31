import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { TokenVerifier } from "./auth.js";
import { MemoryPlatformRepository } from "./memory-repository.js";
import { MemoryWebhookStore } from "./webhooks/outbox.js";

const verifier: TokenVerifier = {
  async verify(token) {
    return {
      subject: token,
      tenantId: "tenant-1",
      scopes: new Set(token === "writer" ? ["webhooks:manage"] : []),
      mfa: false,
    };
  },
};

describe("webhook subscription route", () => {
  it("requires scope and a valid idempotency key", async () => {
    const app = buildApp({
      repository: new MemoryPlatformRepository(),
      webhookStore: new MemoryWebhookStore(),
      webhookEndpointValidator: async () => undefined,
      verifier,
    });
    const forbidden = await app.inject({
      method: "POST",
      url: "/v1/webhook-subscriptions",
      headers: { authorization: "Bearer viewer", "idempotency-key": "0123456789abcdef" },
      payload: { endpoint: "https://customer.example/webhook", event_types: ["source.changed"] },
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/v1/webhook-subscriptions",
      headers: { authorization: "Bearer writer", "idempotency-key": "short" },
      payload: { endpoint: "https://customer.example/webhook", event_types: ["source.changed"] },
    });

    expect(forbidden.statusCode).toBe(403);
    expect(invalid.statusCode).toBe(400);
  });

  it("returns the same pending subscription for an idempotent replay", async () => {
    const store = new MemoryWebhookStore();
    const app = buildApp({
      repository: new MemoryPlatformRepository(),
      webhookStore: store,
      webhookEndpointValidator: async () => undefined,
      webhookSender: {
        async send(request) {
          const challenge = request.headers["x-hk-webhook-challenge"];
          return { status: 200, body: Buffer.from(JSON.stringify({ challenge })) };
        },
      },
      verifier,
      clock: () => new Date("2026-08-28T10:00:00.000Z"),
    });
    const input = {
      method: "POST" as const,
      url: "/v1/webhook-subscriptions",
      headers: { authorization: "Bearer writer", "idempotency-key": "0123456789abcdef" },
      payload: { endpoint: "https://customer.example/webhook", event_types: ["source.changed"] },
    };
    const first = await app.inject(input);
    const second = await app.inject(input);

    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ state: "pending_challenge" });
    expect(second.json().subscription_id).toBe(first.json().subscription_id);

    const verified = await app.inject({
      method: "POST",
      url: `/v1/webhook-subscriptions/${first.json().subscription_id}/verify`,
      headers: { authorization: "Bearer writer" },
    });
    const listed = await app.inject({
      method: "GET",
      url: "/v1/webhook-subscriptions",
      headers: { authorization: "Bearer writer" },
    });
    expect(verified.statusCode).toBe(200);
    expect(verified.json()).toMatchObject({ state: "active" });
    expect(listed.json().items).toHaveLength(1);
  });
});
