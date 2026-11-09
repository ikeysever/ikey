# GAS Google Docs 整合原始碼唯讀盤點 — 2026-11-09

來源：使用者提供的 Google 文件「iKey_Gen3_Auth_API程式即時更新」，文件 ID 1cIy96n1WGXNBPWeoB8YhYpmO6s9AUh_jA9nURvzq4Cs；最後修改 2026-11-07T11:51:00.021Z。透過 Google Drive 連接器唯讀取得，約 74,569 字元。

## 已定位模組
- doPost / execute：Gen3 API key 驗證及各動作分派。
- setupGen3ApiKey：SetupKey 設定。
- executeProjectAccess：專案與存取權限。
- ikeyFactoryDeviceAction：裝置管理。
- executeAdminAccount：管理員帳號。
- ikeyDeviceCommandAction：裝置指令。
- LockService：既有 ScriptLock。
- 未找到 LINE_Bindings 或 LINE 綁定專用操作。

## 待核對
- 文件內容與 GAS 正式部署版本尚未比對；不能視為正式部署原始碼。
- 文件最前段仍註明 V14 diagnostic candidate、需與實際 V13 比對。
- 本文件可能為多檔合併文字，不能直接當單一 .gs 覆蓋 GAS。
- 需要檢查其他 .gs 的全域命名、路由與權限規則後再提出 LINE atomic adapter。
- 正式資料庫已存在 LINE_Bindings、LINE_Notification_Preferences、LINE_Audit_Logs，但未確認 LINE_Bind_Challenges / LINE_Webhook_Events；不得在正式環境新增或修改。

## 操作狀態
僅唯讀 Google Docs 並在 GitHub staging 更新盤點文件；未變更 GAS、Sheets、Render、main。
