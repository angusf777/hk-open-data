import type { Locale } from "./types";

const messages = {
  en: {
    skip: "Skip to catalogue",
    catalogue: "Catalogue",
    toolkit: "Toolkit",
    about: "About",
    locale: "繁中",
    notice: "Independent community project. Check each source's current terms before use.",
    heading: "Hong Kong public data, mapped and runnable.",
    summary: (official: number, external: number, mcp: number) =>
      `Explore ${official} official resources, ${external} external services and ${mcp} MCP candidates.`,
    search: "Search names, providers, topics…",
    browse: "Browse resources",
    filter: "Filter resources",
    clear: "Clear all",
    resourceType: "Resource type",
    authentication: "Authentication",
    termsEvidence: "Terms review",
    all: "All",
    official: "Official resource",
    external: "External service",
    mcp: "MCP candidate",
    none: "None",
    apiKey: "API key",
    registration: "Registration",
    notReviewed: "No review recorded",
    ambiguity: "Questions remain",
    restriction: "Restrictions noted",
    results: (count: number) => `${count} resources`,
    noResults: "No resources match those filters.",
    showMore: "Show more resources",
    provider: "Provider",
    type: "Type",
    protocol: "Protocol",
    auth: "Auth",
    checked: "Checked",
    view: "View resource",
    back: "Back to catalogue",
    openProvider: "Open provider documentation",
    projectNotes: "Project notes",
    providerLinks: "Provider links",
    evidenceBoundary:
      "This dated review does not grant permission. Check the provider's current terms before commercial use, caching or redistribution.",
    projectNote:
      "This community-maintained entry may change. Verify details and terms on the provider's site before use.",
    toolkitHeading: "Run the toolkit locally",
    toolkitSummary: "Validate catalogue metadata and run optional integrations on your machine.",
    toolkitLink: "View toolkit quick start",
    legal:
      "HK Open Data is independently maintained and is not affiliated with any government agency or listed provider. Apache-2.0 covers project-authored code and catalogue material only; linked resources remain governed by their providers. Report corrections or request takedown through the repository process.",
    correction: "Corrections and takedowns",
    sourceReference: "Catalogue reference",
    access: "Access",
    languages: "Languages",
    verification: "Verification",
    formats: "Formats",
  },
  "zh-Hant": {
    skip: "跳至資源目錄",
    catalogue: "資源目錄",
    toolkit: "工具包",
    about: "關於",
    locale: "English",
    notice: "獨立社群項目。使用每項資源前，請先核對來源的現行條款。",
    heading: "香港公共數據，一站整理，隨時可用。",
    summary: (official: number, external: number, mcp: number) =>
      `探索 ${official} 項官方資源、${external} 項外部服務及 ${mcp} 個 MCP 候選項目。`,
    search: "搜尋名稱、供應者或主題…",
    browse: "瀏覽資源",
    filter: "篩選資源",
    clear: "清除全部",
    resourceType: "資源類型",
    authentication: "驗證方式",
    termsEvidence: "使用條款查核",
    all: "全部",
    official: "官方資源",
    external: "外部服務",
    mcp: "MCP 候選項目",
    none: "無需驗證",
    apiKey: "API 金鑰",
    registration: "需要登記",
    notReviewed: "未有查核紀錄",
    ambiguity: "仍有待釐清事項",
    restriction: "已註明限制",
    results: (count: number) => `${count} 項資源`,
    noResults: "沒有符合這些篩選條件的資源。",
    showMore: "顯示更多資源",
    provider: "供應者",
    type: "類型",
    protocol: "協定",
    auth: "驗證",
    checked: "核查日期",
    view: "查看資源",
    back: "返回資源目錄",
    openProvider: "開啟供應者文件",
    projectNotes: "項目註記",
    providerLinks: "供應者連結",
    evidenceBoundary:
      "這項日期化查核不會授予使用權。商業使用、快取或再分發前，請核實供應者的現行條款。",
    projectNote: "本社群維護的記錄可能有變。使用前請在供應者網站核實資料及條款。",
    toolkitHeading: "在本機執行工具包",
    toolkitSummary: "在你的電腦驗證目錄元數據，並執行可選整合。",
    toolkitLink: "查看工具包快速入門",
    legal:
      "HK Open Data 是獨立社群項目，與任何政府機構或所列供應者均無隸屬關係。Apache-2.0 只涵蓋項目自行編寫的程式碼及目錄材料；連結資源仍受其供應者條款規管。請透過程式庫流程提交更正或下架要求。",
    correction: "更正及下架",
    sourceReference: "目錄編號",
    access: "存取方式",
    languages: "語言",
    verification: "核實狀態",
    formats: "格式",
  },
} as const;

export function copy(locale: Locale) {
  return messages[locale];
}

export function humanize(value: string): string {
  const abbreviations: Record<string, string> = {
    https: "HTTPS",
    rest: "REST",
    json: "JSON",
    xml: "XML",
    csv: "CSV",
    rss: "RSS",
    mcp: "MCP",
    "api-key": "API key",
    oauth2: "OAuth 2.0",
  };
  if (abbreviations[value]) return abbreviations[value];
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const localizedValues: Record<string, [string, string]> = {
  official: ["Official", "官方資源"],
  external: ["External", "外部服務"],
  mcp: ["MCP", "MCP 候選項目"],
  none: ["None", "無需驗證"],
  "api-key": ["API key", "API 金鑰"],
  registration: ["Registration", "需要登記"],
  "open-endpoint": ["Open endpoint", "開放端點"],
  "registration-required": ["Registration required", "需要登記"],
  "credential-required": ["Credentials required", "需要憑證"],
  repository: ["Repository", "程式庫"],
  download: ["Download", "下載"],
  unknown: ["Unknown", "未知"],
  "not-applicable": ["Not applicable", "不適用"],
  "not-reviewed": ["No review recorded", "未有查核紀錄"],
  "ambiguity-identified": ["Questions remain", "仍有待釐清事項"],
  "restriction-identified": ["Restrictions noted", "已註明限制"],
  "official-terms-linked": ["Official terms linked", "已連結官方條款"],
  "provider-confirmation-recorded": ["Provider confirmation recorded", "已記錄供應者確認"],
  candidate: ["Candidate", "候選項目"],
  "metadata-reviewed": ["Metadata reviewed", "已審查元數據"],
  "link-verified": ["Link verified", "已核實連結"],
  "source-reviewed": ["Source reviewed", "已審查來源"],
  stale: ["Stale", "可能過時"],
  unavailable: ["Unavailable", "無法使用"],
  en: ["English", "英文"],
  "zh-Hant": ["Traditional Chinese", "繁體中文"],
  "zh-Hans": ["Simplified Chinese", "簡體中文"],
};

export function labelValue(value: string, locale: Locale): string {
  const localized = localizedValues[value];
  if (localized) return localized[locale === "en" ? 0 : 1];
  return humanize(value);
}
