# LINE binding v2 — implementation and release gate, 2026-11-09

## Current implementation
Architecture Handoff V1.0 is the baseline, amended by the user's explicit Q06 decisions: five invalid six-digit submissions from one LINE identity within a rolling 15-minute window block that identity for 15 minutes from the fifth failure. Reissue does not clear the block. The user subsequently authorized implementation, commits, merge to main and deployment without repeated approval, and requested no further GAS editor use.

Six-digit strings (including leading zeros) use crypto.randomInt and versioned HMAC. Five-minute single-use challenges, collision checks, old-code revocation, bidirectional uniqueness, fresh password verification for unbind, CSRF and Origin checks, durable event deduplication and rate accounting are implemented. No OAuth is activated. No automatic webhook or message-send retries exist.

Invalid codes include unknown/expired/consumed/revoked codes. Conflicts, blocked submissions, duplicate events and infrastructure errors do not count as invalid-code failures. Issuance: 60-second account cooldown, five accepted issuance attempts/hour, 30/source/hour. LINE: ten verification attempts/minute, plus global 100/minute. These are implementation defaults, not guarantees against distributed attacks; load-test before activation. Source keys and LINE limiter keys are HMAC pseudonyms.

## Files and installation
- Node domain: lib/line-binding-domain.js; byte-identical GAS source: gas/line-binding-domain.gs.
- GAS adapter: gas/line-binding-v2.gs. Install both in the existing script project without removing any other files.
- The candidate gas/source-snapshot-20261109/程式碼.gs adds only the lineBindingV2 dispatch branch (after existing key verification). Its original content remains in Git history at 1db89cc70558a4c7dc71516c744359c6b8da7024. Do not replace the entire live project with the incomplete snapshot.
- Node transport/service/router and existing ingress are connected but disabled by default.
- public/account.html and public/account-line.js contain code display, countdown, reissue, polling, status recovery and password reauthentication.
- No generic db.* LINE allowlist changes; no independent challenge/event tables.

## Exact appended schemas
LINE_Bindings retains the first eight columns:
binding_id,user_id,line_user_id,line_display_name,status,bound_at,unbound_at,updated_at
Append:
challenge_id,code_digest,digest_version,challenge_status,challenge_created_at,challenge_expires_at,challenge_used_at,created_session_hash,operation_id

LINE_Audit_Logs retains the first seven columns:
audit_id,user_id,line_user_id,event_type,result,details,created_at
Append:
webhook_event_id,operation_id,processing_status,processed_at,line_subject_hash,blocked_until,notification_status

LINE_Notification_Preferences is unchanged. Add sufficient physical columns (Bindings 17; Audit 14) without moving existing columns or overwriting existing rows. Existing active rows remain readable; do not relabel them as pending.

## Failure semantics
All GAS operations use the same existing script lock, not a second project lock. Each authoritative mutation is preceded by a flushed, read-back verified processing intent. Bindings are written as a full row, flushed and read back; then the audit intent is finalized. A failed write can still have committed: exceptions leave a processing fence. Subsequent related account/LINE/code operations return unknown, including duplicate processing events. Never automatically replay a mutation or repair a fence. Manual maintenance must inspect operation ID and rows before authorizing repair. LockService does not implement rollback or ACID.

Completed duplicates are ignored. Different events using a spent code are invalid-code attempts. Notifications are claimed before the single send attempt; notification result is a separate audit row. A crash after claim may lose a notification. Notification outcome cannot change a confirmed binding. A multi-event request can have earlier events completed before a later failure; deduplication prevents reapplying earlier effects.

Read-only admin query hides LINE identifiers, digests, session/password data and exposes no admin mutation endpoint. Pending intent fences block new related operations; existing active bindings are retained. Full-table scans and a global script lock remain capacity risks. No cleanup scheduler or queue is introduced.

## Activation configuration (secret values must never enter Git or ordinary logs)
Render requires IKEY_LINE_BINDING_ENABLED=true, independent IKEY_LINE_TRUST_SECRET and IKEY_LINE_CODE_SECRET (each >=32 random bytes), LINE_MESSAGING_CHANNEL_SECRET and LINE_MESSAGING_ACCESS_TOKEN, plus existing Gen3 storage configuration. GAS requires IKEY_LINE_BINDING_ENABLED=true and matching IKEY_LINE_TRUST_SECRET in Script Properties. Signed action envelopes expire after 60 seconds and cover exact payload bytes. No passwords are logged; a verified current password hash is included only in the private signed unbind request so GAS can detect password changes before mutation.

Both switches default OFF. A matching signed GAS health response with exact v2 schema is required before each operation. Deploying Node alone does not activate binding. Keep LINE webhook provider settings unchanged until real signed-event verification and account quota checks pass.

## Tests and known limits
Offline Node v24.22.1: 92 tests, 92 pass. LINE-specific: 32 tests, 32 pass. Includes production GAS adapter in VM with fake Sheets, shared domain concurrency, every consume/reissue write failure, clock boundaries, rolling block, collision, auth/CSRF, password rejection, notification failure, duplicate delivery, polling stop and unknown-result handling. No live GAS, real LINE send, browser layout, actual concurrent GAS executions, formal load or restoration test has been performed.

Original commit independently tested: 74 tests, 64 pass, 10 fail. One LINE test incorrectly expected signed empty verification to return 503. Nine other failures were stale assertions: semicolon/strict session guard spelling; removed admin cards; cache.put implementation spelling; changed cache version; inventory local variable/order/error identifier; and removed project settings forms/routes replaced by immediate six-pane placeholders. Tests now check current behavior, preserving authentication, owner scope and API-cache exclusion checks. No corresponding login, project, admin or device production feature was altered to satisfy those tests.

## Deployment and rollback gate
The user authorized release. A Node-only release is safe with IKEY_LINE_BINDING_ENABLED=false; it must be reported as deployed disabled, not a working LINE launch. Previous live Render commit: 9b33d6ce72426e05a65f13add1a28a011e35b31b. Preserve manual deployment mode.

Before enabling: privately back up full Sheet and complete GAS source/version, verify restore in a copy, check LINE notification capability/quota, complete missing two device source files, apply schema and GAS code without replacing unrelated files, configure scoped secrets, run the 20 handoff cases against designated test accounts and real signed events. Existing read-only backup discovery is not proof of restoration.

If no non-editor GAS deployment/secret-management path is available, stop at disabled Node deployment. The read-only GitHub Actions capability job checks whether the existing IKEY_CLASPRC_JSON secret supports clasp pull; it prints only filenames and SHA-256, deletes source/credentials and never runs clasp push or a GAS function. It is not a backup, a deployment or proof of live-version equivalence.

On failure: disable LINE switches; preserve confirmed bindings; rollback Node to the captured live commit and GAS to captured version only if compatible. Never replace the entire database with an old backup. Resolve ambiguous rows individually with authorization and audit. A Node release does not change Sheets/GAS or LINE console settings.
