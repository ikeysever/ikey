# GAS 程式碼.gs 唯讀盤點 — 2026-11-09

來源：使用者在對話提供的「程式碼.gs」文字檔（約 554 行）；**候選 V14**，檔首明確註明須先與實際 V13 編輯器程式比較。此文件僅記錄盤點，不代表候選檔已部署或等同正式原始碼。

## 主要介面
- doPost(e)：以 GEN3_API_KEY 驗證，路由 db.*、device、project、admin，最後 execute(action,payload)。
- execute(action,p)：包含 registerAtomic、loginLookupAtomic、completeLoginAtomic、resolveSession、revokeSession 等。
- sheet / rows / findRow / append / overwrite：依 HEADERS 白名單存取 Gen3_Users、Auth_Sessions、Auth_Tokens、Auth_Audit_Logs、Projects、Project_Access 等。
- locked(fn)：LockService.getScriptLock()，tryLock(25000)。
- ikeyDbDispatch_：db.select/insert/update/delete 等，受 IKEY_DB_ALLOWED_TABLES 控制，拒絕存取 Gen3_Users、Auth_Sessions 等保護表。

## LINE 整合缺口
- TABS、HEADERS 尚無 LINE_Bindings、LINE_Bind_Challenges、LINE_Webhook_Events 定義。
- doPost 與 execute 沒有 LINE 專用 atomic actions；不可直接透過 db.* 取代唯一性、過期與事件去重交易。
- 需要額外獨立 GAS 模組並在路由中加入最小權限 action，且與現有登入及 Session 操作共用 ScriptLock。
- 必須先比對正式 GAS 編輯器實際版本與其他 .gs 檔，避免重複全域常數、動作名稱碰撞與路由衝突。

## 安全狀態
- 本次只有唯讀檢查與 staging 文件更新；未修改 GAS 正式環境、Google Sheets、Render 或 GitHub main。
- 原始候選檔由使用者提供；本文件是分析摘要，不是完整原始碼鏡像。
