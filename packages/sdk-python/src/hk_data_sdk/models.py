from __future__ import annotations

from typing import Literal, TypedDict

OperatingProfile = Literal["catalogue", "observe", "fabric"]
TermsEvidenceState = Literal[
    "not-reviewed",
    "official-terms-linked",
    "restriction-identified",
    "ambiguity-identified",
    "provider-confirmation-recorded",
]


class PageMeta(TypedDict):
    next_cursor: str | None


class Page(TypedDict):
    items: list[dict[str, object]]
    page: PageMeta


class SourceSummary(TypedDict, total=False):
    source_id: str
    catalogue_id: str
    catalogue_verified_at: str
    terms_evidence_state: TermsEvidenceState
    operating_profile: OperatingProfile
    name: str
    provider: str
    approval_status: str
    freshness_status: str


class ErrorEnvelope(TypedDict):
    code: str
    message: str
    retryable: bool
    correlation_id: str
