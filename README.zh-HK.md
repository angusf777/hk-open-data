# HK Open Data 香港開放數據目錄

[![授權：Apache-2.0](https://img.shields.io/github/license/angusf777/hk-open-data)](LICENSE)
[![GitHub 星標](https://img.shields.io/github/stars/angusf777/hk-open-data?style=flat)](https://github.com/angusf777/hk-open-data/stargazers)
[![目錄資源](https://img.shields.io/badge/catalogue-521_resources-c81e3a)](catalog/generated/counts.json)
[![持續整合](https://github.com/angusf777/hk-open-data/actions/workflows/ci.yml/badge.svg)](https://github.com/angusf777/hk-open-data/actions/workflows/ci.yml)

> **獨立社群項目。** 本儲存庫並非由香港特別行政區政府或任何列出的提供者營運，亦不代表
> 與其有關聯或獲其認可。本項目是資源目錄及可選用的自託管工具，而不是託管數據服務。
> 原始來源及其現行條款一律作準。

## 香港公共數據，一站整理，按需自託管。

在一個可搜尋的雙語目錄內，尋找官方 API、實用的外部數據來源及 MCP 項目。每項紀錄均顯示
資料來源、核查日期，以及本項目對來源使用條款的查核結果。

<!-- catalog-counts:start -->
**521 項資源** · **265 項官方資源** · **145 項外部資源** · **111 項 MCP 候選項目**
<!-- catalog-counts:end -->

[**瀏覽線上目錄 →**](https://angusf777.github.io/hk-open-data/) ·
[瀏覽供應者檔案及 API](https://angusf777.github.io/hk-open-data/provider-resources/) ·
[在本機執行](#在本機執行目錄) · [English](README.md)

![HK Open Data 供應者資源瀏覽器，展示可搜尋端點、存取分類及使用方法。](docs/images/provider-resources.png)

## 為何建立本項目

香港公共數據分散於不同入門網站、部門頁面、第三方服務及社群工具。HK Open Data 將這些
資源整理為可公開審閱的元數據：

- **尋找：** 在一個雙語索引搜尋，毋須各自保存私人書籤清單。
- **評估：** 開啟來源前，先查看提供者、存取方式、協定、最近核查日期及條款查核結果。
- **開發：** 產生一致的 JSON 供本機應用使用，或按需在自己的電腦執行開發者工具。
- **改善：** 以小型、附來源證據的拉取請求修正單一 YAML 紀錄。

靜態網站只會讀取本儲存庫產生的 JSON，不會呼叫提供者、複製其數據集、建立帳戶或追蹤
訪客。只有當使用者主動選擇來源連結時，瀏覽器才會前往外部網站。

## 在本機執行目錄

需要 Git、Node.js 22+、pnpm 10+、Python 3.12+ 及
[uv](https://docs.astral.sh/uv/)。執行目錄**毋須**使用 Docker。

```bash
git clone https://github.com/angusf777/hk-open-data.git
cd hk-open-data
pnpm install --frozen-lockfile && uv sync --frozen --all-groups
make catalogue
```

以靜態 HTTP 伺服器開啟 `apps/catalog/dist/index.html`；開發時亦可執行
`pnpm --filter @hk-open-data/catalog dev`。編輯及驗證詳情見
[目錄入門指南](docs/getting-started/catalogue.md)。

## 目錄包含甚麼？

| 分類 | 意義 | 收錄並不代表 |
| --- | --- | --- |
| 官方 | 歸屬香港公共機構的資源 | 政府認可、正常運作保證，或對擬議用途的許可 |
| 外部 | 與香港相關的第三方、學術、非牟利或社群資源 | 本項目認可、安全審查或授權許可 |
| MCP | 待評估的社群 MCP 伺服器及相關項目 | 已安裝、已執行、安全、兼容或獲提供者授權 |

[`catalog/`](catalog/) 內的 YAML 紀錄是本儲存庫的權威來源。產生的 JSON（包括精簡搜尋
索引）位於 [`catalog/generated/`](catalog/generated/)。所有欄位的解釋見
[目錄欄位參考](docs/resources/CATALOGUE_FIELDS.md)。

## 使用每項資源前，請先核對來源

目錄內的條款查核標籤，只總結本項目在指定日期找到的資料，並**不**裁定商業使用、快取、
再分發、抓取、署名、個人資料處理或其他活動是否合法或獲准。沒有記錄限制不等於取得
許可；網址可連線亦不代表你的用途已獲批准。紀錄可能不完整、過時或有誤。

使用資源前，請核對提供者現行而且適用於特定數據集及平台的條款、政策、授權、技術限制
及相關法例；有需要時應取得提供者確認或專業意見。詳見
[來源條款及權限](docs/governance/SOURCE_RIGHTS.md)。

## 可選用的開發者工具

本儲存庫現已為全部 **265 項官方來源**提供實用存取配方。每項配方會把來源文件整理為有版本的
要求規格，或清楚列出仍須人手完成的步驟：

- **227 項可執行配方**均有有界限參數、curl／Python／TypeScript 範例，以及帶雜湊的人工合成
  測試資料。
- **190 項 DATA.GOV.HK 資源索引配方**包含 356 組已查核的來源至數據集對應，涵蓋 350 個
  不重複的數據集識別碼。2026 年 9 月 3 日的更新把它們解析為 **5,862 項實際供應者資源**：
  5,391 個毋須參數的 HTTPS 網址、6 個需要參數的網址範本，以及 465 個安全擷取器會拒絕的
  HTTP-only 舊網址。
- 其後的有界限內容核查，從 **350 個數據集中的 310 個**收到非空白 2xx 樣本；另記錄 5 項
  當前供應者失敗，以及 35 個沒有免參數 HTTPS 候選資源的數據集。這是每個數據集的代表性證據，
  並非聲稱已下載全部 5,862 個網址。所有例外均列於
  [供應者資源核查報告](docs/access/provider-resources.md)。
- **37 項直接回應配方**會聯絡已有文件記錄的數據端點；2026 年 9 月 3 日的新一輪核查有 29 項
  成功，其餘八項保留人工合成測試證據及已記錄的即時失敗。
- **38 項手動指引**列出具體的文件、帳戶、互動流程或尚未解決的端點界線。現時合共 219 項
  配方有相符的即時證據；證據會到期，並不保證日後仍可使用。

你可以使用雙語[供應者資源瀏覽器](https://angusf777.github.io/hk-open-data/provider-resources/)
搜尋完整現行清單、按存取狀態或格式篩選、填寫網址必要參數，並產生有界限的 cURL、Python、
Node 或 `hkdata` 指令。瀏覽及產生指令均在本機完成；只有當你開啟供應者資源連結或選擇執行
指令時，才會聯絡供應者。

同一清單亦以供機器讀取的
[`access/generated/data-gov-resources.json`](access/generated/data-gov-resources.json) 發布。

**145 項外部資源**及 **111 個社群 MCP 項目**是供讀者探索的目錄項目，並非隨附連接器。
2026 年 9 月 1 日的連結核查成功連接或跟隨有效重新導向至 128 項外部資源及 107 個 MCP
儲存庫，並為其餘項目記錄結果。該次核查並無登入外部 API，亦無安裝或執行第三方 MCP
程式碼。本儲存庫自有的 15 項唯讀 MCP 工具則另有合約及整合測試。詳見
[覆蓋及證據矩陣](docs/access/coverage.md)。

以下指令只在本機查看配方及產生程式碼，不會發出網絡要求：

```bash
uv run --project packages/sdk-python hkdata recipe HKAPI-001
uv run --project packages/sdk-python hkdata example HKAPI-001 python
uv run --project packages/sdk-python hkdata resources HKAPI-030
uv run --project packages/sdk-python hkdata resource-example HKAPI-030 \
  96c5e827-3d3a-4110-8cd2-e7c80cd562bc curl \
  --dataset nlb-bus-nlb-bus-service-v2
```

安裝後的簡寫是 `hkdata recipe HKAPI-001` 及 `hkdata example HKAPI-001 python`。請先核對來源的
現行條款，再以明確指令聯絡來源：

```bash
uv run --project packages/sdk-python hkdata verify HKAPI-001
uv run --project packages/sdk-python hkdata fetch HKAPI-001 --output json
uv run --project packages/sdk-python hkdata fetch-resource HKAPI-030 \
  96c5e827-3d3a-4110-8cd2-e7c80cd562bc \
  --dataset nlb-bus-nlb-bus-service-v2 --max-bytes 1048576 \
  --output nlb-routes.json
```

本機 REST API、Python 及 TypeScript SDK，以及四項唯讀存取 MCP 工具，會同時提供配方清單及
準確的供應者資源清單。`access_resources_list` 與 `access_resource_get` 只會回傳網址範本、
所需參數、存取分類及 CLI 用法，不會聯絡供應者；實際下載仍須明確執行 CLI 指令。

直接執行 `docker compose up` 只會啟動目錄，不會聯絡外部數據提供者。你必須逐一核對來源的
適用條款及權限，然後自行啟用數據連線。先閱讀雙語[數據來源指南](docs/getting-started/access-recipes.zh-HK.md)
取得可複製指令；如需要本機 API、SDK 或 MCP 服務，再參閱
[自託管指南](docs/getting-started/runtime.zh-HK.md)。

技術指引不會授予商業使用、快取、再分發、抓取或其他擬議用途的權限；個別來源條款及適用法例
仍然作準。

## 架構

```text
附來源 YAML ── 驗證 ── 可重現 JSON ── 靜態雙語目錄
      │                    │
      └── 來源及查核       └── 可選本機數據存取及健康監察工具
```

信任界線及資料流程見[架構概覽](docs/architecture/OVERVIEW.md)及
[開源設計](docs/architecture/OPEN_SOURCE_DESIGN.md)。

## 參與貢獻

適合開始的貢獻包括修正網址、補充官方資源、審閱繁體中文翻譯或改善無障礙體驗。請先閱讀
[CONTRIBUTING.md](CONTRIBUTING.md)並使用議題範本。只提交有權威來源支持的事實元數據；切勿
提交憑證、個人資料、私人通訊或複製的提供者數據集。

如需更正元數據、署名、權利、私隱或提供者陳述，請使用
[更正及下架程序](docs/governance/CORRECTIONS_AND_TAKEDOWNS.md)。安全漏洞應按
[SECURITY.md](SECURITY.md)私下報告。

## 路線圖

`Now / Next / Later` 計劃及「未經全新權利及架構審查，不會提供中央託管數據服務」的明確界線，
見 [ROADMAP.md](ROADMAP.md)。

## 授權及第三方材料

本項目自行編寫的程式碼及文件以 [Apache License 2.0](LICENSE) 授權。目錄事實、名稱、連結、
第三方 API、數據集、文件、商標及提供者內容，仍受各自權利及條款約束。本儲存庫授權
不會授予任何第三方材料的權利。完整項目聲明見 [NOTICE](NOTICE)。
