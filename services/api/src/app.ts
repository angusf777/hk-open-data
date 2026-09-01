import { randomUUID } from "node:crypto";

import rateLimit from "@fastify/rate-limit";
import type { AccessRecipe, OperatingProfile } from "@hk-open-data/schemas";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import {
  AuthError,
  bearerToken,
  requireScopes,
  type RequestPrincipal,
  type Scope,
  type TokenVerifier,
} from "./auth.js";
import { HttpError } from "./errors.js";
import { RepositoryError } from "./repository.js";
import type { PlatformRepository } from "./repository.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerQualityRoutes } from "./routes/quality.js";
import { registerRecordRoutes } from "./routes/records.js";
import { registerSourceRoutes } from "./routes/sources.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { MemoryWebhookStore, type WebhookStore } from "./webhooks/outbox.js";
import { resolveSafeWebhookEndpoint } from "./webhooks/endpoint.js";
import { SafeWebhookSender } from "./webhooks/endpoint.js";
import type { WebhookSender } from "./webhooks/delivery.js";

export interface BuildAppDependencies {
  repository: PlatformRepository;
  verifier: TokenVerifier;
  clock?: () => Date;
  webhookStore?: WebhookStore;
  webhookEndpointValidator?: (endpoint: string) => Promise<void>;
  webhookSender?: WebhookSender;
  operatingProfile?: OperatingProfile;
  trustedProxies?: string[];
  accessRecipes?: readonly AccessRecipe[];
}

export function buildApp(dependencies: BuildAppDependencies): FastifyInstance {
  const app = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
    bodyLimit: 1_048_576,
    trustProxy: dependencies.trustedProxies ?? false,
  });
  const clock = dependencies.clock ?? (() => new Date());
  const operatingProfile = dependencies.operatingProfile ?? "catalogue";
  const startedAt = clock().getTime();
  let completedRequests = 0;

  app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: 60_000,
    errorResponseBuilder: (_request, context) =>
      new HttpError(
        context.statusCode,
        "RATE_LIMITED",
        `Too many requests; retry after ${context.after}`,
        true,
      ),
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-correlation-id", request.id);
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
  });
  app.addHook("onResponse", async () => {
    completedRequests += 1;
  });

  async function authenticate(
    authorization: string | undefined,
    requiredScopes: readonly Scope[],
    optional: boolean,
  ): Promise<RequestPrincipal | null> {
    if (authorization === undefined) {
      if (optional) {
        return null;
      }
      throw new AuthError("UNAUTHENTICATED", "Bearer token is required");
    }
    let principal: RequestPrincipal;
    try {
      principal = await dependencies.verifier.verify(bearerToken(authorization));
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError("UNAUTHENTICATED", "Bearer token is invalid or expired");
    }
    requireScopes(principal, requiredScopes);
    return principal;
  }

  const webhookStore = dependencies.webhookStore ?? new MemoryWebhookStore();
  const context = {
    repository: dependencies.repository,
    clock,
    authenticate,
    operatingProfile,
    accessRecipes: new Map(
      (dependencies.accessRecipes ?? []).map((recipe) => [recipe.sourceReference, recipe]),
    ),
  };
  app.register(async (routes) => {
    routes.get("/health/live", async () => ({
      status: "live",
      operating_profile: operatingProfile,
    }));
    routes.get("/health/ready", async (_request, reply) => {
      try {
        await dependencies.repository.healthCheck();
        return { status: "ready", operating_profile: operatingProfile };
      } catch {
        return reply.status(503).send({
          status: "not_ready",
          operating_profile: operatingProfile,
        });
      }
    });
    routes.get("/metrics", async (_request, reply) => {
      const operational = await dependencies.repository.metricsSnapshot(clock().toISOString());
      return reply
        .type("text/plain; version=0.0.4; charset=utf-8")
        .send(
          `# HELP hk_platform_uptime_seconds Process uptime in seconds.\n` +
            `# TYPE hk_platform_uptime_seconds gauge\n` +
            `hk_platform_uptime_seconds ${Math.max(0, (clock().getTime() - startedAt) / 1000)}\n` +
            `# HELP hk_platform_http_requests_completed_total Completed HTTP requests.\n` +
            `# TYPE hk_platform_http_requests_completed_total counter\n` +
            `hk_platform_http_requests_completed_total ${completedRequests}\n` +
            `# HELP hk_platform_scheduler_backlog Jobs delayed by more than five minutes.\n` +
            `# TYPE hk_platform_scheduler_backlog gauge\n` +
            `hk_platform_scheduler_backlog ${operational.schedulerBacklog}\n` +
            `# HELP hk_platform_delayed_checks Active monitors outside cadence.\n` +
            `# TYPE hk_platform_delayed_checks gauge\n` +
            `hk_platform_delayed_checks ${operational.delayedChecks}\n` +
            `# HELP hk_platform_stale_connectors Active connectors without a recent success.\n` +
            `# TYPE hk_platform_stale_connectors gauge\n` +
            `hk_platform_stale_connectors ${operational.staleConnectors}\n` +
            `# HELP hk_platform_failed_webhooks Retry and dead-letter deliveries.\n` +
            `# TYPE hk_platform_failed_webhooks gauge\n` +
            `hk_platform_failed_webhooks ${operational.failedWebhooks}\n`,
        );
    });

    registerAdminRoutes(routes, context);
    registerSourceRoutes(routes, context);
    registerRecordRoutes(routes, context);
    registerEventRoutes(routes, context);
    registerQualityRoutes(routes, context);
    registerWebhookRoutes(
      routes,
      context,
      webhookStore,
      dependencies.webhookEndpointValidator ??
        (async (endpoint) => {
          await resolveSafeWebhookEndpoint(endpoint);
        }),
      dependencies.webhookSender ?? new SafeWebhookSender(),
    );
  });

  app.setNotFoundHandler(async (request, reply) => {
    await reply.status(404).send({
      code: "NOT_FOUND",
      message: "Route was not found",
      retryable: false,
      correlation_id: request.id,
    });
  });

  app.setErrorHandler(async (error, request, reply) => {
    let statusCode = 500;
    let code = "INTERNAL_ERROR";
    let message = "The request could not be completed";
    let retryable = false;
    if (error instanceof AuthError) {
      statusCode = error.code === "UNAUTHENTICATED" ? 401 : 403;
      code = error.code;
      message = error.message;
    } else if (error instanceof HttpError) {
      statusCode = error.statusCode;
      code = error.code;
      message = error.message;
      retryable = error.retryable;
    } else if (error instanceof RepositoryError) {
      statusCode = error.code === "NOT_FOUND" ? 404 : error.code === "VERSION_CONFLICT" ? 409 : 400;
      code = error.code;
      message = error.message;
    } else if (error instanceof ZodError) {
      statusCode = 400;
      code = "INVALID_REQUEST";
      message = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    }
    await reply.status(statusCode).send({
      code,
      message,
      retryable,
      correlation_id: request.id,
    });
  });

  return app;
}
