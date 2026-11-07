# iKey Gen3 Apps Script｜Google 文件原始碼快照

本目錄保存 [iKey_Gen3_Auth_API程式即時更新](https://docs.google.com/document/d/1cIy96n1WGXNBPWeoB8YhYpmO6s9AUh_jA9nURvzq4Cs/edit) 於 2026-11-07 讀取的十個分頁。每個分頁對應一個獨立原始碼檔案。**此處是備份，不是線上 Apps Script 已部署原始碼的證明。**

| Google 文件分頁 | GitHub 檔案 |
| --- | --- |
| 程式碼.gs | `程式碼.gs` |
| appsscript.json | `appsscript.json` |
| SetupKey.gs | `SetupKey.gs` |
| project-data.gs | `project-data.gs` |
| iKey_AutoCheck | `iKey_AutoCheck.gs` |
| gas-device-actions | `gas-device-actions.gs` |
| gas-device-authorization | `gas-device-authorization.gs` |
| ikey-gen3-admin-accounts | `ikey-gen3-admin-accounts.gs` |
| gas-device-trust | `gas-device-trust.gs` |
| device-command-actions | `device-command-actions.gs` |

## 重要限制
- `程式碼.gs` 開頭註明「V14 DIAGNOSTIC CANDIDATE」，必須比對實際 Apps Script 編輯器版本後才可部署。
- 若干模組標示 `STAGING ONLY` 或 `STAGING CANDIDATE ONLY`，不代表已上線，不能未經審核直接覆蓋正式程式。
- Google 文件標題雖有「即時更新」，這裡的 GitHub 快照**沒有自動同步功能**。未來需重新擷取文件、檢查 diff、提交 commit。
- Apps Script 專案的 `doPost`、資料表白名單、權限與身分驗證應在整合時核對；不得重複定義入口或刪除仍被呼叫的模組。
- 不提交 Script Properties 中的密鑰、密碼、憑證或 `.clasp.json`；README 不得存放任何敏感值。

## 後續整合與刪除舊檔
此次僅更新 **此快照資料夾**。原本的 `gas/` 其他程式和 `gen3-auth/` 同時包含 GAS、Node.js 後端等依賴，不應在未完成依賴盤點前整包刪除。將來源檔案接回正式執行環境前，必須確認 Script ID、部署版本、API 相容性與回復方案。
