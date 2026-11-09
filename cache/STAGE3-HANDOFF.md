# iKey 3.1 Stage 3 — staging GAS prototype, NOT DEPLOYABLE YET

## Verified isolation
- Independent Spreadsheet found: iKey-Gen3-GAS-STAGING-DATA (six tabs, including System_Announcements).
- Independent Apps Script project ID and its Script Properties have **not** been verified. No GAS deployment or data writes performed.
- Proposed new tabs Cache_Change_Log and Cache_Sync_State do **not** exist yet and were not created.

## Added
- gas/staging-cache-sync.gs: opt-in, staging-ID-gated read-only pagination and change-log helper. It does not replace doPost or enable itself.
- cache/staging-gas-sync.test.js: mocked Apps Script tests for pagination, tombstones, revision changes, isolation gate.
- cache/gas-sync-adapter.js: ordered duplicate-ID incremental event folding, keeping the latest tombstone.

## NOT safe for production
- Business write paths are not yet wired to the journal under the same lock. Direct Sheets edits are invisible to the change feed.
- Cross-request pagination consistency is checked by revision only; every writer must increment that revision, and existing production writers do not.
- Journal append and revision advance are not a transactional database commit. Failures between these operations require reconciliation and replay rules before deployment.
- No backfill/retention, cursor expiry, permission-safe public announcement filtering, or durable restart recovery is implemented.
- Existing db.select has no pagination support. No real GAS endpoint was changed.
- Never expose raw cached announcement records before status, schedule, expiry, authorization and field allowlist checks.
- No 10-second timer or Render API integration is enabled.

## Verification
- GitHub file writes were confirmed. Local node tests and GitHub CI are **not yet verified** for this stage (network restrictions prevented fetching branch files into the local test runner).
- Run node --test cache/*.test.js in a checkout of this staging branch before considering integration.
- Next gate: obtain and verify independent staging Script ID and staging Spreadsheet Script Properties, implement journal-backed write-through and transactional consistency, then run isolated end-to-end tests.
