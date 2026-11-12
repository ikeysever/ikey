# iKey 3.1｜網站規格與現行程式差異盤點（2026-11-11）

> 範圍：GitHub `main` 原始碼靜態盤點；**非**正式環境功能測試、資料庫驗證或部署證明。原規格以既有討論為依據，尚待與完整交接檔逐條對照。不得將「檔案存在」誤寫為「功能完成」。

## 核對原則
- 保留現有網站、帳號系統、權限及資料；不要重新建立第二套模組。
- 分類：**已有程式**、**部分實作／有明確限制**、**原規格與現況不一致**、**尚無足夠證據**、**正式部署待驗證**。
- 本分支只做非破壞性開發；不修改 `main`、Render、正式 GAS 或實體鎖。

## 網站逐項差異

| 功能 | 現有證據 | 判定 | 下一個可執行工作 |
|---|---|---|---|
| 登入、Session、權限 | `server.js` 的 `/api/auth/*`、`public/admin-nav-guard.js` | 已有程式；未做本次端到端驗收 | 補權限與失效 Session 回歸測試 |
| 首頁／我的專案 | `public/projects.html`、`projects.js`、`project.html`、`project.js` | 已有頁面及 API 串接 | 逐角色測試清單與切換 |
| 建立專案五步驟／第二步功能多選 | `public/project-create.html` 標題為「基本資料」；`project-create.js` 單次 POST 固定 payload | **原規格與現況不一致**：現行為簡化建立流程 | 找回已批准的五步驟規格與原版實作，確認合併差異；勿直接覆寫 |
| 專案功能模組選擇 | `project-create.js` payload 僅含名稱、描述、授權與通知預設值 | **目前建立流程未見功能多選** | 確認後端 schema/API 支援後恢復 |
| 專案成員 | `public/project-members.js` 讀 `/api/projects/:id/members`，只顯示 `owner + project_creator` | **部分實作**，程式明示其他名冊可能未完成 | 改善顯示與明確標示名冊完整性；增刪／邀請另行確認 API |
| 裝置列表、搜尋與綁定 | `public/project-devices.js` 讀列表、搜尋卡片、POST 綁定 | **已有程式** | 測試裝置綁定權限、錯誤回報、搜尋 |
| 裝置在線狀態 | `project-devices.js` 顯示「連線狀態：尚未驗證」 | **未完成實際狀態整合** | 對接可信 heartbeat／最後上線 API |
| 專案其他設定 | `public/project-other-settings.js` submit 固定回「尚未發布資料庫設定服務」 | **僅唯讀／儲存停用** | 核對安全的後端更新端點及權限後再接通 |
| 專案開鎖中心 | `public/project-unlock.js` 強制要求 `physical_unlock_enabled=false` 且 `command_api_ready=false` | **安全停用，非實體可用** | 沿用 CTRL-001 指令鏈，完成 GAS／Render 實際驗證 |
| 超級管理員開鎖測試 | `public/super-admin.html`；CTRL-001 staging 模擬分支 | **模擬驗證通過；非正式實體控制** | 整合舊版 gateway、統一 API，受控測試 |
| 公告後台 | `public/announcements-admin.js`、CSS | **已有程式** | 核對 CRUD／發布／下架 API、角色及資料一致性 |
| 多管理員、群組／個別權限 | 既有需求；本次未證明完整資料模型與 UI | **尚無足夠證據** | 盤點後端權限與群組資料模型 |
| 多專案共享 iBox | 既有需求；`project-devices.js` 只證明專案裝置清單與綁定 | **尚無足夠證據** | 查 Project_Devices 綁定及共享衝突策略 |
| 借還、領用、寄存、預約／週期排程 | 既有規格；本次檢視的主要專案頁未顯示完整流程 | **尚無足夠證據** | 找既有分支與 API，不新增重複系統 |
| LINE 通知與綁定 | 正式部署記錄含 2026-11-09 LINE 六位數綁定（預設停用） | **已有候選程式，正式功能未啟用** | 核對開關、驗證與通知端點 |
| Welcome 3.1 動畫／音效 | 既有素材與整合分支；本次未逐檔驗證 | **尚無足夠證據** | 對照已核准素材與正式引用 |
| Wi-Fi 配網 | 現有 ESP32 韌體以編譯時 Wi-Fi 常數為主 | **新需求，未實作** | WIFI-001 已確認；SoftAP 本機頁面方案待最後確認後實作 |
| DEV-006 網站設定／Web Serial 備援 | 先前決策；本次未核實程式 | **尚無足夠證據** | 與 SoftAP 設計整合，保留實體配網授權 |

## CTRL-001 既有資產，不可重寫
- `feature/esp32-device-auth-staging`：`lib/device-command-routes.js`、`lib/device-command-gateway.js`、`gas/device-command-actions.gs`、`firmware/esp32-ikey-unlock/esp32-ikey-unlock.ino`。
- `feature/ctrl-001-superadmin-unlock-simulation-20261109`：網站按鈕模擬、指令狀態測試。
- 正式 Render `ikey`：部署 `main`，自動部署關閉；2026-11-09 最新已知 live commit `e8d218a6a382a44765506a86c5dfed6c8fe60ef7`。
- 實體控制啟用前，必須核對正式 GAS 模組、四張指令資料表、簽章、裝置綁定與鎖具過熱／回饋安全問題；不可用離線測試取代。

## WIFI 配網設計狀態
- **WIFI-001 已確認**：首次無設定自動配網；已設定時斷線只自動重連；更換 Wi-Fi 須實體按鍵授權；配網時停止遠端開鎖。
- **SoftAP + 本機 HTTP 設定頁**：已提出並詳細說明，尚未收到明確最終選擇；不可寫成已定案。
- 未定：熱點獨立密碼、長按秒數、超時、按鍵腳位、狀態指示；不得自作決定。
- 正式實作須支援 NVS 安全更新、2.4 GHz Wi-Fi、TLS 驗證、失敗回復、無網路時仍可配網，且不得公開裝置憑證。

## 交付順序
1. 逐項建立可重現的前端／API 契約測試，優先處理確定存在的缺口。
2. 安全修復不依賴資料遷移的 UI 問題，保留現有路由與風格。
3. 找回五步驟／功能多選的原版分支並對照現行後端 schema；不憑記憶直接覆寫。
4. 在獨立分支整合已存在的 CTRL-001 程式與 WIFI-001；需要審核的功能先跳過。
5. CI 通過後提交 Draft PR 供驗收；正式部署、資料變更、實體開鎖另行確認。

## 本次進度
- 已讀取現行 `main` 的建立專案、專案頁、裝置、成員、其他設定、公告與開鎖控制相關程式。
- 此文件是**原始碼證據盤點**，不宣稱所有網站功能已完成或已測試。

## 2026-11-12 追加實作與契約核對
- 已從歷史分支 `feature/project-create-five-step-wizard` 恢復五步驟 UI；主分支目前 `POST /api/projects` 的欄位契約支援主題、音色、音量，已接回送出 payload，並加入送出前檢查。
- 已將基本／授權／通知／進階四個專案面板接到已驗證專案物件的唯讀資料；裝置面板導向既有裝置頁。
- `server.js` 專案清單目前只依 `created_by_user_id` 查詢，並非完整的多專案成員清單；不得把專案邀請／共享稱作完成。
- `server.js` 的 `POST /api/projects` 目前未定義功能模組多選的持久化欄位，且既有資料模型尚未核實；**功能多選仍需後端資料模型與遷移設計**，不能只加前端勾選框冒充完成。
- 2026-11-12 CI 發現新增的路由比對測試正規表示式過度跳脫；已修復，需以最新 commit 的工作流程結果為準。
