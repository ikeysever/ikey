# iKey 3.1 — Messaging API LINE 帳號綁定（方案 B）

狀態：staging 開發中；不得將此文件視為已開通功能。

## 已確認流程
1. 使用者先以原有 iKey 帳號及 Session 登入，進入帳號管理。
2. 點「綁定 LINE」後，由伺服器建立 8 字元隨機一次性碼（顯示格式 IK-XXXX-XXXX），有效 5 分鐘。
3. 網站顯示綁定碼，使用者自行傳送到既有 iKey LINE 官方帳號的**一對一聊天室**，不可在群組綁定。
4. LINE Messaging API Webhook 先驗證原始位元組的 HMAC 簽章，僅接受一對一 user 來源的文字訊息。
5. GAS 必須以原子交易檢查綁定碼雜湊、有效期、已使用狀態、帳號狀態、LINE userId 唯一性及事件去重，成功後綁定至既有 iKey user_id。
6. 帳號管理頁輪詢已驗證的綁定狀態；成功才顯示已綁定。原有密碼登入不變。

## 不可跳過的安全要求
- 不記錄原始綁定碼、LINE userId、使用者訊息或憑證到日誌；只儲存 HMAC 雜湊及必要的受保護識別資料。
- 每位使用者僅允許一個待處理碼；重新產生使舊碼失效；嚴格限制頻率與錯誤嘗試。
- LINE userId 不得同時綁定多個 iKey user_id；解除綁定須有效 iKey Session、CSRF/Origin 檢查及再次確認。
- 事件必須先**持久化並完成原子處理**才可回 HTTP 200；失敗回非 2xx 讓 LINE 重試；利用 webhookEventId 去重。
- LINE Login OAuth 與 LINE Messaging API 是不同產品；此方案不宣稱已提供 LINE OAuth 登入。
- 不使用 Node.js 記憶體 Map 作為綁定碼儲存；Render 重啟或多實例時會失效。
- 不更動既有 Users/Sessions 欄位或帳號權限；新增獨立 LINE_Bind_Challenges、LINE_Bindings、LINE_Webhook_Events（實際名稱及欄位須先經 GAS schema 盤點確認）。
- 目前 GAS writer 未提供這些表的原子操作。lib/line-code-binding.js 僅提供純函式與能力檢查，現有 API 保持 503，真實 webhook 仍不確認未處理事件。

## 啟用門檻
確認 GAS 原始碼可安全修改、部署測試版及備份；實作 createChallengeAtomic / consumeChallengeAtomic / getBindingByUser / unbindAtomic / recordWebhookEventAtomic，完成重放、競爭條件、過期、跨帳號、群組事件、簽章錯誤測試後，才能將 API 和帳號頁按鈕正式啟用。
