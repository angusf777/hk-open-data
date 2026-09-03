# DATA.GOV.HK provider-resource verification

**Checked:** 2026-09-03T03:57:52.987235Z

A bounded live run sampled one usable provider resource for **310 of 350 datasets**. It recorded **5 current failures** and **35 datasets without a parameter-free HTTPS candidate**.

Each successful check received a non-empty 2xx response while reading at most 4096 bytes. The runner tried at most 3 ranked resources per dataset. It stored status, host, media type, timing, size and SHA-256 only; provider response bodies are not committed. This is representative dataset coverage, not a claim that every listed resource URL was downloaded.

Package metadata resolution and downstream payload access are separate checks. The inventory proves that DATA.GOV.HK package metadata resolved; only a successful dataset row in this report proves a bounded provider payload read.

The automatic run does not invent values for parameterized URLs. Separately documented parameter checks cover the airport, Sun Ferry and NLB examples; the two Water Taxi/Fortune Ferry examples currently return HTTP 403 from the verification host. See the usage guide for exact commands and values.

Technical success or inclusion does not grant permission for commercial use, caching, scraping or redistribution. Provider terms and applicable law remain controlling. Availability can change after the recorded check.

- [Machine-readable resource inventory](../../access/generated/data-gov-resources.json)
- [Machine-readable probe evidence](../../access/verification/data-gov-resources/manifest.json)
- [Usage guide](../getting-started/access-recipes.md)

## Exact exceptions

| Dataset | Catalogue sources | Outcome | Recorded detail |
| --- | --- | --- | --- |
| `aahk-team1-flight-info` | HKAPI-076 | not-probeable | no parameter-free HTTPS resource; parameterized=1, HTTP-only=0 |
| `clp-team1-electric-vehicle-charging-stations` | HKAPI-056, HKAPI-162 | failure | 684c99b4-0d87-42ef-b699-434f8437a095: HTTP 403 |
| `ff-fortune-schedule2` | HKAPI-042 | not-probeable | no parameter-free HTTPS resource; parameterized=1, HTTP-only=0 |
| `ff-watertaxi-schedule2` | HKAPI-043 | not-probeable | no parameter-free HTTPS resource; parameterized=1, HTTP-only=0 |
| `hk-cr-crdata-list-ml-licensees` | HKAPI-148 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=8 |
| `hk-dh-chpsebcdde-aed-cdis-syndromic` | HKAPI-128 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=1 |
| `hk-dh-chpsebcdde-ccckg-cdis-sentinel` | HKAPI-129 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=1 |
| `hk-dh-chpsebcdde-cmp-cdis-sentinel` | HKAPI-131 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=1 |
| `hk-dh-chpsebcdde-ev-scan` | HKAPI-132 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=1 |
| `hk-dh-chpsebcdde-rche-cdis-sentinel` | HKAPI-130 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=1 |
| `hk-dh-dh_do-hk-dh-do-licensed-drug-dealer` | HKAPI-134 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=1 |
| `hk-dh-dh_do-hk-dh-do-licensed-pharmacy` | HKAPI-134 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=1 |
| `hk-dh-dh_do-hk-dh-do-pharmaceutical-product` | HKAPI-133 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=1 |
| `hk-dpo-datagovhk1-transport-bus-route-list-and-eta-spcific-bus-stop` | HKAPI-031 | failure | 96bbd2c8-b4eb-48ea-abeb-56e2f9436631: HTTP 422; edea69b4-6105-407e-be6e-cee041bc757f: HTTP 422 |
| `hk-edb-figustat-acc-stu-kin-gra` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-edb-figustat-day-sch-lev-sec` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-edb-figustat-fig-stat-education-and-training-institutions` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=6 |
| `hk-edb-figustat-fig-stat-government-expenditure` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=6 |
| `hk-edb-figustat-fig-stat-population-aged-15` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=6 |
| `hk-edb-figustat-fig-stat-student-enrolment` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=6 |
| `hk-edb-figustat-key-stat-kindergarten-education` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=6 |
| `hk-edb-figustat-key-stat-primary-education` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=6 |
| `hk-edb-figustat-key-stat-secondary-education` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=6 |
| `hk-edb-figustat-key-stat-special-education` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=6 |
| `hk-edb-figustat-ope-acc-stu-rep-pri-gra` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-edb-figustat-ope-acc-stu-rep-pri-sec` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-edb-figustat-ope-acc-stu-rep-sec-gra` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-edb-figustat-ope-acc-stu-rep-sec-sec` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-edb-figustat-stu-day-sch-lev-sec` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-edb-figustat-stu-loc-oth-sec-day-gra` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-edb-figustat-stu-loc-pri-sec-eve-gra` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-edb-figustat-stu-spe-ord-lev` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-isd-gnmis-gnmis` | HKAPI-176 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=3 |
| `hk-lcsd-event-event-leisure` | HKAPI-199 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=1 |
| `hk-td-tis_28-traffic-data-tdas` | HKAPI-062 | failure | 14ca29a1-a872-4a94-8cc7-7efac9d036c1: RetryExhausted |
| `hk-wsd-wsd9-temporary-water-suspension-notices` | HKAPI-160 | failure | 8fdbbdde-b8df-4314-b386-ec45d2db1a45: FetchError; 883741b5-0d51-4e6f-ac86-7a2dc81f22c0: FetchError |
| `hktramways-hktramways-tram-stops` | HKAPI-036 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=3 |
| `rehabsociety-access-accessibile-facilities` | HKAPI-211 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `starferry-starferry-ferry-service-timetables-and-fare-tables-of-star-ferry` | HKAPI-045 | failure | 671e0a33-9fbb-4bee-818a-ad139633a666: FetchError; 0fb52eea-4ad5-4034-8b36-ffbe77c70213: FetchError; 3dd9b4d7-1a86-40e2-ac6b-4a8878f5fca6: FetchError |
| `sunferry-eta-eta` | HKAPI-044 | not-probeable | no parameter-free HTTPS resource; parameterized=1, HTTP-only=0 |
