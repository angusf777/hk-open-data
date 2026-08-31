import { describe, expect, it, vi } from "vitest";

import { ApiError, HKDataClient } from "./client.js";

describe("HKDataClient", () => {
  it("adds bearer auth and follows opaque source cursors", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{ source_id: "HKAPI-001" }], page: { next_cursor: "opaque" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{ source_id: "HKAPI-002" }], page: { next_cursor: null } }), { status: 200 }),
      );
    const client = new HKDataClient({ baseUrl: "https://api.example/v1", token: "secret-token", fetcher });

    const sources = await client.listAllSources({ project: "P01", limit: 1 });

    expect(sources.map((source) => source.source_id)).toEqual(["HKAPI-001", "HKAPI-002"]);
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ authorization: "Bearer secret-token" });
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("cursor=opaque");
  });

  it("throws the common safe error envelope", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ code: "FORBIDDEN", message: "Missing scope", retryable: false, correlation_id: "corr-1" }),
        { status: 403 },
      ),
    );
    const client = new HKDataClient({ baseUrl: "https://api.example/v1", fetcher });

    await expect(client.getSource("HKAPI-001")).rejects.toMatchObject({
      code: "FORBIDDEN",
      correlationId: "corr-1",
      status: 403,
    } satisfies Partial<ApiError>);
  });

  it("supports a same-origin gateway path without embedding a browser token", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ generated_at: "2026-08-28T00:00:00Z" }), { status: 200 }),
    );
    const client = new HKDataClient({ baseUrl: "/v1", origin: "https://status.example.hk", fetcher });
    await client.statusSummary();
    expect(String(fetcher.mock.calls[0]?.[0])).toBe("https://status.example.hk/v1/status/summary");
    expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty("authorization");
  });

  it("allows a relative gateway on loopback for the self-hosted runtime", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ generated_at: "2026-08-28T00:00:00Z" }), { status: 200 }),
    );
    const client = new HKDataClient({ baseUrl: "/v1", origin: "http://127.0.0.1:4174", fetcher });
    await client.statusSummary();
    expect(String(fetcher.mock.calls[0]?.[0])).toBe("http://127.0.0.1:4174/v1/status/summary");
  });

  it("still rejects insecure non-loopback API origins", () => {
    expect(() => new HKDataClient({ baseUrl: "http://api.example/v1" })).toThrow(/https/i);
  });

  it("aborts requests after the configured timeout", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
      return new Response();
    });
    const client = new HKDataClient({ baseUrl: "https://api.example/v1", fetcher, timeoutMs: 5 });

    await expect(client.statusSummary()).rejects.toThrow(/timed out/i);
  });
});
