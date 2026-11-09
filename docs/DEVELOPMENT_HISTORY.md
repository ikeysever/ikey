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


## 2026-11-09｜LINE 方案 B — 持久化契約與 Mock 測試（PR #117）

### 問題與需求
- LINE Developers 的簽名空 events Verify 已通過，但真實文字事件仍維持 503；沒有可安全使用的 GAS 原子綁定交易。
- 使用者既有 Gen3 Session 必須維持原樣；LINE userId 不得代替 iKey user_id 或給予額外權限。
- 驗證碼使用既有 8 位格式 IK-XXXX-XXXX、HMAC 摘要及五分鐘效期。

### 盤點與設計演進
- 讀取 PR #117、Render LINE ingress、Gen3 session、GAS 20261109 十檔來源快照及 Google Docs。GAS 快照為 V14 diagnostic candidate，**尚未與正式 GAS editor 確認相符**，因此先禁止部署。
- 原先狀態：`lib/line-code-binding.js` 只有純函式與 fail-closed `ready`；沒有 durable store。
- 新方案：不更動現有 Webhook / 登入路由；先定義獨立 GAS action allowlist、獨立挑戰與事件去重表 schema、序列化 Mock 模型。採分離模組，避免與其他 PR 並行修改 `server.js`。
- 風險：Google Sheets 的 LockService 可序列化腳本執行，但多筆 Sheet 寫入**不是 ACID 交易**。正式上線前需 fault injection、idempotent reconciliation 與共用 rate limiting。不得只靠 HMAC 防線上猜碼。
- `iKey_DeviceAuth_Verify.gs` 與 `iKey_DeviceAuth_Lookup.gs` 仍缺失，不推測內容。

### 本次新增檔案
- `docs/line-binding-staging-storage-contract-20261109.md`: Schema、action、競爭處理與啟用門檻。
- `lib/line-binding-mock-store.js`: **測試專用**（不具正式持久化能力）的序列化 Mock。
- `lib/line-binding-transport.js`: 嚴格 allowlist 的未啟用 GAS action transport。
- `test/line-binding-storage-mock.test.js`: 五分鐘到期、重新發碼、去重、競爭、身分唯一性與 fail-closed 測試。

### 測試與除錯
- CI 在較早提交 `fd0a48f5138a6b47fa3e0ecbec103099813ed115` 的 `npm test`：**74 項、64 通過、10 失敗**；包含 UI/專案測試，以及 `line-ingress.test.js` 的預期 503/實際 200 差異。此結果不能視為本次 LINE 更動已通過整體回歸。
- 新增的 Mock 測試在 CI 輸出中至少可確認首項通過；完整單檔測試及最新提交的完整回歸仍待確認。
- 測試或部署若無證據，維持「待確認」，不宣稱已成功。
- 無正式資料庫修改、無正式服務部署、無 PR 合併。

### 下一步
1. 確認 PR #117 最新 CI 結果，取得失敗工作日誌，區分既有跨分支衝突與本次新增測試失敗。
2. 比對正式 GAS editor 及缺失的兩檔，建立隔離 staging Apps Script 與 staging 試算表。
3. 實作 GAS lock/唯一性/去重/限速及跨列故障復原，再以 Mock + staging fault-injection 完整驗證。
4. 維持原有 API 503，完成真實 signed webhook + Session 端到端測試後再提出啟用建議。

## 2026-11-09 — LINE v2 implementation, offline verification and release authorization

- Requirements: user Architecture Handoff V1.0; explicit Q06 amendment: five failures per LINE in rolling 15 minutes, blocked 15 minutes from fifth failure; reissue cannot clear block.
- User authorized development branch writes/commits first, then explicitly authorized main merge and deployments without further approval. User subsequently prohibited further GAS editor use. GitHub snapshot is the authorized source baseline, not proof of deployed GAS equivalence.
- Implemented: six-digit keyed challenges, appended existing-table schema, shared GAS/Node domain, lock + intent + verified row writes, ambiguous-state fences, durable rates and uniqueness; signed scoped GAS transport; Session-bound status/create/unbind, fresh password/hash recheck and CSRF; one-attempt notifications; read-only masked admin API; countdown/reissue/polling/unbind frontend.
- Changed source groups: server.js; gen3-auth/sheets-store.js; lib/line-*; public/account.html and account-line.js; gas/line-binding-{domain,v2}.gs; candidate snapshot doPost. Exact files are in the associated commit. Original snapshot retained in ancestor 1db89cc70558a4c7dc71516c744359c6b8da7024.
- No new challenge/event tables, no OAuth, no auto-retry queue. Original login, Session semantics, admin mutations and ESP32 functionality unchanged.
- Baseline tested independently from clean original worktree: 74 / 64 pass / 10 fail. LINE test corrected for signed empty probe 200. Nine stale existing test assertions updated to current main behavior (strict authenticated guard, callback semicolon, removed cards/forms/routes, asset version, cache.put and inventory names/order). No production UI/control features changed to make those old assertions pass.
- Final offline full suite: 92 / 92 pass; LINE subset 32 / 32 pass. Runtime Node v24.22.1. Actual GAS adapter executed in VM using fake Sheets; concurrency and write-fault tests use exclusive test queue, not actual GAS service. Browser-state tests use simulated DOM/timers, not rendered-layout acceptance.
- Debugging: fixed collision retry being counted as cooldown, pending duplicate being treated as completed, partial reissue/consume fencing, unknown-state UI mutation enabling, notification receipt scope, CSRF non-ASCII length handling and late polling response invalidation.
- Security: no credentials or raw codes in Git/logs; keyed digests and source pseudonyms, exact signed payload with 60-second freshness; separate secrets required at activation. Test-only literal secrets are synthetic.
- Release remains feature-gated OFF pending actual GAS/schema deployment, complete source/backup/restore validation and real LINE acceptance. Read-only Actions capability check may inspect existing clasp access; it never pushes GAS, executes business functions or logs source.
- At this entry's creation: no live Sheets/GAS/LINE settings modified; no formal backup/restore/live acceptance performed. Deployment result and exact commit/deploy IDs must be recorded after verification, never inferred from test results.
