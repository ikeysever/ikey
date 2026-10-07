# 給睿謙：右下角通知資源交接（2026-10-07）

通知固定右下角，圖示在視窗左側，右上角 × 只關閉通知。共四個狀態：青藍上傳中、綠色畫線勾勾成功、紅色叉號失敗、橘色三角驚嘆號 ESP 斷線。淡入／淡出 200ms，位移 12px，無 bounce。成功停留 2 秒；錯誤、斷線與進行中保留至手動關閉。聲音透過 Web Audio 產生，峰值增益 .018，四種短提示音，尚需使用者確認實際音量。橘色警告暫定 #f6b35b，屬本次指定的警告色。

資源：public/status-notifications.js、public/status-notifications.css、public/assets/brand/ikey-approved.png、favicon.png。品牌圖片直接縮放 Welcome 交接包既有 approved-logo，沒有重新設計。

此分支只新增資源，避免與你正在編輯的 animation.js、index.html、style.css 衝突。請在 index.html 載入 CSS 與 JS，DOMContentLoaded 後呼叫 iKeyNotices.applyApprovedBrand() 替換登入／側欄 Logo 和 favicon。

真正的課表上傳目前尚未接入：現有 addCourseConfirmButton 明確不呼叫 POST /api/database/schedules。不可把按下確認、介面驗證通過或 GET 課表成功當成上傳成功。等你的上傳 Promise 建立後，在使用者按鈕事件先呼叫 iKeyNotices.unlockAudio()，再依真實請求結果更新通知。

```js
const id = iKeyNotices.show({ type: 'uploading', title: '正在上傳課表…', detail: '正在更新資料' });
// 若 API 沒提供進度，維持不確定進度；不要虛構百分比。
// await 真實寫入請求，並驗證 response.ok 及業務成功欄位。
iKeyNotices.show({ id, type: 'success', title: '課表更新完成', detail: '資料已儲存' });
// catch 時先把實際原因寫入終端機，再傳入該筆紀錄的穩定 ID。
iKeyNotices.show({ id, type: 'error', title: '課表上傳失敗', detail: error.message, logId });
```

```js
iKeyNotices.configure({ openTerminal(logId) {
  showTerminal();
  // 用你維護的 ID → DOM row Map 精準定位，不要搜尋相同文字或猜最後一筆。
  iKeyNotices.highlightLog(logRows.get(logId));
}});
```

對 ESP 僅在已知 online → offline 的轉變通知一次，初次讀到 offline 不當作突然斷線。API 失敗不能推論 ESP 已離線。先建立含實際斷線原因的日誌，再呼叫 show({ type:'warning', title:'ESP32 連線中斷', detail:原因, logId })。每次狀態轉變用新 ID；重複輪詢不重複彈出或播放音效。

點擊通知要切換終端機並將指定原因行反灰約 900ms，恢復原樣。關閉通知不取消上傳，也不改裝置狀態。動畫通知不應被當作真實狀態的資料來源。

Welcome 整合另在 PR #1；本資源分支不包含 Welcome 的變更。請先確認樣稿與音量，再接入你的主功能。跨 ChatGPT 對話無直接訊息通道，本文件與 PR 作為交接紀錄。
