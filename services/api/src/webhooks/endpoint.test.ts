import { describe, expect, it } from "vitest";

import { isPublicAddress, resolveSafeWebhookEndpoint } from "./endpoint.js";

describe("webhook endpoint security", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "::1", "fd00::1"])(
    "rejects private or reserved address %s",
    (address) => expect(isPublicAddress(address)).toBe(false),
  );

  it("rejects credentials, non-standard ports, and private DNS answers", async () => {
    const privateResolver = async () => [{ address: "10.0.0.5", family: 4 }];
    await expect(resolveSafeWebhookEndpoint("https://user:pass@example.com/hook", privateResolver))
      .rejects.toThrow(/credentials/);
    await expect(resolveSafeWebhookEndpoint("https://example.com:8443/hook", privateResolver))
      .rejects.toThrow(/standard HTTPS port/);
    await expect(resolveSafeWebhookEndpoint("https://example.com/hook", privateResolver))
      .rejects.toThrow(/private or reserved/);
  });

  it("accepts a public DNS answer", async () => {
    const result = await resolveSafeWebhookEndpoint(
      "https://hooks.example.com/receive",
      async () => [{ address: "93.184.216.34", family: 4 }],
    );
    expect(result.url.hostname).toBe("hooks.example.com");
  });
});
