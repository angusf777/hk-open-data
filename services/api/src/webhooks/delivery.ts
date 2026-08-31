import type { DueDelivery, WebhookStore, WebhookSubscription } from "./outbox.js";
import { signWebhook } from "./signature.js";

export interface WebhookSender {
  send(request: {
    endpoint: string;
    headers: Record<string, string>;
    body: Uint8Array;
  }): Promise<{ status: number; body?: Uint8Array }>;
}

export interface DeliverySummary {
  delivered: number;
  retried: number;
  deadLettered: number;
}

function retryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function nextAttempt(delivery: DueDelivery, now: Date): string {
  const delaySeconds = Math.min(3_600, 2 ** Math.min(delivery.attemptNumber, 11));
  return new Date(now.getTime() + delaySeconds * 1_000).toISOString();
}

export async function deliverDueBatch(
  store: WebhookStore,
  sender: WebhookSender,
  clock: () => Date,
  limit = 100,
): Promise<DeliverySummary> {
  const now = clock();
  const due = await store.claimDue(now.toISOString(), limit);
  const summary: DeliverySummary = { delivered: 0, retried: 0, deadLettered: 0 };
  for (const delivery of due) {
    const timestamp = String(Math.floor(now.getTime() / 1_000));
    let response: { status: number; body?: Uint8Array };
    try {
      response = await sender.send({
        endpoint: delivery.endpoint,
        headers: {
          "content-type": "application/json",
          "x-hk-event-id": delivery.eventId,
          "x-hk-event-type": delivery.eventType,
          "x-hk-occurred-at": delivery.occurredAt,
          "x-hk-api-version": delivery.apiVersion,
          "x-hk-payload-sha256": delivery.payloadHash,
          "x-hk-timestamp": timestamp,
          "x-hk-signature": signWebhook(delivery.secret, timestamp, delivery.rawBody),
        },
        body: delivery.rawBody,
      });
    } catch {
      response = { status: 599 };
    }
    if (response.status >= 200 && response.status < 300) {
      await store.markDelivered(delivery.deliveryAttemptId, response.status, now.toISOString());
      summary.delivered += 1;
      continue;
    }
    const age = now.getTime() - new Date(delivery.firstAttemptAt).getTime();
    if (retryable(response.status) && age < 24 * 60 * 60 * 1_000) {
      await store.markRetry(
        delivery.deliveryAttemptId,
        response.status,
        nextAttempt(delivery, now),
      );
      summary.retried += 1;
    } else {
      await store.markDeadLetter(delivery.deliveryAttemptId, response.status, now.toISOString());
      summary.deadLettered += 1;
    }
  }
  return summary;
}

export async function performWebhookChallenge(
  store: WebhookStore,
  sender: WebhookSender,
  subscription: WebhookSubscription,
  now: string,
): Promise<WebhookSubscription> {
  if (subscription.state !== "pending_challenge") {
    throw new Error("Webhook subscription is not awaiting a challenge");
  }
  const challenge = await store.getPendingChallenge(
    subscription.subscriptionId,
    subscription.tenantId,
  );
  const body = Buffer.from(JSON.stringify({ challenge }), "utf8");
  const response = await sender.send({
    endpoint: subscription.endpoint,
    headers: {
      "content-type": "application/json",
      "x-hk-webhook-challenge": challenge,
    },
    body,
  });
  let responseValue: unknown;
  try {
    responseValue = JSON.parse(Buffer.from(response.body ?? []).toString("utf8"));
  } catch {
    throw new Error("Webhook challenge response was not valid JSON");
  }
  if (
    response.status < 200 ||
    response.status >= 300 ||
    typeof responseValue !== "object" ||
    responseValue === null ||
    !("challenge" in responseValue) ||
    responseValue.challenge !== challenge
  ) {
    throw new Error("Webhook endpoint did not echo the challenge");
  }
  return store.activateSubscription(
    subscription.subscriptionId,
    subscription.tenantId,
    challenge,
    now,
  );
}
