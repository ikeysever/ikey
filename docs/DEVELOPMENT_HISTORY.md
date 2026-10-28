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

## 2026-10-26 — ESP32 staging HTTPS firmware overlay

- **File replaced:** `firmware/esp32-ikey-unlock/esp32-ikey-unlock.ino` on `feature/esp32-device-auth-staging`.
- **Added:** Wi-Fi connection, HTTPS certificate validation (no `setInsecure()`), device authentication via `POST /api/device/auth`, authenticated command polling via `GET /api/device/commands/next`, and result reporting via `POST /api/device/commands/:commandId/result`.
- **Safety retained:** GPIO 23 active-HIGH relay, GPIO 25 HIGH=open feedback, 500 ms maximum energized pulse, 200 ms pause, maximum 10 attempts, relay de-energized on each pulse end and error path, success only when feedback reads OPEN.
- **Duplicate protection:** Persist command ID in ESP32 Preferences/NVS before actuation; the same command ID will not start a second sequence after a reset.
- **Required local configuration:** Wi-Fi SSID/password, preregistered device ID/password, separately approved staging HTTPS base URL, and correct trusted CA PEM. These are placeholders in the repository; real credentials must not be committed.
- **Dependency:** ArduinoJson library.
- **Backend boundary:** `device-command-simulation.js` is in-memory staging simulation and is hidden unless `IKEY_DEVICE_SIMULATION_ENABLED=true`. No staging API host deployment or end-to-end test is confirmed by this firmware edit. The code intentionally does not target production Render.
- **Verification:** GitHub source update completed. Arduino IDE compilation, TLS connection, API authentication, command round-trip, and hardware-in-the-loop test have not been run; do not treat as verified.
- **Safety note:** If HTTPS host/CA/credentials are not configured, network command control remains disabled. GPIO 25 must never receive 5 V; relay/lock coil must use a suitable driver.

## 2026-10-26 — Full-chain audit: command API mount gap found and fixed on staging

- **User goal:** Complete the web → API → ESP32 → relay → feedback → status flow as one coordinated task; user authorized a production merge/deploy only after review and tests.
- **Audit finding:** The staging branch contained `device-command-simulation.js`, but `server.js` did not mount it. The ESP32 firmware and device settings UI therefore had no active command routes even if the simulation file existed.
- **Staging fix:** `server.js` now mounts the command simulation behind `IKEY_DEVICE_SIMULATION_ENABLED === 'true'`, passing the existing token secret, auth store, and super-admin project-user middleware. Default remains disabled unless the environment variable is explicitly set.
- **Safety boundary:** The mounted simulator remains in-memory only and is not a physical-control backend or persistent database queue. It must not be presented as production-ready unlock control.
- **Regression test added:** `test/device-command-route-mount.test.js` asserts the route mount is explicitly gated and that poll/result routes exist.
- **Commits:** server route mount `fbd5b4f4fac63055a07a2e91777a3bc6dcb3c527`; regression test `4cd85fed7fa80eb43bcac66891a5445918ae6b90`.
- **Still required before any production deployment:** run full GitHub Actions test suite; confirm API/firmware JSON contracts and TLS CA configuration; replace or explicitly isolate in-memory queue; verify Apps Script schema and environment variables without exposing secrets; complete a hardware-in-the-loop test. No production merge/deployment has been performed in this step.

## 2026-10-26 — CI expanded for pull requests and firmware changes

- Updated `.github/workflows/esp32-device-auth-tests.yml` to run on pull requests targeting `main` and to include `firmware/**` changes in both PR and staging-push filters.
- Earlier staging workflow runs passed on commits `fbd5b4f4fac63055a07a2e91777a3bc6dcb3c527` and `4cd85fed7fa80eb43bcac66891a5445918ae6b90`; the latest CI trigger change is pending its own run at time of entry.
- This CI checks Node.js syntax and `npm test`; it does not compile the Arduino sketch or prove hardware operation.

## 2026-10-26 — Full-chain review follow-up: duplicate route mount removed

- **Critical finding:** `device-auth.js` also mounted `device-command-simulation.js`, while `server.js` mounted it a second time. This created two independent in-memory command queues and duplicate route handlers; the earlier route-mount test did not detect this.
- **Fix:** Removed the simulator mount from `device-auth.js`. `server.js` is now the single command-route mount and passes the existing super-admin middleware. No physical-control or production behavior was enabled.
- **Regression test:** `test/device-command-route-mount.test.js` now asserts exactly one command-simulation mount and asserts that `device-auth.js` does not mount it.
- **Commits:** duplicate mount removed in `ee0fa88b2606dabb18332a4ecb595cb4e023ddd3`; regression assertion in `c575249625b80d1e0ddf8e3cd39ee614ed9f5f86`.
- **Latest CI:** staging-push run for `c575249625b80d1e0ddf8e3cd39ee614ed9f5f86` was queued/in progress when checked; verify its final result before treating this revision as tested.
- **Unresolved deployment blocker:** The command queue remains in-memory. Existing `gas/README-generic-db.md` explicitly says its generic database integration is not deployed and documents only the `Projects` allowlist. Device APIs already depend on a `Devices` table and its schema. Do not enable the simulator on the production service or merge this PR until the actual existing Apps Script source is compared, the allowlist/schema are verified, and a durable atomic command store is implemented and tested.
- **Hardware boundary:** The ESP32 sketch uses HTTPS CA validation and reports success only when GPIO 25 indicates open. The sketch has not been compiled or hardware-in-the-loop tested by GitHub Actions; its local configuration placeholders and trusted CA must be filled privately before any physical test.

## 2026-10-28 — Device command durability and integration gate (staging only)

- **Scope:** `feature/esp32-device-auth-staging`; no production GAS/Render/Sheets/ESP32 changes, no physical unlock.
- **Verified CI:** At commit `252a2c596d7d98b677bea096a477103f29c894a3`, GitHub Actions ESP32 Staging Tests, Desktop sidebar hotfix checks, and Safe project UI release all completed successfully. Earlier run had 35/37 tests pass; two tests were updated to supply positive feedback so they exercise claim and timeout errors rather than input validation.
- **Design:** `docs/DEVICE-CONTROL-INTEGRATION-CONTRACT-2026-10-28.md` records target Factory_Devices/Project_Devices/DeviceCommands/DeviceCommandEvents contracts, server-derived actor identity, GAS-side project checks, atomic claim, replay handling and test gates.
- **Prototype:** `lib/local-command-store.js` with `tests/local-command-store.test.js` provides single-process, file-backed JSON persistence and basic idempotency/claim/result/timeout checks. This is **not** multi-process atomic, not durable against all power failures and not wired into production routes.
- **New adapter:** `lib/device-command-gateway.js` and `tests/device-command-gateway.test.js` provide an **unmounted** fail-closed interface for dedicated GAS actions, requiring injected verified actor/device/binding checks. GAS actions named in the adapter are proposed contracts and are **not yet implemented or deployed**. These new tests require a fresh CI result.
- **Blocked:** Actual deployed GAS source/version, Sheets headers, credential migration, server-side verified project-admin membership and cross-instance atomic storage must be checked before production implementation. The current in-memory simulation still exists and is not physical control.
- **Next:** Verify latest CI, implement dedicated GAS atomic actions with isolated test Sheets and audit logging, update authenticated server routes and firmware replay/outbox behavior, complete fault-injection and real-device tests, then obtain explicit deployment review.
