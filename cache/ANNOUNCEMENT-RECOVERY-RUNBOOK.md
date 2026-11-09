# iKey 3.1 — Announcement journal recovery runbook (staging only)

## Safety boundary
This is a **proposal**, not a production-ready migration. No production GAS, Sheets, Render, or `main` changes are authorized by this document. The existing `ikeySyncRecordChange_` remains a legacy staging prototype and **must not be used as an announcement business writer**: it only logs and does not mutate the source.

## Intended write-through contract
1. Authenticate/authorize the announcement mutation **before** acquiring the lock (actual GAS authorization must be reviewed separately).
2. Acquire the same GAS script lock used by all announcement mutations.
3. Verify journal has contiguous committed sequences and no pending tail via `ikeyJournalAudit_`.
4. Append the intent (next sequence, record ID, tombstone flag, full post-mutation payload), flush.
5. Apply idempotent announcement source mutation while still holding lock; flush.
6. Advance committed revision; flush; audit again; release lock.

The staging helper `ikeyJournalWriteIntent_` implements steps 2–6 when the caller provides a source mutation callback, sheets, and lock. It does **not** install itself into any API handler and does **not** provide a database transaction.

## Failure states
- Lock unavailable: reject before writing.
- Journal append fails: reject before source mutation; however partial append is possible and must be inspected.
- Source mutation fails: intent is pending; sync reads and later writes fail closed.
- Revision update fails: intent remains pending; sync reads and later writes fail closed.
- Commit completes but client times out: request outcome is ambiguous; caller must not blindly retry without idempotency tracking.
- Out-of-band spreadsheet edits: journal cannot detect them. Require a complete resnapshot/reconciliation before enabling sync.

## Manual recovery (no automatic cursor advancement)
1. Disable all announcement writes/sync at the integration layer.
2. Back up source, journal and state sheets; record timestamp and revision.
3. Compare the pending intent payload with actual source row and independently verify authorization and whether the operation was applied.
4. Resolve by a reviewed operator procedure that preserves sequential history; do **not** delete rows or advance revision just to make audit pass.
5. Verify journal audit, full snapshot consistency, permission filtering and idempotency.
6. Resume writes and sync only after review and end-to-end validation.

## Unresolved before deployment
- Integrate the staging intent writer with the actual announcement create/update/delete handlers and permission checks.
- Ensure every source writer uses the same lock; reject direct spreadsheet edits or reconcile them.
- Add durable idempotency keys and deterministic retry semantics; journal currently lacks operation IDs.
- Add a recovery state machine / operator tooling, observability and bounded audit scans.
- Test simultaneous writers, network timeout, partial sheet write, source-write failure and stale snapshots.
- Run `node --test` on a complete checkout, GitHub CI, and isolated GAS E2E.

## Verification in this work session
Five additional scenarios were executed against fetched committed `gas/staging-journal-guard.gs` in a JavaScript harness: 5 passed, 0 failed. Persistent Node tests added to `cache/staging-journal-guard.test.js`; the full Node test suite and CI have **not** been run/verified. No deployment occurred.
