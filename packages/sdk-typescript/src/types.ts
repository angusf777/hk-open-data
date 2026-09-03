export interface ErrorEnvelope {
  code: string;
  message: string;
  retryable: boolean;
  correlation_id: string;
}

export interface PageMeta {
  next_cursor: string | null;
}

export interface Page<T> {
  items: T[];
  page: PageMeta;
}

export type OperatingProfile = "catalogue" | "observe" | "fabric";
export type TermsEvidenceState =
  | "not-reviewed"
  | "official-terms-linked"
  | "restriction-identified"
  | "ambiguity-identified"
  | "provider-confirmation-recorded";

export interface SourceSummary {
  source_id: string;
  catalogue_id?: string;
  catalogue_verified_at?: string;
  terms_evidence_state?: TermsEvidenceState;
  operating_profile: OperatingProfile;
  name?: string;
  provider?: string;
  approval_status?: string;
  freshness_status?: string;
  [key: string]: unknown;
}

export type AccessStatus =
  | "live-verified"
  | "fixture-tested"
  | "credential-required"
  | "manual-only"
  | "blocked"
  | "unavailable";

export type AccessExampleLanguage = "curl" | "python" | "typescript";

export interface AccessRecipe {
  schema_version: 1;
  source_reference: string;
  recipe_version: string;
  adapter: string;
  status: AccessStatus;
  effective_status: AccessStatus;
  documentation_url: string;
  limitations: string[];
  authentication: {
    type: string;
    environment_variables: string[];
    setup: string | null;
  };
  request: ApiObject | null;
  response: ApiObject | null;
  reason: string | null;
  next_action: string | null;
  recipe_sha256: string;
  examples: Record<AccessExampleLanguage, string | null>;
  verification: ApiObject | null;
}

export type ResourceAccess =
  | "ready"
  | "parameters-required"
  | "insecure-http"
  | "invalid-url";

export interface AccessResource {
  schema_version: 1;
  source_references: string[];
  dataset_id: string;
  resource_id: string;
  name: string;
  format: string;
  url_template: string;
  template_parameters: string[];
  access: ResourceAccess;
  usage: {
    list_cli: string;
    example_cli: string;
    fetch_cli: string;
  };
  limitations: string[];
}

export type ApiObject = Record<string, unknown>;
export type QueryValue = string | number | boolean | undefined;
export type Query = Record<string, QueryValue>;
