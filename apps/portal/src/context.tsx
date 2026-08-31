import { createContext, useContext, type ReactNode } from "react";
import type { OperatingProfile } from "@hk-open-data/sdk-typescript";
import type { PortalApi } from "./api.js";
import { en } from "./i18n/en.js";
import { zhHant } from "./i18n/zh-Hant.js";
export type Locale = "en" | "zh-Hant";
export type Copy = typeof en | typeof zhHant;
const PortalContext = createContext<{
  api: PortalApi;
  locale: Locale;
  copy: Copy;
  operatingProfile: OperatingProfile;
  setLocale(locale: Locale): void;
  now(): Date;
} | null>(null);
export function PortalProvider({ value, children }: { value: { api: PortalApi; locale: Locale; operatingProfile: OperatingProfile; setLocale(locale: Locale): void; now(): Date }; children: ReactNode }) { return <PortalContext.Provider value={{ ...value, copy: value.locale === "en" ? en : zhHant }}>{children}</PortalContext.Provider>; }
export function usePortal() { const value = useContext(PortalContext); if (value === null) throw new Error("Portal context is missing"); return value; }
