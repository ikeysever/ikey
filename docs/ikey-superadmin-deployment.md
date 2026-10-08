# iKey 全域 Super Admin 身分部署說明

## 指定帳號

- 登入帳號：`ikey`
- 全域角色：`superadmin`（伺服器端判定，不信任瀏覽器傳入角色）
- 原本 `POST /api/login` 的輸入與 JSON 回應保持不變。
- 新增唯讀 `GET /api/login/session` 供已登入者確認身分。
- 新增 `POST /api/login/logout` 清除工作階段。
- 未登入、無效簽章、過期工作階段均不可取得管理員身分。

## 正式啟用前必要設定

在 Render Web Service → Environment 新增：

`IKEY_SESSION_SECRET` = 長度至少 32 字元、使用密碼學安全亂數產生的**私密字串**。

不要放入 GitHub、Google Sheet、聊天室或前端程式。Render 變數未設定時，原登入 API 可繼續運作，但不會核發管理員工作階段；這是刻意採用的安全預設。

## 尚未完成

- 此工作階段只提供伺服器驗證的身分；**既有資料庫與設備 API 尚未接上權限 middleware**。
- 不能把此階段視為完整的 Super Admin 管理介面或已具備跨專案管理功能。
- 目前固定帳密登入本身仍有安全債務，後續應在維持 API 契約前提下改用環境變數、密碼雜湊及登入速率限制。
