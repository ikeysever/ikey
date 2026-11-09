# LINE code-binding staging storage contract — 2026-11-09

Status: **design + mock only**. No live GAS, Sheets, Render, or login changes. This contract extends the existing `lib/line-code-binding.js` format (`IK-XXXX-XXXX`) and requires a separate, reviewed GAS deployment before activation.

## Read-only audit
- PR #117 is a draft on `feature/line-code-binding-staging`.
- Existing Render POST `/api/line/webhook` verifies the signature over raw request bytes; it acknowledges only a signed, empty event array. Real events remain 503.
- Existing `/api/line/bind/start` and `/api/line/unbind` remain 503; `/api/line/status` is unavailable.
- Existing Gen3 session derives identity from the HttpOnly `ikey_gen3_session` cookie and `resolveSession(hashToken(cookie))`, NOT a browser user_id.
- The 10-file 20261109 GAS snapshot has `doPost`, `execute`, `HEADERS`, `TABS`, and `locked`; its header identifies a **V14 diagnostic candidate**. It is not proven identical to the live editor version.
- Existing `LINE_Bindings` columns: `binding_id,user_id,line_user_id,line_display_name,status,bound_at,unbound_at,updated_at`. Do not alter this header.
- Missing `iKey_DeviceAuth_Verify.gs` and `iKey_DeviceAuth_Lookup.gs` were not fabricated.

## Proposed staging-only Sheets schema (NOT CREATED)
`LINE_Bind_Challenges`:
`challenge_id,user_id,code_digest,status,created_at,expires_at,used_at,failed_attempts,last_attempt_at,created_session_hash`

`LINE_Webhook_Events`:
`event_id,event_type,status,created_at,processed_at,result`

Use exact column sequences with fixed `HEADERS` only after validating isolated staging Sheets. Original code, LINE user IDs, session tokens and secrets must never appear in audit records. Do not include `created_session_hash` in any browser response or logs.

## Dedicated GAS action names (not wired to production)
`lineBindingCreateChallengeAtomic`, `lineBindingConsumeChallengeAtomic`, `lineBindingGetByUser`, `lineBindingUnbindAtomic` and `lineBindingRecordWebhookEventAtomic`.

Dispatch only these named actions from the authenticated `doPost`; no generic `db.*` access. All actions must validate their own caller context. Challenge creation/lookup/unbind must re-resolve and validate the actor session under `LockService.getScriptLock()` (and recheck account status); do not trust browser user_id. Webhook consumption must be server-only after signature validation. Use a separate server-to-GAS authorization assertion or dedicated scoped credential to prevent a leaked generic `GEN3_API_KEY` alone from impersonating a signed LINE event. Validate binding code HMAC server-side; avoid duplicating the secret in GAS.

### Atomic behavior
- **Create:** reject disabled user; enforce shared persistent issuance rate limit and at most one pending challenge/user; revoke old pending challenges; persist HMAC code digest, `expires_at = created_at + 300 s`; return code only once to authorized authenticated browser. A failed durable write must not reveal code.
- **Consume:** require validated LINE `source.type=user`, `webhookEventId`, and HMAC digest. Under ONE script lock, check event idempotency and code expiry, challenge pending/unconsumed, active original user, one active binding per LINE ID and one active LINE binding per iKey user. Mark one-time challenge consumed; append binding and audit; mark event processed before acknowledging HTTP 200. If any append fails, fail closed and reconcile partial writes on retries; LockService serializes concurrent script calls but **Google Sheets writes are not ACID transactions**.
- **Replays:** duplicate processed webhook event must not create extra binding. Pending or partially processed event needs safe reconciliation; transient failure should return non-2xx, not a false success.
- **Brute force:** HMAC protects offline lookup but does not replace online rate limiting. With 8 symbols from the existing 32-symbol alphabet, use persistent global/IP/LINE-ID attempt throttles and retention of failed event outcomes. Unknown codes must be throttled without incrementing an identifiable user's challenge unless known.
- **Unbind:** only for current authenticated session, same-origin/CSRF-protected POST with an explicit confirmation step; lock and audit.
- **Status:** session-scoped read with no raw LINE ID or private data exposed by default.
- **Timeouts:** calls may time out after a successful GAS write. Always rely on event idempotency and read-after-write reconciliation, never blindly repeat a mutating operation.

## Mock acceptance matrix
- Expiry boundary and once-only consume.
- Code reissue invalidates prior challenge.
- Same LINE ID cannot bind two users; one account cannot gain two active bindings.
- Parallel consumption of a single challenge yields exactly one winner.
- Duplicate event ID produces an idempotent outcome without a second binding.
- Disabled user, unknown code and invalid event are rejected.
- No new production API is activated; `server.js` and `lib/line-ingress.js` stay fail-closed.

## Activation dependencies
1. Compare the actual deployed GAS editor code against all candidate snapshots; obtain missing files for complete inventory.
2. Provision separate staging Apps Script + staging spreadsheet; validate schema header and locking with concurrency/fault-injection.
3. Implement the secured GAS action dispatcher and the server adapter; test provider redelivery and recovery from partially written rows.
4. Verify all CI suites and LINE signed real-event end-to-end only against staging.
5. Obtain explicit separate approval before release, merge, or production deployment.
