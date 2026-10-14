# iKey Gen3 帳號系統部署與測試

## 目前功能

使用者以 **iKey 帳號／電子郵件＋密碼** 註冊、收取驗證信、登入、登出與重設密碼。網站身分與權限由 iKey 自己管理。

Google Sheets 與 Apps Script 只作為資料儲存及寄信後端，並非使用者登入方式。不得將 API 金鑰、密碼或 Token 放在 GitHub、前端或公開文件。

## 既有系統保護

- 保留舊版 `/api/login`、管理員 Session、LINE、ESP32、借還流程、歡迎動畫及 11 張既有資料表。
- 正式首頁使用 Gen3 一般帳號登入；舊版管理員入口為 `/?legacy=1`。
- 一般帳號不會自動取得舊版管理員權限。
- `Gen3_Users` 正式欄位依序為：
  `user_id, email, password_hash, display_name, global_role, account_status, failed_login_attempts, locked_until, created_at, updated_at, email_verified_at, username`（12 欄）。
- 其餘 `Auth_Tokens`、`Auth_Sessions`、`Auth_Audit_Logs` 結構不變。

## GitHub、Render 與 Apps Script 的部署差異

1. GitHub `main` 更新後，Render 會自動部署 Node.js 伺服器與網頁。
2. **Apps Script 不會隨 GitHub 或 Render 自動更新。** 必須在專用 `iKey_Gen3_Auth_API` 專案手動同步 `gen3-auth/apps-script/Code.gs`，建立新部署版本。
3. Apps Script Script Properties 保留 `GEN3_SPREADSHEET_ID`、`GEN3_API_KEY`；Render Environment 保留 `GEN3_AUTH_ENABLED`、`GEN3_APPS_SCRIPT_URL`、`GEN3_APPS_SCRIPT_KEY`。不得將值公開。
4. `Gen3_Users` 欄位遷移與 Apps Script 新版部署必須協調執行；否則健康檢查會拒絕舊／新結構不一致的帳號服務。

## 正式試算表欄位遷移（維護時段）

**注意：線上試算表在完成此流程前仍可能有 14 欄。此文件及 GitHub 原始碼更新不代表線上欄位已刪除。**

1. 安排短暫維護時段，確認沒有正在進行的帳號操作；備份目前 `Gen3_Users`（含欄位及資料），備份只放在受控位置。
2. 在 Render 將 `GEN3_AUTH_ENABLED` 暫時設為 `false`，確認 Gen3 帳號 API 已停止接受新請求；其他功能不應受影響。
3. 開啟正式 `iKey_Database` → `Gen3_Users`，**僅刪除原 K、L 兩欄**。保留其他 12 欄及所有帳號列，不得刪除整張表。
4. 開啟專用 `iKey_Gen3_Auth_API` Apps Script，將 `Code.gs` 更新為 GitHub 最新版本；在「部署 → 管理部署作業 → 編輯 → 新版本 → 部署」更新既有 Web App，保留原 URL。
5. 在 Apps Script 執行 `inspectGen3Setup`，確認四張表的 schema 均為 `ok`，寄信權限及額度正常。**不必貼出任何金鑰或帳號資料。**
6. 在 Render 將 `GEN3_AUTH_ENABLED` 恢復為 `true`，確認 `/api/auth/status` 的 `enabled:true`、`mail:true`，並實測登入與新帳號電子郵件驗證。
7. 如驗證失敗，先停止帳號服務並回復相容的 Apps Script／表格備份組合；不可在不相容狀態下持續開放註冊。

## 驗收清單

1. `https://ikey.onrender.com/api/auth/status` 回傳 `enabled:true`、`mail:true`。
2. 網站首頁、`/gen3/login.html`、`/gen3/register.html`、`/gen3/account.html` 僅使用 iKey 自訂帳號流程。
3. `Gen3_Users` 表格只有正式 12 欄，且現有帳號資料未遺失。
4. 註冊測試帳號，收到 30 分鐘有效的驗證信；驗證前不能登入，驗證後能登入。
5. 以帳號或 Email 登入、登出，驗證 7 天 Session；忘記密碼的 15 分鐘一次性連結正常。
6. 檢查舊版管理員、LINE、ESP32、借還鑰匙、歡迎動畫仍可使用。
7. 執行 CI：`node --test gen3-auth/core.test.js gen3-auth/apps-script.test.js gen3-auth/routes.test.js` 與既有 smoke tests。

## 診斷

`/api/auth/status` 的 `reason` 僅回傳安全分類：
- `CONFIG_MISSING`：Render 的 Gen3 啟用開關、Apps Script URL 或金鑰缺失。
- `APPS_SCRIPT_AUTH_FAILED`：Render 與 Apps Script 金鑰不一致。
- `APPS_SCRIPT_SCHEMA_MISMATCH`：試算表欄位或存取權有問題。
- `APPS_SCRIPT_OUTDATED_ACTION`：Apps Script 版本過舊。
- `APPS_SCRIPT_NON_JSON_RESPONSE`：Web App URL 或部署存取設定有問題。
- `MAILAPP_NOT_READY`：MailApp 授權或額度尚未就緒。

如需檢查 MailApp，於 Apps Script 編輯器執行 `inspectGen3Setup` 或 `authorizeGen3MailApp`；後者只讀取剩餘寄信額度，不寄信。

## 安全與復原

- **GitHub 刪除檔案不會清除過去的 Git commit 歷史。** 如果真正的密鑰曾被提交，應在服務提供者端撤銷／輪替；刪除程式碼不足以使舊金鑰失效。
- 緊急停用一般帳號寫入：Render 設 `GEN3_AUTH_ENABLED=false`。舊版管理員、LINE、ESP32 不受此開關影響。
