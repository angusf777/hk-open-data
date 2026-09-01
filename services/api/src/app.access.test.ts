import { loadAccessRecipeIndex } from "@hk-open-data/schemas";
import { describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import type { TokenVerifier } from "./auth.js";
import { MemoryPlatformRepository } from "./memory-repository.js";

const verifier: TokenVerifier = {
  async verify() {
    throw new Error("authentication is not used by public access-recipe routes");
  },
};

function app() {
  const recipes = loadAccessRecipeIndex().recipes.slice(0, 8);
  return buildApp({
    repository: new MemoryPlatformRepository(),
    verifier,
    clock: () => new Date("2026-09-01T08:00:00.000Z"),
    accessRecipes: recipes,
  });
}

describe("public access recipe routes", () => {
  it("lists filtered recipes without provider traffic or credential values", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await app().inject({
      method: "GET",
      url: "/v1/access-recipes?status=live-verified&limit=2",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({
      source_reference: "HKAPI-001",
      status: "live-verified",
      effective_status: "live-verified",
    });
    expect(body.page).toEqual({ next_cursor: "HKAPI-002" });
    expect(JSON.stringify(body)).not.toMatch(/authorization|cookie|secret-token/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("gets one recipe and returns the standard 404 envelope for an unknown reference", async () => {
    const instance = app();
    const found = await instance.inject({ method: "GET", url: "/v1/access-recipes/HKAPI-001" });
    const missing = await instance.inject({ method: "GET", url: "/v1/access-recipes/HKAPI-999" });

    expect(found.statusCode).toBe(200);
    expect(found.json()).toMatchObject({
      source_reference: "HKAPI-001",
      examples: { python: expect.stringContaining("httpx") },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: "NOT_FOUND", retryable: false });
  });

  it("rejects unsupported filters instead of silently widening the result", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/v1/access-recipes?status=currently-working",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "INVALID_REQUEST" });
  });
});
