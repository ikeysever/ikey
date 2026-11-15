# iKey 正式版 API 盤點（2026-11-16）

Render My Workspace 的 ikey 服務從 ikeysever/ikey main 啟動 server.js。盤點基準為 a28ca73，在本次整合前後均透過 Express 實際掛載清單核對。共 74 個 HTTP 方法與路徑組合。另有首頁與 /ping。

## 開鎖與測試

- unlock-eligibility 查詢使用者當下的專案或排程資格。unlock-readiness 查詢實體控制是否就緒。格位 resolve 負責查對應與管理權。
- 專案裝置 unlock、管理格位 unlock 和總管理員裝置 commands 各自保留原本的驗證、錯誤碼與 URL，通過檢查後共用實體控制尚未就緒的回應。這些路徑都不會建立實體命令。
- 首頁與總管理員頁面各自驗證使用者資格後，共用測試指令建立、讀取及逾時判定。裝置 next 和 report 只接受裝置認證。completed 表示 ESP32 回報已列印序列訊息。
- Supabase iKey 的 public schema 已比對到轉接器使用的資料表、欄位與 RPC。device_test_commands 對應測試佇列，ikey_serial_test_claim 及 ikey_serial_test_complete 對應裝置領取及回報。Edge Functions 部署數為 0。
- 裝置永久刪除仍回傳 501。command-probe 為選用的舊版 GAS 診斷。舊 project-settings-edit.js 指向已移除的 PATCH settings，現行 project.html 未載入它。
- 盤點範圍為正式分支、公開網頁與韌體原始碼、Supabase 結構和 Render 部署。歷史 GAS 快照不是目前部署狀態的證明。

## Express 掛載清單

| 方法 | 路徑 |
| --- | --- |
| POST | `/api/line/webhook` |
| GET | `/api/line/diagnostics` |
| GET | `/api/line/callback` |
| GET | `/api/health` |
| GET | `/api/auth/status` |
| GET | `/api/ready` |
| POST | `/api/auth/register` |
| POST | `/api/auth/prefetch` |
| POST | `/api/auth/login` |
| GET | `/api/auth/me` |
| POST | `/api/auth/logout` |
| POST | `/api/device/auth` |
| GET | `/api/device/me` |
| GET | `/api/projects/:projectId/members` |
| POST | `/api/projects/:projectId/invitations` |
| POST | `/api/projects/join` |
| POST | `/api/projects/:projectId/members/:entryId/review` |
| POST | `/api/projects/:projectId/members/:userId/role` |
| GET | `/api/projects/:projectId/access-requests` |
| POST | `/api/projects/:projectId/access-requests` |
| POST | `/api/projects/:projectId/access-requests/:requestId/admin-approve` |
| POST | `/api/projects/:projectId/access-requests/:requestId/review` |
| GET | `/api/projects/:projectId/unlock-eligibility` |
| POST | `/api/projects/:projectId/access-requests/:requestId/cancel` |
| GET | `/api/admin/slots` |
| POST | `/api/admin/slots/register` |
| POST | `/api/admin/slots/deactivate` |
| POST | `/api/admin/slots/resolve` |
| POST | `/api/admin/slots/unlock` |
| GET | `/api/serial-test/config` |
| POST | `/api/serial-test/commands` |
| GET | `/api/serial-test/commands/:id` |
| POST | `/api/serial-test/admin/commands` |
| GET | `/api/serial-test/admin/commands/:id` |
| GET | `/api/device/serial-test/next` |
| POST | `/api/device/serial-test/report` |
| GET | `/api/line/status` |
| POST | `/api/line/bind/start` |
| POST | `/api/line/unbind` |
| GET | `/api/admin/line-bindings` |
| GET | `/api/line/notification-preferences` |
| PUT | `/api/line/notification-preferences` |
| GET | `/api/projects` |
| POST | `/api/projects` |
| GET | `/api/projects/:projectId/unlock-readiness` |
| POST | `/api/devices/pre-register` |
| GET | `/api/devices` |
| DELETE | `/api/devices/:deviceId` |
| GET | `/api/devices/:deviceId/status` |
| GET | `/api/projects/:projectId/alert-settings` |
| PUT | `/api/projects/:projectId/alert-settings` |
| GET | `/api/projects/:projectId/settings-permissions` |
| GET | `/api/projects/:projectId/devices` |
| PATCH | `/api/projects/:projectId/devices/:deviceId/display-name` |
| GET | `/api/projects/:projectId/devices/available` |
| POST | `/api/projects/:projectId/devices/bind` |
| DELETE | `/api/projects/:projectId/devices/:deviceId/binding` |
| POST | `/api/projects/:projectId/devices/:deviceId/unlock` |
| POST | `/api/devices/:deviceId/commands` |
| POST | `/api/admin/command-probe` |
| GET | `/api/admin/accounts` |
| POST | `/api/admin/accounts/action` |
| GET | `/api/announcements` |
| GET | `/api/announcements/:id` |
| POST | `/api/announcements/:id/read` |
| POST | `/api/internal/announcements/publish-due` |
| GET | `/api/admin/announcements` |
| GET | `/api/admin/announcements/:id` |
| POST | `/api/admin/announcements` |
| PUT | `/api/admin/announcements/:id` |
| POST | `/api/admin/announcements/:id/publish` |
| POST | `/api/admin/announcements/:id/unpublish` |
| POST | `/api/admin/announcements/:id/restore` |
| DELETE | `/api/admin/announcements/:id` |
