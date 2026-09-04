import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy as CopyIcon,
  ExternalLink,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { loadProviderResourceInventory } from "../data";
import {
  filterProviderResources,
  providerResourceFormats,
  renderProviderResourceCommand,
  type ProviderResourceLanguage,
} from "../provider-resources";
import type {
  Locale,
  ProviderResource,
  ProviderResourceAccess,
  ProviderResourceInventory,
  ProviderResourceKind,
  ProviderResourceVerificationStatus,
} from "../types";

interface ProviderResourceBrowserProps {
  locale: Locale;
  onBack: () => void;
}

const PAGE_SIZE = 20;
const languageLabels: Record<ProviderResourceLanguage, string> = {
  curl: "cURL",
  python: "Python",
  node: "Node",
  hkdata: "hkdata",
};

const messages = {
  en: {
    breadcrumb: "Provider files and endpoints",
    heading: "Browse provider files and endpoints",
    summary: (total: number, datasets: number) =>
      `Search ${total.toLocaleString("en-HK")} provider files and API endpoints mapped from ${datasets.toLocaleString("en-HK")} DATA.GOV.HK datasets. Browsing stays local; providers are contacted only if you open a resource or run a command.`,
    ready: "HTTPS URL",
    parameters: "Parameters needed",
    insecure: "HTTP only",
    invalid: "Invalid URL",
    search: "Search datasets, resource names, formats or URLs…",
    access: "URL status",
    kind: "Resource type",
    verification: "Payload evidence",
    format: "Format",
    allAccess: "All access",
    allFormats: "All formats",
    allKinds: "All resource types",
    allVerification: "All evidence states",
    clear: "Clear filters",
    results: (count: number) => `${count.toLocaleString("en-HK")} ${count === 1 ? "resource" : "resources"}`,
    checked: "Inventory checked",
    dataset: "Dataset",
    source: "Source",
    viewUsage: "View usage",
    hideUsage: "Hide usage",
    copy: "Copy command",
    copied: "Command copied",
    copyFailed: "The command could not be copied.",
    parameterHelp: "Set every required parameter to generate a safe command.",
    safety: "Commands contact the listed provider directly. Check current terms before use.",
    unsafe:
      "Safe fetching is unavailable for this HTTP-only or invalid resource. Use the provider documentation to look for a current HTTPS alternative.",
    loadMore: "Load more",
    showing: (shown: number, total: number) =>
      `Showing 1 to ${shown.toLocaleString("en-HK")} of ${total.toLocaleString("en-HK")} results`,
    empty: "No provider resources match these filters.",
    loading: "Loading the local provider-resource inventory…",
    loadError: "Provider resources unavailable",
    retry: "Retry",
    back: "Back to catalogue",
    openResource: "Open provider resource",
    liveVerified: "Payload verified",
    failed: "Probe failed",
    metadataOnly: "Metadata only",
    evidenceChecked: "Evidence checked",
    observedMedia: "Observed media type",
    directUnavailable:
      "Runnable code is offered only for direct files and API endpoints that passed a bounded payload check. Open this provider page for the authoritative access path.",
    unverifiedUnavailable:
      "This appears to be a direct file or API, but this exact resource has not passed a bounded payload check. Open the resource and verify it before adapting code.",
    failedUnavailable:
      "The latest bounded attempt for this exact resource did not succeed, so runnable code is withheld.",
    kindLabels: {
      api: "API endpoint",
      file: "Direct file",
      "dataset-page": "Dataset page",
      geoportal: "Geoportal",
      "web-page": "Web page",
      unknown: "Unclassified",
    },
  },
  "zh-Hant": {
    breadcrumb: "供應者檔案及端點",
    heading: "瀏覽供應者檔案及端點",
    summary: (total: number, datasets: number) =>
      `搜尋 ${total.toLocaleString("zh-HK")} 個供應者檔案及 API 端點，涵蓋 ${datasets.toLocaleString("zh-HK")} 個 DATA.GOV.HK 數據集。瀏覽只在本機進行；只有開啟資源或執行指令時才會聯絡供應者。`,
    ready: "HTTPS 網址",
    parameters: "需要參數",
    insecure: "只提供 HTTP",
    invalid: "網址無效",
    search: "搜尋數據集、資源名稱、格式或網址…",
    access: "網址狀態",
    kind: "資源類型",
    verification: "內容核實證據",
    format: "格式",
    allAccess: "全部存取狀態",
    allFormats: "全部格式",
    allKinds: "全部資源類型",
    allVerification: "全部證據狀態",
    clear: "清除篩選",
    results: (count: number) => `${count.toLocaleString("zh-HK")} 項資源`,
    checked: "資源清單核查日期",
    dataset: "數據集",
    source: "來源",
    viewUsage: "查看用法",
    hideUsage: "隱藏用法",
    copy: "複製指令",
    copied: "已複製指令",
    copyFailed: "無法複製指令。",
    parameterHelp: "填寫所有必要參數後，系統才會產生安全指令。",
    safety: "指令會直接聯絡所列供應者。使用前請核對現行條款。",
    unsafe: "此資源只提供 HTTP 或網址無效，因此不提供安全擷取指令。請在供應者文件尋找現行 HTTPS 替代方案。",
    loadMore: "顯示更多",
    showing: (shown: number, total: number) =>
      `正顯示第 1 至 ${shown.toLocaleString("zh-HK")} 項，共 ${total.toLocaleString("zh-HK")} 項結果`,
    empty: "沒有符合這些篩選條件的供應者資源。",
    loading: "正在載入本機供應者資源清單…",
    loadError: "無法載入供應者資源",
    retry: "重試",
    back: "返回資源目錄",
    openResource: "開啟供應者資源",
    liveVerified: "已核實內容",
    failed: "核查失敗",
    metadataOnly: "只核實元數據",
    evidenceChecked: "證據核查日期",
    observedMedia: "觀察所得媒體類型",
    directUnavailable: "只有通過有界限內容核查的直接檔案及 API 端點才會提供可執行程式碼。請開啟供應者頁面查閱官方存取方式。",
    unverifiedUnavailable: "此項目看似直接檔案或 API，但尚未通過個別有界限內容核查。請先開啟並核實資源，再調整程式碼。",
    failedUnavailable: "此項資源最近一次有界限核查未能成功，因此不會提供可執行程式碼。",
    kindLabels: {
      api: "API 端點",
      file: "直接檔案",
      "dataset-page": "數據集頁面",
      geoportal: "空間數據平台",
      "web-page": "網頁",
      unknown: "未分類",
    },
  },
} as const;

function accessLabel(access: ProviderResourceAccess, locale: Locale): string {
  const text = messages[locale];
  return {
    ready: text.ready,
    "parameters-required": text.parameters,
    "insecure-http": text.insecure,
    "invalid-url": text.invalid,
  }[access];
}

function verificationLabel(status: ProviderResourceVerificationStatus, locale: Locale): string {
  const text = messages[locale];
  return {
    "live-verified": text.liveVerified,
    failed: text.failed,
    "metadata-only": text.metadataOnly,
  }[status];
}

export function ProviderResourceBrowser({ locale, onBack }: ProviderResourceBrowserProps) {
  const [inventory, setInventory] = useState<ProviderResourceInventory>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const initialSource = new URLSearchParams(window.location.search).get("source") ?? "";
  const [query, setQuery] = useState(initialSource);
  const [access, setAccess] = useState<ProviderResourceAccess | "all">("all");
  const [format, setFormat] = useState("all");
  const [kind, setKind] = useState<ProviderResourceKind | "all">("all");
  const [verification, setVerification] = useState<ProviderResourceVerificationStatus | "all">("all");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [expandedKey, setExpandedKey] = useState<string>();
  const text = messages[locale];

  useEffect(() => {
    const controller = new AbortController();
    setError(undefined);
    loadProviderResourceInventory(controller.signal)
      .then(setInventory)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Provider resource inventory could not be loaded.");
        }
      });
    return () => controller.abort();
  }, [attempt]);

  const filtered = useMemo(
    () =>
      inventory
        ? filterProviderResources(inventory.resources, { query, access, format, kind, verification })
        : [],
    [access, format, inventory, kind, query, verification],
  );
  const formats = useMemo(
    () => (inventory ? providerResourceFormats(inventory.resources) : []),
    [inventory],
  );
  const counts = useMemo(() => {
    const values = { ready: 0, "parameters-required": 0, "insecure-http": 0, "invalid-url": 0 };
    for (const resource of inventory?.resources ?? []) values[resource.access] += 1;
    return values;
  }, [inventory]);
  const datasetCount = useMemo(
    () => new Set(inventory?.resources.map((resource) => resource.datasetId)).size,
    [inventory],
  );

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
    setExpandedKey(undefined);
  }, [access, format, kind, query, verification]);

  const clearFilters = () => {
    setQuery("");
    setAccess("all");
    setFormat("all");
    setKind("all");
    setVerification("all");
    window.history.replaceState({}, "", `${import.meta.env.BASE_URL}provider-resources/`);
  };

  if (error) {
    return (
      <main id="main-content" className="provider-browser provider-browser-state">
        <h1>{text.loadError}</h1>
        <p>{error}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          {text.retry}
        </button>
      </main>
    );
  }
  if (!inventory) {
    return (
      <main id="main-content" className="provider-browser provider-browser-state">
        <p>{text.loading}</p>
      </main>
    );
  }

  const visible = filtered.slice(0, visibleLimit);
  return (
    <main id="main-content" className="provider-browser">
      <nav className="breadcrumbs" aria-label={locale === "en" ? "Breadcrumb" : "頁面路徑"}>
        <button type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={16} />
          {text.back}
        </button>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{text.breadcrumb}</span>
      </nav>

      <section className="provider-browser-introduction" aria-labelledby="provider-browser-title">
        <div>
          <h1 id="provider-browser-title">{text.heading}</h1>
          <p>{text.summary(inventory.resources.length, datasetCount)}</p>
          <small>
            {text.checked}:{" "}
            {new Date(inventory.checkedAt).toLocaleDateString(locale === "en" ? "en-HK" : "zh-HK", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </small>
        </div>
        <span className="provider-browser-route" aria-hidden="true" />
      </section>

      <dl className="provider-resource-counts">
        {(["ready", "parameters-required", "insecure-http"] as const).map((status) => (
          <div key={status}>
            <dd>{counts[status].toLocaleString(locale === "en" ? "en-HK" : "zh-HK")}</dd>
            <dt>{accessLabel(status, locale)}</dt>
          </div>
        ))}
      </dl>

      <section className="provider-resource-controls" aria-label={locale === "en" ? "Resource filters" : "資源篩選器"}>
        <label className="provider-resource-search">
          <span className="visually-hidden">{text.search}</span>
          <Search aria-hidden="true" size={20} strokeWidth={1.7} />
          <input
            type="search"
            value={query}
            placeholder={text.search}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>{text.access}</span>
          <select value={access} onChange={(event) => setAccess(event.target.value as ProviderResourceAccess | "all")}>
            <option value="all">{text.allAccess}</option>
            <option value="ready">{text.ready}</option>
            <option value="parameters-required">{text.parameters}</option>
            <option value="insecure-http">{text.insecure}</option>
            <option value="invalid-url">{text.invalid}</option>
          </select>
        </label>
        <label>
          <span>{text.kind}</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as ProviderResourceKind | "all")}>
            <option value="all">{text.allKinds}</option>
            {(Object.keys(text.kindLabels) as ProviderResourceKind[]).map((value) => (
              <option key={value} value={value}>{text.kindLabels[value]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{text.verification}</span>
          <select value={verification} onChange={(event) => setVerification(event.target.value as ProviderResourceVerificationStatus | "all")}>
            <option value="all">{text.allVerification}</option>
            <option value="live-verified">{text.liveVerified}</option>
            <option value="failed">{text.failed}</option>
            <option value="metadata-only">{text.metadataOnly}</option>
          </select>
        </label>
        <label>
          <span>{text.format}</span>
          <select value={format} onChange={(event) => setFormat(event.target.value)}>
            <option value="all">{text.allFormats}</option>
            {formats.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <button
          className="provider-resource-clear"
          type="button"
          disabled={!query && access === "all" && format === "all" && kind === "all" && verification === "all"}
          onClick={clearFilters}
        >
          {text.clear}
        </button>
      </section>

      <section className="provider-resource-results" aria-labelledby="provider-resource-results-title">
        <div className="provider-resource-results-heading">
          <h2 id="provider-resource-results-title">{text.results(filtered.length)}</h2>
        </div>
        {visible.length > 0 ? (
          <div className="provider-resource-list">
            {visible.map((resource) => {
              const key = `${resource.datasetId}:${resource.resourceId}`;
              const expanded = expandedKey === key;
              return (
                <ProviderResourceRow
                  key={key}
                  locale={locale}
                  resource={resource}
                  expanded={expanded}
                  onToggle={() => setExpandedKey(expanded ? undefined : key)}
                />
              );
            })}
          </div>
        ) : (
          <p className="provider-resource-empty">{text.empty}</p>
        )}
        {filtered.length > visible.length && (
          <button className="provider-resource-load-more" type="button" onClick={() => setVisibleLimit((value) => value + PAGE_SIZE)}>
            {text.loadMore}
          </button>
        )}
        {visible.length > 0 && <p className="provider-resource-showing">{text.showing(visible.length, filtered.length)}</p>}
      </section>
    </main>
  );
}

interface ProviderResourceRowProps {
  locale: Locale;
  resource: ProviderResource;
  expanded: boolean;
  onToggle: () => void;
}

function ProviderResourceRow({ locale, resource, expanded, onToggle }: ProviderResourceRowProps) {
  const text = messages[locale];
  const safeLink = resource.access === "ready" ? resource.urlTemplate : null;
  return (
    <article className="provider-resource-row" aria-label={resource.name}>
      <span className="provider-resource-disclosure" aria-hidden="true">
        {expanded ? <ChevronUp aria-hidden="true" size={18} /> : <ChevronDown aria-hidden="true" size={18} />}
      </span>
      <div className="provider-resource-identity">
        <h3>{resource.name}</h3>
        <p><strong>{text.dataset}</strong> {resource.datasetId}</p>
      </div>
      <dl className="provider-resource-metadata">
        <div><dt>{text.source}</dt><dd>{resource.sourceReferences.join(", ")}</dd></div>
        <div><dt>{text.format}</dt><dd>{resource.format}</dd></div>
        <div><dt>{text.kind}</dt><dd>{text.kindLabels[resource.resourceKind]}</dd></div>
        <div><dt>{text.access}</dt><dd className={`provider-access provider-access-${resource.access}`}>{accessLabel(resource.access, locale)}</dd></div>
        <div><dt>{text.verification}</dt><dd className={`provider-verification provider-verification-${resource.verification.status}`}>{verificationLabel(resource.verification.status, locale)}</dd></div>
      </dl>
      <div className="provider-resource-url">
        {safeLink ? (
          <a href={safeLink} target="_blank" rel="noreferrer" aria-label={`${text.openResource}: ${resource.name}`}>
            {resource.urlTemplate}<ExternalLink aria-hidden="true" size={14} />
          </a>
        ) : (
          <code>{resource.urlTemplate}</code>
        )}
      </div>
      <button className="provider-resource-usage-button" type="button" onClick={onToggle} aria-expanded={expanded}>
        {expanded ? text.hideUsage : text.viewUsage}
      </button>
      {expanded && <ProviderResourceUsage locale={locale} resource={resource} />}
    </article>
  );
}

function ProviderResourceUsage({ locale, resource }: { locale: Locale; resource: ProviderResource }) {
  const text = messages[locale];
  const [language, setLanguage] = useState<ProviderResourceLanguage>("curl");
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");
  const command = renderProviderResourceCommand(resource, language, parameters);
  const unsafe = resource.access === "insecure-http" || resource.access === "invalid-url";
  const direct = resource.resourceKind === "api" || resource.resourceKind === "file";
  const copyCommand = useCallback(async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setAnnouncement(text.copied);
    } catch {
      setAnnouncement(text.copyFailed);
    }
  }, [command, text.copied, text.copyFailed]);

  if (unsafe) {
    return <p className="provider-resource-unsafe"><AlertTriangle aria-hidden="true" size={20} />{text.unsafe}</p>;
  }
  if (!direct || resource.verification.status !== "live-verified") {
    const message = !direct
      ? text.directUnavailable
      : resource.verification.status === "failed"
        ? text.failedUnavailable
        : text.unverifiedUnavailable;
    return (
      <section className="provider-resource-usage provider-resource-evidence" aria-label={`${text.verification}: ${resource.name}`}>
        <p className="provider-resource-unsafe"><AlertTriangle aria-hidden="true" size={20} />{message}</p>
        <dl>
          <div><dt>{text.evidenceChecked}</dt><dd>{new Date(resource.verification.checkedAt).toLocaleString(locale === "en" ? "en-HK" : "zh-HK")}</dd></div>
          <div><dt>{text.observedMedia}</dt><dd>{resource.verification.mediaType ?? "—"}</dd></div>
        </dl>
      </section>
    );
  }
  return (
    <section className="provider-resource-usage" aria-label={`${text.viewUsage}: ${resource.name}`}>
      {resource.templateParameters.length > 0 && (
        <div className="provider-resource-parameters">
          {resource.templateParameters.map((name) => (
            <label key={name}>
              <span>{name}</span>
              <input value={parameters[name] ?? ""} onChange={(event) => setParameters((current) => ({ ...current, [name]: event.target.value }))} />
            </label>
          ))}
        </div>
      )}
      <div className="provider-resource-example-heading">
        <div role="tablist" aria-label={locale === "en" ? "Command language" : "指令語言"}>
          {(Object.keys(languageLabels) as ProviderResourceLanguage[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={language === value}
              onClick={() => setLanguage(value)}
            >
              {languageLabels[value]}
            </button>
          ))}
        </div>
        <button type="button" className="provider-resource-copy" onClick={copyCommand} disabled={!command}>
          <CopyIcon aria-hidden="true" size={16} />{text.copy}
        </button>
      </div>
      {command ? <pre><code>{command}</code></pre> : <p className="provider-resource-command-placeholder">{text.parameterHelp}</p>}
      <p className="provider-resource-safety"><AlertTriangle aria-hidden="true" size={18} />{text.safety}</p>
      <p className="copy-announcement" role="status" aria-live="polite">
        {announcement && <><Check aria-hidden="true" size={15} />{announcement}</>}
      </p>
    </section>
  );
}
