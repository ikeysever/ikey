# iKey 3.1｜新8 → 新9 正式交接文（草案 V1）
> 編寫：新8｜2026-10-21｜使用者已選「快速接手摘要＋完整16章」。本文件是可持續修訂的交接草案，**不得取代永久最高規格**。任何狀態以最新實查為準。

# 00｜給新9的身分與最高指令
你是**新9**，iKey 智慧鑰匙管理系統 3.1 的下一任 AI 開發協作者；上一任是**新8**。你不是來重新設計系統，而是繼承既有規格、程式、決策、失敗紀錄與待辦，謹慎接續開發。

**最高查證順序：**①讀本交接文 → ②讀 Google Doc《iKey 永久開發歷程與最高規格》最新及相關歷史段落 → ③檢查 GitHub、Google Sheets、Render、原始檔案 → ④交叉比對最新決策 → ⑤仍不清楚或涉及未核准重大決策，才向使用者提問。不要讓使用者重複回答已有紀錄的問題。

**永久記錄義務：**從 `新9Log0001` 開始連號，每次重要需求、問答、修改、失敗、測試、部署、交接都要記錄到永久主文件；記錄日期、原始需求、決策及理由、改動前後、路徑、Git commit、Render deploy ID與狀態、Sheets變更、測試證據、未解問題。記錄失敗同樣重要。若寫入失敗，明確回報並保留待補紀錄，絕不可謊稱已保存。

**使用者操作環境：使用者主要以電子紙裝置與 AI 對話，比手機更不便輸入、複製、貼上及切換頁面。** 請優先直接透過已連接的工具完成經授權的工程操作；**不要要求使用者自行複製貼上 Apps Script、大段程式碼、終端機指令**。回覆採繁體中文、短段落、清楚選項、一次集中提出真正必要的問題；盡量降低操作步驟。**電子紙是使用者對話裝置，不是 iKey 的 ESP32 螢幕規格。**

**邊界：**未經使用者核准，不自行決定重大 schema/API/權限/設備規格，不新增無關功能，不刪資料，不處理付款；有疑義查紀錄。不要把「已提交、已部署、已測試、已驗收」混成一件事。

# 01｜五分鐘快速接手摘要
- **專案：**iKey 3.1，網站＋後端＋Google Sheets/Apps Script，長期整合 ESP32 八格鑰匙/冷氣卡、指紋、LINE、課表及日誌。
- **正式程式：**GitHub `ikeysever/ikey` 的 `main`；正式站 https://ikey.onrender.com；Render service `srv-db1jeuk9v7es73fs5n2g`、workspace `tea-dalrrf2jnfac73ajt5n0`；**autoDeploy=off，需手動部署**。
- **最高文件：**Google Doc `1DTowCfa87A8vwWKkl1cvGGUfBXqe2zmYqNbQhBfWsCo`。舊交接：`docs/HANDOFF-NEW8-2026-10-21.md`；本交接：`docs/HANDOFF-NEW9-2026-10-21.md`。
- **正式 Google Sheet：**`iKey_Database` ID `1vOfpbIQ4px03vip_4zDq1t2KlRP9vUeg4R9JJ0OMXnc`。2026-10-21 查得現有 `Users`、`Gen3_Users`、`Auth_Tokens`、`Auth_Sessions`、`Auth_Audit_Logs`；**尚無正式 Projects 表**。
- **近期前端：**「專案管理」改稱「我的專案」；文字直接導航 `/projects.html`、箭頭獨立展開子清單、子清單縮排、移除無授權的「專案中心」。`/project-create.html` 為無側欄、無彈窗的獨立頁；**同一頁包含「專案名稱」（必填）與「專案說明」（選填）**。
- **重要限制：**目前建立專案僅前端輸入與確認畫面，**沒有永久儲存，也沒有完成專案建立 API**；不要宣稱資料庫已接通。正式 Sheets 新增 Projects 曾遭工具安全檢查阻擋。
- **最近部署：**`dep-dbc9tt61egvs739vqk30` 已觸發，查詢時仍為 `build_in_progress`；接手時**必須重新查 live 與實際網站**。
- **第一優先：**查證目前正式站及 GitHub／Render 一致性，再接續 Projects 資料表、建立 API 與「我的專案」真實列表；未決欄位及專案建立時機先查永久紀錄，仍未定案才詢問。

# 02｜完整工程交接（16章）
## 第1章　專案定位與版本
iKey 3.1 是第三代網站與多專案管理方向；八格實體鑰匙管理為整體系統核心。舊版流程、舊動畫、舊備份只作歷史證據，不自動等於現行正式規格。專案階段應按模組分開標註「規格／原型／提交／部署／測試／驗收」。

## 第2章　最高開發規範
以使用者**最新明確核准**的規格為準；重大決策須詢問。不得無故擴張功能或改動已正常運作部分。前端既有授權內可做最小修正、提交及既有 Render 部署，但仍須核對與測試；資料庫結構、權限、機密、設備操作、破壞性操作另需確認範圍。每刀留下紀錄與證據。工具受限時停止相應操作、誠實回報。

## 第3章　整體系統與資料流
網站：`public/` 靜態前端 → Node.js/Express `server.js` → `gen3-auth/` → Google Apps Script → Google Sheets。長期設備方向：ESP32 ↔ Render ↔ Google 資料／日誌 ↔ LINE。ESP32 不應直接無控寫 Sheets；課表單向下發為既有方向。實際部署與 API 必須依程式核對。

## 第4章　GitHub 與 Render
GitHub `ikeysever/ikey`，正式 `main`，歷史備份 `backup/legacy-2026-10-17` 不可混回。Render service/workspace 見快速摘要；自動部署關閉，推送 commit 後需要觸發部署，等待 `live` 並再做功能測試。常見指令 `npm test`、`npm start`；勿將金鑰寫入版本庫。提交時保留 commit SHA。

## 第5章　網站頁面及側欄
主要檔案：`public/index.html`、`app.js`、`home.html`、`home.js`、`home.css`、`account.html`、`account-edit.html`、`projects.html`、`projects.js`、`project-create.html/js/css`。共用側欄：漢堡保持三條線、不變叉叉；依較新規格開啟旋轉180°、關閉反向回0°。底部帳號管理與登出並排。「我的專案」文字可直接導航，箭頭只展開/收合、子項目縮排；**「專案中心」已移除，不得自行恢復**。

## 第6章　建立專案流程
第一頁（已確認）：獨立頁 `/project-create.html`，不顯示漢堡側欄、不使用 modal；同一頁「專案名稱」必填、「專案說明」選填，取消返回、下一步。現有 HTML 暫設名稱最多80字、說明最多1000字，**字數限制尚非正式核准規格**。目前下一步僅顯示前端確認區，**沒有後端持久化**。第二頁內容、何時正式建立專案（第一步或最後一步）、專案權限與狀態尚須查最新紀錄或取得使用者確認；不得自行推定。

## 第7章　Google Sheets 現況與安全遷移
正式 `iKey_Database` 的現有5表見快速摘要。2026-10-17 舊備份 `iKey_Database_LEGACY_BACKUP_2026-10-17` ID `1WoEv7TBeUO-Y4PmsedAT712VAcvI8pXfRDciTXyUJlw` 有 `Projects`、`Project_Memberships`、`Project_Requests` 等**歷史表**。舊 Projects 表標題：`project_id, project_name, project_type, status, created_by, approved_by, created_at, updated_at, project_description`；這是參考，不是新版已核准欄位。使用者已允許開始修改試算表架構，但每次仍應備份、核對 Apps Script 呼叫及新欄位影響；不要把整套舊表直接搬回。新8曾嘗試新增 Projects，工具安全檢查阻擋，**沒有寫入成功**。

## 第8章　後端與登入
`server.js` 掛載 `gen3-auth/routes.js`；既有驗證端點含 `/api/auth/register`、`/login`、`/me`、`/logout`（具體路由及輸入請查現行程式）。`gen3-auth/sheets-store.js` 是 Apps Script 介接層；環境變數 `GEN3_APPS_SCRIPT_URL`、`GEN3_APPS_SCRIPT_KEY` 僅存在安全設定，不可外洩。專案建立/列表 API 仍未完成。不可繞過登入或權限檢查，不得在 log/文件保存密碼、token、cookie 或個資。

## 第9章　ESP32／LINE／硬體
歷史測試 ESP32-2432S028、ILI9341 240×320、TFT_eSPI；SPI MOSI13/MISO12/SCK14/CS15/DC2/BL21、曾以10MHz運作。八格鑰匙，學生一次限借一把、老師可多把；學生借用比對課表，60秒無動作回首頁。Fingerprint ID 僅存 ESP32；LINE 綁學生/老師序號，不綁指紋 ID。硬體、LINE 子分支與正式網站整合的實際完成度必須逐項查證，不能拿歷史原型當驗收。

## 第10章　動畫與視覺
正式 3.1 網站目前採使用者指定的**3.0鑰匙→掛鎖／解鎖歡迎動畫**，不是舊指紋八格動畫。主要 `public/welcome-3-0-production.html`、`public/welcome-3-0.html`、`public/assets/welcome-3-0/welcome.wav`。新7歷程：刪預覽控制、嘗試自動有聲、登入頁使用者手勢預備 WebAudio、等待動畫實際完成才跳首頁、音量振幅增至1.25。瀏覽器可能限制有聲自動播放，仍需實測；不能自行替換舊音軌或重製動畫。深藍漸層設計維持一致。

## 第11章　歷程、決策及錯誤
最高文件為唯一持續追加的主紀錄，從新一至新8的歷史可追溯。新8近期重要事件：`新8Log0008` 我的專案側欄與命名；`0009` 獨立建立專案頁；`0010` 箭頭點擊區及縮排；`0012` 同頁專案名稱與說明；`0013` 刪除「專案中心」。**注意：新8Log0011 寫入嘗試曾被工具安全檢查阻擋，不可假設該編號已存在；接手先查原始主文件實際紀錄。** 論文素材需保留選型、錯誤、測試、修正、反思，不只列完成事項。

## 第12章　進度表與驗證標準
【已提交】我的專案側欄與名稱、專案建立第一頁（名稱＋說明）、刪除「專案中心」。
【尚待驗證】最近 Render 部署 live、跨裝置側欄、登入、動畫聲音與跳轉。
【未完成】Projects 正式表、專案建立及列表 API、前後端資料持久化、建立流程第二頁。
【規格待確認】專案建立時機、後續頁面、字數限制、專案角色與審核。
不得將提交或觸發部署等同已上線、測試或使用者驗收。

## 第13章　下一位 AI 待辦優先順序
(1) 讀最高規格與最近新8紀錄；(2) 查 GitHub main 最新 SHA 和 Render 最新 live SHA；(3) 核對正式站「我的專案」、獨立建立頁、登入狀態；(4) 核對 Sheets schema、舊備份、Apps Script 實際 action 與寫入方式；(5) 在核准範圍內設計最小 Projects 遷移及可回復方案；(6) 完成 API/列表/建立流程；(7) 記錄測試與失敗。使用者有新指令時，以新指令優先調整待辦。

## 第14章　新9接手驗證程序
第一次回覆應報告：已讀哪些文件、GitHub main SHA、Render live SHA、Sheet 現況、已提交/已驗證/未完成項目、**唯一下一個具體工作**。不問已答過的問題。若最高規格與程式衝突，記錄差異並確認最新明確決策；不能悄悄改寫歷史。

## 第15章　已知問題與技術債
正式 Projects 表不存在；前端建立頁仍是非持久化確認；Sheets 寫入操作曾遭工具安全檢查阻擋；Render 最近部署只查到建置中；使用者以電子紙操作，不適合手動貼 Apps Script；歷史文件中可能仍出現「專案中心」「360° 漢堡」「舊歡迎動畫」等**已被新規格取代**的文字，查詢時須依時間與使用者最新確認裁決。

## 第16章　資源索引
- 最高文件：https://docs.google.com/document/d/1DTowCfa87A8vwWKkl1cvGGUfBXqe2zmYqNbQhBfWsCo/edit
- 正式資料庫：https://docs.google.com/spreadsheets/d/1vOfpbIQ4px03vip_4zDq1t2KlRP9vUeg4R9JJ0OMXnc/edit
- 舊版備份：https://docs.google.com/spreadsheets/d/1WoEv7TBeUO-Y4PmsedAT712VAcvI8pXfRDciTXyUJlw/edit
- GitHub：https://github.com/ikeysever/ikey
- Render：https://ikey.onrender.com
- 上代交接：`docs/HANDOFF-NEW8-2026-10-21.md`
- 本代交接：`docs/HANDOFF-NEW9-2026-10-21.md`
- 附件：`整理專案交接規格.txt`、`賴的子分支.txt`、`動畫製作需求.txt`、`iKey-Welcome-Latest-Handoff.zip` 為歷史參考；不可取代正式最新決策。

# 03｜新9開發紀錄範本
`新9Log0001｜YYYY-MM-DD HH:mm（臺灣）｜需求原文摘要｜查閱依據｜核准規格｜修改前狀態｜變更檔案/表格｜GitHub SHA｜Render ID/status｜實際測試與結果｜失敗與風險｜下一步`
必須寫入最高文件，並在需要時同步 GitHub 交接文；若未寫入則標示待補，**不能虛報**。

# 04｜疑義處理程序
交接文 → 最高規格與最新 Log → 實際程式、資料庫與部署 → 交叉比對 → 最後才詢問。能查到的自行查；涉及未核准重大決策則提出清楚選項與影響。避免使用者在電子紙上反覆長篇輸入。

# 05｜接手核對清單
[ ] 確認自己是新9；[ ] 已讀最高文件；[ ] 已讀本交接與上代交接；[ ] 查 main/live；[ ] 查正式 Sheets；[ ] 檢查 Apps Script 介接；[ ] 分開標記提交/部署/測試/驗收；[ ] 開立新9Log0001；[ ] 回報唯一下一步。

# 06｜交接結語
新9請延續既有成果與尊重使用者的工作方式。**先繼承，再理解；先查紀錄，再做判斷；先確認，再修改；修改後必須記錄。** 本文件為新8整理的第一版交接草案；接手前仍須對照最新永久主文件與線上實況，不能把本草案當作最新 live 快照。
