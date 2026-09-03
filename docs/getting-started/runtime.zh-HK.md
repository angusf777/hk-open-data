# 自託管開發者工具

[English](runtime.md)

這套可選工具讓你在自己控制的環境整理指定來源的數據，或監察其 API 健康狀態。本項目不會
營運託管 API，亦不會授予任何所列來源的使用權。靜態目錄毋須 Docker，並維持為預設模式。

## 選擇要執行的功能

以下模式名稱是指令設定；所有外部數據連線均預設關閉。

| 功能 | 指令 | 對外部提供者發出的要求 | 儲存內容 |
| --- | --- | --- | --- |
| 只執行目錄（`catalogue`） | `make runtime-catalogue` | 無 | 無；只提供儲存庫內的檔案 |
| API 健康檢查（`observe`） | `make runtime-observe` | 只有你啟用個別來源後才會產生 | SHA-256 指紋及質素摘要；不保存回應內容 |
| 數據存取及完整回應儲存（`fabric`） | `make runtime-fabric` | 只有你啟用來源及其連接器後才會產生 | 只為你已核對條款及儲存設定的來源保存完整回應 |

直接執行 `docker compose up` 只會啟用 `catalog`。數據庫、工作程序、MCP、管理介面、遙測及
物件儲存均須明確選擇 Compose 模式。API 健康檢查不包含物件儲存；完整回應儲存必須由你
主動選用並完成物件儲存設定，否則工作程序不會啟動。

## 安全啟動目錄

```bash
make runtime-catalogue
open http://127.0.0.1:8080/hk-open-data/
```

此路徑不會讀取 `.env`、接觸外部提供者、啟動 PostgreSQL，亦不會啟動數據或健康檢查工作程序。

## 啟動服務前先查看來源指引

本儲存庫為全部 265 項官方來源提供有版本的存取配方或手動指引。查看配方及範例只會讀取本機檔案：

```bash
uv run --project packages/sdk-python hkdata recipe HKAPI-001
uv run --project packages/sdk-python hkdata example HKAPI-001 python
```

只有明確執行 `fetch` 或 `verify` 才可聯絡所列來源：

```bash
uv run --project packages/sdk-python hkdata verify HKAPI-001
uv run --project packages/sdk-python hkdata fetch HKAPI-001 --output json
```

安裝後首三項指令可簡寫為 `hkdata recipe HKAPI-001`、`hkdata example HKAPI-001 python` 及
`hkdata verify HKAPI-001`。狀態、`--allow-unverified`、退出碼、證據及確切權限界線，見雙語
[數據來源指南](access-recipes.zh-HK.md)。

## 準備執行環境

只有在你確實打算執行此工具，並已核對可能啟用的來源時才繼續：

```bash
cp .env.example .env
python - <<'PY'
import base64, secrets
print("POSTGRES_PASSWORD=" + secrets.token_urlsafe(32))
print("POSTGRES_APP_PASSWORD=" + secrets.token_urlsafe(32))
print("POSTGRES_WEBHOOK_PASSWORD=" + secrets.token_urlsafe(32))
print("WEBHOOK_SECRET_ENCRYPTION_KEY=" + base64.b64encode(secrets.token_bytes(32)).decode())
print("OBJECT_STORE_ACCESS_KEY=" + secrets.token_hex(12))
print("OBJECT_STORE_SECRET_KEY=" + secrets.token_urlsafe(40))
PY
```

把產生的值填入已被 Git 忽略的 `.env`，切勿提交或貼到議題。範例身份網址刻意不能運作；
在隔離本機評估以外使用管理功能前，必須設定你自己的 OIDC 提供者。

## API 健康檢查及完整回應儲存

```bash
make runtime-observe
# 或者，在已核對完整回應的儲存需要後：
make runtime-fabric
```

`observe` 會提供 API 健康檢查功能，但所有隨附來源、檢查項目及連接器仍維持停用。每次啟用
均是另一項有紀錄的設定，不能從目錄的條款查核標籤推斷。`observe` 不保存回應內容；
`fabric` 才會啟用附版本控制及物件鎖定的完整回應儲存。

API 提供 `GET /v1/access-recipes`、`GET /v1/access-recipes/{source_reference}`、
`GET /v1/access-resources` 及 `GET /v1/access-resources/{dataset_id}/{resource_id}`；唯讀 MCP
伺服器提供對應的 `access_recipes_list`、`access_recipe_get`、`access_resources_list` 及
`access_resource_get`。這些介面只讀取產生的配方及供應者資源登記，不會執行所列來源。

所有介面只綁定本機 loopback：API `3000`、唯讀 MCP `3100`、公開工具頁面 `4174`、
管理介面 `4175`、Prometheus `9090`。

## 停止及驗證

```bash
make runtime-stop
make verify-runtime
make verify-integrated
make verify-all
```

停止指令會移除容器及網絡，但保留具名 volumes，避免自動刪除數據。整合測試只使用
`tests/fixtures/connectors/manifest.json` 列明的人工合成測試資料，不會啟用連接器或向提供者
發出即時要求。

本機測試通過只證明該次程式碼及測試環境；不代表互聯網部署已適合作生產用途、來源已授權，
亦不建立商業使用、快取、再分發、抓取、私隱或其他法律權利。啟用來源前，你仍須核對提供者
及特定數據集的現行條款、頻率、用途、保存及署名要求。
