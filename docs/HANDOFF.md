# iKey 永久交接

## 核心原則
規格與歷程永久保留，程式碼允許重建；ChatGPT 對話與記憶不能取代 GitHub 永久文件。

## 目前工作
- Repository: ikeysever/ikey
- 正式分支：main
- 整理分支：cleanup/audit-20261016
- 目標：盤點並安全淘汰無功能程式（含舊版 LINE），保留 Gen3 核心功能與資料。

## 已知程式入口
- server.js：Express 入口，掛載 /api/login、/api/health、/api/database、/api/line，並條件啟用 Gen3 /api/projects、/api/auth。
- public/index.html：網站首頁，引用多個 CSS/JS 與預覽頁。
- gen3-auth/apps-script/Code.gs：Gen3 Apps Script 資料層；GitHub 更新不等於已部署 Apps Script。

## 尚未完成
1. 取得完整儲存庫檔案清單並建立引用／依賴表。
2. 分類為正式使用、保留交接、確認無用、待查。
3. 確認 LINE 舊版與新版的實際邊界。
4. 在整理分支分批刪除，逐批測試。
5. 經確認後才合併 main。

## 安全事項
不得提交明文密碼、Token、Apps Script Key 或個資。不可因程式重建而清空 Google Sheet 帳號／日誌。
