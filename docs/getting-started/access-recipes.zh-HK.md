# 使用香港公共數據來源

[English](access-recipes.md)

數據來源工具把已查核的來源文件整理為有界限及版本控制的存取配方。每項配方會列出官方文件、
身份驗證要求、要求範本、准許主機、參數、回應類型、限制，以及可複製的程式碼範例。你可以先在
本機查看全部內容，再決定是否聯絡所列來源。

現有登記涵蓋目錄內全部 265 項官方來源：37 項可執行配方均有人工合成測試資料，另有 228 項
按來源編寫的手動指引。2026 年 9 月 1 日的一次有界限核查，為 37 項可執行配方中的 29 項記錄
了成功的即時技術驗證；其餘八項維持為測試資料已驗證。即時證據會到期，亦不保證日後仍可使用。

## 安裝開發環境

需要 Python 3.12+ 及 [uv](https://docs.astral.sh/uv/)：

```bash
git clone https://github.com/angusf777/hk-open-data.git
cd hk-open-data
uv sync --frozen --all-groups
```

以下指令使用項目本身的環境，不會安裝全域套件。

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
```

列表可按 `adapter`、`status`、`authentication`、`verification_freshness`、`cursor` 及 `limit`
篩選。啟動服務前請閱讀[自託管指南](runtime.zh-HK.md)。

Python SDK 方法：

```python
recipe = client.get_access_recipe("HKAPI-001")
page = client.list_access_recipes(status="live-verified")
example = client.get_access_example("HKAPI-001", "python")
```

TypeScript SDK 方法：

```typescript
const recipe = await client.getAccessRecipe("HKAPI-001");
const page = await client.listAccessRecipes({ status: "live-verified" });
const example = await client.getAccessExample("HKAPI-001", "typescript");
```

唯讀 MCP 伺服器提供 `access_recipes_list` 及 `access_recipe_get`。它們只讀取以上兩個 REST
路徑，不會執行來源、接受任意網址或回傳來源回應內容。

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
