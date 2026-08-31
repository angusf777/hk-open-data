import { describe, expect, it } from "vitest";

import { AuthError, bearerToken, requireMfa, requireScopes } from "./auth.js";

describe("authentication helpers", () => {
  it("extracts one bearer token case-insensitively", () => {
    expect(bearerToken("bEaReR signed.token.value")).toBe("signed.token.value");
  });

  it("rejects malformed authorization headers", () => {
    expect(() => bearerToken("Basic abc")).toThrowError(AuthError);
    expect(() => bearerToken("Bearer first second")).toThrowError(AuthError);
  });

  it("requires every requested scope", () => {
    const principal = {
      subject: "viewer",
      tenantId: "tenant-1",
      scopes: new Set(["records:read", "status:read"]),
      mfa: false,
    } as const;

    expect(() => requireScopes(principal, ["records:read"])).not.toThrow();
    expect(() => requireScopes(principal, ["records:read", "sources:read"])).toThrowError(
      /sources:read/,
    );
  });

  it("requires an MFA-authenticated principal for administrative writes", () => {
    const principal = {
      subject: "operator",
      tenantId: null,
      scopes: new Set(["admin:sources"]),
      mfa: false,
    } as const;

    expect(() => requireMfa(principal)).toThrowError(/MFA/);
    expect(() => requireMfa({ ...principal, mfa: true })).not.toThrow();
  });
});
