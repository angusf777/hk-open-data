import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@hk-open-data/ui";
import { useState } from "react";
import { BrowserRouter, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { OperatingProfile } from "@hk-open-data/sdk-typescript";
import type { AdminApi } from "./api.js";
import { ApiProvider } from "./context.js";
import { AuditPage } from "./features/audit/AuditPage.js";
import { DeliveriesPage } from "./features/deliveries/DeliveriesPage.js";
import { IncidentsPage } from "./features/incidents/IncidentsPage.js";
import { OverviewPage } from "./features/overview/OverviewPage.js";
import { SourceReviewPage } from "./features/sources/SourceReviewPage.js";
import { SourcesPage } from "./features/sources/SourcesPage.js";
import { TargetsPage } from "./features/targets/TargetsPage.js";

const navigation = [
  { label: "Overview", href: "/", icon: "overview" },
  { label: "Sources", href: "/sources", icon: "sources" },
  { label: "Monitor targets", href: "/targets", icon: "targets" },
  { label: "Incidents", href: "/incidents", icon: "incidents" },
  { label: "Deliveries", href: "/deliveries", icon: "deliveries" },
  { label: "Audit", href: "/audit", icon: "audit" },
] as const;

function AdminRoutes({ operatingProfile }: { operatingProfile: OperatingProfile }) {
  const location = useLocation();
  const active = location.pathname.startsWith("/sources") ? "/sources" : location.pathname;
  const profileName = { catalogue: "catalogue only", observe: "API health checks", fabric: "data access" }[operatingProfile];
  return <AppShell product="HK Open Data Toolkit" environment="Self-hosted" navigation={navigation} activeHref={active} utility={<span className="operator">AD <span>Local admin</span></span>}><div className="admin-profile-banner"><strong>Mode:</strong> Self-hosted {profileName}. You control which data sources are connected.</div><Routes><Route path="/" element={<OverviewPage />} /><Route path="/sources" element={<SourcesPage />} /><Route path="/sources/:sourceId" element={<SourceReviewPage />} /><Route path="/targets" element={<TargetsPage />} /><Route path="/incidents" element={<IncidentsPage />} /><Route path="/deliveries" element={<DeliveriesPage />} /><Route path="/audit" element={<AuditPage />} /><Route path="*" element={<div className="standard-page"><h1>Page not found</h1></div>} /></Routes></AppShell>;
}

export function AdminApp({ api, operatingProfile = "catalogue", initialEntries }: { api: AdminApi; operatingProfile?: OperatingProfile | undefined; initialEntries?: string[] | undefined }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }));
  const content = <QueryClientProvider client={queryClient}><ApiProvider api={api} operatingProfile={operatingProfile}><AdminRoutes operatingProfile={operatingProfile} /></ApiProvider></QueryClientProvider>;
  return initialEntries === undefined ? <BrowserRouter>{content}</BrowserRouter> : <MemoryRouter initialEntries={initialEntries}>{content}</MemoryRouter>;
}
