import type {
  AccessExampleLanguage,
  AccessRecipe,
  ApiObject,
  ErrorEnvelope,
  Page,
  Query,
  SourceSummary,
} from "./types.js";

export class ApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly correlationId: string;
  readonly status: number;

  constructor(status: number, envelope: ErrorEnvelope) {
    super(envelope.message);
    this.name = "ApiError";
    this.status = status;
    this.code = envelope.code;
    this.retryable = envelope.retryable;
    this.correlationId = envelope.correlation_id;
  }
}

export interface ClientOptions {
  baseUrl: string;
  origin?: string;
  token?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export class HKDataClient {
  readonly #baseUrl: string;
  readonly #token: string | undefined;
  readonly #timeoutMs: number;
  readonly #fetcher: typeof fetch;

  constructor(options: ClientOptions) {
    const browserOrigin =
      typeof globalThis.location === "object" ? globalThis.location.origin : undefined;
    const base = new URL(options.baseUrl, options.origin ?? browserOrigin);
    const relativeLoopback =
      options.baseUrl.startsWith("/") &&
      !options.baseUrl.startsWith("//") &&
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if (base.protocol !== "https:" && !relativeLoopback) {
      throw new Error("baseUrl must use HTTPS");
    }
    this.#baseUrl = base.toString().replace(/\/$/, "");
    this.#token = options.token;
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#fetcher = options.fetcher ?? fetch;
  }

  async #request<T>(
    path: string,
    options: {
      method?: string;
      query?: Query;
      body?: unknown;
      ifMatch?: number;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    const url = new URL(`${this.#baseUrl}/${path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.#token !== undefined) {
      headers.authorization = `Bearer ${this.#token}`;
    }
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
    }
    if (options.ifMatch !== undefined) {
      headers["if-match"] = String(options.ifMatch);
    }
    Object.assign(headers, options.headers);
    const signal = AbortSignal.timeout(this.#timeoutMs);
    let response: Response;
    try {
      response = await this.#fetcher(url, {
        method: options.method ?? "GET",
        headers,
        signal,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch (error) {
      if (signal.aborted) {
        throw new Error("API request timed out");
      }
      throw new Error("API request failed", { cause: error });
    }
    const payload: unknown = await response.json();
    if (!response.ok) {
      if (
        typeof payload === "object" &&
        payload !== null &&
        "code" in payload &&
        "message" in payload &&
        "retryable" in payload &&
        "correlation_id" in payload
      ) {
        throw new ApiError(response.status, payload as ErrorEnvelope);
      }
      throw new ApiError(response.status, {
        code: "INVALID_ERROR_RESPONSE",
        message: "API returned an invalid error response",
        retryable: false,
        correlation_id: response.headers.get("x-correlation-id") ?? "unknown",
      });
    }
    return payload as T;
  }

  listSources(query: Query = {}): Promise<Page<SourceSummary>> {
    return this.#request("sources", { query });
  }

  async listAllSources(query: Query = {}): Promise<SourceSummary[]> {
    const items: SourceSummary[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.listSources({ ...query, cursor });
      items.push(...page.items);
      cursor = page.page.next_cursor ?? undefined;
    } while (cursor !== undefined);
    return items;
  }

  getSource(sourceId: string): Promise<ApiObject> {
    return this.#request(`sources/${encodeURIComponent(sourceId)}`);
  }

  listAccessRecipes(query: Query = {}): Promise<Page<AccessRecipe>> {
    return this.#request("access-recipes", { query });
  }

  getAccessRecipe(sourceReference: string): Promise<AccessRecipe> {
    return this.#request(`access-recipes/${encodeURIComponent(sourceReference)}`);
  }

  async getAccessExample(
    sourceReference: string,
    language: AccessExampleLanguage,
  ): Promise<string> {
    if (!(["curl", "python", "typescript"] as const).includes(language)) {
      throw new Error("language must be curl, python, or typescript");
    }
    const recipe = await this.getAccessRecipe(sourceReference);
    const example = recipe.examples[language];
    if (typeof example !== "string" || example.length === 0) {
      throw new Error(`${language} example is not available for this source`);
    }
    return example;
  }

  listSourceRecords(query: Query = {}): Promise<Page<ApiObject>> {
    return this.#request("source-records", { query });
  }

  getSourceRecord(sourceRecordId: string): Promise<ApiObject> {
    return this.#request(`source-records/${encodeURIComponent(sourceRecordId)}`);
  }

  queryEvents(query: Query = {}): Promise<Page<ApiObject>> {
    return this.#request("events", { query });
  }

  getEvent(eventId: string): Promise<ApiObject> {
    return this.#request(`events/${encodeURIComponent(eventId)}`);
  }

  listMonitorTargets(query: Query = {}): Promise<Page<ApiObject>> {
    return this.#request("monitor-targets", { query });
  }

  getMonitorTarget(monitorId: string, historyLimit = 20): Promise<ApiObject> {
    return this.#request(`monitor-targets/${encodeURIComponent(monitorId)}`, {
      query: { history_limit: historyLimit },
    });
  }

  listIncidents(query: Query = {}): Promise<Page<ApiObject>> {
    return this.#request("incidents", { query });
  }

  getIncident(incidentId: string): Promise<ApiObject> {
    return this.#request(`incidents/${encodeURIComponent(incidentId)}`);
  }

  statusSummary(query: Query = {}): Promise<ApiObject> {
    return this.#request("status/summary", { query });
  }

  createWebhookSubscription(input: ApiObject, idempotencyKey: string): Promise<ApiObject> {
    return this.#request("webhook-subscriptions", {
      method: "POST",
      body: input,
      headers: { "idempotency-key": idempotencyKey },
    });
  }

  listWebhookSubscriptions(query: Query = {}): Promise<{ items: ApiObject[] }> {
    return this.#request("webhook-subscriptions", { query });
  }

  verifyWebhookSubscription(subscriptionId: string): Promise<ApiObject> {
    return this.#request(`webhook-subscriptions/${encodeURIComponent(subscriptionId)}/verify`, {
      method: "POST",
    });
  }

  listWebhookDeliveries(query: Query = {}): Promise<{ items: ApiObject[] }> {
    return this.#request("webhook-deliveries", { query });
  }

  listAudit(query: Query = {}): Promise<Page<ApiObject>> {
    return this.#request("admin/audit", { query });
  }

  decideSourceApproval(sourceId: string, version: number, input: ApiObject): Promise<ApiObject> {
    return this.#request(`admin/sources/${encodeURIComponent(sourceId)}/approval-decisions`, {
      method: "POST",
      body: input,
      ifMatch: version,
    });
  }

  activateMonitorTarget(monitorId: string, version: number, input: ApiObject): Promise<ApiObject> {
    return this.#request(`admin/monitor-targets/${encodeURIComponent(monitorId)}/activate`, {
      method: "POST",
      body: input,
      ifMatch: version,
    });
  }

  activateConnector(sourceId: string, version: number, input: ApiObject): Promise<ApiObject> {
    return this.#request(`admin/sources/${encodeURIComponent(sourceId)}/connectors`, {
      method: "POST",
      body: input,
      ifMatch: version,
    });
  }

  actOnIncident(
    incidentId: string,
    action: "acknowledge" | "suppress" | "resolve" | "publish" | "correct",
    version: number,
    input: ApiObject,
  ): Promise<ApiObject> {
    return this.#request(`admin/incidents/${encodeURIComponent(incidentId)}/${action}`, {
      method: "POST",
      body: input,
      ifMatch: version,
    });
  }
}

export type {
  AccessExampleLanguage,
  AccessRecipe,
  AccessStatus,
  ApiObject,
  ErrorEnvelope,
  OperatingProfile,
  Page,
  Query,
  SourceSummary,
  TermsEvidenceState,
} from "./types.js";
