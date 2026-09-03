import { dataGovResourceAccessSchema, type DataGovResource } from "@hk-open-data/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { notFound } from "../errors.js";
import { ResourceRegistry } from "../resource-registry.js";
import { pageQuery, pageResponse } from "./query.js";

const sourceReference = z.string().regex(/^HKAPI-[0-9]{3}$/);
const datasetId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{1,299}$/);
const resourceId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{1,299}$/);
const resourceQuery = pageQuery.extend({
  source_reference: sourceReference.optional(),
  dataset_id: datasetId.optional(),
  format: z.string().min(1).max(32).optional(),
  access: dataGovResourceAccessSchema.optional(),
});

export function registerAccessResourceRoutes(
  app: FastifyInstance,
  registry: ResourceRegistry,
): void {
  app.get("/v1/access-resources", async (request) => {
    const query = resourceQuery.parse(request.query);
    const result = registry.list({
      limit: query.limit,
      ...(query.source_reference === undefined
        ? {}
        : { sourceReference: query.source_reference }),
      ...(query.dataset_id === undefined ? {} : { datasetId: query.dataset_id }),
      ...(query.format === undefined ? {} : { format: query.format }),
      ...(query.access === undefined ? {} : { access: query.access }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
    });
    return pageResponse(result.items.map(accessResourceResponse), result.nextCursor);
  });

  app.get("/v1/access-resources/:dataset_id/:resource_id", async (request) => {
    const params = z
      .object({ dataset_id: datasetId, resource_id: resourceId })
      .parse(request.params);
    const resource = registry.get(params.dataset_id, params.resource_id);
    if (resource === undefined) throw notFound("Provider resource");
    return accessResourceResponse(resource);
  });
}

export function accessResourceResponse(resource: DataGovResource) {
  const parameterFlags = resource.templateParameters
    .map((parameter) => ` --param ${parameter}=VALUE`)
    .join("");
  return {
    schema_version: resource.schemaVersion,
    source_references: resource.sourceReferences,
    dataset_id: resource.datasetId,
    resource_id: resource.resourceId,
    name: resource.name,
    format: resource.format,
    url_template: resource.urlTemplate,
    template_parameters: resource.templateParameters,
    access: resource.access,
    usage: {
      list_cli: `hkdata resources ${resource.sourceReferences[0]} --dataset ${resource.datasetId}`,
      example_cli: `hkdata resource-example ${resource.sourceReferences[0]} ${resource.resourceId} curl --dataset ${resource.datasetId}${parameterFlags}`,
      fetch_cli: `hkdata fetch-resource ${resource.sourceReferences[0]} ${resource.resourceId} --dataset ${resource.datasetId}${parameterFlags} --output resource.data`,
    },
    limitations: [
      "Technical access metadata only; availability can change after the recorded check.",
      "Review current provider terms, attribution, caching and redistribution requirements before use.",
    ],
  };
}
