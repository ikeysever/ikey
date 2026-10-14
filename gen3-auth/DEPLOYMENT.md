# iKey Gen3｜取消電子郵件帳號功能之部署與遷移

## 已授權的範圍

- 網站註冊：帳號、顯示名稱、密碼、確認密碼。
- 網站登入：帳號＋密碼。
- 移除 Email 註冊、Email 驗證、重新寄信、Email 密碼重設及相關路由。
- 不修改舊版管理員登入、LINE、ESP32、歡迎動畫、其他 11 張既有資料表。

## GitHub、Render 與 Apps Script

GitHub `main` 自動部署到 Render，但 **Apps Script 必須在原專用 Apps Script 專案手動部署新版本**。
Render 可暫時辨識舊版 `gen3-mailapp-v2`：既有啟用帳號仍可用 username 登入，**禁止新註冊**。
當 `/api/auth/status` 顯示 `registration:false`、`reason:"APPS_SCRIPT_UPGRADE_REQUIRED"` 時，代表仍需資料遷移。
新版本為 `gen3-username-v3`，就緒後 `enabled:true`、`registration:true`。

## 資料遷移：務必維護時段操作

**不可在未備份、未準備新 Apps Script 時直接刪除欄位。**

1. 備份線上 `Gen3_Users` **所有帳號資料及標題**、`Auth_Tokens`，備份放受控位置，不上傳公開 GitHub。原先的舊版資料庫備份不包含 Gen3 使用者表。
2. 將 GitHub 最新 `gen3-auth/apps-script/Code.gs` 貼到專用 Apps Script 專案，儲存但先不要部署。保留既有 `GEN3_SPREADSHEET_ID` 與 `GEN3_API_KEY` Script Properties。
3. Render 暫設 `GEN3_AUTH_ENABLED=false`，確認帳號 API 暫停後才修改資料。
4. 正式 `Gen3_Users` 最終十欄依序為：
   `user_id,password_hash,display_name,global_role,account_status,failed_login_attempts,locked_until,created_at,updated_at,username`。
   若目前仍是十四欄，**由右往左**刪除原 `email_verified_at`（M）、`google_sub` 與 `google_linked_at`（K/L）、`email`（B），保留其餘十欄及所有帳號列。
   若 Google 身分欄位已先刪除，請依**欄位名稱**刪除 `email_verified_at`、`email`，不要套用舊欄位字母。
5. `Auth_Tokens` 刪除原 `target_email`（E），保留其他七欄與限流資料。
6. 在 Apps Script「部署 → 管理部署作業 → 編輯 → 新版本 → 部署」更新**原 Web App 部署**，保留原 URL。
7. 執行 `inspectGen3Setup`，確認四張表均為 `ok`、`ready:true`，不要公開任何金鑰、帳號、密碼雜湊。
8. Render 恢復 `GEN3_AUTH_ENABLED=true`；確認 `/api/auth/status` 的 `enabled:true`、`registration:true`。測試新帳號註冊、重複帳號拒絕、登入、登出、錯誤密碼、既有帳號登入。
9. 若不成功，停止 Gen3 登入，將 Apps Script 與資料表**成對回復到備份版本**，不可讓版本與欄位不一致時繼續接受寫入。

## 帳號相容

- 既有已啟用帳號的 `user_id`、`username`、`password_hash` 與 Session 必須保留。
- 過去 `pending_verification` 的帳號，部署新版後在密碼驗證成功時才轉成 `active`，不會跳過密碼驗證。
- 不再寄發驗證信或重設密碼連結。忘記密碼目前僅提示聯絡管理團隊，**不提供尚未確認安全規格的自助重設 API**。
- 原有稽核日誌保留，不以刪除功能為由抹除歷史。
- Git 歷史不會因新提交而消失；曾曝光的真正金鑰必須輪替。
