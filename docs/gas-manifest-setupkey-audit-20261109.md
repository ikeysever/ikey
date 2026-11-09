# appsscript.json / SetupKey.gs 唯讀盤點 — 2026-11-09

來源：使用者於對話直接貼上的原始碼。僅分析並同步摘要，未執行任何 GAS 函式，未取得或寫入金鑰。

## appsscript.json
- timeZone: Asia/Taipei
- runtimeVersion: V8
- exceptionLogging: STACKDRIVER
- webapp.executeAs: USER_DEPLOYING
- webapp.access: ANYONE_ANONYMOUS
- Web App 公開可呼叫；資料存取仍取決於 doPost 的 GEN3_API_KEY 驗證與後端授權。

## SetupKey.gs 函式
- setupGen3ApiKey(): 已有 GEN3_API_KEY 則拒絕覆蓋；利用 8 次 UUID 字串組合建立並儲存金鑰；不在 log 印出值。
- testGen3DatabaseConnection(): 唯讀檢查 Gen3_Users、Auth_Tokens、Auth_Sessions、Auth_Audit_Logs，會在 Apps Script log 印出資料列數。
- testGen3DeployedAPI(): 呼叫部署 Web App 的 findByEmail；但先前提供的程式碼.gs execute() 未提供此 action，存在版本不一致風險。使用無效測試信箱，不應改為真實個資。
- testGen3ProjectAccessSchema(): 預期 db.schema Project_Access 可成功。
- testGen3DeployedProjectAccess(): 預期 db.schema Project_Access 回 DB_TABLE_DENIED，且 projectAccessMine 無效 actor 回 ACTOR_INVALID；與上一測試期待相衝突。

## 整合 LINE 的影響
- 不應重新執行 setupGen3ApiKey 或更換現有金鑰；Render 與 GAS 既有認證需保持一致。
- 不應直接更改 appsscript.json 存取模式，避免破壞現有 Render -> GAS 呼叫。
- LINE 綁定 action 應經過現有 API 金鑰與 iKey Session 的伺服器端授權，並使用持久化、唯一性檢查及 LockService。
- 仍需核對正式部署版本與剩餘 .gs 模組。此處不包含任何真實憑證或使用者資料。

## 安全狀態
僅 GitHub staging 文件；未修改 GitHub main、正式 GAS、Sheets 或 Render。
