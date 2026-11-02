# iKey 3.1 系統公告｜實作歷程

## 2026-11-02｜第 14 項：首頁公告排序核心

### 已採用的排序基準
- 第一排序鍵：公告優先級，緊急（urgent）> 重要（important）> 一般（normal）。
- 第二排序鍵：同優先級時，發布時間（published_at）由新到舊。
- 第三排序鍵：發布時間相同或缺漏時，以建立時間（created_at）由新到舊。
- 無法辨識的優先級排在已知優先級之後；無效／缺漏時間不會被當成最新公告。
- 排序函式回傳新陣列，不修改原始資料。

### 本次程式變更
- 新增 `lib/announcement-order.js`：純函式排序核心，沒有資料庫或網路副作用。
- 新增 `test/announcement-order.test.js`：涵蓋優先級、同級時間排序、未知值、輸入不可變與錯誤輸入。
- 開發分支：`feature/system-announcements-staging-20261102`。
- 基底分支：`feature/super-admin-dashboard-live-20261102`。
- 未修改 `main`、正式資料庫、Render 設定或部署。

### 尚未完成
- 尚未將排序核心接入首頁公告 API 與超級管理員公告管理介面。
- 公告資料表／欄位尚需依現有 GAS 與資料庫 Schema 唯讀盤點結果確認；本次不自行新增資料表或欄位。
- 尚未執行正式環境驗收。
