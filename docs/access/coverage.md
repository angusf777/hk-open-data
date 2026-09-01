# Coverage and evidence matrix

This page states exactly what the repository can access and what has actually been tested. Counts
describe the 1 September 2026 checkout and evidence window; provider availability can change.

| Catalogue scope | Records | Current repository capability | Observed evidence | Not established |
| --- | ---: | --- | --- | --- |
| Official Hong Kong sources | 265 | 227 executable recipes and 38 source-specific manual guides | 219 recipes have current matching live evidence; eight direct-response recipes have fixtures plus a recorded live failure | Continuing availability, data quality, permission, or successful retrieval of every linked payload |
| DATA.GOV.HK subset | 190 source records / 356 mappings / 350 unique dataset IDs | Fixed `package_show` resource-index recipes with reviewed ID allowlists | All 350 dataset IDs and all 190 default lookups returned valid resource metadata | That every resource URL in each package was downloaded, parsed, or licensed for a proposed use |
| Direct-response subset | 37 source records | Bounded requests to documented data endpoints | 29 live successes; eight current failures retained as fixture-tested | Uptime after the evidence expiry date |
| External resources | 145 | Searchable catalogue metadata and provider links | 128 landing links were reachable or redirected successfully; 17 produced link-health findings | API authentication, request/response compatibility, account eligibility, or provider approval |
| Community MCP candidates | 111 | Searchable repository metadata only | 107 repository links were reachable or redirected successfully; four returned HTTP 404 and are marked unavailable | Installation, dependency safety, MCP handshake, tool correctness, data access, or endorsement |
| This repository's MCP server | 13 read-only tools | Local MCP facade over the self-hosted REST service | Pinned tool-schema fingerprint, in-memory protocol tests, and runtime integration tests | Operation of any third-party MCP candidate |

## Interpreting a resource-index recipe

A `data-gov-resource-index` recipe is executable and source-specific, but it accesses the official
dataset catalogue rather than every linked data payload. Its allowlisted `id` parameter contains
the reviewed DATA.GOV.HK identifiers represented by the catalogue entry. The response returns the
current resource names, formats and URLs.

This distinction prevents a successful metadata request from being presented as proof that every
CSV, JSON feed, ArcGIS layer, WFS service, download, or downstream API in that dataset package has
also passed a live parser test.

## Safety and permission boundary

Link reachability, fixture success, package metadata, and live technical compatibility are evidence
of different things. None grants permission for commercial use, caching, redistribution, scraping,
personal-data processing, or any other proposed activity. The provider's current terms, licences,
technical controls and applicable law remain controlling.
