# iKey 3.1 — Device control integration contract (2026-10-28)

Status: **DESIGN / NOT DEPLOYED**. Scope: feature/esp32-device-auth-staging only. Do not merge or deploy based on this document alone.

## Verified baseline
- server.js and device-auth.js use generic db.* table `Devices` with `device_id,password_hash,status`; generic GAS DB default allowlist is `Projects`.
- User-supplied GAS device actions use `Factory_Devices` and `Project_Devices`; the deployed GAS version and actual Sheets schema have NOT been verified.
- User-supplied doPost validates GEN3_API_KEY before dispatching; this authenticates the calling service, NOT the human actor.
- User-supplied ikeyVerifyDeviceActor_ checks actor_user_id, active account, super-admin list or project admin access, but actor_user_id is supplied in payload.
- device-command-simulation.js stores commands and idempotency in process-local Maps; no persistent command store or physical verification.

## Target canonical model (proposal; migration requires verification)
- Factory_Devices: manufacturer identity and credential verifier, keyed by device_id. Never return verifier, salt or secret in browser responses.
- Project_Devices: binding_id, project_id, device_id, lock_mode, heartbeat policy and binding metadata; unique active binding per device unless an explicit reassignment transaction is approved.
- DeviceCommands: command_id UUID, device_id, project_id, action, requester_user_id (server-derived), idempotency_key, request_fingerprint, status, created_at, deadline_at, claimed_at, claim_token_hash, attempt_count, finished_at, outcome, feedback_observed, updated_at.
- DeviceCommandEvents: append-only command_id, event_id, device_id, timestamp, event_type, outcome and sanitized details. No credentials.
- Existing Devices table is a staging compatibility model, **not** an automatically authorized alias. Introduce an explicit adapter/migration after reading live schema; never auto-copy credentials or expand the generic db.* allowlist.

## Authorization contract
1. Browser -> Render: resolve and validate ikey_gen3_session, expiration, revocation, active user, same-origin/CSRF protection.
2. Render -> project authorization: verify actor is project admin or a specifically approved global super-admin; check active device binding to requested project. Do not treat creator-only /api/projects list as complete authorization.
3. Render -> GAS: use server-only GEN3_API_KEY; actor_user_id MUST be injected from verified server session, never accepted from request body. Prefer a dedicated authenticated action with server-side authorization context and GAS-side revalidation; do not expose device writes via generic db.*.
4. Device -> Render: signed short-lived device token plus active registration/binding check on every poll and report. Token does not confer human admin rights.
5. factoryDeviceCredentialGet: deny raw verifier/salt/hash disclosure by default. Any credential provisioning requires a separately reviewed one-time protocol.

## Durable command lifecycle
- pending -> claimed -> succeeded|failed; pending/claimed -> timed_out; terminal states immutable.
- Create: unique (device_id, requester_user_id, idempotency_key) + request fingerprint, under atomic transaction/lock; same key/same fingerprint returns existing command, mismatch returns conflict.
- Claim: atomically select one unexpired pending command for authenticated device, persist claimed state and single-use claim token before returning it; concurrent polls cannot claim twice.
- Report: device must present command_id, authenticated device identity and claim token; verify ownership, deadline and transition under the same lock. Duplicate identical terminal report is acknowledged without re-execution; contradictory report rejected.
- Timeout: enforce on read/claim/report and via scheduled reconciliation; expired commands never dispatched. Preserve event audit and command status across process restarts.
- GAS Sheets LockService is script-scoped only; all writers must use the same dedicated action/lock. A generic db.update without conditional state transition is insufficient for atomic claim.
- Define retention, command size limits, quotas, error semantics and recovery before implementation. Avoid raw credential logging.

## Firmware safety and replay handling
- GPIO23 relay active HIGH, <=500 ms energized / >=200 ms off, <=10 tries; stop immediately on GPIO25 HIGH; default relay OFF on boot/errors.
- Persist a bounded executed-command ledger (not only last_cmd) and a pending result outbox in NVS before/after actuation; never re-energize for a repeated command ID.
- On reconnect, retry only result transmission, not actuation. Use server deadline with clock-sync and fail-closed behavior; validate TLS CA and reject stale commands.
- GPIO25 HIGH proves configured lock feedback only, not cabinet-door closure; separate door sensor required.

## Test gates (all must pass before deployment review)
- Auth: anonymous, ordinary user, creator non-admin, project admin, global admin, cross-project actor, spoofed actor_user_id, disabled account, stolen/expired device token.
- Storage: restart persistence, parallel claim, duplicate create, idempotency conflict, duplicate/contradictory report, deadline race, unknown command, wrong device, lost report, backend retry, partial GAS failure.
- Firmware: Arduino compile for exact ESP32 board, TLS CA, GPIO23/25 bench validation, power/brownout, relay thermal limits, NVS replay and outbox recovery, real lock-open feedback, no unsafe repeat.
- Staging end-to-end using isolated test sheets and mock ESP32, followed by explicitly authorized physical test. Only then consider main and existing Render service deployment.

## Blockers / open verification
- Read actual deployed GAS source, doPost deployment version, real Sheets headers and IKEY_DB_ALLOWED_TABLES **without disclosing secret values**.
- Inspect full gas-device-actions.gs and project access role semantics.
- Decide authoritative credential migration and provisioning protocol; do not silently map incompatible hashes.
- Select dedicated durable command actions and storage schema after checking current GAS quotas/locking and service capacity.

## Change log
- 2026-10-28: Added design-only integration contract on staging branch; no production changes, no GAS changes, no hardware actuation, no implementation or tests claimed.
