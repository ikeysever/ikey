# GAS synchronization protocol — staging proposal (2026-11-09)

The deployed `db.select` is limited to 100 rows and has no continuation cursor. **This adapter is not connected to the deployed GAS.**

## Proposed contract for a separately authorized staging GAS
Injected `request({action,namespace,cursor,pageToken,limit,signal})` must support:
- `snapshot.page` (initial), `changes.page` (incremental).
- `{complete:true,revision:'stable-revision',rows:[...],nextPageToken:null|'token',nextCursor:'cursor'}`.
- Each row: `{id:'id',version:integer,deleted:boolean,value:{...}}`; tombstones omit value.
- All pages in a logical batch must share one **consistent snapshot revision**. `complete:true` must be attested by source, not guessed from page length.
- Snapshot revision is a valid incremental cursor. Every incremental page reports the same complete-batch nextCursor.
- Incremental results include all updates and tombstones after the previous cursor. Expired cursor errors, never silently returns an empty list.
- Render-to-GAS authentication, table/field allowlist, bounded payloads, and consistent pagination are required.

## Safety
- No existing Express routes import this adapter; no production calls are made.
- No caching of sessions, passwords, user authorization, or device commands.
- Announcement publish/schedule/expiry filtering and public-field allowlist must be applied before exposing cached records.
- Do not start a 10-second sync timer until independent staging GAS and Sheets are verified.
- Do not merge this diverged branch wholesale without reviewing differences.

## Test
Run `node --test cache/gas-sync-adapter.test.js`. Mock protocol tests were run locally (10 passed, 0 failed). GitHub CI and actual staging GAS integration remain unverified.
