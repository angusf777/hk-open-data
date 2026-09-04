import { Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Disclaimer } from "./components/Disclaimer";
import { Filters } from "./components/Filters";
import { Hero } from "./components/Hero";
import { ProviderResourceBrowser } from "./components/ProviderResourceBrowser";
import { ResourceCard } from "./components/ResourceCard";
import { ResourceDetail } from "./components/ResourceDetail";
import { ToolkitBand } from "./components/ToolkitBand";
import { copy } from "./i18n";
import { searchResources } from "./search";
import type { Catalogue, Locale, Resource, ResourceFilters } from "./types";

interface AppProps {
  catalogue: Catalogue;
  initialLocale?: Locale;
}

export function App({ catalogue, initialLocale = "en" }: AppProps) {
  const pathCategory = decodeURIComponent(
    window.location.pathname.match(/\/categories\/([^/]+)\/?$/)?.[1] ?? "",
  );
  const initialCategory = window.__HK_OPEN_DATA_CATEGORY__ ?? (pathCategory || undefined);
  const pathDatasetId = decodeURIComponent(
    window.location.pathname.match(/\/datasets\/([^/]+)\/?$/)?.[1] ?? "",
  );
  const initialDatasetId = window.__HK_OPEN_DATA_DATASET_ID__ ?? (pathDatasetId || undefined);
  const initialProviderBrowser =
    /\/provider-resources\/?$/.test(window.location.pathname) || Boolean(initialDatasetId);
  const initialResource = catalogue.resources.find(
    (resource) => resource.id === window.__HK_OPEN_DATA_RESOURCE_ID__,
  );
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ResourceFilters>(
    initialCategory ? { category: initialCategory } : {},
  );
  const [selected, setSelected] = useState<Resource | undefined>(
    initialProviderBrowser ? undefined : initialResource,
  );
  const [providerBrowser, setProviderBrowser] = useState(initialProviderBrowser);
  const [providerDatasetId, setProviderDatasetId] = useState<string | undefined>(initialDatasetId);
  const [visibleLimit, setVisibleLimit] = useState(10);
  const text = copy(locale);
  const visibleResources = useMemo(
    () => searchResources(catalogue.resources, query, filters),
    [catalogue.resources, filters, query],
  );
  useEffect(() => setVisibleLimit(10), [filters, query]);

  const openResource = (resource: Resource) => {
    setProviderBrowser(false);
    setProviderDatasetId(undefined);
    setSelected(resource);
    window.history.pushState(
      { resourceId: resource.id },
      "",
      `${import.meta.env.BASE_URL}resources/${encodeURIComponent(resource.id)}/`,
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const closeResource = () => {
    setSelected(undefined);
    setProviderBrowser(false);
    setProviderDatasetId(undefined);
    window.history.pushState({}, "", import.meta.env.BASE_URL);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handlePopState = () => {
      const onProviderBrowser = /\/provider-resources\/?$/.test(window.location.pathname);
      const nextDatasetId = decodeURIComponent(
        window.location.pathname.match(/\/datasets\/([^/]+)\/?$/)?.[1] ?? "",
      );
      const nextCategory = decodeURIComponent(
        window.location.pathname.match(/\/categories\/([^/]+)\/?$/)?.[1] ?? "",
      );
      const pathId = decodeURIComponent(
        window.location.pathname.match(/\/resources\/([^/]+)\/?$/)?.[1] ?? "",
      );
      setProviderBrowser(onProviderBrowser || Boolean(nextDatasetId));
      setProviderDatasetId(nextDatasetId || undefined);
      setFilters((current) => {
        const next = { ...current };
        if (nextCategory) next.category = nextCategory;
        else delete next.category;
        return next;
      });
      setSelected(
        onProviderBrowser || nextDatasetId
          ? undefined
          : catalogue.resources.find((resource) => resource.id === pathId),
      );
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [catalogue.resources]);

  return (
    <div className="app-shell" lang={locale === "zh-Hant" ? "zh-HK" : "en"}>
      <a className="skip-link" href="#main-content">
        {providerBrowser
          ? locale === "en"
            ? "Skip to provider resources"
            : "跳至供應者資源"
          : text.skip}
      </a>
      <Disclaimer locale={locale} />
      <header className="site-header">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          onClick={(event) => {
            if (selected || providerBrowser) {
              event.preventDefault();
              closeResource();
            }
          }}
        >
          <span>HK</span> OPEN DATA
        </a>
        <details className="mobile-menu">
          <summary aria-label={locale === "en" ? "Open navigation" : "開啟導覽"}>
            <Menu aria-hidden="true" size={25} strokeWidth={1.75} />
          </summary>
          <Navigation locale={locale} />
        </details>
        <div className="desktop-navigation">
          <Navigation locale={locale} />
        </div>
        <button
          className="locale-control"
          type="button"
          onClick={() => setLocale(locale === "en" ? "zh-Hant" : "en")}
        >
          {text.locale}
        </button>
      </header>

      {providerBrowser ? (
        <ProviderResourceBrowser locale={locale} onBack={closeResource} datasetId={providerDatasetId} />
      ) : selected ? (
        <ResourceDetail locale={locale} resource={selected} onBack={closeResource} />
      ) : (
        <>
          <main id="main-content">
            <Hero
              counts={catalogue.counts}
              locale={locale}
              query={query}
              selectedCategory={filters.category}
              onQueryChange={setQuery}
              onCategoryChange={(category) => {
                const next = { ...filters };
                if (category) next.category = category;
                else delete next.category;
                setFilters(next);
                const path = category
                  ? `${import.meta.env.BASE_URL}categories/${encodeURIComponent(category)}/`
                  : import.meta.env.BASE_URL;
                window.history.pushState({}, "", path);
              }}
            />
            <section className="catalogue-layout" id="catalogue-results" aria-labelledby="results-title">
              <Filters
                locale={locale}
                value={filters}
                onChange={setFilters}
                queryActive={Boolean(query.trim())}
                onClearAll={() => {
                  setQuery("");
                  setFilters({});
                }}
              />
              <div className="results-list" aria-live="polite">
                <div className="results-heading">
                  <h2 id="results-title">{text.results(visibleResources.length)}</h2>
                  <span>{locale === "en" ? "Official sources first" : "官方來源優先"}</span>
                </div>
                {visibleResources.length > 0 ? (
                  visibleResources.slice(0, visibleLimit).map((resource) => (
                    <ResourceCard
                      key={resource.id}
                      locale={locale}
                      resource={resource}
                      onOpen={openResource}
                    />
                  ))
                ) : (
                  <p className="empty-state">{text.noResults}</p>
                )}
                {visibleResources.length > visibleLimit && (
                  <button
                    className="show-more"
                    type="button"
                    onClick={() => setVisibleLimit((limit) => limit + 20)}
                  >
                    {text.showMore} ({visibleResources.length - visibleLimit})
                  </button>
                )}
              </div>
            </section>
          </main>
        </>
      )}

      {!providerBrowser && <ToolkitBand locale={locale} />}
      <footer className="legal-footer" id="legal">
        <p>{text.legal}</p>
        <nav aria-label={locale === "en" ? "Legal and project links" : "法律及項目連結"}>
          <a href="https://github.com/angusf777/hk-open-data" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a
            href="https://github.com/angusf777/hk-open-data/blob/main/docs/governance/CORRECTIONS_AND_TAKEDOWNS.md"
            target="_blank"
            rel="noreferrer"
          >
            {text.correction}
          </a>
        </nav>
      </footer>
    </div>
  );
}

function Navigation({ locale }: { locale: Locale }) {
  const text = copy(locale);
  return (
    <nav className="site-navigation" aria-label={locale === "en" ? "Primary" : "主要導覽"}>
      <a href="#catalogue-results">{text.catalogue}</a>
      <a href="#toolkit">{text.toolkit}</a>
      <a href="#legal">{text.about}</a>
    </nav>
  );
}
