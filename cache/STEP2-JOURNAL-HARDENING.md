# iKey 3.1 | Step 2 journal hardening handoff (2026-11-09)

Scope: **GitHub staging branch only**, no deployment or data mutation.

Files:
- `gas/staging-journal-guard.gs`: validates contiguous journal sequences, payload, revision; rejects uncommitted tails; opt-in write-through helper holding script lock.
- `cache/staging-journal-guard.test.js`: eight isolated Node VM test cases.

Verification:
- Eight equivalent scenarios executed against the exact fetched GitHub guard source in an isolated JavaScript VM: 8 passed / 0 failed.
- Persistent Node test file was committed, but **`npm test` and GitHub CI have not been verified**.
- No real Apps Script execution or end-to-end test.

Important blocking limitations:
1. **Not transactional**: a source mutation can succeed while journal append fails. Without a database transaction this cannot be automatically rolled back or safely replayed.
2. The new audit guard is **not wired into the existing `ikeySyncRead_`**; existing GAS prototype must not be deployed or used as a production sync endpoint.
3. All writers must participate in the same lock and change log. Existing GAS handlers and direct spreadsheet edits do not.
4. Manual recovery needs independently verified source state, journal state and an idempotency key; do not auto-repair a pending journal tail.
5. Staging-only property guard in the earlier prototype remains in effect. User's observed GAS deployment likely points to production Spreadsheet; do not push the prototype there.
6. Snapshot pagination revision checks cannot protect against out-of-band writers.
7. No user/session/device authorization data may be cached.

Next: implement an isolated, transactionally safe writer or reconciled outbox, integrate the audit guard into the read path, run `node --test cache/*.test.js`, then verify with a separate test GAS before production deployment.
