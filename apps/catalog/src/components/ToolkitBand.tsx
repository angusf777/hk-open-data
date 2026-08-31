import { ArrowRight, Terminal } from "lucide-react";

import { copy } from "../i18n";
import type { Locale } from "../types";

export function ToolkitBand({ locale }: { locale: Locale }) {
  const text = copy(locale);
  return (
    <section className="toolkit-band" id="toolkit" aria-labelledby="toolkit-heading">
      <div className="terminal-mark" aria-hidden="true">
        <Terminal size={26} strokeWidth={1.5} />
      </div>
      <div>
        <h2 id="toolkit-heading">{text.toolkitHeading}</h2>
        <p>{text.toolkitSummary}</p>
      </div>
      <code>git clone https://github.com/angusf777/hk-open-data.git</code>
      <a
        href="https://github.com/angusf777/hk-open-data/blob/main/docs/getting-started/runtime.md"
        target="_blank"
        rel="noreferrer"
      >
        {text.toolkitLink}
        <ArrowRight aria-hidden="true" size={18} strokeWidth={1.75} />
      </a>
    </section>
  );
}
