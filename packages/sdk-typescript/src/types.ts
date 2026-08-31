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

export type ApiObject = Record<string, unknown>;
export type QueryValue = string | number | boolean | undefined;
export type Query = Record<string, QueryValue>;
