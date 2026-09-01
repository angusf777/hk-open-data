import { Check, Copy as CopyIcon, ExternalLink } from "lucide-react";
import { useState } from "react";

import { copy, labelValue } from "../i18n";
import type { AccessRecipe, Locale } from "../types";

type ExampleLanguage = keyof AccessRecipe["examples"];

const exampleLabels: Record<ExampleLanguage, string> = {
  curl: "cURL",
  python: "Python",
  typescript: "TypeScript",
};

interface AccessPanelProps {
  locale: Locale;
  recipe: AccessRecipe;
}

export function AccessPanel({ locale, recipe }: AccessPanelProps) {
  const text = copy(locale);
  const languages = (Object.keys(exampleLabels) as ExampleLanguage[]).filter(
    (language) => recipe.examples[language] !== null,
  );
  const [selected, setSelected] = useState<ExampleLanguage>(languages[0] ?? "curl");
  const [announcement, setAnnouncement] = useState("");
  const selectedExample = recipe.examples[selected];

  const copyExample = async () => {
    if (!selectedExample) return;
    try {
      await navigator.clipboard.writeText(selectedExample);
      setAnnouncement(text.copiedExample(exampleLabels[selected]));
    } catch {
      setAnnouncement(text.copyFailed);
    }
  };

  return (
    <section className="access-panel" aria-labelledby="access-heading">
      <div className="access-panel-heading">
        <div>
          <p className="section-kicker">{text.sourceAccess}</p>
          <h2 id="access-heading">{text.accessHeading}</h2>
        </div>
        <span className={`access-status access-status-${recipe.effectiveStatus}`}>
          {labelValue(recipe.effectiveStatus, locale)}
        </span>
      </div>

      <p className="access-boundary">{text.accessBoundary}</p>

      <dl className="access-summary">
        {recipe.status !== recipe.effectiveStatus && (
          <AccessSummaryItem label={text.recordedStatus} value={labelValue(recipe.status, locale)} />
        )}
        <AccessSummaryItem label={text.adapter} value={labelValue(recipe.adapter, locale)} />
        <AccessSummaryItem
          label={text.authentication}
          value={labelValue(recipe.authentication.type, locale)}
        />
        {recipe.response && (
          <AccessSummaryItem label={text.responseFormats} value={recipe.response.mediaTypes.join(", ")} />
        )}
        {recipe.verification && (
          <>
            <AccessSummaryItem label={text.currentVerification} value={recipe.verification.checkedAt} />
            <AccessSummaryItem label={text.validUntil} value={recipe.verification.validUntil} />
          </>
        )}
      </dl>

      {recipe.authentication.environmentVariables.length > 0 && (
        <p className="access-setup">
          <strong>{text.authentication}:</strong>{" "}
          {recipe.authentication.environmentVariables.map((name) => (
            <code key={name}>{name}</code>
          ))}
          {recipe.authentication.setup ? ` — ${recipe.authentication.setup}` : ""}
        </p>
      )}

      {recipe.request ? (
        <div className="access-request">
          <div>
            <h3>{text.endpoint}</h3>
            <code className="endpoint-code">
              {recipe.request.method} {recipe.request.urlTemplate}
            </code>
          </div>
          <div>
            <h3>{text.parameters}</h3>
            {recipe.request.parameters.length > 0 ? (
              <ul className="parameter-list">
                {recipe.request.parameters.map((parameter) => (
                  <li key={`${parameter.location}:${parameter.name}`}>
                    <code>{parameter.name}</code>
                    <span>
                      {parameter.description} ({parameter.location}; {parameter.dataType}
                      {parameter.required ? "; required" : ""})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{text.noParameters}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="manual-access-guidance">
          {recipe.reason && (
            <div>
              <h3>{text.accessReason}</h3>
              <p>{recipe.reason}</p>
            </div>
          )}
          {recipe.nextAction && (
            <div>
              <h3>{text.nextAction}</h3>
              <p>{recipe.nextAction}</p>
            </div>
          )}
        </div>
      )}

      {languages.length > 0 && selectedExample && (
        <div className="example-browser">
          <div className="example-heading">
            <h3>{text.codeExamples}</h3>
            <div role="tablist" aria-label={text.codeExamples}>
              {languages.map((language) => (
                <button
                  key={language}
                  type="button"
                  role="tab"
                  id={`access-tab-${language}`}
                  aria-selected={selected === language}
                  aria-controls={`access-example-${language}`}
                  onClick={() => setSelected(language)}
                >
                  {exampleLabels[language]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="copy-example"
              aria-label={text.copyExample(exampleLabels[selected])}
              onClick={copyExample}
            >
              <CopyIcon aria-hidden="true" size={16} />
              {locale === "en" ? "Copy" : "複製"}
            </button>
          </div>
          <pre
            role="tabpanel"
            id={`access-example-${selected}`}
            aria-labelledby={`access-tab-${selected}`}
          >
            <code>{selectedExample}</code>
          </pre>
          <p className="copy-announcement" role="status" aria-live="polite">
            {announcement && <><Check aria-hidden="true" size={15} />{announcement}</>}
          </p>
        </div>
      )}

      <div className="access-footer">
        <ul>
          {recipe.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
        <a href={recipe.documentationUrl} target="_blank" rel="noreferrer">
          {text.openAccessDocs}
          <ExternalLink aria-hidden="true" size={16} />
        </a>
      </div>
    </section>
  );
}

function AccessSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
