import type { Catalogue, Resource } from "./types";

export const fixtureResources: Resource[] = [
  {
    schemaVersion: 1,
    id: "official:hko",
    sourceReference: "HKAPI-HKO",
    type: "official",
    publicationStatus: "published",
    name: { en: "Hong Kong Observatory Open Data API", "zh-Hant": "香港天文台開放數據 API" },
    summary: {
      en: "Weather observations, forecasts and warnings.",
      "zh-Hant": "天氣觀測、預報及警告。",
    },
    translationStatus: "reviewed",
    provider: {
      name: { en: "Hong Kong Observatory", "zh-Hant": "香港天文台" },
      type: "public-authority",
    },
    categories: ["weather"],
    tags: ["forecast"],
    protocols: ["https", "rest"],
    formats: ["json"],
    authentication: "none",
    access: "open-endpoint",
    urls: {
      landing: "https://www.hko.gov.hk/",
      documentation: "https://www.hko.gov.hk/en/abouthko/opendata_intro.htm",
      terms: null,
    },
    languages: ["en", "zh-Hant"],
    verification: {
      status: "metadata-reviewed",
      checkedAt: "2026-08-27",
      evidenceUrl: "https://www.hko.gov.hk/en/abouthko/opendata_intro.htm",
    },
    termsEvidence: {
      state: "ambiguity-identified",
      checkedAt: "2026-08-27",
      note: {
        en: "Current provider terms require review.",
        "zh-Hant": "須審查供應者的現行條款。",
      },
      attribution: null,
      restrictions: [],
    },
    integrations: { connector: "none", sdk: "none", mcp: "none" },
  },
  {
    schemaVersion: 1,
    id: "external:map",
    sourceReference: "EXT-MAP",
    type: "external",
    publicationStatus: "published",
    name: { en: "Map Service", "zh-Hant": "地圖服務" },
    summary: { en: "Map data.", "zh-Hant": "地圖數據。" },
    translationStatus: "reviewed",
    provider: { name: { en: "Map Provider", "zh-Hant": "地圖供應者" }, type: "third-party" },
    categories: ["geospatial"],
    tags: [],
    protocols: ["https"],
    formats: ["json"],
    authentication: "api-key",
    access: "credential-required",
    urls: { landing: "https://example.com", documentation: "https://example.com/docs", terms: null },
    languages: ["en"],
    verification: { status: "candidate", checkedAt: "2026-08-27", evidenceUrl: "https://example.com" },
    termsEvidence: {
      state: "not-reviewed",
      checkedAt: "2026-08-27",
      note: { en: "Not reviewed.", "zh-Hant": "尚未審查。" },
      attribution: null,
      restrictions: [],
    },
    integrations: { connector: "none", sdk: "none", mcp: "none" },
  },
];

export const fixtureCatalogue: Catalogue = {
  schemaVersion: 1,
  resources: fixtureResources,
  counts: {
    total: 2,
    byType: { official: 1, external: 1 },
    byTermsEvidenceState: { "ambiguity-identified": 1, "not-reviewed": 1 },
    byTranslationStatus: { reviewed: 2 },
  },
};
