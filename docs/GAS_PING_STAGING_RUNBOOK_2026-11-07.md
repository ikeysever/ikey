# iKey 3.1 — GAS staging integration checklist (2026-11-07)

## Scope and safety
- Branch: `feature/ibox-binding-verification-staging` (PR #101).
- No changes to `main`, production GAS, Render production, or live Sheets.
- No physical actuation: ping only.
- The GitHub staging source is versioned but is **not** a verified backup of the current live Apps Script project.

## Source verification and backup gate
1. Obtain the **current** Apps Script project source through an authenticated read-only channel (e.g. Apps Script API/clasp with an authorized account), not a Drive document describing a historic candidate.
2. Record project script ID (keep private), source file names, version and retrieval time; store source in a **private** backup location with access controls. Do not commit production secrets or credentials.
3. Compare the actual `doPost(e)` dispatcher with `docs/GAS_PING_DOPOST_INTEGRATION.md`. The historic V14 diagnostic candidate is not authoritative.
4. Confirm the dispatcher validates `GEN3_API_KEY` **before** routing any ping action. Confirm the actual success/error JSON envelope is `{ok:true,result:...}` or adapt the staging bridge only after checking the live contract.

## Isolated staging setup
1. Clone the GAS project to a separate staging Apps Script project and separate staging spreadsheet; do not reuse the live spreadsheet.
2. Add existing `gas-device-actions.gs`, `gas-device-authorization.gs` and all staging ping files to the isolated project:
   - `ikey-ping-command-actions.gs`
   - `ikey-ping-trust-verifier.gs`
   - `ikey-ping-nonce-ledger.gs`
   - `ikey-ping-dispatcher.gs`
   - `ikey-ping-authorization-adapter.gs`
   - `ikey-ping-preflight.gs`
   - `ikey-ping-route-seam.gs`
3. Keep the original `doPost` response/error behavior. After API-key verification and payload extraction, insert only:
   ```js
   const ping = ikeyPingTryDispatch_(action, payload);
   if (ping.handled) {
     // Use the existing success envelope to return ping.result.
     // Do not change legacy routes or exception handling.
   }
   ```
   Do **not** paste this incomplete routing sketch as a complete `doPost` implementation.
4. Provision the staging sheets with **exact** headers:
   - `Factory_Devices`: use `IKEY_FACTORY_HEADERS`
   - `Project_Devices`: use `IKEY_BIND_HEADERS`
   - `Device_Ping_Commands`: `command_id,project_id,device_id,action,status,created_at,claimed_at,reported_at,result`
   - `Device_Ping_Nonces`: `nonce,expires_at`
5. Configure staging-only `GEN3_SPREADSHEET_ID`, `GEN3_API_KEY`, `IKEY_COMMAND_TRUST_SECRET` (32+ bytes) and the existing actor/project access configuration. Secrets must not be stored in GitHub or firmware.
6. Run `ikeyPingPreflight_()` in the staging editor and require every check to pass before enabling the route.

## Test gate
1. GitHub CI: run `iKey GAS ping staging tests` including route-seam, crypto, authorization and command-store tests.
2. GAS isolated test: create → claim → report → status; verify project/device IDs, exact response envelopes, and duplicate report handling.
3. Negative tests: bad API key, missing signature, wrong actor/project, inactive factory device, wrong binding, expired signature, replayed nonce, wrong result, and unknown action.
4. Render staging bridge must use a **dedicated staging GAS URL** and secret, with feature flags disabled until verified.
5. ESP32 ping only; do not energize a lock or relay.

## Stop conditions
- Missing current GAS source or backup.
- Preflight not fully passing.
- Any response-envelope mismatch or unexpected permission acceptance.
- No dedicated staging spreadsheet or inability to keep staging credentials isolated.

## Progress accounting
This work advances preparation of the existing unfinished GAS integration item in the 23/32 baseline. It does **not** increase the completed count until the staging Apps Script integration and actual verification pass.


## Actual staging spreadsheet provisioned — 2026-11-07
- Dedicated Google Sheet: https://docs.google.com/spreadsheets/d/1dn__bGUmCAnGZTNOmvdc0QOUozmrGenpqbrNU3bb_CQ/edit
- Four tabs created and headers read back from Google Sheets:
  - Factory_Devices: device_id,credential_kdf,credential_salt,credential_hash,registration_status,registered_by,registered_at,updated_at
  - Project_Devices: binding_id,project_id,device_id,display_name,lock_mode,heartbeat_interval_minutes,auto_firmware_update,bound_by,bound_at,updated_at
  - Device_Ping_Commands: command_id,project_id,device_id,action,status,created_at,claimed_at,reported_at,result
  - Device_Ping_Nonces: nonce,expires_at
- This is a new empty staging spreadsheet; no production data or credentials copied.
- Fixed the previously incorrect factory/binding test fixtures in commit 0be49de97ad7e29c760f5d155faa80300005d463.
- The user has independently created an empty Apps Script staging project. Its script ID is not yet known to GitHub tooling, and no staging script upload or GAS deployment has occurred.
- Critical: no current full doPost source backup has been verified; do not deploy an invented replacement.
- Division of labor: assistant completes GitHub/Drive work in batches; user alone performs Apps Script editor operations, with precise instructions when a human action is required.


## One-file installation alternative (prepared 2026-11-07)
- Source: gas-staging/ikey-ping-staging-single-file.gs, commit 03c3c796bc91ee0d5a032690bb21693274171627. This concatenates the seven staging ping files without changing their logic.
- In isolated Apps Script staging, install this bundle **instead of** the seven individual ping files. Do not include both: duplicate top-level const declarations would cause errors.
- Existing original gas-device-actions.gs and gas-device-authorization.gs remain dependencies; the bundle does not recreate missing production source.
- No doPost included or activated. Actual existing doPost must be verified, backed up and adapted without changing legacy behavior.
- Staging spreadsheet exists with four headers verified, but secrets and staging GAS source have not been configured, so preflight has NOT passed.
- Never deploy or activate Render flags until these gates pass.


## Authorization contract tests added
- `test/gas-ping-authorization-adapter-contract.test.js` at commit `bf3d8d603bc8002f72e70fe12234951aeb6141e7` exercises inactive devices, invalid scope, wrong project, duplicate binding and denied web actor with isolated mocks.
- This does NOT verify the real legacy `ikeyVerifyDeviceActor_` return contract or substitute for a staging GAS execution. Keep the staging route disabled until original source is verified and backed up.


## Correction after user showed existing GAS editor (2026-11-07)
- The existing original Apps Script project is **iKey_Gen3_Auth_API**, with editor-visible files `程式碼.gs`, `SetupKey.gs`, `project-data.gs`, `iKey_AutoCheck.gs`, `gas-device-actions.gs`, `gas-device-authorization.gs`, `gas-device-trust.gs`, `device-command-actions.gs` and admin module(s). These files **exist in the original project**; do not describe them as missing from the original system.
- The newly created **iKey-Gen3-GAS-STAGING** is a separate test project containing the seven-module ping bundle, not a replacement for original GAS.
- Source screenshot establishes file presence only, not code correctness or deployment wiring. Do not overwrite or deploy original GAS.
- New read-only inventory utility `gas-staging/ikey-gen3-legacy-readonly-inventory.gs` inspects function availability and staging-related property/sheet presence without printing secrets or changing data. It has not been installed or run in original GAS.
- Next prerequisite for exact integration remains a read-only export of the **actual current original project**; the Drive V14 document is explicitly a candidate and cannot substitute.
