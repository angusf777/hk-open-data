import { createContext, useContext, type ReactNode } from "react";
import type { OperatingProfile } from "@hk-open-data/sdk-typescript";
import type { AdminApi } from "./api.js";

const ApiContext = createContext<AdminApi | null>(null);
const OperatingProfileContext = createContext<OperatingProfile | null>(null);

export function ApiProvider({ api, operatingProfile, children }: { api: AdminApi; operatingProfile: OperatingProfile; children: ReactNode }) {
  return <ApiContext.Provider value={api}><OperatingProfileContext.Provider value={operatingProfile}>{children}</OperatingProfileContext.Provider></ApiContext.Provider>;
}

export function useOperatingProfile(): OperatingProfile {
  const profile = useContext(OperatingProfileContext);
  if (profile === null) throw new Error("Operating profile is not configured");
  return profile;
}

export function useAdminApi(): AdminApi {
  const api = useContext(ApiContext);
  if (api === null) throw new Error("Admin API is not configured");
  return api;
}
