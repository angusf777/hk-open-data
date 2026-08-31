import { StatusDot } from "@hk-open-data/ui";
import type { PublicSource } from "../../api.js";
export function publicTone(value: string): "healthy" | "pending" | "incident" | "neutral" { if (value === "fresh" || value === "operational") return "healthy"; if (value === "stale" || value === "degraded") return "pending"; if (value === "outage" || value === "failed") return "incident"; return "neutral"; }
export function SourceStatusRow({ source }: { source: PublicSource }) { return <><a href={`/sources#${source.id}`}>{source.name}</a><small>{source.provider}</small><StatusDot tone={publicTone(source.freshness)}>{source.freshness === "fresh" ? "Operational" : source.freshness === "stale" ? "Degraded" : source.freshness}</StatusDot></>; }
