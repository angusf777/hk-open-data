import * as z from "zod/v4";

const page = {
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
};

export const outputSchema = z
  .object({
    contract_version: z.literal("2026-08-28.v1"),
    data: z.record(z.string(), z.json()),
    evidence: z
      .object({
        source_record_ids: z.array(z.string()),
        retrieved_at: z.string(),
        freshness_status: z.string(),
        limitations: z.array(z.string()),
      })
      .strict(),
    next_cursor: z.string().nullable(),
  })
  .strict();

export const schemas = {
  sources_list: z
    .object({
      project: z.string().regex(/^P[0-9]{2}$/).optional(),
      authority_class: z.string().optional(),
      freshness_status: z.string().optional(),
      approval_status: z.string().optional(),
      ...page,
    })
    .strict(),
  source_get: z.object({ source_id: z.string().regex(/^(HKAPI|EXT)-[0-9]{3}$/) }).strict(),
  source_records_query: z
    .object({
      source_id: z.string().optional(),
      observed_from: z.iso.datetime().optional(),
      observed_to: z.iso.datetime().optional(),
      published_from: z.iso.datetime().optional(),
      published_to: z.iso.datetime().optional(),
      language: z.string().optional(),
      ...page,
    })
    .strict(),
  source_record_get: z
    .object({ source_record_id: z.string().min(1), include_lineage: z.boolean().default(true) })
    .strict(),
  events_query: z
    .object({
      event_type: z.string().optional(),
      status: z.string().optional(),
      severity: z.string().optional(),
      observed_from: z.iso.datetime().optional(),
      observed_to: z.iso.datetime().optional(),
      affected_entity: z.string().optional(),
      ...page,
    })
    .strict(),
  event_get: z.object({ event_id: z.string().min(1) }).strict(),
  monitor_targets_list: z
    .object({
      provider: z.string().optional(),
      source_id: z.string().optional(),
      outcome: z.string().optional(),
      ...page,
    })
    .strict(),
  monitor_target_get: z
    .object({ monitor_id: z.string().regex(/^P14-M[0-9]{3}$/), history_limit: z.number().int().min(1).max(100).default(20) })
    .strict(),
  incidents_list: z
    .object({
      status: z.string().optional(),
      severity: z.string().optional(),
      source_id: z.string().optional(),
      opened_from: z.iso.datetime().optional(),
      opened_to: z.iso.datetime().optional(),
      ...page,
    })
    .strict(),
  incident_get: z.object({ incident_id: z.string().regex(/^INC-[0-9]{4}-[0-9]{6}$/) }).strict(),
  status_summary: z.object({ project: z.string().optional(), provider: z.string().optional() }).strict(),
} as const;
