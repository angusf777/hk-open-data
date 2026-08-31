import { HKDataClient, type OperatingProfile, type SourceSummary, type TermsEvidenceState } from "@hk-open-data/sdk-typescript";

export interface PublicStatus { generatedAt: string; overall: string; snapshot: boolean; counts: { operational: number; degraded: number; outage: number; unknown: number } }
export interface PublicIncident { id: string; sourceId: string; sourceName: string; provider: string; severity: string; state: string; openedAt: string; summary: string; reviewed: boolean }
export interface PublicSource { id: string; name: string; provider: string; authority: string; freshness: string; lastObserved: string | null; limitations: string[]; termsEvidenceState?: TermsEvidenceState | undefined; activationStatus?: string | undefined; operatingProfile?: OperatingProfile | undefined }
export interface PublicSnapshot { status: PublicStatus; incidents: PublicIncident[]; sources: PublicSource[] }
export interface PortalApi { getDashboard(): Promise<PublicSnapshot>; getStatus(): Promise<PublicStatus>; listIncidents(): Promise<PublicIncident[]>; listSources(): Promise<PublicSource[]> }
export interface SnapshotStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

function text(value: unknown, fallback: string): string { return typeof value === "string" && value !== "" ? value : fallback; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function localizedText(value: unknown, fallback: string): string {
  if (typeof value === "object" && value !== null) {
    const localized = value as Record<string, unknown>;
    return text(localized["en"] ?? localized["zh_Hant"], fallback);
  }
  return text(value, fallback);
}

export function createSnapshotPortalApi(live: Omit<PortalApi, "getDashboard">, storage?: SnapshotStorage): PortalApi {
  const key = "hk-public-status-snapshot-v1";
  return {
    ...live,
    async getDashboard() {
      try {
        const [status, incidents, sources] = await Promise.all([
          live.getStatus(),
          live.listIncidents(),
          live.listSources(),
        ]);
        const snapshot = { status: { ...status, snapshot: false }, incidents, sources };
        storage?.setItem(key, JSON.stringify(snapshot));
        return snapshot;
      } catch (error) {
        const stored = storage?.getItem(key);
        if (stored === null || stored === undefined) throw error;
        try {
          const snapshot = JSON.parse(stored) as PublicSnapshot;
          if (
            typeof snapshot.status?.generatedAt !== "string" ||
            !Array.isArray(snapshot.incidents) ||
            !Array.isArray(snapshot.sources)
          ) {
            throw new Error("invalid snapshot");
          }
          return { ...snapshot, status: { ...snapshot.status, snapshot: true } };
        } catch {
          throw error;
        }
      }
    },
  };
}

export function createLivePortalApi(baseUrl: string): PortalApi {
  const client = new HKDataClient({ baseUrl });
  const live = {
    async getStatus() {
      const value = await client.statusSummary(); const counts = (value["counts"] ?? {}) as Record<string, unknown>;
      return { generatedAt: text(value["generated_at"], new Date(0).toISOString()), overall: text(value["overall"], "unknown"), snapshot: false, counts: { operational: Number(counts["operational"] ?? 0), degraded: Number(counts["degraded"] ?? 0), outage: Number(counts["major_outage"] ?? counts["outage"] ?? 0), unknown: Number(counts["unknown"] ?? 0) } };
    },
    async listIncidents() {
      const [page, sources] = await Promise.all([
        client.listIncidents({ status: "open", limit: 100 }),
        client.listAllSources({ limit: 200 }),
      ]);
      const byId = new Map(sources.map((source) => [source.source_id, source]));
      return page.items.map((item) => {
        const sourceId = text(item["source_id"], "Unknown source");
        const source = byId.get(sourceId);
        return { id: text(item["incident_id"], "Unknown incident"), sourceId, sourceName: text(source?.name, sourceId), provider: text(source?.provider, "Provider not listed"), severity: text(item["severity"], "unknown"), state: text(item["status"], "unknown"), openedAt: text(item["opened_at"], new Date(0).toISOString()), summary: localizedText(item["public_summary"], "Reviewed details are not yet available"), reviewed: item["public_state"] === "published" || item["public_state"] === "corrected" };
      });
    },
    async listSources() {
      return (await client.listAllSources({ limit: 200 })).map((item: SourceSummary) => ({ id: item.source_id, name: text(item.name, item.source_id), provider: text(item.provider, "Provider not listed"), authority: text(item["authority_class"], "unclassified"), freshness: text(item.freshness_status, "unknown"), lastObserved: typeof item["last_observed_at"] === "string" ? item["last_observed_at"] : null, limitations: strings(item["limitations"]), termsEvidenceState: item.terms_evidence_state, activationStatus: text(item.approval_status, "specified_pending_approval"), operatingProfile: item.operating_profile }));
    },
  } satisfies Omit<PortalApi, "getDashboard">;
  const storage = typeof globalThis.localStorage === "object" ? globalThis.localStorage : undefined;
  return createSnapshotPortalApi(live, storage);
}

export function createFixturePortalApi(): PortalApi {
  const live = {
    async getStatus() { return { generatedAt: new Date().toISOString(), overall: "degraded", snapshot: false, counts: { operational: 43, degraded: 5, outage: 2, unknown: 0 } }; },
    async listIncidents() { return [
      { id: "INC-2026-000143", sourceId: "HKAPI-021", sourceName: "CSDI WFS", provider: "Development Bureau (CSDI)", severity: "major", state: "Investigating", openedAt: "2026-08-28T09:12:00+08:00", summary: "A reviewed schema change affects the CSDI Web Feature Service.", reviewed: true },
      { id: "INC-2026-000144", sourceId: "HKAPI-041", sourceName: "HKMA Daily Series", provider: "Hong Kong Monetary Authority", severity: "minor", state: "Identified", openedAt: "2026-08-28T08:05:00+08:00", summary: "The latest reviewed publication is delayed.", reviewed: true },
    ]; },
    async listSources() { return [
      { id: "HKAPI-021", name: "CSDI WFS", provider: "Development Bureau (CSDI)", authority: "official", freshness: "outage", lastObserved: "2026-08-28T09:12:00+08:00", limitations: ["Schema review in progress"] },
      { id: "HKAPI-041", name: "HKMA Daily Series", provider: "Hong Kong Monetary Authority", authority: "official", freshness: "stale", lastObserved: "2026-08-28T08:05:00+08:00", limitations: ["Publication delayed"] },
      { id: "HKAPI-001", name: "DATA.GOV.HK CKAN", provider: "Digital Policy Office", authority: "official", freshness: "fresh", lastObserved: "2026-08-28T10:18:00+08:00", limitations: [] },
      { id: "HKAPI-016", name: "Hong Kong Observatory", provider: "Hong Kong Observatory", authority: "official", freshness: "fresh", lastObserved: "2026-08-28T10:20:00+08:00", limitations: [] },
    ]; },
  } satisfies Omit<PortalApi, "getDashboard">;
  return createSnapshotPortalApi(live);
}
