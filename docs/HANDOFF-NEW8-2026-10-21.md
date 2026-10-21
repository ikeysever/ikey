# iKey 3.1｜新7 → 新8 交接（2026-10-21）
## 本次使用者明確指令
「先建一個按鈕 和一個空頁面 好了之後 開始交接給新8」。
已在個人帳號管理頁新增「修改帳號資料」按鈕，連結至新的空白功能頁 `/account-edit.html`。此頁只有標題、尚未實作的說明與返回按鈕，**未實作修改姓名或密碼、未新增寫入 API**。空白頁仍透過既有 `/api/auth/me` 檢查登入狀態，未登入導回登入頁。
## 現有網站與路徑
- GitHub: `ikeysever/ikey`，目前工作分支 `main`。
- Render: `https://ikey.onrender.com`，服務 `srv-db1jeuk9v7es73fs5n2g`。
- 登入：`public/index.html`、`public/app.js`；成功後經過 3.0 歡迎動畫（3.1 網站整合）進入 `/home.html`。
- 首頁：`public/home.html`。
- 個人帳號管理：`public/account.html`，只讀取 `/api/auth/me` 的安全欄位。
- 新增待開發頁：`public/account-edit.html`，由「修改帳號資料」按鈕進入。
- 共用樣式：`public/home.css`；共用互動：`public/home.js`。
- 側欄最底部「帳號管理」「登出」兩個按鈕並排。漢堡圖示點擊旋轉 360°，始終保持三條線，不轉叉叉。
## 現有帳號資料與後端限制
- `server.js` 掛載 `gen3-auth/routes.js` 到 `/api/auth`。
- `GET /api/auth/me` 回傳經驗證的 `user` 安全欄位：`user_id`、`username`、`display_name`、`global_role`、`account_status`。
- 現有路由有登入、註冊、登出、me；**尚無修改名稱/密碼 API**。
- 新8不得把只有前端的修改畫面宣稱為資料庫已保存。資料寫入、密碼驗證、權限與 Apps Script/Google Sheets schema 均需另行確認。
## 歷程與測試注意
- 新7上一筆歷程為 `新7Log0196`；本次新增記錄為 `新7Log0197`。
- 歷程文件：《iKey 永久開發歷程與最高規格》，Google Doc ID `1DTowCfa87A8vwWKkl1cvGGUfBXqe2zmYqNbQhBfWsCo`。
- 版本不能混用：3.0 歡迎動畫為鑰匙＋掛鎖解鎖動畫（9.8 秒），不是 2.0 指紋動畫；網站為 3.1。
- 使用者說「現在已經回電子紙囉」是指回到自己的電子設備前，不是 iKey 硬體換成電子紙。
- 尚需在 Render 部署完成後實際測試按鈕跳轉、未登入保護、手機側欄、登出。未實測不得宣稱全部正常。
## 新8建議下一步
先請使用者確認要在空白「修改帳號資料」頁實作哪一個欄位／功能（逐項確認）；優先確認修改顯示名稱是否需要密碼驗證，修改密碼需驗證舊密碼。未經使用者同意不要擴充資料表或部署額外服務。
