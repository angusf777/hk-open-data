# DATA.GOV.HK provider-resource verification

**Checked:** 2026-09-04T03:13:33.770563Z

A bounded live run sampled one usable provider resource for **234 of 350 datasets**. It recorded **5 current failures** and **111 datasets without a parameter-free HTTPS candidate**.

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
| `eac-eacpsi01-csdi-dc-boundaries-2023` | HKAPI-175 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `eac-eacpsi01-csdi-dcca-boundaries-1999` | HKAPI-175 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `eac-eacpsi01-csdi-dcca-boundaries-2003` | HKAPI-175 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `eac-eacpsi01-csdi-dcca-boundaries-2007` | HKAPI-175 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `eac-eacpsi01-csdi-dcca-boundaries-2011` | HKAPI-175 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `eac-eacpsi01-csdi-dcca-boundaries-2015` | HKAPI-175 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `eac-eacpsi01-csdi-gc-boundaries-2016` | HKAPI-175 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `eac-eacpsi01-csdi-gc-boundaries-2020` | HKAPI-175 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `eac-eacpsi01-csdi-gc-boundaries-2021` | HKAPI-175 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `eac-eacpsi01-csdi-gc-boundaries-2025` | HKAPI-175 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `ff-fortune-schedule2` | HKAPI-042 | not-probeable | no parameter-free HTTPS resource; parameterized=1, HTTP-only=0 |
| `ff-watertaxi-schedule2` | HKAPI-043 | not-probeable | no parameter-free HTTPS resource; parameterized=1, HTTP-only=0 |
| `hk-afcd-afcdlist-habitatmap` | HKAPI-117 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-bd-opendata-foundation-consent-commenced` | HKAPI-222 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-bd-opendata-ldb` | HKAPI-223 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-bd-opendata-s24-order-1` | HKAPI-220 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-bd-opendata-s24-order-2` | HKAPI-220 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-bd-opendata-s26-order-1` | HKAPI-220 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-bd-opendata-s26-order-2` | HKAPI-220 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-bd-opendata-s26a-order-1` | HKAPI-220 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-bd-opendata-s26a-order-2` | HKAPI-220 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-bd-opendata-s28-order-1` | HKAPI-220 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-bd-opendata-s28-order-2` | HKAPI-220 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-cedd-csu-cedd-incident` | HKAPI-234 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
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
| `hk-edb-figustat-stu-pri-dis-gra` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-edb-figustat-stu-sec-dis-gra` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-edb-figustat-stu-spe-ord-lev` | HKAPI-244 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `hk-edb-hei-geo-referenced-data` | HKAPI-238 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-edb-kgjoinkes-kg-join-kes` | HKAPI-243 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=26 |
| `hk-edb-schinfo-registration-info` | HKAPI-237 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=3 |
| `hk-edb-schinfo-school-location-and-information` | HKAPI-235 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=3 |
| `hk-epd-angteam-2020-l10` | HKAPI-113 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-epd-aqmnteam-air-quality-monitoring-network-of-hong-kong` | HKAPI-105 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-epd-asmteam-epd-path` | HKAPI-106 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-epd-evcpateam-evc-1` | HKAPI-055 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-epd-rngteam-chemical-waste-collectors-list` | HKAPI-116 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-epd-rngteam-clinical-waste-collectors-list` | HKAPI-116 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-epd-rngteam-issued-construction-noise-permit` | HKAPI-116 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-epd-rsteam-specified-process-licence` | HKAPI-116 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-epd-tnteameiao-dir` | HKAPI-115 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-epd-tnteameiao-eia` | HKAPI-115 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-epd-tnteamhfer-habitat-from-eia-reports` | HKAPI-117 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-fehd-fehddengue-fehd-dengue-surveillance` | HKAPI-192 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-had-json1-db-of-private-buildings-in-hong-kong` | HKAPI-233 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-housing-hcp-hcp-ha` | HKAPI-214 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-housing-los-los` | HKAPI-215 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-housing-os-os` | HKAPI-215 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-immd-set9-immdcp` | HKAPI-079 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-isd-gnmis-gnmis` | HKAPI-176 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=3 |
| `hk-landsd-openmap-landsd-building-licence` | HKAPI-230 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-landsd-openmap-landsd-government-land-allocation` | HKAPI-228 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-landsd-openmap-landsd-lot` | HKAPI-227 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-landsd-openmap-landsd-slope-maintenance-responsibility-boundaries` | HKAPI-231 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-landsd-openmap-short-term-tenancy` | HKAPI-229 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-lcsd-csdi-barbecue-areas` | HKAPI-205 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-lcsd-csdi-libraries` | HKAPI-202 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-lcsd-csdi-parks-zoos-gardens` | HKAPI-205 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-lcsd-csdi-sports-centres` | HKAPI-204 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-lcsd-csdi-sports-grounds` | HKAPI-204 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-lcsd-csdi-swimming-pools` | HKAPI-203 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-lcsd-csdi-swimming-pools-attendance` | HKAPI-207 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-lcsd-event-event-leisure` | HKAPI-199 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=1 |
| `hk-lcsd-facility-facility-mbp` | HKAPI-206 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=1 |
| `hk-lcsd-facwd-fac-wd-list` | HKAPI-206 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=3 |
| `hk-ofca-ofca-ofca-dataset-40` | HKAPI-261 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-pland-pland1-2021-based-tpedm` | HKAPI-226 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-pland-pland1-boundaries-of-tpu-sb-vc` | HKAPI-225 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-reo-reopsi01-election-result-dcc-2023` | HKAPI-174 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-swd-fcw-ciss` | HKAPI-251 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-swd-fcw-list-ccc-standalone` | HKAPI-248 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-swd-fcw-list-ifsc` | HKAPI-248 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-swd-fcw-list-ifsc-boundary` | HKAPI-248 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-swd-fcw-list-occs` | HKAPI-248 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-swd-fcw-list-swsppi` | HKAPI-248, HKAPI-252 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-swd-fcw-list-vsp` | HKAPI-248 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-swd-rm-list-of-iss` | HKAPI-253 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-swd-ssb-ssfu` | HKAPI-247 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-td-tis_28-traffic-data-tdas` | HKAPI-062 | failure | 14ca29a1-a872-4a94-8cc7-7efac9d036c1: RetryExhausted |
| `hk-td-tis_32-traffic-data-aivas` | HKAPI-070 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-td-tis_38-taxi-pick-up-drop-off-points` | HKAPI-075 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-td-tis_39-fleet-taxi-stopping-places` | HKAPI-074 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
| `hk-wsd-wsd9-temporary-water-suspension-notices` | HKAPI-160 | failure | 8fdbbdde-b8df-4314-b386-ec45d2db1a45: FetchError; 883741b5-0d51-4e6f-ac86-7a2dc81f22c0: FetchError |
| `hktramways-hktramways-tram-stops` | HKAPI-036 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=3 |
| `rehabsociety-access-accessibile-facilities` | HKAPI-211 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=4 |
| `starferry-starferry-ferry-service-timetables-and-fare-tables-of-star-ferry` | HKAPI-045 | failure | 671e0a33-9fbb-4bee-818a-ad139633a666: FetchError; 0fb52eea-4ad5-4034-8b36-ffbe77c70213: FetchError; 3dd9b4d7-1a86-40e2-ac6b-4a8878f5fca6: FetchError |
| `sunferry-eta-eta` | HKAPI-044 | not-probeable | no parameter-free HTTPS resource; parameterized=1, HTTP-only=0 |
| `tpd-tpb1-digital-planning-data-of-statutory-plans` | HKAPI-224 | not-probeable | no parameter-free HTTPS resource; parameterized=0, HTTP-only=0 |
