export interface EvidenceEnvelope {
  source_record_ids: string[];
  retrieved_at: string;
  freshness_status: string;
  limitations: string[];
}

export interface ToolEnvelope {
  contract_version: "2026-09-01.v1";
  data: Record<string, unknown>;
  evidence: EvidenceEnvelope;
  next_cursor: string | null;
}

export interface PlatformReadClient {
  call(name: string, input: Record<string, unknown>): Promise<ToolEnvelope>;
}

export class PlatformClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly correlationId: string;

  constructor(code: string, message: string, retryable: boolean, correlationId: string) {
    super(message);
    this.name = "PlatformClientError";
    this.code = code;
    this.retryable = retryable;
    this.correlationId = correlationId;
  }
}

const routeByTool: Record<string, { path: string; detailKey?: string }> = {
  sources_list: { path: "sources" },
  source_get: { path: "sources", detailKey: "source_id" },
  source_records_query: { path: "source-records" },
  source_record_get: { path: "source-records", detailKey: "source_record_id" },
  events_query: { path: "events" },
  event_get: { path: "events", detailKey: "event_id" },
  monitor_targets_list: { path: "monitor-targets" },
  monitor_target_get: { path: "monitor-targets", detailKey: "monitor_id" },
  incidents_list: { path: "incidents" },
  incident_get: { path: "incidents", detailKey: "incident_id" },
  status_summary: { path: "status/summary" },
  access_recipes_list: { path: "access-recipes" },
  access_recipe_get: { path: "access-recipes", detailKey: "source_reference" },
};

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sourceRecordIds(value: unknown): string[] {
  const found = new Set<string>();
  function visit(current: unknown): void {
    if (Array.isArray(current)) {
      current.forEach(visit);
    } else if (typeof current === "object" && current !== null) {
      for (const [key, child] of Object.entries(current)) {
        if (key === "source_record_id" && typeof child === "string") {
          found.add(child);
        } else if (key === "source_records" || key === "parent_record_ids") {
          strings(child).forEach((item) => found.add(item));
        }
        visit(child);
      }
    }
  }
  visit(value);
  return [...found];
}

function includesTermsEvidence(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(includesTermsEvidence);
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(
    ([key, child]) => key === "terms_evidence_state" || includesTermsEvidence(child),
  );
}

export class RestPlatformClient implements PlatformReadClient {
  readonly #baseUrl: string;
  readonly #token: string | undefined;
  readonly #fetcher: typeof fetch;

  constructor(options: { baseUrl: string; token?: string; fetcher?: typeof fetch; allowInternalHttp?: boolean }) {
    const url = new URL(options.baseUrl);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && options.allowInternalHttp === true)) {
      throw new Error("Platform API URL must use HTTPS");
    }
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    this.#token = options.token;
    this.#fetcher = options.fetcher ?? fetch;
  }

  async call(name: string, input: Record<string, unknown>): Promise<ToolEnvelope> {
    const route = routeByTool[name];
    if (route === undefined) {
      throw new PlatformClientError("TOOL_NOT_ALLOWED", "Tool is not allowlisted", false, "local");
    }
    const values = { ...input };
    let path = route.path;
    if (route.detailKey !== undefined) {
      const identifier = values[route.detailKey];
      if (typeof identifier !== "string") {
        throw new PlatformClientError("INVALID_REQUEST", "Detail identifier is required", false, "local");
      }
      path = `${path}/${encodeURIComponent(identifier)}`;
      delete values[route.detailKey];
    }
    if (name === "source_record_get") {
      delete values["include_lineage"];
    }
    if (name === "access_recipes_list" && values["freshness"] !== undefined) {
      values["verification_freshness"] = values["freshness"];
      delete values["freshness"];
    }
    const url = new URL(`${this.#baseUrl}/${path}`);
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.#token !== undefined) {
      headers.authorization = `Bearer ${this.#token}`;
    }
    const response = await this.#fetcher(url, { headers, signal: AbortSignal.timeout(30_000) });
    const payload: unknown = await response.json();
    if (!response.ok) {
      if (typeof payload === "object" && payload !== null) {
        const error = payload as Record<string, unknown>;
        throw new PlatformClientError(
          typeof error["code"] === "string" ? error["code"] : "PLATFORM_ERROR",
          typeof error["message"] === "string" ? error["message"] : "Platform request failed",
          error["retryable"] === true,
          typeof error["correlation_id"] === "string" ? error["correlation_id"] : "unknown",
        );
      }
      throw new PlatformClientError("PLATFORM_ERROR", "Platform request failed", false, "unknown");
    }
    if (typeof payload !== "object" || payload === null) {
      throw new PlatformClientError("INVALID_RESPONSE", "Platform returned invalid JSON", false, "unknown");
    }
    const object = payload as Record<string, unknown>;
    const page = object["page"];
    const nextCursor =
      typeof page === "object" && page !== null && "next_cursor" in page
        ? ((page as Record<string, unknown>)["next_cursor"] as string | null)
        : null;
    const data = "items" in object ? { items: object["items"] } : { item: object };
    const item = (data["item"] ?? {}) as Record<string, unknown>;
    const limitations = strings(item["limitations"]);
    if (includesTermsEvidence(payload)) {
      limitations.push(
        "The terms review is informational and does not grant permission for commercial use, caching, or redistribution.",
      );
    }
    return {
      contract_version: "2026-09-01.v1",
      data,
      evidence: {
        source_record_ids: sourceRecordIds(payload),
        retrieved_at:
          typeof item["retrieved_at"] === "string"
            ? item["retrieved_at"]
            : typeof item["generated_at"] === "string"
              ? item["generated_at"]
              : new Date().toISOString(),
        freshness_status:
          typeof item["freshness_status"] === "string" ? item["freshness_status"] : "unknown",
        limitations,
      },
      next_cursor: nextCursor,
    };
  }
}
