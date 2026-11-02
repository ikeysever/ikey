# iKey 3.1 — isolated GAS command test contract

Status: **STAGING ONLY / NOT DEPLOYED**. This is a candidate schema and test plan, not evidence of successful GAS execution.

## Required isolated spreadsheet tabs

### DeviceCommands (exact header order)
```csv
command_id,project_id,device_id,actor_user_id,action,idempotency_key,fingerprint,status,created_at,deadline_at,claimed_at,finished_at,claim_token_hash,feedback_observed,result
```

### DeviceCommandEvents (exact header order)
```csv
event_id,command_id,device_id,event_type,occurred_at,details
```

### Project_Devices
Existing `IKEY_BIND_HEADERS` contract from user-supplied `gas-device-actions.gs`:
```csv
binding_id,project_id,device_id,display_name,lock_mode,heartbeat_interval_minutes,auto_firmware_update,bound_by,bound_at,updated_at
```

## Integration guardrails
- Do not add `ikeyDeviceCommandAction` to production `doPost` until a separate review of the actual deployed dispatcher and authenticated Render routes.
- Required hooks `ikeyVerifyCommandActorContext_` and `ikeyVerifyCommandDeviceContext_` are **intentionally not implemented**. They must independently verify server-issued, tamper-resistant identity context. Merely returning true or checking payload actor IDs is forbidden.
- `GEN3_API_KEY` is a server-to-server credential, not proof of an end-user identity.
- The current candidate does not provide true multi-sheet ACID transactions. A failure between command row write and event append may leave a missing audit event; a failure during multi-cell claim/report updates may leave partially updated state. Recovery, reconciliation, idempotent event writes and fault-injection tests are blockers.
- Do not log claim tokens or credential verifier material. Do not expose raw command rows through generic `db.*`.
- No spreadsheet is created or modified by this commit.

## Test cases to execute against a disposable spreadsheet
1. Missing context verifier -> deny create, claim, report and get.
2. Inactive/non-admin actor and unbound/wrong-project device -> deny.
3. Create -> pending, duplicate same key -> duplicate, different fingerprint -> conflict.
4. Concurrent create -> at most one active command per device.
5. Concurrent claim -> exactly one claim; claim token hash stored, plaintext never in Sheets.
6. Wrong claim token, contradictory report, wrong device -> deny.
7. Expired pending/claimed commands -> timed_out; late report rejected.
8. Positive success requires observed feedback.
9. Inject failure after each individual Sheets write; reconcile incomplete command/event pairs.
10. Verify exact headers, quotas, lock timeout, retention and bounded query performance.

## Development history
2026-11-02: Added isolated candidate GAS command actions and proposed spreadsheet schema. No GAS deployment, no Render changes, no live Sheets writes, no hardware operation.
