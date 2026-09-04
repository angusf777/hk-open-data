import { BusFront, CloudSun, HeartPulse, MapPinned, Scale, Search } from "lucide-react";

import { copy } from "../i18n";
import type { CatalogueCounts, Locale } from "../types";

const categoryLinks = [
  ["transportation", "Transport", "交通", BusFront],
  ["climate-weather", "Weather", "天氣", CloudSun],
  ["geospatial-mapping", "Geospatial", "地理空間", MapPinned],
  ["government-law", "Law", "法律", Scale],
  ["health", "Health", "健康", HeartPulse],
] as const;

interface HeroProps {
  counts: CatalogueCounts;
  locale: Locale;
  query: string;
  selectedCategory: string | undefined;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category?: string) => void;
}

export function Hero({
  counts,
  locale,
  query,
  selectedCategory,
  onQueryChange,
  onCategoryChange,
}: HeroProps) {
  const text = copy(locale);
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title">{text.heading}</h1>
        <span className="hero-route" aria-hidden="true" />
        <p className="count-summary count-summary-desktop">
          {text.summary(
            counts.byType.official ?? 0,
            counts.byType.external ?? 0,
            counts.byType.mcp ?? 0,
          )}
        </p>
        <p className="count-summary count-summary-mobile">
          {counts.byType.official ?? 0} {locale === "en" ? "official" : "官方"}
          <span aria-hidden="true"> · </span>
          {counts.byType.external ?? 0} {locale === "en" ? "external" : "外部"}
          <span aria-hidden="true"> · </span>
          {counts.byType.mcp ?? 0} MCP
        </p>
      </div>
      <form
        className="search-form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          document.querySelector("#catalogue-results")?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <label className="search-control">
          <span className="visually-hidden">{text.search}</span>
          <Search aria-hidden="true" size={22} strokeWidth={1.75} />
          <input
            type="search"
            value={query}
            placeholder={text.search}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <button type="submit">{text.browse}</button>
      </form>
      <nav className="category-links" aria-label={locale === "en" ? "Categories" : "類別"}>
        {categoryLinks.map(([value, en, zh, Icon]) => (
          <a
            className={selectedCategory === value ? "is-active" : ""}
            key={value}
            aria-current={selectedCategory === value ? "page" : undefined}
            href={
              selectedCategory === value
                ? import.meta.env.BASE_URL
                : `${import.meta.env.BASE_URL}categories/${encodeURIComponent(value)}/`
            }
            onClick={(event) => {
              event.preventDefault();
              onCategoryChange(selectedCategory === value ? undefined : value);
            }}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
            {locale === "en" ? en : zh}
          </a>
        ))}
      </nav>
    </section>
  );
}
