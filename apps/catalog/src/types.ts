export type Locale = "en" | "zh-Hant";

export interface LocalizedText {
  en: string;
  "zh-Hant": string;
}

export type ResourceType = "official" | "external" | "mcp";

export type AccessStatus =
  | "live-verified"
  | "fixture-tested"
  | "credential-required"
  | "manual-only"
  | "blocked"
  | "unavailable";

export interface AccessParameter {
  name: string;
  location: "path" | "query" | "header" | "body";
  dataType: string;
  required: boolean;
  default: string | number | boolean | null;
  example: string | number | boolean | null;
  description: string;
  enum: Array<string | number | boolean>;
  minimum?: number | null;
  maximum?: number | null;
  pattern?: string | null;
}

export interface AccessRecipe {
  schemaVersion: 1;
  sourceReference: string;
  recipeVersion: string;
  adapter: string;
  status: AccessStatus;
  effectiveStatus: AccessStatus;
  documentationUrl: string;
  limitations: string[];
  authentication: {
    type: string;
    environmentVariables: string[];
    setup: string | null;
  };
  request: {
    method: "GET" | "POST" | "HEAD";
    urlTemplate: string;
    allowedHosts: string[];
    parameters: AccessParameter[];
    headers: Array<{
      name: string;
      value: string | null;
      environmentVariable: string | null;
    }>;
    bodyTemplate: unknown;
    timeoutMs: number;
    maxResponseBytes: number;
    maxPages: number;
    retry: { attempts: number; statusCodes: number[] };
  } | null;
  response: {
    mediaTypes: string[];
    recordPath: string;
    idPath: string | null;
    timestampPath: string | null;
    pagination: { strategy: string; nextPath: string | null };
    normalization: {
      fields: Record<string, string>;
      language: string | null;
      geometry: string | null;
      timestamp: string | null;
    };
  } | null;
  reason: string | null;
  nextAction: string | null;
  recipeSha256: string;
  examples: {
    curl: string | null;
    python: string | null;
    typescript: string | null;
  };
  verification: {
    checkedAt: string;
    validUntil: string;
    outcome: "success" | "failure";
    errorCode: string | null;
    recipeSha256: string;
    finalHost: string;
    httpStatus: number | null;
    elapsedMs: number;
    mediaType: string | null;
    responseBytes: number;
    responseSha256: string | null;
    schemaFingerprint: string | null;
    parsedRecordCount: number;
    limitations: string[];
    toolVersion: string;
  } | null;
}

export interface Resource {
  schemaVersion: 1;
  id: string;
  sourceReference: string;
  type: ResourceType;
  publicationStatus: "published" | "draft" | "archived";
  name: LocalizedText;
  summary: LocalizedText;
  translationStatus: "seeded" | "reviewed";
  provider: {
    name: LocalizedText;
    type: string;
  };
  categories: string[];
  tags?: string[];
  protocols: string[];
  formats: string[];
  authentication: string;
  access: string;
  urls: {
    landing: string | null;
    documentation: string | null;
    terms: string | null;
  };
  languages: string[];
  availability?: string | null;
  updateCadence?: string | null;
  verification: {
    status: string;
    checkedAt: string;
    evidenceUrl: string;
  };
  termsEvidence: {
    state: string;
    checkedAt: string;
    note: LocalizedText;
    attribution: LocalizedText | null;
    restrictions: LocalizedText[];
  };
  integrations: {
    connector: string;
    sdk: string;
    mcp: string;
  };
  accessRecipe?: AccessRecipe;
}

export interface CatalogueCounts {
  total: number;
  byType: Record<string, number>;
  byTermsEvidenceState: Record<string, number>;
  byTranslationStatus: Record<string, number>;
  byAccessStatus: Record<string, number>;
  accessExecutable: number;
  accessLiveVerified: number;
}

export interface Catalogue {
  schemaVersion: 1;
  resources: Resource[];
  counts: CatalogueCounts;
}

export interface ResourceFilters {
  type?: string;
  authentication?: string;
  termsState?: string;
  category?: string;
  access?: "executable" | "live" | "none";
}

declare global {
  interface Window {
    __HK_OPEN_DATA_RESOURCE_ID__?: string;
  }
}
