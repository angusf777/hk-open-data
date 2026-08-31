import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { WebhookSecretProtector } from "./postgres-store.js";

describe("WebhookSecretProtector", () => {
  it("encrypts secrets with authenticated encryption", () => {
    const protector = new WebhookSecretProtector(randomBytes(32).toString("base64"));
    const protectedValue = protector.protect("delivery-secret");
    expect(protectedValue).not.toContain("delivery-secret");
    expect(protector.reveal(protectedValue)).toBe("delivery-secret");
  });

  it("rejects invalid key material", () => {
    expect(() => new WebhookSecretProtector(Buffer.from("short").toString("base64")))
      .toThrow(/32 bytes/);
  });
});
