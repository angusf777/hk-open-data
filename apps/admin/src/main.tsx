import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@hk-open-data/ui/tokens.css";
import "./styles.css";
import { AdminApp } from "./App.js";
import { createFixtureAdminApi, createLiveAdminApi } from "./api.js";
import type { OperatingProfile } from "@hk-open-data/sdk-typescript";

const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const api = baseUrl !== undefined && baseUrl !== "" ? createLiveAdminApi({ baseUrl }) : createFixtureAdminApi();
const configuredProfile = import.meta.env.VITE_HKOD_PROFILE as string | undefined;
const operatingProfile: OperatingProfile = configuredProfile === "observe" || configuredProfile === "fabric" ? configuredProfile : "catalogue";

createRoot(document.getElementById("root")!).render(<StrictMode><AdminApp api={api} operatingProfile={operatingProfile} /></StrictMode>);
