import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { notFound } from "../errors.js";
import { eventResponse } from "../serialize.js";
import type { RouteContext } from "./context.js";
import { identifier, pageQuery, pageResponse } from "./query.js";

const eventQuery = pageQuery.extend({
  event_type: z.string().optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
  observed_from: z.iso.datetime().optional(),
  observed_to: z.iso.datetime().optional(),
  affected_entity: z.string().min(1).optional(),
});

export function registerEventRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get("/v1/events", async (request) => {
    await context.authenticate(request.headers.authorization, ["events:read"], false);
    const query = eventQuery.parse(request.query);
    const result = await context.repository.listEvents({
      eventType: query.event_type,
      status: query.status,
      severity: query.severity,
      observedFrom: query.observed_from,
      observedTo: query.observed_to,
      affectedEntity: query.affected_entity,
      cursor: query.cursor,
      limit: query.limit,
    });
    return pageResponse(result.items.map(eventResponse), result.nextCursor);
  });

  app.get("/v1/events/:event_id", async (request) => {
    await context.authenticate(request.headers.authorization, ["events:read"], false);
    const params = z.object({ event_id: identifier }).parse(request.params);
    const event = await context.repository.getEvent(params.event_id);
    if (event === null) {
      throw notFound("Event");
    }
    return eventResponse(event);
  });
}
