# iKey 3.1 GAS command integration gate — staging only

## Verified in GitHub source (not proof of deployed GAS)

- The GEN3 entrypoint is `gen3-auth/Code.gs`, which already routes four allowlisted command actions to `ikeyDeviceCommandAction(action,p)` after checking `GEN3_API_KEY`. Do not create another `doPost`.
- Command implementation: `gas/device-command-actions.gs`; authorization: `gas/device-command-authorization.gs`; assertion verification and nonce ledger: `gas/device-command-trust.gs`.
- Render's `GEN3_APPS_SCRIPT_KEY` must have the same **secret value** as GAS `GEN3_API_KEY` (different environment-variable names). Verify without printing secrets.
- Both Render and GAS need matching `IKEY_COMMAND_TRUST_SECRET` values, at least 32 bytes.
- All command actions require `GEN3_SPREADSHEET_ID` in GAS. GAS authorization checks Projects, Project_Access, Devices; commands additionally require Project_Devices, DeviceCommands, DeviceCommandEvents, DeviceCommandNonces.
- Signature binds the full payload via `payload_sha256`; a consumed nonce is recorded in DeviceCommandNonces under the script lock.
- `ikeyCommandNoncePruneLocked_` is a maintenance helper only, not an automatic scheduler. It requires the same lock, removes at most 500 rows, and retains nonces until at least 24 hours past expiration.

## Required additional sheets (exact header order)

`Project_Devices`:
`binding_id,project_id,device_id,display_name,lock_mode,heartbeat_interval_minutes,auto_firmware_update,bound_by,bound_at,updated_at`

`DeviceCommands`:
`command_id,project_id,device_id,actor_user_id,action,idempotency_key,fingerprint,status,created_at,deadline_at,claimed_at,finished_at,claim_token_hash,feedback_observed,result`

`DeviceCommandEvents`:
`event_id,command_id,device_id,event_type,occurred_at,details`

`DeviceCommandNonces`:
`nonce,expires_at`

## Deployment gate — stop if any item is unknown

1. Verify the **actual deployed** Apps Script project and deployment version contain the current GEN3 entrypoint and all three command modules. Repository files alone do not prove deployment.
2. Confirm GAS script properties and Render environment variable names/values correspond, without exposing credentials.
3. Inspect the target spreadsheet ID and exact headers; never silently create tabs or modify production data.
4. Verify authorized actor/session trust boundary, device registration and binding, nonce replay behavior, tamper rejection, command expiry, duplicate prevention and failure reporting.
5. Run offline CI and then controlled end-to-end tests. Do not enable physical unlock until independent authorization and hardware safety checks pass.
6. Keep `IKEY_PHYSICAL_UNLOCK_ENABLED=false` and `IKEY_GAS_COMMAND_TRUST_VERIFIED=false` until the deployment and security gates have been explicitly approved.

## Known blockers

- The last observed production workbook did not contain the four command-related sheets. Re-read metadata before provisioning.
- No confirmation yet of the deployed Apps Script project contents or its active deployment version.
- The command actor identity currently originates in Render; verify its authenticated-session derivation and device binding before enabling.
- The nonce ledger reads all rows on each command, so throughput and archival strategy require validation before production scale.
- The maintenance helper does not independently acquire a lock; only call it from a controlled locked maintenance entrypoint.
- Do not deploy to production, change `main`, mutate the production workbook, or actuate hardware as part of this staging gate.
