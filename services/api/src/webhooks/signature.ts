import { createHmac, timingSafeEqual } from "node:crypto";

export function signWebhook(secret: string, timestamp: string, rawBody: Uint8Array): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(timestamp, "utf8");
  hmac.update(".", "utf8");
  hmac.update(rawBody);
  return `v1=${hmac.digest("hex")}`;
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: Uint8Array,
  signature: string,
): boolean {
  const expected = Buffer.from(signWebhook(secret, timestamp, rawBody));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
