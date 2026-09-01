from __future__ import annotations

import json
import re
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import TypedDict


@dataclass(frozen=True)
class DataGovDataset:
    dataset_id: str
    dataset_name: str
    provider: str
    resources: tuple[tuple[str, str], ...]
    score: float


@dataclass(frozen=True)
class _IndexedDataset:
    dataset_id: str
    dataset_name: str
    provider: str
    resources: tuple[tuple[str, str], ...]
    label_tokens: tuple[frozenset[str], ...]
    provider_tokens: frozenset[str]


class _DatasetGroup(TypedDict):
    dataset_name: str
    provider: str
    resources: list[tuple[str, str]]


class DataGovDirectory:
    def __init__(self, datasets: tuple[_IndexedDataset, ...]) -> None:
        self._datasets = datasets

    @classmethod
    def from_rows(cls, rows: Iterable[Mapping[str, object]]) -> DataGovDirectory:
        grouped: dict[str, _DatasetGroup] = {}
        for row in rows:
            dataset_id = row.get("Dataset ID")
            dataset_name = row.get("Dataset Name")
            provider = row.get("Data Provider")
            resource_name = row.get("Resource Name")
            data_format = row.get("Data Format")
            if not isinstance(dataset_id, str) or not isinstance(dataset_name, str):
                continue
            if not isinstance(provider, str) or not isinstance(resource_name, str):
                continue
            if not isinstance(data_format, str):
                continue
            item = grouped.setdefault(
                dataset_id,
                {
                    "dataset_name": dataset_name,
                    "provider": provider,
                    "resources": [],
                },
            )
            item["resources"].append((resource_name, data_format))

        indexed: list[_IndexedDataset] = []
        for dataset_id, item in grouped.items():
            dataset_name = item["dataset_name"]
            provider = item["provider"]
            resources = tuple(item["resources"])
            indexed.append(
                _IndexedDataset(
                    dataset_id=dataset_id,
                    dataset_name=dataset_name,
                    provider=provider,
                    resources=resources,
                    label_tokens=tuple(
                        _tokens(label)
                        for label in (
                            dataset_name,
                            *(resource_name for resource_name, _ in resources),
                        )
                    ),
                    provider_tokens=_tokens(provider),
                )
            )
        return cls(tuple(indexed))

    def rank(
        self,
        *,
        name: str,
        provider: str,
        search_query: str,
    ) -> tuple[DataGovDataset, ...]:
        source_labels = (_tokens(name), _tokens(search_query))
        source_provider = _tokens(provider)
        candidates: list[DataGovDataset] = []
        for item in self._datasets:
            name_score = max(
                _token_similarity(source, label)
                for source in source_labels
                for label in item.label_tokens
            )
            provider_score = _token_similarity(source_provider, item.provider_tokens)
            candidates.append(
                DataGovDataset(
                    dataset_id=item.dataset_id,
                    dataset_name=item.dataset_name,
                    provider=item.provider,
                    resources=item.resources,
                    score=round((name_score * 0.88) + (provider_score * 0.12), 6),
                )
            )
        return tuple(sorted(candidates, key=lambda item: (-item.score, item.dataset_id)))


def parse_data_gov_directory(payload: bytes) -> tuple[Mapping[str, object], ...]:
    document = json.loads(payload.decode("utf-8-sig"))
    if not isinstance(document, dict) or not isinstance(document.get("Data"), list):
        raise ValueError("DATA.GOV.HK directory must contain a Data array")
    rows = document["Data"]
    if not all(isinstance(row, dict) for row in rows):
        raise ValueError("DATA.GOV.HK directory rows must be objects")
    return tuple(rows)


_ALIASES = (
    (re.compile(r"\b(?:version 2|2nd generation|second generation)\b"), "v2"),
    (re.compile(r"\breal[ -]?time\b"), "realtime"),
    (re.compile(r"\bcar[ -]?park\b"), "parking"),
)
_STOP_WORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "api",
        "apis",
        "chinese",
        "data",
        "dataset",
        "datasets",
        "english",
        "for",
        "hong",
        "in",
        "information",
        "kong",
        "of",
        "on",
        "simplified",
        "the",
        "to",
        "traditional",
    }
)


def _tokens(value: str) -> frozenset[str]:
    normalized = value.casefold().replace("&", " and ")
    for pattern, replacement in _ALIASES:
        normalized = pattern.sub(replacement, normalized)
    return frozenset(
        _singularize(token)
        for token in re.sub(r"[^a-z0-9]+", " ", normalized).split()
        if token not in _STOP_WORDS
    )


def _singularize(token: str) -> str:
    if len(token) > 4 and token.endswith("ies"):
        return f"{token[:-3]}y"
    if len(token) > 4 and token.endswith("s") and not token.endswith(("is", "ss", "us")):
        return token[:-1]
    return token


def _token_similarity(
    left_tokens: frozenset[str],
    right_tokens: frozenset[str],
) -> float:
    if not left_tokens or not right_tokens:
        return 0.0
    intersection = len(left_tokens & right_tokens)
    containment = intersection / min(len(left_tokens), len(right_tokens))
    jaccard = intersection / len(left_tokens | right_tokens)
    return (containment * 0.65) + (jaccard * 0.35)


def rank_data_gov_datasets(
    *,
    name: str,
    provider: str,
    search_query: str,
    directory_rows: Iterable[Mapping[str, object]],
) -> tuple[DataGovDataset, ...]:
    return DataGovDirectory.from_rows(directory_rows).rank(
        name=name,
        provider=provider,
        search_query=search_query,
    )


def select_unambiguous_dataset(
    ranked: Sequence[DataGovDataset],
    *,
    minimum_score: float = 0.72,
    minimum_margin: float = 0.04,
) -> DataGovDataset | None:
    if not ranked or ranked[0].score < minimum_score:
        return None
    if len(ranked) > 1 and ranked[0].score - ranked[1].score < minimum_margin:
        return None
    return ranked[0]
