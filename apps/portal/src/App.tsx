import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Activity, Menu, X } from "lucide-react";
import { useState } from "react";
import { BrowserRouter, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { OperatingProfile } from "@hk-open-data/sdk-typescript";
import type { PortalApi } from "./api.js";
import { PortalProvider, type Locale } from "./context.js";
import { DeveloperPage } from "./features/developer/DeveloperPage.js";
import { MethodologyPage } from "./features/methodology/MethodologyPage.js";
import { PublicSourcesPage } from "./features/sources/PublicSourcesPage.js";
import { StatusPage } from "./features/status/StatusPage.js";
import { en } from "./i18n/en.js";
import { zhHant } from "./i18n/zh-Hant.js";

function PortalRoutes({ locale, operatingProfile, setLocale }: { locale: Locale; operatingProfile: OperatingProfile; setLocale(value: Locale): void }) {
  const [open, setOpen] = useState(false); const location = useLocation(); const copy = locale === "en" ? en : zhHant;
  const profileName = locale === "en"
    ? { catalogue: "catalogue only", observe: "API health checks", fabric: "data access" }[operatingProfile]
    : { catalogue: "只執行目錄", observe: "API 健康檢查", fabric: "數據存取" }[operatingProfile];
  const nav = [{ href: "/", label: copy.status }, { href: "/sources", label: copy.sources }, { href: "/methodology", label: copy.methodology }, { href: "/developers", label: copy.developer }];
  return <div lang={locale === "en" ? "en" : "zh-Hant"}><div className="independent-banner">{copy.independent}</div><div className="runtime-profile"><strong>{copy.profileLabel}:</strong> {copy.profileText.replace("{profile}", profileName)}</div><header className="public-header"><a className="public-brand" href="/"><Activity aria-hidden="true" />HK Open Data Toolkit</a><button className="public-menu" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button><nav aria-label="Primary" data-open={open}>{nav.map((item) => <a key={item.href} href={item.href} aria-current={location.pathname === item.href ? "page" : undefined}>{item.label}</a>)}</nav><button className="language-switch" onClick={() => setLocale(locale === "en" ? "zh-Hant" : "en")}>{copy.language}</button></header><Routes><Route path="/" element={<StatusPage />} /><Route path="/sources" element={<PublicSourcesPage />} /><Route path="/methodology" element={<MethodologyPage />} /><Route path="/developers" element={<DeveloperPage />} /><Route path="*" element={<main className="public-main"><h1>Page not found</h1></main>} /></Routes><footer className="public-footer"><strong>HK Open Data Toolkit</strong><span>{copy.independent}</span><span>All times are shown in Hong Kong Time (HKT).</span></footer></div>;
}

export function PortalApp({ api, operatingProfile = "catalogue", now = () => new Date(), initialEntries }: { api: PortalApi; operatingProfile?: OperatingProfile | undefined; now?: (() => Date) | undefined; initialEntries?: string[] | undefined }) {
  const [locale, setLocale] = useState<Locale>("en"); const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const content = <QueryClientProvider client={queryClient}><PortalProvider value={{ api, locale, operatingProfile, setLocale, now }}><PortalRoutes locale={locale} operatingProfile={operatingProfile} setLocale={setLocale} /></PortalProvider></QueryClientProvider>;
  return initialEntries === undefined ? <BrowserRouter>{content}</BrowserRouter> : <MemoryRouter initialEntries={initialEntries}>{content}</MemoryRouter>;
}
