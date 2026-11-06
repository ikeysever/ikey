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

## Render GAS transport adapter — 2026-11-06

Added `gen3-auth/ping-store-adapter.js` with strict allowlisting of the
four `devicePing*` operations, scope validation, and a required trusted
assertion; tests cover malformed inputs and invalid responses. This is a
transport adapter, **not an authorized HTTP endpoint**. The existing
`lib/command-trust-assertion.js` signer only accepts
`deviceCommandCreateAtomic`, `deviceCommandGet`,
`deviceCommandClaimAtomic`, and `deviceCommandReportAtomic`.
It does not sign `devicePing*` actions. Therefore the adapter must **not**
be wired to the live GAS dispatcher until both the signer and GAS verifier
agree on the exact actions, payload digest, replay rules and authorization
for Web users versus ESP32 device principals. No GAS deployment performed.

## Signed ping transport (staging only)

Render signer now permits `devicePingCreate/Claim/Report/Status`.
`gen3-auth/signed-ping-store.js` produces HMAC assertions using the existing
command trust secret and separates verified Web actor claims from device
principals. `gas-staging/ikey-ping-trust-verifier.gs` checks signature,
expiry, audience, action, scope and payload digest. Tests verify HMAC and
principal separation.

**Critical security gates remain:** GAS dispatcher has not been wired to the
verifier or queue; project owner and device binding authorization must be
checked server-side; CacheService replay checks are NOT atomic/durable and
must be replaced with a durable nonce ledger before deployment. Neither
production GAS nor Render has been deployed. This is staging implementation,
not an end-to-end success claim.

## Durable replay and permission gate (staging only)

Added `gas-staging/ikey-ping-nonce-ledger.gs` to atomically persist each
assertion nonce in `Device_Ping_Nonces` (`nonce,expires_at`) using ScriptLock;
replaced CacheService marker in GAS verifier. Added
`gas-staging/ikey-ping-dispatcher.gs` with fail-closed authorization callbacks
for Web project owners and authenticated bound devices. Runtime tests exercise
nonce reuse rejection and authorization denial. These callbacks are **not yet
bound to real GAS account/device records**, and the staging dispatcher is **not
registered with doPost**. Durable nonce rows must be retained at least through
expiry; operational pruning is still outstanding. Do not deploy until real
permissions, trusted device login, GAS routing and concurrency tests pass.

## ESP32 staging client (hardware-day smoke test)
`firmware/esp32-ikey-ping-staging/esp32-ikey-ping-staging.ino` is a
non-actuating HTTPS client for the isolated `/api/bridge-demo` endpoints.
It logs in, polls every 30 seconds and acknowledges only `ping`.
The Arduino sketch intentionally refuses to run until WiFi, device credentials
and a **verified TLS root CA PEM** are filled locally; secrets must not be
committed. ArduinoJson 7 and Arduino-ESP32 core 3.x are required.

This does **not** mean the deployed Render instance is ready: demo HTTP routes
require `IKEY_BRIDGE_DEMO_ENABLED=true`, a matching demo device ID and password,
and the backend must be deployed separately after explicit authorization.
The demo queue is memory-only, single-process, and unsuitable for unlocking.
The signed GAS ping transport is also not yet connected to live doPost or
real owner/device authorization callbacks. No main changes or deployment.
