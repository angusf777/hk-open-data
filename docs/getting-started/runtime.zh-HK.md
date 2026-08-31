# 可選用的自託管執行環境

[English](runtime.md)

P01/P14 執行環境是可選用的本機工具，供營運者建立標準化唯讀存取或 API 質素觀察。它不是
託管服務、數據轉售產品、上游授權或法律結論。靜態目錄毋須 Docker，亦一直是安全的預設模式。

## 預設拒絕的模式

| 模式 | 支援指令 | 提供者流量 | 保存的證據 |
| --- | --- | --- | --- |
| `catalogue` | `make runtime-catalogue` | 無 | 無；只提供已提交的目錄成品 |
| `observe` | `make runtime-observe` | 只有營運者另行啟用來源後才可能產生 | SHA-256 摘要及衍生質素元數據；不保存回應內容 |
| `fabric` | `make runtime-fabric` | 只有來源及連接器均啟用後才可能產生 | 只在營運者已記錄相容來源批准時保存原始證據 |

直接執行 `docker compose up` 只會啟用 `catalog`。數據庫、工作程序、MCP、管理介面、遙測及
物件儲存均須明確選擇 Compose 模式。`observe` 不包含物件儲存；`fabric` 如欠缺原始證據選擇
或完整物件儲存設定，工作程序會拒絕啟動。

## 安全啟動目錄

```bash
make runtime-catalogue
open http://127.0.0.1:8080/hk-open-data/
```

此路徑不會讀取 `.env`、接觸提供者、啟動 PostgreSQL 或啟動 P01/P14 工作程序。

## 準備執行環境

只有在你確實打算營運此工具，並已審閱可能啟用的來源時才繼續：

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
在隔離本機評估以外使用管理功能前，必須設定由營運者控制的 OIDC 提供者。

## 摘要觀察及原始證據模式

```bash
make runtime-observe
# 或者，在已審閱原始保存需要後：
make runtime-fabric
```

`observe` 會令工作程序具備向提供者發出要求的能力，但所有預載來源、監察目標及連接器仍
維持待啟用。每次啟用都是另一項可稽核的營運者行動，絕不能由目錄的條款證據標籤推斷。
`observe` 不保存回應內容；`fabric` 才會啟用附版本控制及物件鎖定的原始證據儲存。

所有介面只綁定本機 loopback：API `3000`、唯讀 MCP `3100`、公開執行環境頁面 `4174`、
營運者介面 `4175`、Prometheus `9090`。

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

本機測試通過只證明該次程式碼及測試環境；不代表互聯網部署合格、來源獲批准，亦不建立
商業使用、快取、再分發、抓取、私隱或其他法律權利。啟用來源前，營運者仍須核對提供者及
特定數據集的現行條款、頻率、用途、保存及署名要求。
