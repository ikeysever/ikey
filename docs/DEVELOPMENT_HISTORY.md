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
## 2026-10-26 — Device settings and staged unlock-test integration

- **Scope:** `feature/esp32-device-auth-staging` only.
- **Goal:** Start implementing the super-admin device settings flow for device `Y8R69EXB`, while preserving the production `main`, production Render service, and production database.
- **Changes:
  - Added `.github/workflows/esp32-device-auth-tests.yml` to run Node.js syntax checks and `npm test` on staging changes and manual dispatch.
  - Added a super-admin read-only command status endpoint, `GET /api/device-commands/:commandId`, to the in-memory command simulation.
  - Updated `public/project-devices.html`, `public/project-devices.js`, and `public/project-subpages.css` to load the authenticated preregistered device list, open device settings, request an explicitly confirmed simulated unlock command, and display command status.
  - Kept physical mode, heartbeat, firmware-update, and settings writes disabled. UI text explicitly states that the simulated command does not prove a physical door opened.
  - Added/updated tests for command status readback and device page API contracts.
- **Safety boundary:** No Render service was created, changed, or deployed. No commit was made to `main`. No production database or physical Relay was accessed.
- **Verification:** The first staging Actions run passed the backend and simulation tests before the UI contract tests were updated. Subsequent run is being checked after adjusting the tests to the new UI contract; final green status is not yet confirmed at time of this entry.
- **Known limitation:** Command storage is in-memory and the staging API is not deployed at the production URL. The UI change is not visible on `https://ikey.onrender.com` until a separately approved release. This stage is not yet a real physical unlock integration.
- **Next:** Confirm the latest Actions run is green; then implement and test ESP32 polling/result reporting against the staged API contract. Only after end-to-end testing should a separate release plan be discussed.
## 2026-10-26 — ESP32 bounded unlock pulse and feedback requirements

- **User requirement:** Web-triggered unlock test; relay output GPIO 23; lock-open feedback GPIO 25; energize 500 ms, pause 200 ms; repeat up to 10 times or stop immediately when feedback confirms open.
- **Specification added:** `docs/ESP32-UNLOCK-CONTROL-SPEC-2026-10-26.md`.
- **Safety/behavior requirements:** Maximum 10 attempts; always de-energize relay on success, exhaustion, timeout, reset, or error; only report success after GPIO 25 confirms the open state; duplicate command IDs must never start a second physical sequence.
- **Unconfirmed hardware details:** Relay active polarity and GPIO 25 open-feedback polarity still require confirmation against the actual wiring/module. GPIO 25 must be electrically compatible with ESP32 3.3 V logic.
- **Backend limitation:** Current command simulation is in-memory and staging-only. End-to-end device polling needs a securely provisioned device token and a staging API host with verified TLS; no TLS certificate bypass is permitted.
- **Scope preserved:** No `main` changes, no Render deployment, and no production database access.
- **Next step:** Confirm feedback polarity first, then relay active polarity; prepare firmware with explicit constants and test the pulse/feedback state machine before connecting it to the network API.
