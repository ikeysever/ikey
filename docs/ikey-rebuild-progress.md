# iKey 網站重建與交接紀錄

> 專案正式名稱仍為 **iKey**。本文件紀錄開發分支的實際狀態，不代表功能已上線。

## 安全邊界

- 正式 Render 服務追蹤 `main`；本分支不直接部署正式站。
- 既有 `/api/login`、`/api/health`、`/api/device`、`/api/database`、`/api/line` API 路徑與協定不修改。
- Google Sheet `iKey_Database` 原始八個分頁不覆寫、不刪除。
- ESP32、門鎖、庫存異動與 LINE 訊息不由示範介面觸發。
- 歡迎動畫素材已從此分支移除；原始版本可由 Git 歷史及備份分支恢復。
- `code1cmd.txt`、`code2cmd.txt`、`code3cmd.txt`、`docs/` 保留作專題歷程。

## 已實作（開發分支）

1. `lib/ibox/project-access.js`：全域 superadmin 與專案成員角色隔離的純判斷函式。
2. `lib/ibox/project-workflow.js`：加入申請、管理員核准／拒絕、管理員邀請的純狀態轉換函式。
3. `public/project-center.js`、`project-center.css`：工具櫃與化學實驗室的響應式專案範本預覽、搜尋、選取及詳情。
4. `public/index.html` 與 `public/animation.js`：專案中心導覽；移除舊歡迎動畫的載入，登入成功直接進首頁。
5. GitHub Actions：JavaScript 語法、權限與流程測試、靜態資源、HTTP health 檢查。

## 尚未實作／不能宣稱完成

- 使用者帳號驗證與真正的登入工作階段（現有登入實作不能視為正式多專案身分驗證）。
- 專案資料表、成員資料持久化、邀請接受流程、專案申請後台。
- 真正的專案建立、設備綁定、權限授予、設備命令、門禁與庫存交易。
- Google Sheet 新結構的正式建立與 Apps Script 寫入。
- 新版 LINE 前端互動與專案主題動畫。
- 真實瀏覽器端到端測試、手機操作測試、正式 Render 驗收。

## 建議整合順序

1. 先確認新舊資料的共存與帳號識別方式。
2. 在不改動既有 API 契約前提下完成新版專案資料來源。
3. 將純權限模組接入經過身分驗證的伺服器端。
4. 完成網站的專案管理、成員邀請與設備管理頁面。
5. 補齊全自動測試、實際瀏覽器測試與安全驗收。
6. 確認部署方案後才合併至 `main`。

## 風險

- 目前 `routes/login.js` 使用硬編碼帳密，無法直接支撐正式多專案授權。**不得將前端顯示的角色當成伺服器授權。**
- 原 `ESP32-01` 是測試虛擬裝置，不得作為已連接實體硬體的證據。
- GitHub Actions 綠燈不等於完整 UI 或設備安全驗證。
