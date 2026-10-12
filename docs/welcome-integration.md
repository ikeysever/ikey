# iKey Welcome 整合與第三版裝置監測調整（2026-10-12）

歡迎動畫延用核准的 iKey 掛鎖 Canvas 視覺、字體、音效與 9.8 秒時序。登入身分仍由各自的後端 Session 驗證；動畫本身不負責認證。

## 第三版登入流程

1. 一般帳號使用 `/api/auth/me` 驗證 Session；舊管理員帳號使用 `/api/login/session`。
2. 驗證成功後播放 `public/welcome-padlock.js`。動畫以自身時間軸結束，**不查詢任何裝置狀態 API，也不等待 ESP32 心跳**。
3. 動畫完成後顯示首頁，並透過登入 Session 取得「我的帳號」資料。若音效遭瀏覽器政策阻擋，視覺動畫仍可完成。
4. 登出後清除個人資料並回登入頁。

## 已移除的舊版依賴

- `/api/device/heartbeat`、`/api/device/status`、`/api/login/admin/connections` 及固定兩台裝置的全域狀態追蹤。
- 原本動畫等待裝置 API 成功、15 秒載入逾時與重試的邏輯。
- 登入後的裝置狀態輪詢、全域連線指示燈與 ESP Robot／LVGL Terminal 斷線提示。

**後續待辦**：新監測功能將由「專案中心 → 我的專案」管理。每個專案可能有多台裝置，必須先確認專案、裝置、成員權限與資料來源之間的關係，再定義新的心跳／狀態 API；不可直接沿用固定 `esp-robot`、`lvgl-terminal` 的全域模式。

這次保留登入、歡迎動畫本身、LINE、Google Sheets、借還及其他獨立功能，不代表已完成新的多專案裝置監測。
