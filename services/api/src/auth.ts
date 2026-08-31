import { createRemoteJWKSet, jwtVerify } from "jose";

export type Scope =
  | "sources:read"
  | "records:read"
  | "events:read"
  | "status:read"
  | "admin:sources"
  | "admin:incidents"
  | "webhooks:manage";

export interface RequestPrincipal {
  subject: string;
  tenantId: string | null;
  scopes: ReadonlySet<string>;
  mfa: boolean;
}

export interface TokenVerifier {
  verify(token: string): Promise<RequestPrincipal>;
}

export class AuthError extends Error {
  readonly code: "UNAUTHENTICATED" | "FORBIDDEN";

  constructor(code: "UNAUTHENTICATED" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export function bearerToken(authorization: string): string {
  const match = /^Bearer ([^\s]+)$/i.exec(authorization.trim());
  if (match?.[1] === undefined) {
    throw new AuthError("UNAUTHENTICATED", "Authorization must contain one bearer token");
  }
  return match[1];
}

export function requireScopes(
  principal: RequestPrincipal,
  required: readonly Scope[],
): void {
  const missing = required.filter((scope) => !principal.scopes.has(scope));
  if (missing.length > 0) {
    throw new AuthError("FORBIDDEN", `Missing required scope: ${missing.join(", ")}`);
  }
}

export function requireMfa(principal: RequestPrincipal): void {
  if (!principal.mfa) {
    throw new AuthError("FORBIDDEN", "Administrative access requires MFA");
  }
}

function mfaFromClaim(claim: unknown): boolean {
  if (!Array.isArray(claim) || !claim.every((value) => typeof value === "string")) {
    return false;
  }
  const methods = new Set(claim);
  return (
    methods.has("mfa") ||
    (methods.has("pwd") && ["otp", "hwk", "swk", "fpt", "face"].some((value) => methods.has(value)))
  );
}

export interface OidcVerifierConfiguration {
  issuer: string;
  audience: string;
  jwksUrl: string;
}

function scopesFromClaim(claim: unknown): Set<string> {
  if (typeof claim === "string") {
    return new Set(claim.split(/\s+/).filter(Boolean));
  }
  if (Array.isArray(claim) && claim.every((value) => typeof value === "string")) {
    return new Set(claim);
  }
  return new Set();
}

export function createOidcTokenVerifier(
  configuration: OidcVerifierConfiguration,
): TokenVerifier {
  const jwksUrl = new URL(configuration.jwksUrl);
  if (jwksUrl.protocol !== "https:") {
    throw new Error("OIDC JWKS URL must use HTTPS");
  }
  const keys = createRemoteJWKSet(jwksUrl, {
    timeoutDuration: 5_000,
    cooldownDuration: 30_000,
    cacheMaxAge: 600_000,
  });
  return {
    async verify(token): Promise<RequestPrincipal> {
      try {
        const { payload } = await jwtVerify(token, keys, {
          issuer: configuration.issuer,
          audience: configuration.audience,
          algorithms: ["RS256", "ES256"],
        });
        if (payload.sub === undefined || payload.sub === "") {
          throw new Error("subject is missing");
        }
        const tenantClaim = payload["tenant_id"];
        return {
          subject: payload.sub,
          tenantId: typeof tenantClaim === "string" && tenantClaim !== "" ? tenantClaim : null,
          scopes: scopesFromClaim(payload.scope ?? payload["scp"]),
          mfa: mfaFromClaim(payload.amr),
        };
      } catch {
        throw new AuthError("UNAUTHENTICATED", "Bearer token is invalid or expired");
      }
    },
  };
}
