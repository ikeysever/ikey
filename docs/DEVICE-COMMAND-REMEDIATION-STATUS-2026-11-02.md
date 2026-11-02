# iKey 3.1 device command remediation — work in progress

Branch: `fix/device-command-safety-20261102`
Scope: GitHub source only. No production deployment, GAS writes, Sheets changes, or physical actuation.

## Changes committed
- Fail-closed physical actuation flag; serial local unlock shortcut removed; maximum attempts reduced to one.
- ESP32 now targets the project-scoped claim/report endpoints instead of the in-memory simulator routes.
- Pending result and claim proof are recorded in Preferences before actuation, and a pending result is retried before claiming another command.
- Explicit configured project UUID is checked against the claimed project; command ID must be UUID.

## Important unresolved items — DO NOT ENABLE PHYSICAL UNLOCK
1. Compile and test firmware against Arduino ESP32 core and ArduinoJson. These source changes have not been compiled.
2. Device claim recovery: if the claim response is lost after GAS marks it claimed, backend must support idempotent re-claim or status reconciliation.
3. The ESP32 stores only the last executed command ID. Replace with durable bounded dedup ledger and durable report outbox; ensure NVS wear management.
4. The pending result is initially persisted as failed before actuation. After power loss, reconcile the ambiguous execution state explicitly; do not silently equate it with a verified hardware failure.
5. Ensure report retry after token expiry and lost HTTP response is idempotent and accepts an acknowledged terminal state.
6. Protect sensitive claim proofs in NVS; enable flash encryption or redesign short-lived proof persistence.
7. Verify the production GAS action dispatcher, four command tabs, trust secrets and device identity mapping. No verification of deployed GAS was performed.
8. Verify lock power supply, flyback suppression, current/temperature limits, feedback sensor and emergency disable before any hardware test.
9. Review dual create-command endpoints and consolidate them without breaking existing clients.
10. Rebase/cherry-pick reviewed changes onto a fresh main-based release candidate, and run full CI plus supervised integration checks.

## Release policy
`IKEY_PHYSICAL_UNLOCK_ENABLED=false` and `IKEY_GAS_COMMAND_TRUST_VERIFIED=false` until every gate is verified.
Do not merge this repair branch to main without separate review and authorization.
