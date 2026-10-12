# iKey Gen3 帳號系統（一般帳號 / 電子郵件）

正式網站的 Gen3 帳號功能使用帳號（或 Email）＋密碼登入，並透過專用 Apps Script + Google Sheets 儲存帳號資料、MailApp 寄送驗證與密碼重設郵件。**不提供第三方 Google OAuth 登入或綁定。**

## 系統分工

- `server.js`：啟用 `/api/auth/*`、帳號狀態檢查與 Gen3 網頁。
- `routes.js`：註冊、登入、登出、驗證信、密碼重設及 Session。
- `core.js`：scrypt 密碼雜湊、帳號狀態、Session。
- `sheets-store.js`：伺服器對專用 Apps Script 的安全 API 呼叫。
- `apps-script/Code.gs`：使用 Script Properties 驗證伺服器請求、LockService 與資料表存取。
- `email.js`：MailApp 驗證郵件與密碼重設流程。

## 資料表相容性

保留現有 `Gen3_Users` 的 14 欄，以及 `Auth_Tokens`、`Auth_Sessions`、`Auth_Audit_Logs`。
`Gen3_Users` 中舊有 `google_sub` 與 `google_linked_at` 欄位目前**不再讀寫**，暫時保留以避免破壞已部署的 Apps Script 和資料表欄位位置。要真正刪除欄位，必須另行規劃資料遷移並同步更新線上 Apps Script；不能只改 GitHub。

## 安全

- 不得將 `GEN3_APPS_SCRIPT_KEY`、`GEN3_API_KEY`、密碼、Token 或任何服務憑證提交到 GitHub。
- 伺服器端程式可接受程式碼審查；程式公開不代表金鑰公開。
- `GEN3_AUTH_ENABLED`、`GEN3_APPS_SCRIPT_URL`、`GEN3_APPS_SCRIPT_KEY` 僅存 Render Environment。
- 原有管理員登入、LINE、ESP32、借還鑰匙與動畫不受本次移除第三方登入影響。

部署與測試步驟見 `DEPLOYMENT.md`。
