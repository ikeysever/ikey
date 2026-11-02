# iKey 3.1 — device command remediation status

Branch: `fix/device-command-safety-20261102`
Scope: GitHub source only. No production Render, GAS, Sheets, main, or physical actuation changed.

## Source fixes committed
- Physical unlock defaults to disabled; serial `u` actuator bypass removed; maximum hardware attempts reduced to one.
- ESP32 uses project-scoped POST claim and POST report API, with claim proof and feedback result.
- ESP32 project UUID is configured explicitly and checked against command project and device ID.
- A pending report is persisted in NVS before hardware execution; retry is prioritized before any new claim.
- A bounded 8-command NVS replay ledger replaces last-command-only dedup.
- Invalid NVS, claim proof, project ID, command ID, or command deadline fails closed.
- Reauthentication does not restore a stale bearer token after authentication failure.
- Report outbox is cleared only after a successful JSON acknowledgement.
- Source-level static assertions checked 10 contracts; all passed on 2026-11-02. This is **not** a compiler, integration, or hardware test.

## Remaining release blockers
1. **Compile ESP32 firmware** using the actual Arduino ESP32 core and ArduinoJson; no compile was run.
2. **Claim response loss** after server commits a claim needs recoverable idempotent claim or server reconciliation. An 8-entry replay ledger is a bounded mitigation, not durable global exactly-once semantics.
3. **Crash ambiguity**: the pre-execution persisted `failed` result means `not verified succeeded`, not a trustworthy assertion that the actuator never moved. Add explicit `unknown` or `interrupted` state to backend contract before physical enablement.
4. **Claim token in NVS**: flash encryption and secure provisioning require review; do not assume credentials are protected at rest.
5. **GAS deployment and schema**: verify live dispatcher, required command tables, nonce replay handling, secrets and identity mappings through approved read-only methods; no live verification performed.
6. **Device identity contracts**: reconcile Devices vs Project_Devices vs staging device registry with tested migration and authorization invariants.
7. **Two create-command endpoints**: verify clients and consolidate with compatibility tests; do not delete an existing public route blindly.
8. **Release branch divergence**: select and cherry-pick only reviewed commits onto a fresh main-based candidate; avoid merging all 149 staging-only commits.
9. **Physical safety**: independently verify relay polarity, safe-off, separate supply, flyback suppression, current/thermal limits and feedback wiring.
10. **Full tests**: execute automated unit, failure injection, concurrency, reset/retry and end-to-end no-actuation tests before any deployment.

## Release gates
Keep `IKEY_PHYSICAL_UNLOCK_ENABLED=false` and `IKEY_GAS_COMMAND_TRUST_VERIFIED=false`.
Keep firmware `PHYSICAL_UNLOCK_APPROVED=false`.
Do not merge or deploy without separate explicit authorization.
