# iKey 3.1

正式服務由 Render 部署 main，資料儲存使用 Supabase。合併後請核對 Render live commit。

`IKEY_STORAGE_BACKEND=supabase` 選用正式資料庫，`gas` 選用舊版 Sheets。未知設定會停用儲存服務。

`/api/health` 檢查程序存活；`/api/ready` 檢查驗證服務的資料庫依賴，未就緒時回應 503。LINE 診斷只反映本機設定，實際收發需要 LINE webhook 事件驗證。

舊版程式保存在 `backup/legacy-2026-10-17`。`iKey-Welcome-Latest-Handoff.zip` 為歷史交接包，3.1 音效請使用正式整合包。
