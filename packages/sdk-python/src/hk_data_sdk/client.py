from __future__ import annotations

from collections.abc import Mapping
from typing import cast
from urllib.parse import quote

import httpx

from .access import AccessRecipe, access_example
from .models import ErrorEnvelope, Page


class ApiError(RuntimeError):
    def __init__(self, status: int, envelope: ErrorEnvelope) -> None:
        super().__init__(envelope["message"])
        self.status = status
        self.code = envelope["code"]
        self.retryable = envelope["retryable"]
        self.correlation_id = envelope["correlation_id"]


class HKDataClient:
    def __init__(
        self,
        *,
        base_url: str,
        token: str | None = None,
        timeout_seconds: float = 30.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        if not base_url.startswith("https://"):
            raise ValueError("base_url must use HTTPS")
        headers = {"accept": "application/json"}
        if token is not None:
            headers["authorization"] = f"Bearer {token}"
        self._client = httpx.Client(
            base_url=base_url.rstrip("/") + "/",
            headers=headers,
            timeout=timeout_seconds,
            transport=transport,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> HKDataClient:
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()

    def _request(
        self,
        path: str,
        *,
        method: str = "GET",
        params: Mapping[str, str | int | bool | None] | None = None,
        body: Mapping[str, object] | None = None,
        if_match: int | None = None,
        extra_headers: Mapping[str, str] | None = None,
    ) -> dict[str, object]:
        headers = dict(extra_headers or {})
        if if_match is not None:
            headers["if-match"] = str(if_match)
        clean_params = {key: value for key, value in (params or {}).items() if value is not None}
        try:
            response = self._client.request(
                method,
                path.lstrip("/"),
                params=clean_params,
                json=body,
                headers=headers,
            )
        except httpx.TimeoutException as error:
            raise TimeoutError("API request timed out") from error
        except httpx.HTTPError as error:
            raise RuntimeError("API request failed") from error
        try:
            payload = response.json()
        except ValueError as error:
            raise RuntimeError("API returned invalid JSON") from error
        if not isinstance(payload, dict):
            raise RuntimeError("API returned an invalid response")
        if response.is_error:
            required = {"code", "message", "retryable", "correlation_id"}
            if not required.issubset(payload):
                raise RuntimeError("API returned an invalid error response")
            raise ApiError(response.status_code, cast(ErrorEnvelope, payload))
        return cast(dict[str, object], payload)

    def list_sources(self, **query: str | int | bool | None) -> Page:
        return cast(Page, self._request("sources", params=query))

    def list_all_sources(self, **query: str | int | bool | None) -> list[dict[str, object]]:
        items: list[dict[str, object]] = []
        cursor: str | None = None
        while True:
            page = self.list_sources(**query, cursor=cursor)
            items.extend(page["items"])
            cursor = page["page"]["next_cursor"]
            if cursor is None:
                return items

    def get_source(self, source_id: str) -> dict[str, object]:
        return self._request(f"sources/{source_id}")

    def list_access_recipes(self, **query: str | int | bool | None) -> Page:
        return cast(Page, self._request("access-recipes", params=query))

    def get_access_recipe(self, source_reference: str) -> AccessRecipe:
        encoded = quote(source_reference, safe="")
        return cast(AccessRecipe, self._request(f"access-recipes/{encoded}"))

    def get_access_example(self, source_reference: str, language: str) -> str:
        if language not in {"curl", "python", "typescript"}:
            raise ValueError("language must be curl, python, or typescript")
        return access_example(self.get_access_recipe(source_reference), language)

    def list_access_resources(self, **query: str | int | bool | None) -> Page:
        return cast(Page, self._request("access-resources", params=query))

    def get_access_resource(self, dataset_id: str, resource_id: str) -> dict[str, object]:
        encoded_dataset = quote(dataset_id, safe="")
        encoded_resource = quote(resource_id, safe="")
        return self._request(f"access-resources/{encoded_dataset}/{encoded_resource}")

    def list_source_records(self, **query: str | int | bool | None) -> Page:
        return cast(Page, self._request("source-records", params=query))

    def get_source_record(self, source_record_id: str) -> dict[str, object]:
        return self._request(f"source-records/{source_record_id}")

    def query_events(self, **query: str | int | bool | None) -> Page:
        return cast(Page, self._request("events", params=query))

    def get_event(self, event_id: str) -> dict[str, object]:
        return self._request(f"events/{event_id}")

    def list_monitor_targets(self, **query: str | int | bool | None) -> Page:
        return cast(Page, self._request("monitor-targets", params=query))

    def get_monitor_target(self, monitor_id: str, history_limit: int = 20) -> dict[str, object]:
        return self._request(
            f"monitor-targets/{monitor_id}", params={"history_limit": history_limit}
        )

    def list_incidents(self, **query: str | int | bool | None) -> Page:
        return cast(Page, self._request("incidents", params=query))

    def get_incident(self, incident_id: str) -> dict[str, object]:
        return self._request(f"incidents/{incident_id}")

    def status_summary(self, **query: str | int | bool | None) -> dict[str, object]:
        return self._request("status/summary", params=query)

    def create_webhook_subscription(
        self, input_data: Mapping[str, object], *, idempotency_key: str
    ) -> dict[str, object]:
        return self._request(
            "webhook-subscriptions",
            method="POST",
            body=input_data,
            extra_headers={"idempotency-key": idempotency_key},
        )

    def list_webhook_subscriptions(self, **query: str | int | bool | None) -> dict[str, object]:
        return self._request("webhook-subscriptions", params=query)

    def verify_webhook_subscription(self, subscription_id: str) -> dict[str, object]:
        return self._request(f"webhook-subscriptions/{subscription_id}/verify", method="POST")

    def list_webhook_deliveries(self, **query: str | int | bool | None) -> dict[str, object]:
        return self._request("webhook-deliveries", params=query)

    def decide_source_approval(
        self, source_id: str, *, version: int, input_data: Mapping[str, object]
    ) -> dict[str, object]:
        return self._request(
            f"admin/sources/{source_id}/approval-decisions",
            method="POST",
            body=input_data,
            if_match=version,
        )

    def activate_monitor_target(
        self, monitor_id: str, *, version: int, input_data: Mapping[str, object]
    ) -> dict[str, object]:
        return self._request(
            f"admin/monitor-targets/{monitor_id}/activate",
            method="POST",
            body=input_data,
            if_match=version,
        )

    def activate_connector(
        self, source_id: str, *, version: int, input_data: Mapping[str, object]
    ) -> dict[str, object]:
        return self._request(
            f"admin/sources/{source_id}/connectors",
            method="POST",
            body=input_data,
            if_match=version,
        )

    def act_on_incident(
        self,
        incident_id: str,
        action: str,
        *,
        version: int,
        input_data: Mapping[str, object],
    ) -> dict[str, object]:
        if action not in {"acknowledge", "suppress", "resolve", "publish", "correct"}:
            raise ValueError("action must be acknowledge, suppress, resolve, publish, or correct")
        return self._request(
            f"admin/incidents/{incident_id}/{action}",
            method="POST",
            body=input_data,
            if_match=version,
        )

    def list_audit(self, **query: str | int | bool | None) -> Page:
        return cast(Page, self._request("admin/audit", params=query))
