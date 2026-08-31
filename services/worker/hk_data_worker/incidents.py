from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

from .models import Incident, MonitorObservation

Severity = Literal["minor", "moderate", "major", "critical"]


@dataclass(frozen=True)
class IncidentDecision:
    action: str
    incident: Incident


@dataclass
class _IncidentState:
    incident: Incident
    failure_count: int = 0
    recovery_passes: int = 0
    recovery_started_at: datetime | None = None


def _category(observation: MonitorObservation) -> str:
    failing = next((check for check in observation.check_results if check.outcome == "fail"), None)
    if failing is None:
        return "availability"
    if failing.check in {"redirect", "hash"}:
        return "security"
    if failing.check == "media":
        return "contract"
    return failing.check


class IncidentEvaluator:
    def __init__(self, *, recovery_window: timedelta) -> None:
        if recovery_window.total_seconds() <= 0:
            raise ValueError("recovery_window must be positive")
        self._recovery_window = recovery_window
        self._groups: dict[tuple[str, str, str], _IncidentState] = {}
        self._by_id: dict[str, _IncidentState] = {}
        self._sequence = 0

    def _replace(self, state: _IncidentState, **updates: object) -> Incident:
        state.incident = state.incident.model_copy(update=updates)
        return state.incident

    def apply(
        self,
        observation: MonitorObservation,
        *,
        source_id: str,
        severity: Severity,
    ) -> IncidentDecision:
        category = _category(observation)
        key = (source_id, observation.monitor_id, category)
        state = self._groups.get(key)
        occurred_at = observation.finished_at
        if state is not None and state.incident.status == "suppressed":
            expiry = state.incident.suppression_expires_at
            if expiry is not None and occurred_at < expiry:
                incident = self._replace(
                    state,
                    observation_ids=(*state.incident.observation_ids, observation.observation_id),
                    last_observed_at=occurred_at,
                )
                return IncidentDecision("suppressed", incident)
            self._replace(
                state,
                status="open",
                suppression_reason=None,
                suppression_expires_at=None,
                audit_version=state.incident.audit_version + 1,
            )

        if observation.outcome in {"fail", "degraded"}:
            if state is None:
                self._sequence += 1
                immediate = severity == "critical"
                incident = Incident(
                    incident_id=f"INC-{occurred_at.year}-{self._sequence:06d}",
                    source_id=source_id,
                    status="open" if immediate else "candidate",
                    severity=severity,
                    category=category,
                    monitor_ids=(observation.monitor_id,),
                    observation_ids=(observation.observation_id,),
                    opened_at=occurred_at,
                    last_observed_at=occurred_at,
                    public_state="review_required",
                    audit_version=1,
                )
                state = _IncidentState(incident=incident, failure_count=1)
                self._groups[key] = state
                self._by_id[incident.incident_id] = state
                return IncidentDecision(
                    "incident_opened" if immediate else "candidate_created", incident
                )
            state.failure_count += 1
            state.recovery_passes = 0
            state.recovery_started_at = None
            status = "open" if state.failure_count >= 2 or severity == "critical" else "candidate"
            action = (
                "incident_opened"
                if state.incident.status != "open" and status == "open"
                else "incident_updated"
            )
            incident = self._replace(
                state,
                status=status,
                severity=severity,
                observation_ids=(*state.incident.observation_ids, observation.observation_id),
                last_observed_at=occurred_at,
                resolved_at=None,
                resolved_by=None,
                audit_version=state.incident.audit_version
                + (1 if action == "incident_opened" else 0),
            )
            return IncidentDecision(action, incident)

        if state is None:
            self._sequence += 1
            incident = Incident(
                incident_id=f"INC-{occurred_at.year}-{self._sequence:06d}",
                source_id=source_id,
                status="resolved",
                severity=severity,
                category=category,
                monitor_ids=(observation.monitor_id,),
                observation_ids=(observation.observation_id,),
                opened_at=occurred_at,
                last_observed_at=occurred_at,
                resolved_at=occurred_at,
                resolved_by="monitor-engine",
                public_state="private",
                audit_version=1,
            )
            return IncidentDecision("healthy_no_incident", incident)

        state.failure_count = 0
        if state.incident.status == "candidate":
            incident = self._replace(
                state,
                status="resolved",
                observation_ids=(*state.incident.observation_ids, observation.observation_id),
                last_observed_at=occurred_at,
                resolved_at=occurred_at,
                resolved_by="monitor-engine",
                audit_version=state.incident.audit_version + 1,
            )
            return IncidentDecision("candidate_cleared", incident)
        if state.incident.status == "resolved":
            return IncidentDecision("healthy_no_change", state.incident)
        if state.recovery_started_at is None:
            state.recovery_started_at = occurred_at
            state.recovery_passes = 1
        else:
            state.recovery_passes += 1
        enough_time = occurred_at - state.recovery_started_at >= self._recovery_window
        if state.recovery_passes >= 2 and enough_time:
            incident = self._replace(
                state,
                status="resolved",
                observation_ids=(*state.incident.observation_ids, observation.observation_id),
                last_observed_at=occurred_at,
                resolved_at=occurred_at,
                resolved_by="monitor-engine",
                audit_version=state.incident.audit_version + 1,
            )
            return IncidentDecision("incident_resolved", incident)
        incident = self._replace(
            state,
            status="monitoring",
            observation_ids=(*state.incident.observation_ids, observation.observation_id),
            last_observed_at=occurred_at,
        )
        return IncidentDecision("recovery_monitoring", incident)

    def acknowledge(self, incident_id: str, *, actor: str, reason: str, at: datetime) -> Incident:
        if not reason.strip():
            raise ValueError("acknowledgement requires a reason")
        state = self._by_id[incident_id]
        if state.incident.status not in {"open", "candidate"}:
            raise ValueError("only an open incident can be acknowledged")
        return self._replace(
            state,
            status="acknowledged",
            acknowledged_at=at,
            acknowledged_by=actor,
            audit_version=state.incident.audit_version + 1,
        )

    def suppress(
        self,
        incident_id: str,
        *,
        owner: str,
        reason: str,
        at: datetime,
        expires_at: datetime,
    ) -> Incident:
        if not owner.strip() or not reason.strip() or expires_at <= at:
            raise ValueError("suppression requires owner, reason and future expiry")
        state = self._by_id[incident_id]
        if state.incident.status == "resolved":
            raise ValueError("resolved incidents cannot be suppressed")
        return self._replace(
            state,
            status="suppressed",
            suppression_reason=reason,
            suppression_expires_at=expires_at,
            audit_version=state.incident.audit_version + 1,
        )
