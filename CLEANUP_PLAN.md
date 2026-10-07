# iKey 專案瘦身計畫（CLEANUP PLAN）

> 建立日期：2026-10-07  
> 狀態：**盤點／討論中，尚未授權刪除任何檔案**  
> 基準：建立前已重新同步 GitHub main、code1cmd.txt、code2cmd.txt、code3cmd.txt。

## 清理鐵律

1. 列入候選 ≠ 可以刪除。
2. 真正刪除前必須再次同步最新 main 與 code1/code2/code3。
3. 必須確認沒有其他工作線正在引用或準備引用。
4. 不因「檔案大」就刪除；正式素材、授權、測試、交接歷程可保留。
5. 不在清理時順便改功能規格。
6. 同一功能若要拆檔／重構，先保證行為不變，再做回歸測試。
7. 若任何 AI／組員對候選項有異議，先標記「保留待討論」，禁止先刪。

## 分類

- 🟢 保留：目前正式使用、必要資產、授權、測試或協作歷程。
- 🟡 可整理：仍有用途，但可能有死碼、重複碼、可拆分或可縮減。
- 🟠 疑似舊版殘留：目前未見正式用途，但刪除前仍需跨工作線確認。
- 🔴 高可信可刪候選：目前證據顯示無內容／無引用；仍需其他工作線確認後才刪。

## 全部檔案盤點（35 個）

| 檔案 | 大小 | 分類 | 目前判斷／瘦身計畫 |
|---|---:|---|---|
| code1cmd.txt | 37,505 B | 🟢 | 工作線 1 開發歷程與交接，保留；未來可考慮歸檔，但本輪不動。 |
| code2cmd.txt | 17,128 B | 🟢 | 通知／動畫工作線交接，保留。 |
| code3cmd.txt | 28,661 B | 🟢 | LINE 工作線交接，保留。 |
| config/supabase.js | 0 B | 🔴 | 空檔；目前正式程式未見引用。請 2、3 號 AI 確認未來也不需要後再刪。 |
| docs/notifications-handoff-ruiqian.md | 2,907 B | 🟢/🟡 | 通知整合交接紀錄；目前先保留。待 2 號確認內容是否已完全吸收進 code2cmd／正式碼後，再決定是否歸檔。 |
| docs/welcome-integration.md | 2,041 B | 🟢 | Welcome 整合規格／歷史，現階段保留。 |
| package.json | 280 B | 🟡 | 必須保留；其中 @supabase/supabase-js 疑似舊依賴，需確認後只移除 dependency，不刪 package.json。 |
| public/animation.js | 61,922 B | 🟡 | 核心網站程式，不能刪。檢查 classroomPlaceholder 等死碼、重複 helper；未來可評估按功能拆檔，但不可趁清理改行為。 |
| public/assets/brand/favicon.png | 10,249 B | 🟢 | 正式 favicon，index 有引用，保留。 |
| public/assets/brand/ikey-approved.png | 261,897 B | 🟢 | 正式網站品牌圖，index 有引用，保留。 |
| public/assets/ikey-logo.png | 1,377,193 B | 🟠 | 舊 Logo 且非常大；目前正式品牌已換新。status-notifications.js 尚有舊 Logo 相容引用，需先由 2 號確認是否可移除相容碼，再刪資產。 |
| public/assets/welcome/OFL.txt | 4,301 B | 🟢 | 字型授權文件，即使 runtime 不引用也應保留。 |
| public/assets/welcome/connection-lines.png | 70,854 B | 🟢 | welcome.js 使用中。 |
| public/assets/welcome/final-chord.mp3 | 11,092 B | 🟢 | Welcome 最後和弦使用中。 |
| public/assets/welcome/fingerprint.png | 69,797 B | 🟢 | Welcome 使用中。 |
| public/assets/welcome/ikey-approved-source.webp | 215,630 B | 🟢 | Welcome 使用中，不能因與品牌圖相似就刪。 |
| public/assets/welcome/intro.mp3 | 224,788 B | 🟢 | Welcome 音軌使用中；音量目前由程式 gain 控制。 |
| public/assets/welcome/letter-K.png | 15,473 B | 🟢 | Welcome iKey 字母動畫使用中。 |
| public/assets/welcome/letter-e.png | 13,091 B | 🟢 | 同上。 |
| public/assets/welcome/letter-i.png | 10,750 B | 🟢 | 同上。 |
| public/assets/welcome/letter-y.png | 13,389 B | 🟢 | 同上。 |
| public/assets/welcome/status-text-subset.ttf | 4,948 B | 🟢 | style.css 使用中的 subset font。 |
| public/assets/welcome/welcome-text-subset.ttf | 6,360 B | 🟢 | style.css 使用中的 subset font。 |
| public/index.html | 24,533 B | 🟡 | 核心頁面，不能刪；後續只檢查已失效 placeholder／舊 DOM，先不重構。 |
| public/status-notifications.css | 3,516 B | 🟢/🟡 | 通知功能使用中；由 2 號 AI 檢查是否有已淘汰 selector。 |
| public/status-notifications.js | 5,709 B | 🟡 | 通知功能使用中；仍有舊 ikey-logo.png 相容引用，是舊 Logo 能否刪除的關鍵。 |
| public/style.css | 36,403 B | 🟡 | 核心樣式，不能刪；後續檢查 placeholder／未使用 selector，需配合 DOM 查證。 |
| public/welcome.js | 10,907 B | 🟢/🟡 | Welcome 正式程式，保留；只做明確需求修改，不為瘦身破壞時間軸。 |
| routes/database.js | 18,217 B | 🟢/🟡 | 正式 DB API，保留；可做重複 helper 檢查，但不改 schema／API。 |
| routes/device.js | 1,795 B | 🟢 | ESP32／LVGL heartbeat 與 LINE 系統狀態共用，保留。 |
| routes/health.js | 220 B | 🟢 | 小但有 server 正式掛載；保留。 |
| routes/line.js | 81,566 B | 🟡 | LINE 核心且目前最大程式檔；不能刪。由 3 號 AI 檢查死碼／重複 helper，之後可考慮模組化，但本輪不重構。 |
| routes/login.js | 557 B | 🟢 | 正式登入 route，server 有掛載，保留。 |
| server.js | 1,531 B | 🟢 | 入口檔，正式掛載 login/health/device/database/line，保留。 |
| tests/welcome-state.cjs | 2,213 B | 🟢 | Welcome 回歸測試，保留。 |

## 跨檔案候選項

### A. Supabase 舊架構殘留
候選：
- config/supabase.js（0 B）
- package.json 的 @supabase/supabase-js

目前正式架構是 Render ↔ Google Database/Logs；本輪掃描未發現正式 runtime 程式使用 Supabase client。  
**處理建議：先請 2、3 號 AI 確認各自工作線沒有依賴，再一起移除。**

### B. 舊 Logo
候選：
- public/assets/ikey-logo.png（約 1.38 MB）
- public/status-notifications.js 內針對 ikey-logo.png 的舊品牌相容邏輯

正式網站已使用 public/assets/brand/ikey-approved.png。  
**處理順序：2 號 AI 先確認通知模組不再需要舊相容 → 移除相容碼 → 全域搜尋零引用 → 才刪舊圖。**

### C. 課表 placeholder 死碼
public/animation.js 目前仍出現 classroomPlaceholder 相關程式，但教室 1～8 已改成真實課表。  
**處理建議：1 號工作線逐段確認 DOM/CSS/JS 是否仍有 fallback 用途；確認無用途後成組移除並回歸 R01～R08。**

### D. 大檔案不是直接刪除對象
- routes/line.js 約 81.6 KB
- public/animation.js 約 61.9 KB
- public/style.css 約 36.4 KB

這些是「可整理／可模組化」而不是「可刪」。先查死碼與重複，再決定是否拆分；不得因檔案大而重寫。

## 目前最優先討論的刪除候選

1. config/supabase.js
2. package.json 的 @supabase/supabase-js
3. public/assets/ikey-logo.png + 對應舊相容碼
4. classroomPlaceholder 相關死碼（不是整個 animation.js）

## 給其他 AI 的回覆格式

請不要直接刪檔。請針對每個候選回覆：

- 候選項：
- 你的工作線目前是否引用：是／否／不確定
- 未來已確認功能是否需要：是／否／不確定
- 建議：保留／可刪／先整理後刪／待討論
- 依據：請指出檔案、函式、功能或交接規格
- 若刪除會影響什麼：
- 是否同意由工作線 1 最後統一執行清理：是／否

## 尚未執行

- 尚未刪除任何檔案。
- 尚未移除任何 npm dependency。
- 尚未刪除 placeholder。
- 尚未重構 animation.js / routes/line.js。
- 清理必須等工作線 2、3 回覆後，再由工作線 1 重新同步 main 並逐項執行。
