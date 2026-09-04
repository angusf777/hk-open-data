import { ArrowLeft, ExternalLink, FileWarning } from "lucide-react";

import { copy, labelValue } from "../i18n";
import type { Locale, Resource } from "../types";
import { AccessPanel } from "./AccessPanel";

interface ResourceDetailProps {
  locale: Locale;
  resource: Resource;
  onBack: () => void;
}

export function ResourceDetail({ locale, resource, onBack }: ResourceDetailProps) {
  const text = copy(locale);
  const providerUrl = resource.urls.documentation ?? resource.urls.landing;
  return (
    <main id="main-content" className="detail-page">
      <nav className="breadcrumbs" aria-label={locale === "en" ? "Breadcrumb" : "頁面路徑"}>
        <button type="button" onClick={onBack}>
          {text.catalogue}
        </button>
        <span aria-hidden="true">/</span>
        <span>{resource.type === "official" ? text.official : labelValue(resource.type, locale)}</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{resource.name[locale]}</span>
      </nav>

      <div className="detail-layout">
        <section className="detail-introduction" aria-labelledby="resource-title">
          <h1 id="resource-title">{resource.name[locale]}</h1>
          <span className="detail-route" aria-hidden="true" />
          <p className="detail-summary">{resource.summary[locale]}</p>
          <dl className="identity-list">
            <div>
              <dt>{text.provider}</dt>
              <dd>{resource.provider.name[locale]}</dd>
            </div>
            <div>
              <dt>{text.sourceReference}</dt>
              <dd>{resource.sourceReference}</dd>
            </div>
          </dl>

          <section className="evidence-panel" aria-labelledby="terms-heading">
            <FileWarning aria-hidden="true" size={34} strokeWidth={1.6} />
            <div>
              <h2 id="terms-heading">{text.termsEvidence}</h2>
              <strong>{labelValue(resource.termsEvidence.state, locale)}</strong>
              <p>{text.evidenceBoundary}</p>
              <p className="source-note">{resource.termsEvidence.note[locale]}</p>
            </div>
          </section>

          <div className="detail-actions">
            {providerUrl && (
              <a href={providerUrl} target="_blank" rel="noreferrer" className="primary-link">
                <ExternalLink aria-hidden="true" size={19} strokeWidth={1.75} />
                {text.openProvider}
              </a>
            )}
            <button type="button" onClick={onBack}>
              <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.75} />
              {text.back}
            </button>
          </div>
        </section>

        <aside className="metadata-ledger" aria-label={locale === "en" ? "Source metadata" : "來源元數據"}>
          <MetadataRow label={text.type} value={labelValue(resource.type, locale)} />
          <MetadataRow
            label={text.protocol}
            value={resource.protocols.map((value) => labelValue(value, locale)).join(" / ")}
          />
          <MetadataRow
            label={text.formats}
            value={resource.formats.map((value) => labelValue(value, locale)).join(" / ")}
          />
          <MetadataRow
            label={text.authentication}
            value={labelValue(resource.authentication, locale)}
          />
          <MetadataRow label={text.access} value={labelValue(resource.access, locale)} />
          <MetadataRow
            label={text.languages}
            value={resource.languages.map((value) => labelValue(value, locale)).join(" / ")}
          />
          <MetadataRow
            label={text.verification}
            value={labelValue(resource.verification.status, locale)}
          />
          <MetadataRow label={text.checked} value={resource.verification.checkedAt} />
        </aside>
      </div>

      {resource.accessRecipe && <AccessPanel locale={locale} recipe={resource.accessRecipe} />}

      <div className="notes-grid">
        <section>
          <h2>{text.projectNotes}</h2>
          <p>{text.projectNote}</p>
        </section>
        <section>
          <h2>{text.providerLinks}</h2>
          {providerUrl ? (
            <a href={providerUrl} target="_blank" rel="noreferrer">
              {resource.name[locale]}
              <ExternalLink aria-hidden="true" size={16} strokeWidth={1.75} />
            </a>
          ) : (
            <p>{locale === "en" ? "No provider link recorded." : "未有記錄供應者連結。"}</p>
          )}
        </section>
      </div>
    </main>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}
