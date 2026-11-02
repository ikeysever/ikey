# iKey 3.1 command chain — consolidated pre-production gate (2026-11-02)

Scope: staging source review and offline tests only. **Not a production release approval.**

## Completed in staging
- Render HTTP routes for create/get and authenticated ESP32 claim/report are feature-gated.
- Four GAS actions are routed by the GEN3 dispatcher; GAS checks HMAC assertions, authorization, binding, command state and nonce replay ledger.
- Offline schema plan and GAS schema parity tests for four required tabs.
- GET now forwards verified `actor_user_id`.
- Offline tests cover Create/Get actor identity, Claim/Report device identity, signed payload digests, tampering and nonce replay, including direct execution of GAS verifier with mocked Apps Script services.
- No physical unlock or production data mutation performed.

## Blocking items (not inferred as completed)
1. **Production workbook:** `Project_Devices`, `DeviceCommands`, `DeviceCommandEvents`, `DeviceCommandNonces` are not yet provisioned. Requires explicit separate approval, backup, creation and read-back; never modify original eight tabs.
2. **GAS deployment:** inspect the actual active Apps Script project/deployment, not only GitHub. Confirm all modules and dispatcher are present and `GEN3_SPREADSHEET_ID` is correct.
3. **Secrets:** verify `GEN3_APPS_SCRIPT_KEY` equals GAS `GEN3_API_KEY`, and Render/GAS `IKEY_COMMAND_TRUST_SECRET` match (>=32 bytes), without exposing values.
4. **Auth and device lifecycle:** verify session-derived `req.projectUser`, per-request device token validation, project admin/owner rights, preregistration and explicit project-device binding with controlled test cases.
5. **Cross-system behavior:** offline GAS verification is not a live integration test. Test expired/replayed/tampered assertions, retries, duplicate create, claim races, deadline, report, offline device, and failure recovery with controlled, authorized data.
6. **Hardware:** validate independent lock supply, flyback suppression, heating, actuation feedback, watchdog and safe-off behavior before any real relay action. The lock previously showed overheating and intermittent release.
7. **Scale/maintenance:** nonce ledger currently scans rows and pruning requires a separate locked maintenance entrypoint; review performance and retention.
8. **Release controls:** keep `IKEY_PHYSICAL_UNLOCK_ENABLED=false` and `IKEY_GAS_COMMAND_TRUST_VERIFIED=false` until the above are approved and verified.

## Explicitly excluded
- No production Google Sheets changes, Apps Script deployment, Render deployment, `main` branch modifications, or physical lock activation.
- No claim that passing GitHub CI proves the deployed command chain works.

## Next authorization boundary
Obtain a separate, narrowly scoped instruction before creating production tabs or changing deployment configuration. Verify live state again immediately before any authorized change.
