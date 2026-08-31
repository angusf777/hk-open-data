import { ArrowRight } from "lucide-react";

import { copy, labelValue } from "../i18n";
import type { Locale, Resource } from "../types";

interface ResourceCardProps {
  locale: Locale;
  resource: Resource;
  onOpen: (resource: Resource) => void;
}

export function ResourceCard({ locale, resource, onOpen }: ResourceCardProps) {
  const text = copy(locale);
  const detailHref = `${import.meta.env.BASE_URL}resources/${encodeURIComponent(resource.id)}/`;
  return (
    <article className="resource-row">
      <div className="resource-primary">
        <h2>{resource.name[locale]}</h2>
        <p>{resource.summary[locale]}</p>
        <span className={`resource-kind resource-kind-${resource.type}`}>
          {resource.type === "official"
            ? text.official
            : resource.type === "external"
              ? text.external
              : text.mcp}
        </span>
      </div>
      <dl className="resource-metadata">
        <div>
          <dt>{text.provider}</dt>
          <dd>{resource.provider.name[locale]}</dd>
        </div>
        <div>
          <dt>{text.protocol}</dt>
          <dd>{resource.protocols.map((value) => labelValue(value, locale)).join(" / ")}</dd>
        </div>
        <div>
          <dt>{text.auth}</dt>
          <dd>{labelValue(resource.authentication, locale)}</dd>
        </div>
        <div>
          <dt>{text.termsEvidence}</dt>
          <dd>{labelValue(resource.termsEvidence.state, locale)}</dd>
        </div>
        <div>
          <dt>{text.checked}</dt>
          <dd>{resource.verification.checkedAt}</dd>
        </div>
      </dl>
      <a
        className="resource-action"
        href={detailHref}
        onClick={(event) => {
          event.preventDefault();
          onOpen(resource);
        }}
      >
        {text.view}
        <ArrowRight aria-hidden="true" size={17} strokeWidth={1.75} />
      </a>
    </article>
  );
}
