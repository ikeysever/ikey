# iKey Gen3 帳號系統部署與測試

## 目前功能

使用者可用 **帳號／電子郵件＋密碼** 註冊、驗證、登入、登出與重設密碼。第三方 Google OAuth 登入與帳號綁定已從伺服器、網頁、Apps Script 原始碼移除。

**注意：** 使用 Google Sheets 和 Apps Script 作為資料庫與寄信後端，與「使用 Google 帳號登入 iKey」是不同的功能。此次仍保留前者，否則一般帳號註冊與驗證信也會停止運作。

## 既有系統保護

- 保留舊版 `/api/login`、管理員 Session、LINE、ESP32、借還流程、歡迎動畫及 11 張舊資料表。
- 正式首頁使用 Gen3 一般帳號登入；舊版管理員入口為 `/?legacy=1`。
- 一般帳號不會自動取得舊版管理員權限。
- Google Sheet `Gen3_Users` 維持 14 欄，另有 `Auth_Tokens`、`Auth_Sessions`、`Auth_Audit_Logs`。
- 原先兩個第三方登入專用欄位 `google_sub`、`google_linked_at` **只為維持欄位順序而保留，不再使用**。不要直接刪除欄位，避免與線上 Apps Script 版本不相容。

## GitHub、Render 與 Apps Script 的部署差異

1. GitHub `main` 合併後，Render 會自動部署 Node.js 伺服器與網頁；確認 Render Deploy 狀態為 `live`。
2. **Apps Script 不會隨 GitHub 或 Render 自動更新。** 要移除線上 Apps Script 中舊有第三方登入操作，需手動開啟專用 `iKey_Gen3_Auth_API`，以最新版 `gen3-auth/apps-script/Code.gs` 完整覆蓋並儲存。
3. 在 Apps Script 選擇「部署 → 管理部署作業 → 編輯 → 新版本 → 部署」，沿用原本 Web App URL。不要改動舊版資料庫 Apps Script。
4. Apps Script Script Properties 保留 `GEN3_SPREADSHEET_ID`、`GEN3_API_KEY`。Render Environment 保留 `GEN3_AUTH_ENABLED=true`、`GEN3_APPS_SCRIPT_URL`、`GEN3_APPS_SCRIPT_KEY`；不要將任何金鑰貼到 GitHub 或聊天室。
5. 若 Render 先更新，原有 Apps Script 尚未更新，一般帳號操作仍使用相同的操作名稱，預期可相容；但線上舊操作要等第 2–3 步才真正移除。

## 驗收清單

1. `https://ikey.onrender.com/api/auth/status` 回傳 `enabled:true`、`mail:true`，且不再提供第三方登入的 `google` 欄位。
2. 網站首頁、`/gen3/login.html`、`/gen3/register.html`、`/gen3/account.html` 均無第三方登入／綁定按鈕。
3. `/api/auth/google/start`、`/api/auth/google/link`、`/api/auth/google/callback` 不再存在（HTTP 404）。
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

- **GitHub 刪除檔案不會清除 Git commit 歷史。** 若任何真正的密鑰曾被提交，應立即在提供者端撤銷／輪替，不可只刪檔。
- 這次沒有建立第三方登入 OAuth 憑證，也不需要在 Render 新增相關環境變數；如果曾自行建立，應到 Google Cloud 撤銷該用戶端。
- 緊急停用一般帳號寫入：Render 設 `GEN3_AUTH_ENABLED=false`。舊版管理員、LINE、ESP32 不受此開關影響。
