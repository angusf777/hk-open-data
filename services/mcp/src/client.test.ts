import { describe, expect, it, vi } from "vitest";

import { RestPlatformClient } from "./client.js";
import { safeToolError } from "./errors.js";
import { callerToken } from "./http-auth.js";

describe("REST-backed MCP parity", () => {
  it("returns the exact REST object version and evidence identifiers for the same token", async () => {
    const restObject = {
      source_record_id: "SR-00000001",
      source_id: "HKAPI-001",
      schema_version: "1.0.0",
      approval_reference: "APP-HKAPI-001-2",
      raw_payload_hash: "a".repeat(64),
      retrieved_at: "2026-08-28T10:00:00.000Z",
      freshness_status: "fresh",
      operating_profile: "fabric",
      catalogue_id: "official:hkapi-001",
      terms_evidence_state: "ambiguity-identified",
      evidence_mode: "raw",
      limitations: ["Metadata only"],
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(restObject), { status: 200 }),
    );
    const client = new RestPlatformClient({
      baseUrl: "https://api.example/v1",
      token: "caller-token",
      fetcher,
    });

    const result = await client.call("source_record_get", {
      source_record_id: "SR-00000001",
      include_lineage: true,
    });

    expect(result.data.item).toEqual(restObject);
    expect(result.evidence.source_record_ids).toEqual(["SR-00000001"]);
    expect(result.evidence.retrieved_at).toBe(restObject.retrieved_at);
    expect(result.evidence.limitations).toContain(
      "Terms evidence is informational, not permission for commercial use, caching, or redistribution.",
    );
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: "Bearer caller-token",
    });
  });

  it("never treats a malformed authorization header as anonymous", () => {
    expect(callerToken(null)).toBeUndefined();
    expect(callerToken("Bearer caller-token")).toBe("caller-token");
    expect(() => callerToken("Basic unsafe")).toThrow(/bearer token/i);
  });

  it("surfaces an API rate limit as a safe retryable tool error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "RATE_LIMITED",
          message: "Too many requests; retry after 1 minute",
          retryable: true,
          correlation_id: "corr-rate-limit",
        }),
        { status: 429, headers: { "retry-after": "60" } },
      ),
    );
    const client = new RestPlatformClient({
      baseUrl: "https://api.example/v1",
      fetcher,
    });

    const error = await client.call("status_summary", {}).catch((caught: unknown) => caught);
    const result = safeToolError(error);

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0]?.type === "text" ? result.content[0].text : "{}")).toEqual({
      code: "RATE_LIMITED",
      message: "Too many requests; retry after 1 minute",
      retryable: true,
      correlation_id: "corr-rate-limit",
    });
  });
});
