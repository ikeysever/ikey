# iKey｜Apps Script 原始碼備份（2026-11-07）

本目錄保存使用者在對話中提供的兩份 Apps Script 檔案，僅作為**收到的來源快照**，不代表已核對線上 Apps Script 編輯器、部署版本或其他 `.gs` 檔案。

- `程式碼.gs`：使用者提供的 Gen3 V14 diagnostic candidate；原始碼註解明確要求先與實際 V13 編輯器來源比對，**不可直接部署**。
- `appsscript.json`：使用者提供的 Apps Script manifest（V8、Asia/Taipei、USER_DEPLOYING、ANYONE_ANONYMOUS）。匿名可進入 Web App，仍需程式內驗證。

## 給接手 ChatGPT 的指引
1. 先讀取這兩個檔案，再與線上 GAS 的最新實際版本逐檔比對。
2. 其他檔案（SetupKey.gs、project-data.gs、裝置相關 `.gs` 等）尚未在本目錄備份；不得宣稱整個 Apps Script 專案已同步。
3. 禁止在未確認前覆蓋線上 GAS、修改 main、部署 Render 或公開 Script Properties／API Key。
4. 修改請使用獨立分支與 commit，保留差異、測試與回復紀錄。
5. 此資料夾不是自動同步機制；GitHub 更新不會自動更新 Apps Script，其他 ChatGPT 也必須主動讀取。
