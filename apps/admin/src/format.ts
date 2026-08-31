export function formatHkt(value: string | null): string {
  if (value === null) return "Not yet observed";
  return new Intl.DateTimeFormat("en-HK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Hong_Kong" }).format(new Date(value));
}

export function statusTone(value: string): "healthy" | "pending" | "incident" | "neutral" {
  if (["fresh", "pass", "approved", "delivered", "resolved"].includes(value)) return "healthy";
  if (["stale", "pending", "pending_challenge", "retry", "monitoring"].includes(value)) return "pending";
  if (["fail", "failed", "open", "major", "critical", "dead_letter"].includes(value)) return "incident";
  return "neutral";
}
