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

## 第三版首頁（重新建置）

- 首頁位於 `public/index.html` 的 `#dashboardPage`，2026-10-12 以新的第三版版型取代原本的帳號卡片＋連線監測首頁。
- 新的 `public/home-dashboard.js` 控制個人帳號資訊；舊的 `public/home-account.js` 已刪除。
- 登入後首頁只保留：iKey 歡迎區、我的帳號、Web／LINE／iBox 系統組成介紹。
- 第三版帳號透過 `GET /api/auth/me` 取得已驗證的帳號名稱、顯示名稱、電子郵件、權限與狀態。
- 管理員登入透過獨立的 `GET /api/login/session` 取得帳號名稱與權限，不混用第三版個資。
- 不顯示已取消的 Google OAuth 或綁定狀態。
- 2026-10-12 依需求移除首頁的「裝置連線監測」整個區塊、快捷連結與其專用前端樣式／DOM 更新程式。
- **後續待辦（尚未實作）**：將裝置連線監測整合到「專案中心 → 我的專案」，屆時需依使用者實際參與的專案顯示所屬設備，先確認專案與設備關聯及權限規格，不得直接套用全站兩台裝置狀態。
- 2026-10-12 依多專案／多裝置方向，**完全移除舊版全域雙裝置心跳系統**：刪除 `routes/device.js`、`POST /api/device/heartbeat`、`GET /api/device/status`、`GET /api/login/admin/connections`、首頁頂端連線狀態、隱藏的管理員監測頁、前端每 5 秒輪詢、ESP Robot／LVGL Terminal 狀態變更日誌與斷線通知。
- 登入歡迎動畫保留視覺與音效，但**不再等待或查詢裝置連線狀態**，動畫時間結束後直接進入首頁；移除過時的裝置載入失敗／重試機制。
- `/api/health` 與一般操作事件紀錄保留，因為它們是 Render 服務健康檢查及其他系統事件，不屬於被移除的全域設備心跳。
- **相容性提醒**：仍呼叫上述舊 API 的 ESP32／外部客戶端，部署後會收到 404。未來必須改接「專案中心 → 我的專案」所設計的專案／設備專屬 API；目前尚未定義或上線。
- 這次不動帳號登入、LINE、Sheets、既有借還與專案管理資料，亦不預先設計新的多裝置資料模型。
- 原網址 `/gen3/account.html` 保留回首頁轉址相容。其他歷史程式的移除需另行逐一查核跨組引用。
