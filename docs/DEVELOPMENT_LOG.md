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
