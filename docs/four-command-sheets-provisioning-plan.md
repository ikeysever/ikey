# iKey 3.1 — four command sheets provisioning plan (NO EXECUTION)

Status: **PLAN ONLY**. No production workbook writes, GAS deployment, Render changes, or hardware activation are authorized by this document.

## Target and current observation
- Target workbook: `iKey_Database` (spreadsheet ID `1vOfpbIQ4px03vip_4zDq1t2KlRP9vUeg4R9JJ0OMXnc`).
- Metadata rechecked 2026-11-02: existing tabs `Users`, `Gen3_Users`, `Auth_Tokens`, `Auth_Sessions`, `Auth_Audit_Logs`, `Projects`, `Project_Access`, `Devices`.
- All four tabs below were **absent** at that check. Re-read metadata immediately before any authorized execution; abort if the workbook identity or existing sheets differ.

## Proposed new tabs (row 1, exact order; no seed data)

1. `Project_Devices` — 10 columns:
   `binding_id | project_id | device_id | display_name | lock_mode | heartbeat_interval_minutes | auto_firmware_update | bound_by | bound_at | updated_at`
2. `DeviceCommands` — 15 columns:
   `command_id | project_id | device_id | actor_user_id | action | idempotency_key | fingerprint | status | created_at | deadline_at | claimed_at | finished_at | claim_token_hash | feedback_observed | result`
3. `DeviceCommandEvents` — 6 columns:
   `event_id | command_id | device_id | event_type | occurred_at | details`
4. `DeviceCommandNonces` — 2 columns:
   `nonce | expires_at`

All columns must be created as plain text headers in row 1. Do not insert sample identities, commands, events, or nonces. Treat timestamps as epoch milliseconds (numeric) as expected by the GAS command code. Preserve command IDs, nonce and hashes as strings. Avoid formulas in command data.

## Authorized execution procedure (future only)
1. Obtain explicit user approval to add exactly these four tabs to the production workbook; approval of this **plan** is not approval to execute.
2. Re-fetch workbook metadata, confirm its ID and the eight existing tabs; stop on any unexpected conflict or duplicate name.
3. Create only the four missing tabs with exact names, one header row each; never overwrite an existing tab, change existing data, or deploy code.
4. Read back metadata and each new `A1` header range; compare names, count and order against this plan and the GAS code. Stop and report mismatches rather than silently changing them.
5. Record the operation date, spreadsheet ID, created sheet IDs, header verification result and any errors in development history. Do not log secrets or personal records.
6. Leave physical-unlock flags disabled. Treat schema creation as **not** proof that GAS deployment, authentication, end-to-end execution, or hardware safety are ready.

## Preflight / rollback
- Take a verified backup or export before any approved mutation; retain original eight tabs unchanged.
- If a partial creation occurs, do not automatically delete sheets. Report exactly what was created and request separate authorization for rollback.
- Restrict edit access to authorized service operators; do not weaken existing workbook sharing permissions.
- Fail closed if any sheet is missing or has a wrong header. Confirm deployment's `GEN3_SPREADSHEET_ID` points to this workbook without printing credentials.
- `DeviceCommandNonces` requires a later locked maintenance entrypoint and retention policy validation; its presence alone is insufficient for production scale.

## Acceptance checklist
- [ ] User explicitly approves production tab creation
- [ ] Fresh metadata confirms workbook and no naming conflicts
- [ ] Backup verified
- [ ] Four new tabs exist with exact ordered headers, and no data rows
- [ ] All eight original tabs preserved
- [ ] GitHub CI passes, deployed GAS source/version independently verified
- [ ] Secrets/configuration correspondence verified without disclosure
- [ ] Controlled command-chain security tests pass before any physical unlock

Source of header contract: `gas/device-command-actions.gs`, `gas/device-command-trust.gs`, and `docs/gas-command-dispatch-integration.md` on staging.
