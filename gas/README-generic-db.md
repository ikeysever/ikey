# iKey 3.1 — 通用 GAS 資料庫引擎（方案 A）

## 已確認的相容性

- Render 使用 `GEN3_APPS_SCRIPT_URL` + `GEN3_APPS_SCRIPT_KEY`，透過 `POST text/plain` 傳送 `{api_key,action,payload}`。
- GAS 回應必須為 `{ok:true,result:...}`；錯誤回應為 `{ok:false,error:"..."}`。
- 現有 Gen3 登入指令（health、registerAtomic、resolveSession 等）必須原封不動保留。
- `Projects` 工作表已存在；第一列欄位為 `project_id,project_name,description,created_by_user_id,authorization_method,scheduled_authorization,status,created_at,updated_at`。

## 部署步驟（需先取得並檢查現有 GAS 原始碼）

1. 在**目前已運作的 Gen3 Apps Script 專案**新增 `generic-db-engine.gs`，**不要**建立另一個 `doPost`。
2. 在既有 `doPost` 完成 API key 驗證之後、未知 action 拒絕之前，加入以下分派。請依現有程式的實際變數名稱整合：

```javascript
if (typeof action === 'string' && action.indexOf('db.') === 0) {
  const result = ikeyDbDispatch_(action, payload);
  return ContentService.createTextOutput(JSON.stringify({ok:true,result}))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Script Properties 新增 `IKEY_DB_SPREADSHEET_ID` = 現有 iKey_Database 的 ID；`IKEY_DB_ALLOWED_TABLES` = `Projects`。**不需要更改現有 GEN3_APPS_SCRIPT_KEY**。
4. 先在測試部署檢查舊登入 action 仍可運作，然後測試 `db.health`、`db.schema`、`db.insert`、`db.select`。
5. 驗證通過後再更新既有 GAS Web App 部署版本，然後合併 Render 開發分支，部署 Render。
6. 瀏覽器登入，測試建立專案 → Sheet 出現資料 → 我的專案顯示；檢查使用者 A 不能讀取使用者 B 的專案。

## 安全設計

- GAS 通用引擎只信任已驗證 API key 的 Render；瀏覽器不持有 key。
- GAS 只允許 Script Property 明確列出的表；Render 仍須逐 API 實作使用者／專案授權。
- 現有 Users、Gen3_Users、Auth_Tokens、Auth_Sessions、Auth_Audit_Logs 不加入通用引擎 allowlist。
- 更新及軟刪除需要單一 `*_id` 唯一條件；禁止批次無條件操作。
- 使用 LockService 序列化寫入；新增時檢查主鍵重複。
- 防止公式注入、欄位未知及非預期型別。
- Sheets 無法提供完整跨表 ACID 交易；不要把這個引擎視為關聯式資料庫。

## 未來增加資料表

在 Google Sheets 新增工作表及第一列欄位，Render 新增明確的業務 API、權限檢查，並把已審核的工作表名稱加入 Script Property `IKEY_DB_ALLOWED_TABLES`。無須修改 GAS 引擎原始碼。注意：若新增特殊資料型別、複雜查詢或跨表交易，仍需設計新的功能或升級引擎。

## 目前狀態

此分支只含原始碼，**未寫入現有 GAS、未改現有登入系統、未部署 Render、未實測 GAS**。沒有取得目前已部署的 GAS 專案原始碼，因此尚不能保證直接貼入既有 `doPost` 不衝突。請先完成原始碼比對與測試部署。
