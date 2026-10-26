# iKey 3.1 — P2 裝置出廠預登錄（P1-C 前置規格）
日期：2026-10-26
狀態：已確認授權模式；資料模型／API 設計草案，尚未部署或啟用

## 已確認的規則
1. 只有超級管理員可以建立出廠裝置身分（factory device ID 與一次性出廠密碼）。
2. 專案管理員只能以出廠 ID 與密碼申請綁定已登錄裝置；不得自行創建裝置。
3. 一般使用者不能建立或綁定裝置。
4. 所有驗證與唯一綁定檢查必須由後端執行，前端禁用按鈕不是權限機制。
5. 出廠密碼不以明文儲存、不寫入日誌、不由讀取 API 回傳。

## 建議最小資料模型（待正式審核）
Factory_Devices：device_id（唯一）、credential_hash、credential_salt／KDF metadata、registration_status、registered_by、registered_at、updated_at。
Project_Devices：binding_id、project_id、device_id（唯一有效綁定）、display_name、lock_mode、heartbeat_interval_minutes、auto_firmware_update、bound_by、bound_at、updated_at。
Device_Events：event_id、device_id、project_id、event_type、actor_id、result、timestamp（絕不包含密碼）。
不得將 Factory_Devices 開放給一般 db.select／db.update 通用 CRUD；需使用專用操作和伺服器角色檢查。

## 最小 API 合約（規劃，未實作）
POST /api/admin/factory-devices：需超級管理員身分，建立裝置 ID 與憑證雜湊，拒絕重複 ID。
POST /api/projects/:id/devices/bind：需專案管理員身分，驗證出廠 ID 與密碼，原子性確認未被其他專案綁定。
GET /api/projects/:id/devices：僅可讀取所屬專案裝置，不回傳任何憑證。
PATCH /api/projects/:id/devices/:deviceId：需管理員身分，驗證可修改欄位。
POST /api/projects/:id/devices/:deviceId/test：需管理員身分，回傳實際裝置測試結果，不得假造在線。
實作前需確定超級管理員的可信任身分來源、資料庫交易／併發鎖策略、裝置首次領取與憑證輪替流程。

## 安全與驗收門檻
- 超級管理員認證不可只依靠瀏覽器宣告或可編輯的使用者資料欄位。
- 出廠密碼使用適合密碼的加鹽 KDF，並限制錯誤嘗試、記錄去識別化稽核事件。
- 綁定須防競態條件與跨專案重複綁定。
- 未建立專用 API 與資料庫前，裝置登錄表單保持不可提交，顯示「尚未啟用」。
- 完成單元／整合／實機測試並記錄 Commit、測試與回滾後才可宣布可用。

## 本次 P1 收尾
開發分支 feature/project-visual-design-sync-new11 的 project.html 已將舊版內嵌設定區隱藏，使用獨立 project-settings.html 作為可見設定入口；保留舊 DOM 鉤子避免現有 project.js 執行時找不到元素。後續應重構移除舊 DOM 與對應 JS，並完成瀏覽器回歸測試。
