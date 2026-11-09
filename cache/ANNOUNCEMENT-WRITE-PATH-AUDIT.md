# Announcement write path audit — 2026-11-09

Branch: `feature/preloading-3-1-staging`. This is a **non-deployed integration boundary**, not a working announcement API.

## Source audit
- `server.js`: inspected all 288 lines for announcement routes; no dedicated announcement create/update/delete HTTP routes found. Project and device handlers exist, but must not be reused as authorization.
- `gas/generic-db-engine.gs`: generic `db.insert`, `db.update`, `db.delete` support arbitrary allowed tables. Each mutation takes a script lock and writes directly to its sheet. **No journal integration** and **no announcement-specific permission check** inside the generic engine. `db.delete` is soft-delete only and requires `status`.
- `gen3-auth/Code.gs`: has `doPost`; the deployed production GAS files seen by the user include other modules not present in this repository, so repository inspection cannot certify all live write paths.
- `gen3-auth/routes.js`: authentication router explicitly not mounted live; it is not an announcement controller.
- `cache/staging-journal-guard.gs`: intent-first helper is not called by the generic engine and lacks durable idempotency enforcement.

## Staging-only implementation
`cache/announcement-mutation-adapter.js` provides an opt-in `makeAnnouncementMutator` requiring injected `authorize` and `writeJournaled` functions. It validates create/update/delete, announcement ID, operation ID, payload, explicit authorization, and a verified committed revision. It **never falls back to generic db writes**. Not mounted in `server.js` and no direct GAS dispatch added.

The injected `authorize` MUST verify a trusted server-resolved session, super-admin role and scope. The caller must NOT trust client-provided actor information. `writeJournaled` MUST be a reviewed, operation-ID-deduplicated GAS endpoint that records the actual mutation with the intent-first journal. No such verified endpoint currently exists. The operation ID is only validated by the adapter, **not deduplicated**; do not interpret it as retry-safe.

## Verification
Seven isolated JS scenarios executed against the fetched committed adapter source: 7 passed, 0 failed. A persistent Node test file is committed. Full repository `npm test`, CI and GAS E2E remain **unverified**. The current repository staging branch's workflow run list showed only old runs (last inspected run SHA not current), so no new CI success is claimed.

## Blocking tasks
1. Inspect actual production GAS announcement handlers (read-only) and full source before any patch.
2. Define announcement authorization and operation-ID idempotency persisted server-side.
3. Implement journaled create/update/soft-delete within one script lock and verified recovery.
4. Integrate via an opt-in route after authorization tests and schema validation.
5. Execute full checkout tests and isolated GAS E2E. Do not deploy without acceptance.

No `main`, Render, live GAS, live Sheets, or device unlock changes.
