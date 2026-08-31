import { AlertTriangle, CheckCircle2, CircleHelp, Clock3, XCircle } from "lucide-react";
import type { ReactNode } from "react";

export type StatusTone = "healthy" | "pending" | "incident" | "neutral";

export function StatusLabel({ children, tone }: { children: ReactNode; tone: StatusTone }) {
  const Icon =
    tone === "healthy"
      ? CheckCircle2
      : tone === "pending"
        ? Clock3
        : tone === "incident"
          ? AlertTriangle
          : CircleHelp;
  return (
    <span className="ui-status" data-tone={tone}>
      <Icon aria-hidden="true" size={15} strokeWidth={2} />
      <span>{children}</span>
    </span>
  );
}

export function StatusDot({ children, tone }: { children: ReactNode; tone: StatusTone }) {
  return (
    <span className="ui-status-dot" data-tone={tone}>
      {tone === "incident" ? <XCircle aria-hidden="true" size={14} /> : null}
      <span className="ui-status-dot__mark" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
