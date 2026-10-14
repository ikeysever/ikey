# iKey Gen3｜原生帳號登入

第三代只使用 **iKey 帳號＋密碼**。註冊欄位為帳號、顯示名稱、密碼與確認密碼。
不提供第三方登入、電子郵件註冊、驗證信、寄信重設密碼或個人帳號的信箱欄位。

- `server.js`：登入入口、帳號狀態與新舊資料後端相容檢查。
- `routes.js`：帳號註冊、登入、登出、Session 與登入鎖定。
- `core.js`：scrypt 密碼雜湊、帳號狀態與 Session。
- `sheets-store.js`：Render 呼叫專用 Apps Script，不在瀏覽器公開金鑰。
- `apps-script/Code.gs`：唯一帳號、原子寫入、權限驗證、Session 與稽核。

## 正式資料結構

`Gen3_Users` 十欄：
`user_id,password_hash,display_name,global_role,account_status,failed_login_attempts,locked_until,created_at,updated_at,username`。

`Auth_Tokens` 七欄：`token_id,user_id,token_hash,purpose,created_at,expires_at,used_at`。
僅作伺服器端限流用途；不再發出電子郵件驗證或密碼重設憑證。
`Auth_Sessions` 與 `Auth_Audit_Logs` 不變。

**GitHub／Render 不會自動更新線上 Apps Script。** 請依 `DEPLOYMENT.md` 先備份既有使用者資料，再協調資料表欄位與 Apps Script 部署。舊 Apps Script 尚在使用時，既有已啟用帳號仍可用帳號名稱登入；新註冊會暫停，避免資料格式不一致。

帳號忘記密碼的管理員協助流程尚待規格確認，**不提供未經授權的自助重設 API**。
舊版管理員、LINE、iBox、歡迎動畫與其他資料表不應受影響。
不得將金鑰、密碼或 Token 提交公開 GitHub。
