import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { notFound } from "../errors.js";
import {
  incidentResponse,
  observationResponse,
  statusResponse,
  targetResponse,
} from "../serialize.js";
import type { RouteContext } from "./context.js";
import { identifier, pageQuery, pageResponse } from "./query.js";

const targetQuery = pageQuery.extend({
  provider: z.string().optional(),
  source_id: z.string().optional(),
  outcome: z.string().optional(),
});

const incidentQuery = pageQuery.extend({
  status: z.string().optional(),
  severity: z.string().optional(),
  source_id: z.string().optional(),
  opened_from: z.iso.datetime().optional(),
  opened_to: z.iso.datetime().optional(),
});

const statusQuery = z.object({
  project: z.string().regex(/^P[0-9]{2}$/).optional(),
  provider: z.string().min(1).optional(),
});

export function registerQualityRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get("/v1/status/summary", async (request) => {
    const query = statusQuery.parse(request.query);
    return statusResponse(
      await context.repository.getStatusSummary(context.clock().toISOString(), query),
      context.operatingProfile,
    );
  });

  app.get("/v1/monitor-targets", async (request) => {
    const principal = await context.authenticate(
      request.headers.authorization,
      ["status:read"],
      true,
    );
    const query = targetQuery.parse(request.query);
    const result = await context.repository.listMonitorTargets({
      visibility: principal === null ? "public" : "private",
      provider: query.provider,
      sourceId: query.source_id,
      outcome: query.outcome,
      cursor: query.cursor,
      limit: query.limit,
    });
    return pageResponse(result.items.map(targetResponse), result.nextCursor);
  });

  app.get("/v1/monitor-targets/:monitor_id", async (request) => {
    const principal = await context.authenticate(
      request.headers.authorization,
      ["status:read"],
      true,
    );
    const params = z.object({ monitor_id: identifier }).parse(request.params);
    const query = z
      .object({ history_limit: z.coerce.number().int().min(1).max(100).default(20) })
      .parse(request.query);
    const detail = await context.repository.getMonitorTarget(
      params.monitor_id,
      principal === null ? "public" : "private",
      query.history_limit,
    );
    if (detail === null) {
      throw notFound("Monitor target");
    }
    return {
      target: targetResponse(detail.target),
      observations: detail.observations.map(observationResponse),
      incidents: detail.incidents.map(incidentResponse),
    };
  });

  app.get("/v1/incidents", async (request) => {
    const principal = await context.authenticate(
      request.headers.authorization,
      ["status:read"],
      true,
    );
    const query = incidentQuery.parse(request.query);
    const result = await context.repository.listIncidents({
      visibility: principal === null ? "public" : "private",
      status: query.status,
      severity: query.severity,
      sourceId: query.source_id,
      openedFrom: query.opened_from,
      openedTo: query.opened_to,
      cursor: query.cursor,
      limit: query.limit,
    });
    return pageResponse(result.items.map(incidentResponse), result.nextCursor);
  });

  app.get("/v1/incidents/:incident_id", async (request) => {
    const principal = await context.authenticate(
      request.headers.authorization,
      ["status:read"],
      true,
    );
    const params = z.object({ incident_id: identifier }).parse(request.params);
    const incident = await context.repository.getIncident(
      params.incident_id,
      principal === null ? "public" : "private",
    );
    if (incident === null) {
      throw notFound("Incident");
    }
    return incidentResponse(incident);
  });
}
