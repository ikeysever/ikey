# iKey 開發歷程紀錄

> 本檔記錄已確認的程式變更、設計決策、部署與待驗證事項。新增紀錄採追加方式，不以推測取代測試結果。

## 2026-10-26｜超級管理員頁面（第一階段）

### 需求與決策
- 使用者選擇方案 A：先新增側邊欄入口與獨立頁面，管理功能後續討論。
- 保留 iKey 3.1 深藍科技風格與既有首頁、我的專案、帳號管理及登出流程。
- 不新增資料庫表格、不新增管理 API，也不變更登入或權限模型。
- 安全限制：目前頁面僅為佔位介面，尚未實作超級管理員專屬的伺服器端授權，不能視為受保護的管理功能。

### 程式變更
- GitHub 儲存庫：`ikeysever/ikey`
- 開發分支：`feature/super-admin-page-staging`
- PR：https://github.com/ikeysever/ikey/pull/77
- 合併至 `main` 的 Commit：`757c79ce0c54e2549eb1c338271cc374db0eb502`
- 修改：`public/home.html`、`public/projects.html`、`public/account.html`（加入超級管理員側邊欄連結）。
- 新增：`public/super-admin.html`（管理控制台準備中佔位頁面）。

### 問題定位與部署
- 使用者截圖顯示正式網站側邊欄未出現「超級管理員」。
- Render 服務：`ikey`，服務 ID `srv-db1jeuk9v7es73fs5n2g`，工作區 `My Workspace`。
- 查明 Render `autoDeploy=no`，`autoDeployTrigger=off`；當時正式部署版本為 `0cdc805e6cff600623eec062ee2aa511b9ed25a7`，落後於 GitHub `main`。
- 使用者確認工作區後，於 2026-10-26 觸發一次手動部署，部署 ID：`dep-dbfeimlg1s2s73fgs1q0`，目標 Commit：`757c79ce0c54e2549eb1c338271cc374db0eb502`。
- 最近一次查詢結果：`update_in_progress`。**尚未確認 Live**，不得記成部署成功。
- 保留原本手動部署設定，未修改環境變數與資料庫。

### 待驗證與後續
1. 確認 Render 部署狀態轉為 `live`，且 Commit 符合目標。
2. 檢查正式網站 `/home.html`、`/projects.html`、`/account.html` 側邊欄入口。
3. 檢查 `/super-admin.html` 及手機／桌面導覽、登出功能。
4. 注意既有 Service Worker 可能快取舊頁面；若 Render 已更新但畫面未變，需驗證快取版本。
5. 後續另行討論超級管理員可見性與後端權限驗證，完成前不提供敏感管理操作。

### 記錄原則
後續每次重大修改都補上日期、需求、設計決策、檔案路徑、PR／Commit、測試與部署狀態、已知限制、待辦與交接資訊；以可核對的事實為準。

## 2026-11-06｜iBOX 專案裝置管理：第一階段唯讀串接（staging）

### 範圍與決策
- 新版實體設備為 iBOX（電池、ESP32、電子鎖），透過 Wi-Fi/HTTPS 主動連接既有 Render；GAS/Google Sheets 仍是資料後端。大型鑰匙櫃、RFID、指紋不再是必要功能。
- 本次只建立專案裝置清單的安全唯讀路徑；不提供綁定、指令建立、實際開鎖，也不部署正式環境。
- 跨主線：M1 網站、M2 Render、M4 GAS/Sheets、M6 安全與測試。此階段僅有 staging 實作證據，正式驗收進度尚不加分。

### 實作與追蹤
- 分支：`feature/ibox-project-device-read-staging`，PR #100（Draft）。
- `server.js`：新增 `GET /api/projects/:projectId/devices`，需要登入並核對專案建立者；從 Devices 讀取 project_id 對應記錄，僅回傳安全欄位，連線狀態固定標為 unverified、control_ready=false。當 GAS schema 未就緒、結果截斷或存取失敗時拒絕回傳假清單。
- `public/project-devices.js`：使用專案裝置 API 顯示經後端讀取的卡片；錯誤時明確顯示不可驗證。
- `test/ibox-project-inventory.test.js`：新增靜態安全與接線測試。
- 首次 CI 的 npm test 失敗，原因為既有 `test/project-subpages-api.test.js` 禁止專案裝置 API 的舊假設；已調整為驗證新 API 並重新觸發 CI。

### 待驗證與下一步
1. 確認最新 PR CI 成功；失敗則查 log 修正。
2. 核實正式 GAS Devices schema 是否包含 project_id、device_name、status，以及 db.select 的過濾語義。未核實前不得宣稱可讀取正式裝置。
3. 完成安全的出廠憑證驗證、專案綁定及裝置心跳，再逐步串接既有指令生命週期。
4. 未修改 main、未部署 Render/GAS、未啟用實體電子鎖。

