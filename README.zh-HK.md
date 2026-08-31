# HK Open Data 香港開放數據目錄

[![授權：Apache-2.0](https://img.shields.io/github/license/angusf777/hk-open-data)](LICENSE)
[![GitHub 星標](https://img.shields.io/github/stars/angusf777/hk-open-data?style=flat)](https://github.com/angusf777/hk-open-data/stargazers)
[![目錄資源](https://img.shields.io/badge/catalogue-521_resources-c81e3a)](catalog/generated/counts.json)
[![持續整合](https://github.com/angusf777/hk-open-data/actions/workflows/ci.yml/badge.svg)](https://github.com/angusf777/hk-open-data/actions/workflows/ci.yml)

> **獨立社群項目。** 本儲存庫並非由香港特別行政區政府或任何列出的提供者營運，亦不代表
> 與其有關聯或獲其認可。本項目是資源目錄及可選用的自託管工具，而不是託管數據服務。
> 上游來源及其現行條款一律作準。

## 香港公共數據，一站整理，按需自託管。

在一個可搜尋的雙語目錄內，尋找官方 API、實用的外部數據來源及 MCP 項目。每項紀錄均顯示
來源脈絡、核查日期及條款證據狀態。

<!-- catalog-counts:start -->
**521 項資源** · **265 項官方資源** · **145 項外部資源** · **111 項 MCP 候選項目**
<!-- catalog-counts:end -->

[**瀏覽線上目錄 →**](https://angusf777.github.io/hk-open-data/) ·
[在本機執行](#在本機執行目錄) · [English](README.md)

![HK Open Data Civic Signal 目錄，展示搜尋、附證據標籤的資源及篩選器。](docs/images/catalogue-home.png)

## 為何建立本項目

香港公共數據分散於不同入門網站、部門頁面、第三方服務及社群工具。HK Open Data 將這些
資源整理為可公開審閱的元數據：

- **尋找：** 在一個雙語索引搜尋，毋須各自保存私人書籤清單。
- **評估：** 開啟上游來源前，先查看提供者、存取方式、協定、最近核查日期及權利證據狀態。
- **開發：** 產生可重現的 JSON，供本機應用使用，亦可按需執行預設拒絕存取的自託管
  P01/P14 工具。
- **改善：** 以小型、附來源證據的拉取請求修正單一 YAML 紀錄。

靜態網站只會讀取本儲存庫產生的 JSON，不會呼叫提供者、複製其數據集、建立帳戶或追蹤
訪客。只有當使用者主動選擇上游連結時，瀏覽器才會前往外部網站。

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

## 證據標籤並非法律結論

`termsEvidence` 只記錄在指定日期從來源找到的資料，並**不**裁定商業使用、快取、再分發、
抓取、署名、個人資料處理或其他活動是否合法或獲准。沒有記錄限制不等於取得許可；網址
可連線亦不等於獲准作生產用途。紀錄可能不完整、過時或有誤。

使用資源前，請核對提供者現行而且適用於特定數據集及平台的條款、政策、授權、技術限制
及相關法例；有需要時應取得提供者確認或專業意見。詳見
[來源權利及證據](docs/governance/SOURCE_RIGHTS.md)。

## 可選用的自託管工具

本儲存庫包含兩個可選用的本機、預設拒絕存取的執行組件，而不會把項目變成託管轉售服務：

- **P01 — Public Data Fabric：** 本機標準化唯讀存取、SDK 介面及唯讀 MCP 工具。
- **P14 — API Quality Observatory：** 只為明確啟用的來源執行本機探測及建立質素證據。

直接執行 `docker compose up` 只會啟動 `catalogue`，不會產生提供者流量；`observe` 是明確選用
的摘要證據模式；`fabric` 則為營運者另行批准的來源加入原始證據保存。所有預載來源及連接器
均維持未啟用。設定、驗證、本機介面及啟用界線見雙語
[執行環境指南](docs/getting-started/runtime.zh-HK.md)。

## 架構

```text
附來源 YAML ── 驗證 ── 可重現 JSON ── 靜態雙語目錄
      │                    │
      └── 來源及證據       └── 可選本機 P01/P14 執行環境（明確啟用）
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

## 授權及上游材料

本項目自行編寫的程式碼及文件以 [Apache License 2.0](LICENSE) 授權。目錄事實、名稱、連結、
上游 API、數據集、文件、商標及提供者內容，仍受各自權利及條款約束。本儲存庫授權不會
授予任何上游材料的權利。完整項目聲明見 [NOTICE](NOTICE)。
