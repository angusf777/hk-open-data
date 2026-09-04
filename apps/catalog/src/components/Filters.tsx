import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { copy } from "../i18n";
import type { Locale, ResourceFilters } from "../types";

interface FiltersProps {
  locale: Locale;
  value: ResourceFilters;
  onChange: (filters: ResourceFilters) => void;
  queryActive: boolean;
  onClearAll: () => void;
}

export function Filters({ locale, value, onChange, queryActive, onClearAll }: FiltersProps) {
  const text = copy(locale);
  const [expanded, setExpanded] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(min-width: 761px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia?.("(min-width: 761px)");
    if (!media) return undefined;
    const sync = (event: MediaQueryListEvent) => setExpanded(event.matches);
    setExpanded(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const update = (key: keyof ResourceFilters, next: string) => {
    const filters = { ...value };
    if (next) Object.assign(filters, { [key]: next });
    else delete filters[key];
    onChange(filters);
  };
  const activeCount = Object.values(value).filter(Boolean).length + (queryActive ? 1 : 0);

  return (
    <details
      className="filters"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <span>
          <SlidersHorizontal aria-hidden="true" size={20} strokeWidth={1.75} />
          {text.filter}
        </span>
        {activeCount > 0 && <small>{activeCount} active</small>}
      </summary>
      <div className="filter-panel">
        <div className="filter-heading">
          <h2>{text.filter}</h2>
          <button type="button" onClick={onClearAll} disabled={activeCount === 0}>
            {text.clear}
          </button>
        </div>
        <FilterGroup
          legend={text.resourceType}
          name="type"
          value={value.type ?? ""}
          options={[
            ["official", text.official],
            ["external", text.external],
            ["mcp", text.mcp],
          ]}
          onChange={(next) => update("type", next)}
        />
        <FilterGroup
          legend={text.authentication}
          name="authentication"
          value={value.authentication ?? ""}
          options={[
            ["none", text.none],
            ["api-key", text.apiKey],
            ["registration", text.registration],
          ]}
          onChange={(next) => update("authentication", next)}
        />
        <FilterGroup
          legend={text.sourceAccess}
          name="access-recipe"
          value={value.access ?? ""}
          options={[
            ["executable", text.hasExecutableRecipe],
            ["live", text.liveVerified],
            ["none", text.noAutomatedAccess],
          ]}
          onChange={(next) => update("access", next)}
        />
        <FilterGroup
          legend={text.termsEvidence}
          name="terms"
          value={value.termsState ?? ""}
          options={[
            ["not-reviewed", text.notReviewed],
            ["ambiguity-identified", text.ambiguity],
            ["restriction-identified", text.restriction],
          ]}
          onChange={(next) => update("termsState", next)}
        />
      </div>
    </details>
  );
}

interface FilterGroupProps {
  legend: string;
  name: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
}

function FilterGroup({ legend, name, value, options, onChange }: FilterGroupProps) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {options.map(([optionValue, label]) => (
        <label key={optionValue || "all"}>
          <input
            type="radio"
            name={name}
            value={optionValue}
            checked={value === optionValue}
            onChange={(event) => onChange(event.target.value)}
          />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
