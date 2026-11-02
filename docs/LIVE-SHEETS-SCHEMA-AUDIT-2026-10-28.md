# iKey 3.1 — Live Sheets read-only schema audit (2026-10-28)

## Source and scope
Read-only metadata and header-row inspection through connected Google Drive/Sheets of spreadsheet titled `iKey_Database` (ID `1vOfpbIQ4px03vip_4zDq1t2KlRP9vUeg4R9JJ0OMXnc`). This is an observation of the accessible spreadsheet, **not proof that the deployed GAS points to it**. No row data, secrets, Script Properties, or production writes were read or changed.

## Observed tabs and header rows
- `Projects` (12): `project_id,project_name,description,created_by_user_id,authorization_method,scheduled_authorization,status,created_at,updated_at,notification_theme,notification_sound_pack,notification_volume`.
- `Project_Access` (11): `entry_id,project_id,entry_type,user_id,role,status,invite_hash,join_policy,created_at,updated_at,reviewed_by`.
- `Devices` (6 nonempty headers): `device_id,password_hash,status,created_by_user_id,created_at,updated_at`.
- `Gen3_Users` (10): `user_id,password_hash,display_name,global_role,account_status,failed_login_attempts,locked_until,created_at,updated_at,username`.
- No tabs named `Factory_Devices`, `Project_Devices`, `DeviceCommands` or `DeviceCommandEvents` observed in spreadsheet metadata.
- Backups exist, including `iKey_Database_LEGACY_BACKUP_2026-10-17`; they are historical and not treated as active schema.

## Compatibility findings
1. Current `Devices` has no `project_id`, so project/device binding cannot be inferred from it.
2. `Project_Access` contains role/status but the exact admin role values and access semantics must be verified in code and against approved rules; no assumption from headers alone.
3. The proposed `Factory_Devices`/`Project_Devices` schema is not present in the inspected workbook; do not alias or overwrite `Devices` automatically.
4. `DeviceCommands`/`DeviceCommandEvents` do not exist here; no durable command backend has been verified.
5. Apps Script deployment version, dispatcher, script properties, configured spreadsheet ID and GAS LockService implementation remain unverified.

## Safe migration gate (not executed)
1. Confirm actual deployed GAS source and spreadsheet ID; compare existing `Devices` with any device-related GAS action schemas.
2. Confirm user-approved project admin roles and project binding semantics; implement server-derived actor context and GAS-side revalidation.
3. Take a verified point-in-time backup before any schema changes.
4. Create **separate isolated test spreadsheet**, add candidate `Factory_Devices`, `Project_Devices`, `DeviceCommands`, `DeviceCommandEvents` headers, then implement LockService-guarded atomic create/claim/report and audit append. LockService alone does not guarantee atomicity across external systems or multi-sheet partial writes; test failure recovery.
5. Run concurrency, replay, expired command, wrong device, crash/retry and rollback tests. Only then propose production migration and obtain explicit approval.

## Safety status
Read-only discovery only; no modifications to live Sheets, GAS, Render, main or physical ESP32.
