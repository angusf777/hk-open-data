import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { notFound } from "../errors.js";
import { sourceResponse } from "../serialize.js";
import type { RouteContext } from "./context.js";
import { identifier, pageQuery, pageResponse } from "./query.js";

const sourceQuery = pageQuery.extend({
  project: z.string().regex(/^P[0-9]{2}$/).optional(),
  authority_class: z.string().min(1).optional(),
  freshness_status: z.enum(["fresh", "stale", "unknown", "not_applicable"]).optional(),
  approval_status: z.enum([
    "specified_pending_approval",
    "approved",
    "restricted",
    "rejected",
    "revoked",
    "expired",
  ]).optional(),
});

export function registerSourceRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get("/v1/sources", async (request) => {
    const principal = await context.authenticate(
      request.headers.authorization,
      ["sources:read"],
      true,
    );
    const query = sourceQuery.parse(request.query);
    const result = await context.repository.listSources({
      visibility: principal === null ? "public" : "private",
      limit: query.limit,
      cursor: query.cursor,
      project: query.project,
      authorityClass: query.authority_class,
      freshnessStatus: query.freshness_status,
      approvalStatus: query.approval_status,
    });
    return pageResponse(
      result.items.map((source) => sourceResponse(source, context.operatingProfile)),
      result.nextCursor,
    );
  });

  app.get("/v1/sources/:source_id", async (request) => {
    const principal = await context.authenticate(
      request.headers.authorization,
      ["sources:read"],
      true,
    );
    const params = z.object({ source_id: identifier }).parse(request.params);
    const source = await context.repository.getSource(
      params.source_id,
      principal === null ? "public" : "private",
    );
    if (source === null) {
      throw notFound("Source");
    }
    return sourceResponse(source, context.operatingProfile);
  });
}
