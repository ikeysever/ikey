# iKey 3.1 — Main communication bridge acceptance (staging only)

Scope: Web → Render → GAS command storage → Render → ESP32 → Render → GAS → Web.
iBOX hardware scope is strictly battery, ESP32 and electromagnetic lock. This
document covers software only. No unlock command may be sent during bridge
verification.

## Verified in source
- Web project owner session middleware and project device binding route exist.
- Factory device credential lookup is an admin-authorized GAS action intended
  for the **Web owner binding flow**; it is **not** an ESP32 authentication API.
- `/api/health` is public and only confirms HTTP service availability.
- `/api/devices/:deviceId/commands` is a disabled placeholder, not a queue.
- The device protocol validation module and tests are now present at
  `gen3-auth/device-bridge-contract.js` and `test/device-bridge-contract.test.js`.
  They accept only `ping` test commands and cannot actuate a lock.

## Blocking interfaces to implement and verify
1. Device-scoped authentication: dedicated GAS action with no borrowed Web
   actor identity, server-side credential verification, replay protection,
   bounded session expiry and revocation.
2. Durable GAS command queue: create, poll/claim, acknowledge/report with
   project binding checks, atomic claim and idempotent completion.
3. Render authenticated device endpoints for login, poll and report.
4. Web session-protected test-command creation and status lookup.
5. ESP32 firmware using certificate-verified HTTPS and the device API.
6. Isolated full-chain tests, then explicit authorization for production
   deployment and physical testing.

**Never** treat CI success, a 200 health response, or the mock GAS binding
tests as proof that these interfaces are operational. The new bridge contract
is an input-validation layer only, not a working transport.

## GAS storage implementation staged — 2026-11-06

Added `gas-staging/ikey-ping-command-actions.gs` with a strict
`Device_Ping_Commands` sheet schema, ScriptLock-protected ping create/claim/
report/status, project+device scoping, and idempotent completion. Added
`test/ibox-gas-ping-queue-contract.test.js` for source-level invariants.

**Not integrated:** The live GAS dispatcher does not yet route these actions.
The code intentionally contains no caller authorization; the trusted GAS
dispatcher must validate the Render API key and verify the appropriate Web
actor or device session, including project binding, **before** invoking the
storage function. Never deploy this script standalone or expose its function
to an untrusted caller. Create an isolated test spreadsheet with exact header
`command_id,project_id,device_id,action,status,created_at,claimed_at,reported_at,result`
and verify concurrent claims, failures, permissions and rollback behavior.
No production GAS writes or deployments occurred.
