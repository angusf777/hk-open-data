# Coverage and evidence matrix

This page states exactly what the repository can access and what has actually been tested. Recipe
and link checks were recorded on 1 September 2026; DATA.GOV.HK resource discovery and bounded
payload checks were rerun on 3 September 2026. Provider availability can change.

| Catalogue scope | Records | Current repository capability | Observed evidence | Not established |
| --- | ---: | --- | --- | --- |
| Official Hong Kong sources | 265 | 227 executable recipes and 38 source-specific manual guides | 219 recipes have current matching live evidence; eight direct-response recipes have fixtures plus a recorded live failure | Continuing availability, data quality, permission, or successful retrieval of every linked payload |
| DATA.GOV.HK subset | 190 source records / 356 mappings / 350 unique dataset IDs / 5,862 resources | Offline exact resource inventory, generated code and explicit bounded downloads | All 350 packages resolved; 310 datasets returned a non-empty 2xx representative sample; 5 failed; 35 had no parameter-free HTTPS candidate | Successful retrieval of all 5,862 URLs, continuing uptime, schema-level correctness, or permission for a proposed use |
| Direct-response subset | 37 source records | Bounded requests to documented data endpoints | 29 live successes; eight current failures retained as fixture-tested | Uptime after the evidence expiry date |
| External resources | 145 | Searchable catalogue metadata and provider links | 128 landing links were reachable or redirected successfully; 17 produced link-health findings | API authentication, request/response compatibility, account eligibility, or provider approval |
| Community MCP candidates | 111 | Searchable repository metadata only | 107 repository links were reachable or redirected successfully; four returned HTTP 404 and are marked unavailable | Installation, dependency safety, MCP handshake, tool correctness, data access, or endorsement |
| This repository's MCP server | 15 read-only tools | Local MCP facade over the self-hosted REST service, including recipe and exact provider-resource lookup | Pinned tool-schema fingerprint, in-memory protocol tests, and runtime integration tests | Operation of any third-party MCP candidate or automatic execution of provider URLs |

## Interpreting provider-resource evidence

A `data-gov-resource-index` recipe accesses the official dataset catalogue. Its allowlisted `id`
parameter contains the reviewed DATA.GOV.HK identifiers represented by the catalogue entry. The
generated inventory publishes all current resource names, formats, URLs/templates, parameter names
and access classifications. A separate live run samples up to three parameter-free HTTPS candidates
per dataset until one returns a non-empty 2xx response.

The [provider-resource report](provider-resources.md) publishes the exact five failed and 35
non-probeable datasets. This distinction prevents representative success from being presented as
proof that every CSV, JSON feed, ArcGIS layer, WFS service, download, or downstream API passed a
live parser test.

## Safety and permission boundary

Link reachability, fixture success, package metadata, and live technical compatibility are evidence
of different things. None grants permission for commercial use, caching, redistribution, scraping,
personal-data processing, or any other proposed activity. The provider's current terms, licences,
technical controls and applicable law remain controlling.
