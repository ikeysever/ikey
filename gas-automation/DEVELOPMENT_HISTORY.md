# GAS Automation DEVELOPMENT HISTORY

## 2026-11-02 — Read-only foundation

Status: staged, NOT remotely validated. No GAS writeback implementation or permission.

### Evidence and decisions
- Base main: b755128181f8f27dd99b645db58650a0b6f836e6; main unchanged.
- Repository is public. Never commit remote private source, credentials or source backups.
- Read all three current main workflows. Existing sync-apps-script.yml manually pulls then copies gen3-auth/Code.gs and runs clasp push --force. It has no approval, concurrency baseline or backup. Never execute it.
- GitHub gen3-auth contains Code.gs, core.js, routes.js, sheets-store.js. These are not a confirmed full remote GAS inventory.
- Browser verified repository secrets GEN3_APPS_SCRIPT_KEY, GEN3_APPS_SCRIPT_URL and newly user-created IKEY_GAS_AUDIT_CLASPRC_JSON. No values read. IKEY_CLASPRC_JSON absent.
- User reported revoking previously disclosed OAuth credentials and logging in again. Do not preserve disclosed values. Secret name is isolation from the legacy workflow, not an OAuth permission boundary; current project scope can write source.
- Created feature/gas-automation-staging from exact base. No other development branches changed.
- Use Apps Script projects.getContent GET to read complete HEAD, not Web App business routes. Only OAuth refresh uses POST. No execute, push, deployment, Sheets or Render operations.
- Keep source snapshot in private runner temporary directory; always delete it. Print metadata and SHA-256 only, no artifact upload. Credentials are confined to one step environment and never written to disk.
- Mapping remains empty intentionally. All remote files are unmapped until actual inventory and reviewed source correspondence exist. Added/deleted/modified/same categories only apply to explicit mapping.

### Tests and verification
- Local node --check passed.
- Five synthetic node:test tests passed: Unicode complete inventory; missing manifest/duplicate rejection; unmapped distinction; mapped difference categories; exact byte hashing and traversal rejection.
- These are audit utility tests, NOT admin/session/timeout/idempotency business tests. Those require a private full baseline and remain pending.
- GitHub Actions UI does not register the new dispatch-only workflow on this non-default branch; direct workflow page reports workflow not found. Remote OAuth and GAS read are NOT verified.
- No main modification is authorized. Do not merge merely to make workflow_dispatch available.

### Commits before this log
- 209d1ba0cc81c2e83fe822e658e0a08aefe7013f audit tests
- cf42655808df712b90270f993d2e7ea42a2c8de9 audit tool
- 6b53de2ccc411c54f05a8ffbae6e093898cf9e46 empty mapping
- 5120196e9c6857f5616852b0932435ab256a423d manual read-only workflow

### Blockers and next steps
1. Resolve dispatch-only registration without changing main: use an independently approved private automation repository/default branch, or explicitly revise hosting constraints. Do not silently add push/pull_request triggers for credential use.
2. Run reviewed audit at pinned commit in authorized host; verify OAuth and newest full inventory.
3. Establish explicit mapping; report unmapped GitHub helper files separately. Store private full baseline and backup in controlled private storage before any edits. This public repository cannot host it.
4. Build private edit workspace and actual mocked business tests (admin authorization, sessions, expiry, duplicate prevention, errors). No production accounts or Sheets.
5. Only after stages 1–3 complete, design auditable approval gate bound to exact commit and remote inventory hash, full diff, preserved file set, backup and post-write verification. Web App deployment approval must remain separate. No writeback workflow currently exists.

### Recovery
No production changes made; production rollback is unnecessary. Revert staged audit commits on the staging branch to remove this tooling; never force-reset other work. Revoke OAuth and remove audit secret if authorization must be withdrawn. Never run the legacy sync workflow.

### Future ChatGPT requests
Specify feature, files and expected behavior, require latest private GAS baseline, request tests and a staging PR. A PR or manual dispatch is not writeback approval. Until remote validation and private source workspace exist, do not claim automatic read/edit/write capability.
