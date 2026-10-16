# iKey 開發歷程

## 2026-10-16 — 程式庫整理啟動
- 狀態：整理分支作業中；尚未合併 main。
- 使用者確認原則：「規格與歷程永久保留，程式碼允許重建」。
- 保留 Gen3 帳號、專案管理、正式 API、資料庫、操作歷程、有效網站資源。
- 僅移除經確認沒有正式功能依賴的舊版 LINE、重複預覽及過時測試程式。
- 用途不明或仍被引用的檔案暫不刪除。
- 已知 server.js 載入 routes/line，刪除前需移除或替代引用並驗證啟動。
- 本次先建立永久文件；未進行正式功能刪除、未執行線上測試。

## 每次修改必填
日期｜目的｜修改檔案｜原因｜風險｜測試結果｜Commit｜待辦。

## 2026-10-16 — 歷史分支初步比較
- 已建立 main 快照備份：backup/main-before-purge-20261016。
- compare(main...handoff/notification-audio-20261012)：ahead 0、behind 46，可列入候選清理。
- compare(main...backup-pre-cleanup-20261007)：ahead 0、behind 94，可列入候選清理。
- compare(main...feat/approved-welcome-animation)：ahead 0、behind 131，可列入候選清理。
- compare(main...handoff/welcome-padlock-20261009)：ahead 6、behind 80，含動畫素材，暫時保留。
- compare(main...feat/gen3-auth-mailapp-activation)：ahead 21、behind 60，含帳號功能差異，暫時保留。
- 以上 ahead=0 只代表沒有獨有提交，不等於已完成刪除或已檢查所有檔案。
- GitHub 連接工具目前未提供刪除遠端分支的操作；尚未刪除任何分支。

## 2026-10-16 — 匯入新四永久主交接草案
- 使用者提供「貼上的 Markdown(3).md」，原文保留於 docs/IKEY_GEN4_MASTER_HANDOFF_DRAFT.md。
- 匯入提交：3b402fbeacf5fa804353ae6ddfc69ebdb2336c88。
- 草案含新一至新四歷程、規格、授權、Render 查核、LOG-0001～LOG-0003；內容中的「已核准／待核准／歷史」依原文保留。
- 草案記載「不重新開發」，但本次使用者已另外確認「程式允許重建」；兩者視為不同時間的決策，不擅自覆寫，後續以最新明確授權範圍執行。
- 僅匯入整理分支；未修改 main、Render、Apps Script、資料庫或硬體。

## 2026-10-16 — 網頁式封存策略與高價值分支審核
- 使用者不願安裝 Git／使用 PowerShell；改採 GitHub 網頁下載 ZIP、保留重要遠端分支，確認後才刪除。
- 使用者表示已下載 main 快照及五個高風險分支 ZIP；尚未驗證 ZIP 內容及完整 Git 歷史。
- compare(main...feature/gen3-auth-registration)：ahead 60；包含 Gen3 登入、註冊、測試、Apps Script。
- compare(main...feat/ibox-data-model-foundation)：ahead 34；包含資料模型、工作流程、歡迎動畫素材。
- compare(main...feat/integrate-padlock-welcome-20261009)：ahead 22；包含歡迎動畫、音效、整合檔案。
- compare(main...remove/google-oauth-login)：ahead 20；包含登入流程與 OAuth 相關變更。
- 以上分支均暫不刪除；ZIP 只能保留檔案快照，不能保證完整 Git 歷史。
- 已確認 ahead 0 的 feat/status-notification-resources、fix/sidebar-left-right-chevron-20261009 可列為刪除候選；尚未執行刪除。
