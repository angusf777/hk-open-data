import { describe, expect, it } from "vitest";

import { deliverDueBatch, performWebhookChallenge } from "./delivery.js";
import { MemoryWebhookStore } from "./outbox.js";
import { signWebhook } from "./signature.js";

const now = new Date("2026-08-28T10:00:00.000Z");

describe("webhook delivery", () => {
  it("matches the pinned HMAC vector over timestamp and raw bytes", () => {
    expect(signWebhook("secret", "1787911200", Buffer.from('{"event_id":"EV-1"}'))).toBe(
      "v1=45f46ec1c15d00a4645355b2858172bec82e32f53506b9f92c769282a514c7b6",
    );
  });

  it("activates only after the endpoint echoes the challenge", async () => {
    const store = new MemoryWebhookStore();
    const pending = await store.createSubscription({
      tenantId: "tenant-1",
      endpoint: "https://customer.example/webhook",
      eventTypes: ["source.changed"],
      sourceIds: [],
      idempotencyKey: "0123456789abcdef",
      secret: "delivery-secret",
      now: now.toISOString(),
    });

    expect(pending.state).toBe("pending_challenge");
    await expect(store.activateSubscription(pending.subscriptionId, pending.tenantId, "wrong", now.toISOString()))
      .rejects.toThrow(/challenge/i);
    const challenge = await store.getPendingChallenge(pending.subscriptionId, pending.tenantId);
    const active = await store.activateSubscription(
      pending.subscriptionId,
      pending.tenantId,
      challenge,
      now.toISOString(),
    );
    expect(active.state).toBe("active");
  });

  it("performs the endpoint challenge before activation", async () => {
    const store = new MemoryWebhookStore();
    const pending = await store.createSubscription({
      tenantId: "tenant-1",
      endpoint: "https://customer.example/webhook",
      eventTypes: ["source.changed"],
      sourceIds: [],
      idempotencyKey: "0123456789abcdea",
      secret: "delivery-secret",
      now: now.toISOString(),
    });
    const active = await performWebhookChallenge(
      store,
      {
        async send(request) {
          const challenge = request.headers["x-hk-webhook-challenge"];
          return { status: 200, body: Buffer.from(JSON.stringify({ challenge })) };
        },
      },
      pending,
      now.toISOString(),
    );
    expect(active.state).toBe("active");
  });

  it("deduplicates events and signs the exact delivered bytes", async () => {
    const store = new MemoryWebhookStore();
    const subscription = await store.createActiveFixture({
      endpoint: "https://customer.example/webhook",
      secret: "delivery-secret",
      now: now.toISOString(),
    });
    const event = { event_id: "EV-00000001", event_type: "source.changed", occurred_at: now.toISOString(), api_version: "v1", value: "中環" };
    await store.enqueue(subscription.subscriptionId, event, now.toISOString());
    await store.enqueue(subscription.subscriptionId, event, now.toISOString());
    const sent: Array<{ body: Uint8Array; headers: Record<string, string> }> = [];

    const summary = await deliverDueBatch(
      store,
      {
        async send(request) {
          sent.push({ body: request.body, headers: request.headers });
          return { status: 204 };
        },
      },
      () => now,
    );

    expect(summary).toEqual({ delivered: 1, retried: 0, deadLettered: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.headers["x-hk-signature"]).toBe(
      signWebhook("delivery-secret", sent[0]!.headers["x-hk-timestamp"]!, sent[0]!.body),
    );
    expect(sent[0]?.headers).toMatchObject({
      "x-hk-occurred-at": now.toISOString(),
      "x-hk-api-version": "v1",
      "x-hk-payload-sha256": expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("retries retryable failures and dead-letters after 24 hours", async () => {
    const store = new MemoryWebhookStore();
    const subscription = await store.createActiveFixture({
      endpoint: "https://customer.example/webhook",
      secret: "delivery-secret",
      now: now.toISOString(),
    });
    await store.enqueue(
      subscription.subscriptionId,
      { event_id: "EV-00000002", event_type: "source.changed", occurred_at: now.toISOString(), api_version: "v1" },
      now.toISOString(),
    );
    const first = await deliverDueBatch(store, { async send() { return { status: 500 }; } }, () => now);
    await store.forceDue(now.toISOString());
    const expired = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 1);
    const second = await deliverDueBatch(store, { async send() { return { status: 500 }; } }, () => expired);

    expect(first.retried).toBe(1);
    expect(second.deadLettered).toBe(1);
  });

  it("rejects seeded secret-bearing fields before a webhook body is stored", async () => {
    const store = new MemoryWebhookStore();
    const subscription = await store.createActiveFixture({
      endpoint: "https://customer.example/webhook",
      secret: "delivery-secret",
      now: now.toISOString(),
    });

    await expect(store.enqueue(
      subscription.subscriptionId,
      {
        event_id: "EV-00000003",
        event_type: "source.changed",
        occurred_at: now.toISOString(),
        api_version: "v1",
        metadata: { access_token: "DLP-SEED-MUST-NOT-LEAVE" },
      },
      now.toISOString(),
    )).rejects.toThrow(/sensitive field/i);
  });
});
