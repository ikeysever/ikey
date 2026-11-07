# iKey 3.1 系統公告｜實作歷程

## 2026-11-02｜第 14 項：首頁公告排序核心

### 已採用的排序基準
- 第一排序鍵：公告優先級，緊急（urgent）> 重要（important）> 一般（normal）。
- 第二排序鍵：同優先級時，發布時間（published_at）由新到舊。
- 第三排序鍵：發布時間相同或缺漏時，以建立時間（created_at）由新到舊。
- 無法辨識的優先級排在已知優先級之後；無效／缺漏時間不會被當成最新公告。
- 排序函式回傳新陣列，不修改原始資料。

### 本次程式變更
- 新增 `lib/announcement-order.js`：純函式排序核心，沒有資料庫或網路副作用。
- 新增 `test/announcement-order.test.js`：涵蓋優先級、同級時間排序、未知值、輸入不可變與錯誤輸入。
- 開發分支：`feature/system-announcements-staging-20261102`。
- 基底分支：`feature/super-admin-dashboard-live-20261102`。
- 未修改 `main`、正式資料庫、Render 設定或部署。

### 測試與驗證
- 使用 Node.js 內建測試執行器驗證排序核心：5 項測試全部通過（5 passed、0 failed）。
- 測試涵蓋優先級優先、同級時間倒序、未知優先級／缺漏時間處理、輸入不可變及非陣列輸入。
- 測試於隔離工作目錄執行；GitHub 分支中的測試檔已按相同測試案例提交，尚未觸發 GitHub Actions。

### 第二階段｜超級管理員前端介面
- 新增 `public/announcements-admin.css`：公告管理介面樣式，沿用 iKey 深藍、冰藍色系，支援窄螢幕排版。
- 新增 `public/announcements-admin.js`：公告列表、搜尋、分類／狀態篩選、優先級排序、新增、編輯、預覽、草稿、示範發布、示範排程、下架與回收站操作。
- 更新 `public/super-admin.html`：新增「系統公告」管理入口與獨立管理區域，不更動既有裝置管理流程。
- 前端使用明確標示的示範資料，僅存於頁面記憶體；不呼叫 API、不寫入 Google Sheets、不修改 GAS，也不建立資料表。重新整理後示範資料會還原。
- 已核對新增 JS/CSS 檔案、超級管理員入口、管理區域及腳本載入引用均存在。尚未進行瀏覽器端互動測試；不可視為正式公告功能已上線。

### 第三階段｜首頁公告閱讀介面
- 新增 `public/announcements-home.css` 與 `public/announcements-home.js`。
- 更新 `public/home.html`：首頁系統公告卡片改為公告列表入口，載入公告閱讀介面資產。
- 首頁支援依優先級及發布時間排序、公告摘要卡片、點擊後顯示全文彈出視窗、分類／優先級標籤、發布時間、點擊遮罩／Escape／關閉按鈕關閉。
- 使用獨立示範資料，不呼叫 API、不記錄已讀、不連接資料庫；明確顯示介面預覽聲明。
- 桌面／手機自適應樣式已建立。尚未進行實際瀏覽器端視覺與互動 QA。

### 尚未完成
- 尚未將排序核心接入首頁公告 API 與超級管理員公告管理介面。
- 公告資料表／欄位尚需依現有 GAS 與資料庫 Schema 唯讀盤點結果確認；本次不自行新增資料表或欄位。
- 尚未執行正式環境驗收。


## 2026-11-02｜第四階段：公告 API 與資料庫串接（staging）

### 已完成的程式變更
- 新增 `gen3-auth/announcement-router.js`，沿用既有 Gen3 HttpOnly session 與 `global_role === super_admin` 權限檢查。
- 新增公開公告讀取、管理員 CRUD／發布／下架／回收站／還原，以及使用者公告已讀 API。
- 已讀紀錄使用 `SHA-256(user_id:announcement_id)` 作為唯一 read_id，避免同一使用者重複寫入相同公告的已讀紀錄。
- 新增受 Bearer secret 保護的排程發布端點，供 staging Cron Job 呼叫。
- `server.js` 已掛載公告 Router；超級管理員公告頁及首頁公告閱讀頁已改用同源 API，不再使用 DEMO 記憶體資料。
- 新增 GAS 安全遷移檔，僅建立兩張公告工作表並加入資料表 allowlist；既有資料表不會被覆寫。
- 通用 Sheets 引擎文字欄位上限調整為 12,000 字，公告 API 仍限制內容最多 10,000 字。
- 新增公告 API 文件與 Node 測試案例。

### 安全與資料保護
- 所有管理 API 需要有效登入 Session 與超級管理員角色。
- 瀏覽器不接觸 Apps Script API Key 或 Spreadsheet ID。
- 刪除採軟刪除；永久刪除不在本次 API 範圍。
- GAS 遷移檔遇到既有欄位不一致會停止，不清除或覆蓋既有工作表。
- 排程端點需設定 staging 專用 `ANNOUNCEMENTS_CRON_SECRET`；本次沒有建立 Render Cron Job。

### 尚待驗證／阻塞
- 尚未取得並比對目前實際部署中的 Gen3 GAS 完整原始碼；不可直接改寫現有 `doPost`。
- 尚未在 staging Spreadsheet 執行 `setupSystemAnnouncementTables()`。
- 尚未確認 staging Render 的 `GEN3_APPS_SCRIPT_URL`、`GEN3_APPS_SCRIPT_KEY` 與新排程密鑰設定。
- 尚未建立 staging Cron Job。
- 尚未執行完整 Node 測試與真實 staging API 測試。
- 本次僅修改 `feature/system-announcements-staging-20261102`；未修改 `main)、未部署 Render 或 GAS 正式環境。


### GAS source integration｜2026-11-02
- 已將通用 `db.*` dispatcher 整合至分支內 `gen3-auth/Code.gs`：先完成既有 `GEN3_API_KEY` 驗證，再分派 `db.*`；原本 Gen3 action 仍走既有 `execute()`。
- 已將公告表格遷移函式整合進 GAS source，並加上 `IKEY_ENVIRONMENT=staging` 與 `IKEY_STAGING_SPREADSHEET_ID === GEN3_SPREADSHEET_ID` 雙重保護。
- 新增獨立 staging Apps Script 同步 workflow，要求獨立 staging GitHub secrets，並拒絕已知非 staging Script ID。
- Drive 唯讀搜尋找到既有 `iKey_Database` 與歷史備份，未找到獨立 staging Spreadsheet 或獨立 staging Apps Script 專案。
- 沒有執行任何 clasp push、GAS Web App 部署或 Spreadsheet 寫入；不得使用舊的固定 Script ID 同步 workflow。



## 2026-11-07｜排程到期歸檔補強

### 問題發現
- 靜態檢查發現原排程工作只讀取 `scheduled` 狀態，因此能處理到期排程公告，卻不會把已發布且已過期的公告狀態更新為 `archived`。
- 首頁公開 API 雖然會隱藏過期公告，但管理後台仍可能持續顯示為「已發布」，與文件描述的自動歸檔行為不一致。

### 修正
- `gen3-auth/announcement-router.js` 的排程工作現在同時讀取 `scheduled` 與 `published`。
- 到期的已發布公告會更新為 `archived` 並寫入 `archived_at`、`updated_at`。
- 尚未到期的已發布公告維持原狀；到期排程公告仍會歸檔，未到期且已到排程時間的公告則發布。

### 測試補強
- `test/announcement-router.test.js` 新增排程工作測試，涵蓋：到期已發布公告歸檔、到期排程公告歸檔、到期排程公告發布，以及尚未到期公告維持發布狀態。
- 程式與測試已提交至 staging 分支；本次尚未取得 GitHub Actions 執行結果，也未宣稱測試通過。

### Commit
- Router 修正：`62535f87aa624426808839fd7e2d397691836c72`
- 排程測試：`bdba4f23de6801999c577d91110f81adcfc5920a`

### 部署邊界
- 僅修改 `feature/system-announcements-staging-20261102`。
- 未修改 `main`、未執行 GAS 同步、未寫入試算表、未修改 Render 環境變數，亦未部署正式環境。


## 2026-11-07｜Staging CI 驗收與資料庫盤點

### 自動化測試
- GitHub Actions workflow：`iKey announcement API tests`，Run ID `42381490574`，結果 `completed / success`。
- 工作步驟：Node.js 22、依賴安裝、server/browser JavaScript 語法檢查、`npm test` 全部成功。
- `npm test`：30 tests、30 pass、0 fail、0 skipped。
- 本結果只代表 staging 分支的程式／模擬測試通過，不代表 GAS 已同步、Render 已部署或真實 Sheets API 已端到端驗收。

### Staging 資料庫盤點
- 找到 Google Spreadsheet：`iKey-Gen3-GAS-STAGING-DATA`，ID：`1dn__bGUmCAnGZTNOmvdc0QOUozmrGenpqbrNU3bb_CQ`。
- 目前工作表：`Device_Ping_Commands`、`Device_Ping_Nonces`、`Factory_Devices`、`Project_Devices`；尚無 `System_Announcements` 與 `System_Announcement_Reads`。
- 僅讀取 Spreadsheet metadata，未讀取資料列、未新增工作表、未寫入資料。
- Google Drive 搜尋未找到可確認的獨立 Apps Script 專案；無法確認 staging Script ID 及其是否已綁定上述 Spreadsheet。

### 分支整合風險
- staging 分支相對目前 `main` 顯示 diverged：ahead 84、behind 53。不可直接合併整個分支或將其視為可直接發布的 PR；需先釐清基底與差異範圍。

### 下一步與邊界
- 取得／確認獨立 staging Apps Script 專案 ID，並確認其 Script Properties 指向上述 staging Spreadsheet。
- 取得獨立 staging clasp OAuth secret 與 Script ID 後，才可執行既有 staging 專用同步 workflow；不可使用正式 GAS 專案。
- 確認隔離無誤後，建立公告兩表並執行真實 staging API CRUD／權限／已讀／排程測試。
- 本次未修改 `main`、未部署 Render、未同步 GAS、未寫入 Spreadsheet。
