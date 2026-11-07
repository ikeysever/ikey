# GAS 原始碼管理｜GitHub 為共同版本來源

## 原始碼位置
- **現有可執行原始碼：`gen3-auth/Code.gs`**（不是本文件）。
- 公告 API：`gen3-auth/announcement-router.js`。
- 公告 API 規格：`docs/SYSTEM_ANNOUNCEMENTS_API.md`。
- GAS 相關檔案與既有 GitHub Actions 請先盤點，**不要另建一套平行 Code.gs**。

## 建議的同步流程
1. 從 GitHub 指定工作分支讀取 `gen3-auth/Code.gs`，確認最新 SHA 與差異。
2. 對照現行 Apps Script 專案的實際來源、Script ID、部署版本與 Script Properties；只記錄鍵名，不公開值。
3. 如需修改 GAS，先於 GitHub 分支提交並審查，再以明確授權的 clasp／受控流程同步至指定 Apps Script 專案。
4. 同步後檢查 Apps Script 實際版本、GAS API 健康檢查及回歸測試；再驗證 Render。
5. 將 commit、部署版本、測試結果與回復方式寫入開發歷程。

## 重要限制
- GitHub 不是 Apps Script 執行環境；提交 `.gs` 不會自動更新線上 GAS。
- Apps Script Web App 的 `/exec` 可能仍指向舊部署版本。
- 現有 `sync-apps-script.yml` 可能指向固定 Script ID；未核對前不得執行。
- `setupSystemAnnouncementTables()` 的既有程式有 staging-only 防護；正式資料庫已人工建立兩張表，不應盲目執行該初始化。
- 禁止提交 `.clasp.json` 中的敏感識別、API 密鑰、環境變數值、憑證及真實使用者資料。
- 同步前需備份線上 GAS，並確認可回滾。

## 對所有接手 ChatGPT 的要求
讀取程式與本文件，先做差異盤點。若缺少安全的線上 GAS 讀取／寫回管道，明確回報阻塞，**不可聲稱已完成同步**。
