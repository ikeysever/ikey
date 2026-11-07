# iKey v3.1｜跨 ChatGPT 協作交接中心

> **新接手的 ChatGPT、Codex 或開發者，請先閱讀本頁，再修改任何程式。**
> 本目錄是協作指引，不是即時記憶服務；只有 GitHub 已提交的內容才可作為可追溯版本。每次接手都必須重新讀取最新分支與檔案。

## 目前工作範圍
- 專案：`ikeysever/ikey`，版本：iKey v3.1。
- 本次工作分支：`feature/system-announcements-staging-20261102`。
- 主線一（M1）：網站前端與使用者操作介面；公告管理頁為本次任務。
- 後端 API、GAS、資料表與部署須依既有原始碼核對，不得把跨主線修改當作 M1 已完成工作。
- 舊版「課表、教室、固定八格鑰匙櫃」不是 v3.1 現行 M1 功能。

## 權威來源與讀取順序
1. 本頁與 [專案總規格](./專案總規格.md)。
2. [GAS 原始碼管理](./GAS原始碼管理.md)。
3. [主線分工](./主線分工.md) 與 [開發歷程](./開發歷程.md)。
4. 實際程式：`public/announcements-admin.js`、`gen3-auth/announcement-router.js`、`gen3-auth/Code.gs`。
5. API 詳規：`docs/SYSTEM_ANNOUNCEMENTS_API.md`。若文件與程式或正式部署不一致，**不得自行假定已部署**；先記錄差異並驗證。

## 每位 ChatGPT 必須遵守
1. 開始前確認 repository、branch、最新 commit、檔案實際內容；不得只憑對話記憶修改。
2. 修改前讀取目標檔案與最新 SHA；僅改必要檔案，不覆寫他人工作。
3. 預設禁止修改 `main`、合併 PR 或部署 Render；需要明確授權。
4. GAS 原始碼以 GitHub 為版本基準，線上 Apps Script 部署是**獨立狀態**；修改 GitHub 不等於同步部署。
5. 不提交 API key、Script Properties、Token、密碼、私人使用者資料或部署機密。
6. 修改後執行可行的測試，記錄 commit SHA、變更、驗證與未完成事項於 [開發歷程](./開發歷程.md)。
7. 不宣稱「所有 ChatGPT 自動同步」；新對話必須主動讀取本目錄。

## 交接提示詞
「請先唯讀讀取 GitHub `ikeysever/ikey` 指定分支的 `docs/AI協作交接/README.md`、其連結文件及相關程式，回報目前版本、已完成、待辦、風險及最新 commit；未經授權不要修改 main 或部署。」

## 變更治理
- 文件與程式一同提交；若修改跨主線介面，需說明依賴與影響。
- 同時編輯時以 GitHub 最新 SHA 與 PR diff 協調，不得無條件覆寫。
- 所有歷史決策留在歷程，舊規格不得冒充現行規格。
