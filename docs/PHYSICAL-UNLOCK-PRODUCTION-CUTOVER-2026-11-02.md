# iKey 3.1 physical unlock production cutover gates (2026-11-02)

Status: BLOCKED — do not deploy actuator routes until these are satisfied.

## Verified repository facts
- Production Render service `ikey` currently tracks `main`, autoDeploy off.
- `server.js` mounts `device-auth.js` and optionally `device-command-simulation.js`; it does NOT mount `lib/device-command-gateway.js`.
- `device-auth.js` issues 15-minute bearer tokens for rows in `Devices` with `status=pre_registered` and an eight-character uppercase ID.
- GAS candidate `gas/device-command-actions.gs` requires `Project_Devices` binding, `DeviceCommands` and `DeviceCommandEvents` tabs, plus intentionally missing trusted identity-context verifiers.
- `gen3-auth/sheets-store.js` does not allowlist command actions.
- In-memory simulation is not a production command backend; it is disabled by default.
- GAS and Render have different device-record contracts: `Devices` versus `Factory_Devices`/`Project_Devices`. Do not assume pre-registration implies binding or hardware authorization.

## Required integration work before physical activation
1. Implement server-side authenticated project-admin context from verified session; validate project/device binding against canonical records, not caller-supplied IDs.
2. Implement device bearer validation for command poll/report, rechecking credential status and project binding. Bind authenticated device identity to command device_id; do not trust request body identity.
3. Implement trusted server-to-GAS action dispatch and GAS verifiers. Current `GEN3_API_KEY` is only server-to-server authentication and cannot establish a user/device identity by itself.
4. Provision command tabs in a separate verified test spreadsheet and run actual GAS concurrency/partial-failure tests. Define reconciliation and event retention strategy.
5. Implement command-claim retry recovery for lost response, so device never re-executes after an ambiguous claim. Require durable command ID deduplication and report outbox on ESP32.
6. Verify lock driver independent supply, flyback suppression, safe-off default, current/temperature limits, lock feedback sensor and watchdog. Previous lock heating and intermittent release make physical activation unsafe without these checks.
7. Add explicit feature flag default-off for physical control and per-device emergency disable; preserve safe read-only website behavior when disabled.
8. Only after checks pass: review release diff, controlled deployment approval, smoke test without actuator, then supervised one-device unlock.

## Release decision
Do not change production `main`, Render environment, GAS deployment, live Google Sheets or physical GPIO from this document. No deployment performed.
