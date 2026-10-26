# iKey P1｜加入專案與成員權限部署閘門

狀態：**程式已提交開發分支，尚未部署 GAS 或 Render**。

## 新增資料模型

- 既有 `Projects` 表不增刪欄位。
- `iKey_Database` 新增 `Project_Access` 表，表頭依序為：
  `entry_id, project_id, entry_type, user_id, role, status, invite_hash, join_policy, created_at, updated_at, reviewed_by`。
- `entry_type=config`：每個專案一筆加入規則與邀請碼 SHA-256 雜湊。**不儲存明文邀請碼**。
- `entry_type=member`：每個使用者／專案一筆加入申請與成員狀態（pending / active / rejected）。
- 原 `Project_Members` 是舊申請草稿資料，不可直接當作 3.1 正式成員清單。

## Apps Script 上線前提

`gen3-auth/Code.gs` 已新增資料表 schema 與 action dispatch。
`gen3-auth/project-data.gs` 含 Projects 資料讀寫白名單、邀請碼設定、加入、審核、成員清單與權限檢查。

**必須**把這兩份 `.gs` 同步至目前 Render 使用的 **同一個 Gen3 Apps Script 專案**，並將 Web App 更新為含新程式碼的部署版本。GitHub commit 不等於 Apps Script 發布，切勿先部署 Render 假裝已完成。

保留 Script Properties 的 `GEN3_SPREADSHEET_ID` 與 `GEN3_API_KEY`，不得將金鑰放入 GitHub 或 log。

## 驗收

1. GitHub Actions `iKey P1 checks`：Node 語法、原有測試、專案儲存 mock、加入／審核狀態與 API 測試均成功。
2. 在**測試專案／測試帳號**上確認建立者可產生一次性邀請碼；非管理員不能產生；再次產生使舊碼失效。
3. 測試「直接加入」立刻可見、「申請審核」核准前不可查看專案、「拒絕」不得取得權限；他人不能審核。
4. 專案軟刪除前必須兩次確認，刪除後管理員與成員都無法存取；確認日誌已寫入。
5. 手機介面：主要按鈕、錯誤提示、loading 與管理員／使用者角色清楚。
6. **尚未完成：** 裝置 API、實體設備配對及解鎖授權。不可將這部分標示為已上線。

只有在 Apps Script 已同步、真實 GAS/Sheets 整合測試完成、無安全阻塞缺陷之後，才合併 PR #63 至 `main` 並手動觸發 Render 部署；部署後需重新驗證健康狀態。


## Other project settings (2026-10-26)

- The owner-only endpoint `PATCH /api/projects/:id/other-settings` accepts only `status` (`active`/`inactive`), `authorization_method` (`application`/`self_registration`), and boolean `scheduled_authorization`.
- The Render API validates origin, session, project ID, payload shape and values. GAS `projectSettingsUpdate` rechecks the active actor and project owner under a script lock, performs the update, reads it back and appends an audit event.
- The deployment **must** publish both `gen3-auth/Code.gs` and `gen3-auth/project-data.gs` together, since the new dispatcher action is not present in the previously published GAS version. Do not deploy Render first.
- Validate unauthorized member and invalid status rejection; verify actual Sheets write/readback, audit row, and that inactive projects cannot receive new joins. No hardware unlock claim is implied.
- Until live GAS verification succeeds, leave PR #63 unmerged and Render unchanged.
