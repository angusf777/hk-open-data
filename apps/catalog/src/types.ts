export type Locale = "en" | "zh-Hant";

export interface LocalizedText {
  en: string;
  "zh-Hant": string;
}

export type ResourceType = "official" | "external" | "mcp";

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
}

export interface CatalogueCounts {
  total: number;
  byType: Record<string, number>;
  byTermsEvidenceState: Record<string, number>;
  byTranslationStatus: Record<string, number>;
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
}

declare global {
  interface Window {
    __HK_OPEN_DATA_RESOURCE_ID__?: string;
  }
}
