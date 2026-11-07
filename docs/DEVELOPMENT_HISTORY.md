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


## 2026-11-07｜系統公告排程到期歸檔修正

- 靜態程式碼檢查發現排程工作原先只處理 `scheduled` 公告；已發布且過期的公告雖不再出現在首頁，卻不會自動轉為 `archived`，導致管理後台狀態不一致。
- 修正 `gen3-auth/announcement-router.js`：排程工作同時讀取 `scheduled` 與 `published`，到期已發布公告會更新為 `archived`。
- 新增 `test/announcement-router.test.js` 案例，驗證過期已發布公告歸檔、已到期排程公告發布，以及未到期已發布公告保持不變。
- Commit：`62535f87aa624426808839fd7e2d397691836c72`（程式）、`bdba4f23de6801999c577d91110f81adcfc5920a`（測試）。
- 本次尚未取得 GitHub Actions 執行結果；不得將程式提交等同測試通過。
- 僅修改 `feature/system-announcements-staging-20261102`；未修改 `main`、未同步 GAS、未寫入試算表、未設定 Render 環境變數、未部署正式環境。
- 下一步：確認 GitHub Actions 測試結果，再準備隔離的 staging Apps Script 專案與 staging Spreadsheet，執行受保護的兩表遷移及 API 整合驗收。


## 2026-11-07｜系統公告 CI 與 staging 資料庫查核

- GitHub Actions Run `42381490574`：`iKey announcement API tests` 完成且成功；Node.js 22、語法檢查及 `npm test` 通過。測試統計：30 pass、0 fail、0 skipped。
- 找到 staging Spreadsheet `iKey-Gen3-GAS-STAGING-DATA`（ID `1dn__bGUmCAnGZTNOmvdc0QOUozmrGenpqbrNU3bb_CQ`）；現有四張表為 Device_Ping_Commands、Device_Ping_Nonces、Factory_Devices、Project_Devices，尚無兩張公告表。
- Google Drive 搜尋未找到可確認的 staging Apps Script 專案，因此尚無法確認 Script ID 與 Spreadsheet 綁定關係。未執行 clasp push、GAS 部署、Spreadsheet 寫入或 Render 部署。
- staging 分支與 main 比較為 diverged（ahead 84 / behind 53）；不得直接整支合併，須先處理分支基底與差異。
- 下一步：確認隔離的 staging Apps Script 專案及其 Script Properties 指向 staging Spreadsheet，再使用既有 workflow 同步；完成後才建立公告兩表並執行真實 staging API 驗收。
