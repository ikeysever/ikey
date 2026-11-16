# iKey 3.1 借還交易契約（staging）

本文件為待審查方案，尚未執行 SQL、尚未啟用 API、尚未開鎖。

## 已核對
Supabase iKey 具有舊式 borrowings/storage_slots，以及新版 project_slot_codes。新版格位表含 slot_code、project_id、device_id、slot_number、is_active；沒有借還狀態。不能混用舊表的 UUID slot ID。

## 提案
獨立 ikey_slot_loans + ikey_slot_loan_events；資料庫函式在單一 PostgreSQL 交易內鎖住 project_slot_codes 行、檢查狀態、更新借還、寫入事件，並以 UUID request_id 冪等回覆。新表開啟 RLS，撤銷 anon/authenticated 權限；函式預設不開放執行。

## 上線阻擋條件
1. 需決定借還紀錄何時成立：裝置已確認開鎖或使用者完成取還鑰匙；現行提案只表示資料庫邏輯轉移，不能當成實體操作成功。
2. 完成 API 的 Session、專案存取權限、CSRF 與頻率限制；禁止前端直接指定他人 actor_user_id。
3. 測試雙請求併發、重試相同 request_id、相同 request_id 不同 payload、回滾、失敗重送與設備離線。
4. 審查 migration 在實際 schema 上的型別、外鍵及權限，建立隔離測試資料後再執行。
5. 未經以上驗證，不授予 RPC execute、不部署 Render。
