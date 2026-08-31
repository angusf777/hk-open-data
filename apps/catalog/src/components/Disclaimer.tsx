import { AlertTriangle } from "lucide-react";

import { copy } from "../i18n";
import type { Locale } from "../types";

export function Disclaimer({ locale }: { locale: Locale }) {
  return (
    <aside className="project-notice" aria-label={copy(locale).notice}>
      <span className="route-node" aria-hidden="true" />
      <AlertTriangle aria-hidden="true" size={18} strokeWidth={1.75} />
      <p>{copy(locale).notice}</p>
      <a href="#legal">{locale === "en" ? "Learn more" : "了解更多"}</a>
    </aside>
  );
}
