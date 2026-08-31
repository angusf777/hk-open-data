import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { notFound } from "../errors.js";
import { sourceRecordResponse } from "../serialize.js";
import type { RouteContext } from "./context.js";
import { identifier, pageQuery, pageResponse } from "./query.js";

const recordQuery = pageQuery.extend({
  source_id: z.string().optional(),
  observed_from: z.iso.datetime().optional(),
  observed_to: z.iso.datetime().optional(),
  published_from: z.iso.datetime().optional(),
  published_to: z.iso.datetime().optional(),
  language: z.string().min(2).max(32).optional(),
});

export function registerRecordRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get("/v1/source-records", async (request) => {
    await context.authenticate(request.headers.authorization, ["records:read"], false);
    const query = recordQuery.parse(request.query);
    const result = await context.repository.listSourceRecords({
      sourceId: query.source_id,
      observedFrom: query.observed_from,
      observedTo: query.observed_to,
      publishedFrom: query.published_from,
      publishedTo: query.published_to,
      language: query.language,
      cursor: query.cursor,
      limit: query.limit,
    });
    return pageResponse(
      result.items.map((record) => sourceRecordResponse(record, context.operatingProfile)),
      result.nextCursor,
    );
  });

  app.get("/v1/source-records/:source_record_id", async (request) => {
    await context.authenticate(request.headers.authorization, ["records:read"], false);
    const params = z.object({ source_record_id: identifier }).parse(request.params);
    const record = await context.repository.getSourceRecord(params.source_record_id);
    if (record === null) {
      throw notFound("Source record");
    }
    return sourceRecordResponse(record, context.operatingProfile);
  });
}
