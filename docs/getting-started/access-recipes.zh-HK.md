# 使用香港公共數據來源

[English](access-recipes.md)

數據來源工具把已查核的來源文件整理為有界限及版本控制的存取配方。每項配方會列出官方文件、
身份驗證要求、要求範本、准許主機、參數、回應類型、限制，以及可複製的程式碼範例。你可以先在
本機查看全部內容，再決定是否聯絡所列來源。

現有登記涵蓋目錄內全部 265 項官方來源：227 項可執行配方均有人工合成測試資料，另有 38 項
按來源編寫的手動指引。可執行配方中，190 項包含 356 組已查核的來源至數據集對應，涵蓋 350
個不重複的 DATA.GOV.HK 數據集識別碼；另外 37 項會直接聯絡已有文件記錄的數據端點。

2026 年 9 月 4 日，全部 350 個 DATA.GOV.HK 套件紀錄均成功解析為 5,862 項供應者資源：
5,391 個免參數 HTTPS 網址、6 個需要參數的 HTTPS 範本，以及 465 個 HTTP-only 網址。另一輪
有界限內容核查從 234 個數據集的代表直接檔案或 API 收到非空白 2xx 回應；5 個數據集出現當前
供應者失敗，111 個則沒有免參數直接 HTTPS 內容候選。詳見[準確例外及核查方法](../access/provider-resources.md)。即時
證據會到期，亦不保證日後仍可使用。

145 項外部資源及 111 個社群 MCP 項目屬目錄候選項目，並非來源配方。現行連結核查成功到達或
安全重新導向 128 個外部首頁及 107 個 MCP 程式庫連結，但沒有登入這些 API，亦沒有執行第三方
MCP 軟件。詳見[涵蓋範圍及證據表](../access/coverage.md)。

## 安裝開發環境

需要 Python 3.12+ 及 [uv](https://docs.astral.sh/uv/)：

```bash
git clone https://github.com/angusf777/hk-open-data.git
cd hk-open-data
uv sync --frozen --all-groups
```

以下指令使用項目本身的環境，不會安裝全域套件。
請在儲存庫工作目錄內執行。如要在其他目錄呼叫已安裝的 `hkdata`，請設定
`HK_OPEN_DATA_REPOSITORY=/absolute/path/to/hk-open-data`；以 editable 開發模式安裝時，CLI
亦會自動尋找所屬工作目錄。

## 離線查看配方

```bash
uv run --project packages/sdk-python hkdata recipe HKAPI-001
uv run --project packages/sdk-python hkdata recipe HKAPI-001 --format yaml
uv run --project packages/sdk-python hkdata example HKAPI-001 python
```

簡寫為 `hkdata recipe HKAPI-001` 及 `hkdata example HKAPI-001 python`。查看配方及範例只會讀取
儲存庫檔案。產生的 curl、Python 及 TypeScript 範例亦位於 `access/generated/examples/`。

如狀態為 `manual-only`，配方會解釋為何尚未發布安全的機器要求，以及下一個文件查核步驟。
當來源資料只指向搜尋頁面、互動表格、帳戶流程或須另選數據集時，本項目不會猜測網址。

### DATA.GOV.HK 資源索引

`data-gov-resource-index` 配方會使用一個或多個已查核的數據集識別碼，呼叫官方 CKAN
`package_show` 動作。產生的
[`data-gov-resources.json`](../../access/generated/data-gov-resources.json) 會列出每項資源的 ID、
準確供應者網址或範本、格式、所需參數、所屬目錄來源及存取分類；檔案只含供應者中繼資料，
不含複製的數據集。

如要使用圖像化流程，可開啟公開的
[供應者資源瀏覽器](https://angusf777.github.io/hk-open-data/provider-resources/)。它會搜尋同一份清單、
接收必要參數值，並在不聯絡供應者的情況下產生 cURL、Python、Node 或 `hkdata` 用法。在網址加入
`?source=HKAPI-030`，即可只顯示一個目錄來源。執行產生的指令仍是另一個明確步驟。

以下指令離線列出 HKAPI-030 的現行供應者資源：

```bash
uv run --project packages/sdk-python hkdata resources HKAPI-030
uv run --project packages/sdk-python hkdata resources HKAPI-030 \
  --dataset nlb-bus-nlb-bus-service-v2
```

為指定資源產生可複製的 cURL、Python 或 TypeScript；只有經範本准許的參數名稱才可代入，參數
值會安全編碼：

```bash
uv run --project packages/sdk-python hkdata resource-example HKAPI-030 \
  6a3b194a-4718-44aa-9087-34ac2f7117ff curl \
  --dataset nlb-bus-nlb-bus-service-v2 --param routeId=1
```

透過有保護措施的 CLI 下載時，必須明確指定目的地及大小上限；如檔案已存在，指令會拒絕覆寫：

```bash
uv run --project packages/sdk-python hkdata fetch-resource HKAPI-030 \
  96c5e827-3d3a-4110-8cd2-e7c80cd562bc \
  --dataset nlb-bus-nlb-bus-service-v2 --max-bytes 1048576 \
  --output nlb-routes.json
```

此準確指令在 2026 年 9 月 3 日重新執行時收到 HTTP 200、64 條新大嶼山巴士路線及 18,797
bytes。以下指令透過同一個受保護 CLI 核實兩種帶參數網址：

```bash
uv run --project packages/sdk-python hkdata fetch-resource HKAPI-030 \
  6a3b194a-4718-44aa-9087-34ac2f7117ff \
  --dataset nlb-bus-nlb-bus-service-v2 --param routeId=1 \
  --max-bytes 1048576 --output nlb-stops.json

uv run --project packages/sdk-python hkdata fetch-resource HKAPI-030 \
  690662ca-748a-4dc0-89c1-b3aaf280d06a \
  --dataset nlb-bus-nlb-bus-service-v2 \
  --param routeId=1 --param stopId=1 --param languageCode=en \
  --max-bytes 1048576 --output nlb-eta.json
```

核查於 2026-09-03T04:00:42Z 完成，觀察結果如下：

| 要求 | HTTP | Bytes | 已解析紀錄 | 回應 SHA-256 |
| --- | ---: | ---: | ---: | --- |
| 路線 | 200 | 18,797 | 64 條路線 | `44369c71003e8ac47f3970be2ce9f84535629fee90631bc0b9e4c94e9307c590` |
| `routeId=1` 的車站 | 200 | 20,259 | 56 個車站 | `8e10f16ad787fe3a7344791391136cd907ac69d1359606b6cf2c58ec3771c51b` |
| 路線 1、車站 1 的 ETA | 200 | 427 | 1 項 ETA | `37312e81e13c0648899e0ca7b550ede1192594fd9c939dec93dfe25bff58d4d7` |

雜湊及紀錄數只屬該時點證據，會隨供應者更新而改變，並非永久可用性或內容保證。核查後已刪除
所下載的內容。

其餘帶參數供應者網址，已使用官方數據字典內的值核查：

| 來源 | 所需範例 | 2026 年 9 月 3 日觀察結果 |
| --- | --- | --- |
| HKAPI-076，機場歷史航班 | `--param date=2026-09-02`（應使用前一曆日，格式為 `YYYY-MM-DD`） | HTTP 200；82,810 bytes；414 項航班紀錄；SHA-256 `efd0f1fbf9a28cedc6da773f691290cf5048d485253aa9d2cdbc1e942623a343` |
| HKAPI-044，新渡輪 | `--param routecode=CEMW`（中環至梅窩） | HTTP 200；379 bytes；1 項 ETA；SHA-256 `7aba513f6fa8af32717099bee61241e143a4dcf3c5eb369e4389b5eb57380343` |
| HKAPI-043，水上的士 | `--param route_code=WATERTAXI` | 本核查主機收到 HTTP 403；參數符合文件，但目前不聲稱可自動存取 |
| HKAPI-042，富裕小輪 | `--param route_code=HHTEC`（紅磡至尖沙咀東） | 本核查主機收到 HTTP 403；參數符合文件，但目前不聲稱可自動存取 |

請先以 `hkdata resources SOURCE` 找出對應資源 ID，再加上表內參數。機場
[數據規格](https://www.hongkongairport.com/iwov-resources/misc/opendata/Flight_Information_DataSpec_en.pdf)、
新渡輪 [ETA 規格](https://www.sunferry.com.hk/eta/SunFerry_ETA_API_Specification_and_Data_Dictionary.pdf)
及水上的士[數據字典](https://www.hongkongwatertaxi.com.hk/csv/DataDictionary.pdf)仍是有效參數值的
權威來源。HTTP 403 會保留為失敗證據；工具不會繞過供應者存取控制。

如一項目錄紀錄涵蓋多個數據集，請查看配方 `id` 參數的 `enum`，並明確選擇已查核的識別碼：

```bash
uv run --project packages/sdk-python hkdata recipe HKAPI-174
uv run --project packages/sdk-python hkdata fetch HKAPI-174 \
  --param id=hk-reo-reopsi01-election-result-lc-2025lcge --output json
```

## 明確執行一次有界限要求

只有 `fetch` 及 `verify` 指令可以聯絡所列來源。執行前，請先查看配方及來源的現行條款。

```bash
uv run --project packages/sdk-python hkdata fetch HKAPI-001 --output json
uv run --project packages/sdk-python hkdata fetch HKAPI-001 --param limit=5 --output ndjson
```

如配方只有人工合成測試證據，必須明確確認此限制：

```bash
uv run --project packages/sdk-python hkdata fetch HKAPI-018 --allow-unverified
```

參數會按准許清單及數據類型檢查。要求只用 HTTPS、精確主機准許清單、有界限的逾時及回應大小、
有限重試，而且不會自動跨主機重新導向。回應數據輸出至 stdout，診斷資料輸出至 stderr。

## 驗證技術兼容性

驗證一項匿名配方：

```bash
uv run --project packages/sdk-python hkdata verify HKAPI-001
```

簡寫為 `hkdata verify HKAPI-001`。如要明確選擇核查全部匿名可執行配方，預設會逐一執行，並行數
上限為三：

```bash
uv run --project packages/sdk-python hkdata verify --all-anonymous
uv run --project packages/sdk-python hkdata verify --all-anonymous --concurrency 3
```

每項已嘗試來源會在 `access/verification/` 產生一個只含元數據的 JSON 檔案，記錄時間、雜湊、
媒體類型、大小、紀錄數、穩定錯誤碼及限制；不會保存回應內容、授權標頭、cookie 或憑證。只有
成功證據與現行配方雜湊相符，而且仍在 `validUntil` 期限內，產生狀態才可為 `live-verified`。

穩定的非零退出碼為：`2` 輸入無效或找不到配方、`3` 需要身份驗證、`4` 來源未能連線、`5`
回應媒體或結構不符、`6` 配方不可執行、`7` 不安全重新導向或回應過大。

只有在你明確選擇聯絡供應者時，才更新資源清單及代表內容證據。並行數上限為三；內容樣本預設
上限為 4 KiB，只會保存雜湊，不會保存內容：

```bash
uv run python -m scripts.data_gov_resources refresh --concurrency 3
uv run python -m scripts.data_gov_resources probe --concurrency 3 \
  --sample-bytes 4096 --max-candidates 3
uv run python -m scripts.data_gov_resources check
```

## 理解狀態

| 狀態 | 意義 |
| --- | --- |
| `live-verified` | 有現行、相符而成功的純元數據核查證據 |
| `fixture-tested` | 要求規劃及解析已通過帶雜湊的人工合成測試；現時沒有成功即時證據 |
| `credential-required` | 文件所述要求須透過指定環境變數提供憑證 |
| `manual-only` | 文件仍有參考價值，但尚未確立安全的可執行要求 |
| `blocked` | 已記錄的先決條件阻止執行 |
| `unavailable` | 保留先前文件所述要求及恢復步驟，但現時不可使用 |

產生的[官方來源狀態索引](../access/source-status.md)列出每項官方來源的現行有效狀態及最近驗證結果。

## 透過本機 API 或 SDK 讀取配方

自託管 REST 服務只會提供儲存庫資料；以下路徑不會執行來源：

```text
GET /v1/access-recipes
GET /v1/access-recipes/{source_reference}
GET /v1/access-resources?source_reference=HKAPI-030
GET /v1/access-resources/{dataset_id}/{resource_id}
```

列表可按 `adapter`、`status`、`authentication`、`verification_freshness`、`cursor` 及 `limit`
篩選。啟動服務前請閱讀[自託管指南](runtime.zh-HK.md)。

Python SDK 方法：

```python
recipe = client.get_access_recipe("HKAPI-001")
page = client.list_access_recipes(status="live-verified")
example = client.get_access_example("HKAPI-001", "python")
resources = client.list_access_resources(source_reference="HKAPI-030", limit=10)
resource = client.get_access_resource(
    "nlb-bus-nlb-bus-service-v2",
    "96c5e827-3d3a-4110-8cd2-e7c80cd562bc",
)
```

TypeScript SDK 方法：

```typescript
const recipe = await client.getAccessRecipe("HKAPI-001");
const page = await client.listAccessRecipes({ status: "live-verified" });
const example = await client.getAccessExample("HKAPI-001", "typescript");
const resources = await client.listAccessResources({ source_reference: "HKAPI-030", limit: 10 });
const resource = await client.getAccessResource(
  "nlb-bus-nlb-bus-service-v2",
  "96c5e827-3d3a-4110-8cd2-e7c80cd562bc",
);
```

唯讀 MCP 伺服器提供 `access_recipes_list`、`access_recipe_get`、
`access_resources_list` 及 `access_resource_get`。它們只讀取以上四個 REST 路徑，不會執行
來源、接受任意網址或回傳來源回應內容；資源工具會把準確網址及所需參數提供給 MCP 客戶端，
實際網絡執行仍是另一項明確操作。

## 新增或修正一項來源

1. 更新 `catalog/official/` 內的來源紀錄及對應的
   `access/recipes/official/hkapi-NNN.yml`。
2. 引用官方文件。如文件不足以確立安全而精確的要求，保留 `manual-only`，並寫明原因及下一步。
3. 如配方可執行，加入人工合成的要求及回應測試檔案，並更新兩份測試清單。
4. 執行 `pnpm access:generate`、`pnpm catalog:generate`、`uv run pytest tests/access -q`、
   `pnpm access:check` 及 `pnpm catalog:check`。
5. 只有在你明確決定聯絡來源時才執行即時驗證；切勿提交來源回應內容或憑證。

## 權限及準確性界線

本工具提供技術指引，並非提供者授權或法律意見。收錄來源、產生範例、測試資料成功或即時技術
核查成功，均不授予商業使用、快取、再分發、抓取、個人資料處理或其他擬議活動的權限。使用前
請核對提供者現行的平台及個別數據集條款、授權、署名規定、技術限制及適用法例；原始來源一律
作準。
