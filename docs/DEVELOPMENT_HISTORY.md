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
## 2026-10-26 — Firmware pulse engine added; GPIO 25 feedback polarity confirmed

- **User-confirmed hardware fact:** GPIO 25 reads HIGH (approximately 3.3 V) when the lock is open.
- **Firmware file added:** `firmware/esp32-ikey-unlock/esp32-ikey-unlock.ino`.
- **Behavior implemented:** GPIO 23 relay output; 500 ms energized pulse; 200 ms inactive pause; up to 10 attempts; stop immediately when GPIO 25 reads HIGH; force relay inactive and report failure when attempts are exhausted; ignore duplicate serial requests while a sequence is running.
- **Safety compile gate:** Relay active polarity remains unconfirmed. Firmware intentionally fails compilation until exactly one of `IKEY_RELAY_ACTIVE_HIGH` or `IKEY_RELAY_ACTIVE_LOW` is selected after verifying the actual relay driver/module.
- **Current test trigger:** Serial `u` starts a local bounded hardware test. Web/API command polling and result reporting are not connected in this firmware file yet.
- **Electrical safety:** GPIO 25 must never receive 5 V; verify its input circuit and signal common ground. Relay/lock coil must be driven through a suitable driver, not directly from ESP32 GPIO.
- **Scope preserved:** staging branch only; no `main` changes, no Render deployment, no production database access.
- **Next:** confirm relay active polarity and verify GPIO 25 signal wiring; then run a supervised local pulse/feedback test before adding authenticated HTTPS command polling and result reporting.
## 2026-10-26 — Relay active-HIGH polarity confirmed and firmware configured

- **User-confirmed hardware fact:** GPIO 23 output HIGH (approximately 3.3 V) energizes the relay.
- **Firmware updated:** `firmware/esp32-ikey-unlock/esp32-ikey-unlock.ino` now enables `IKEY_RELAY_ACTIVE_HIGH`; `IKEY_RELAY_ACTIVE_LOW` remains commented out.
- **Feedback requirement retained:** GPIO 25 HIGH (approximately 3.3 V) means lock-open.
- **Pulse behavior retained:** relay active 500 ms, inactive pause 200 ms, maximum 10 attempts; stop on open feedback and always force relay inactive on terminal result.
- **Commit:** `6ab19f0b455dce59c242b532e98d8e11ec928aec`.
- **Verification status:** Source edit confirmed via GitHub readback. Arduino IDE compilation and physical relay/feedback tests have not yet been run; do not treat as hardware-verified.
- **Remaining integration:** Serial `u` is still the local test trigger; authenticated web command polling and result reporting are not yet connected. No Render deployment and no `main` changes.
## 2026-10-26 — Web device live-status indicators added

- **User request:** Add web-visible status labels for `連線中`, `未連線`, `已解鎖`, and `櫃門關閉`.
- **Files changed:** `public/project-devices.html`, `public/project-devices.js`, `public/project-subpages.css`.
- **UI behavior:** Device cards and the device settings dialog now show network connection, lock state, and cabinet-door state indicators. Connection status uses only API fields (`connected`/`online`/`verified` or `connecting`/`pending`); lock status only shows `已解鎖` when API reports `lock_status: unlocked` or `feedback_open: true`; cabinet status only shows `櫃門關閉` when API reports `door_status: closed` or `cabinet_door_closed: true`.
- **Truthful fallback:** Current `/api/devices` and `/api/devices/:deviceId/status` responses expose `connection_status: unverified` and `control_ready: false`, not live ESP32 heartbeat, GPIO 25 feedback, or cabinet-door sensor state. Therefore current UI displays `未連線` and `尚未回報` for states the backend cannot verify; it does not invent a successful state.
- **Database status:** Existing server code reads device registration data through `authStore.dbCall('db.select', ...)` (the existing Apps Script/database adapter). Actual runtime availability has not been verified in this change, and live telemetry fields are not currently persisted/read from the database.
- **Safety boundary:** Staging branch only; no Render service deployed or modified, no `main` changes, no physical Relay test.
- **Next:** Implement authenticated ESP32 heartbeat/status reporting for network, GPIO 25 lock feedback, and a separate cabinet-door sensor input if that status must be real; define persistence schema/adapter behavior before claiming database-backed live status.
