# iKey other settings write release gate

Code prepared in PR for admin-only PATCH /api/projects/:id/other-settings.

**Do not merge or deploy until Google Apps Script is published and verified.** Current production GAS is not confirmed to implement `projectSettingsUpdate`. Publishing only Render would expose a save button that returns HTTP 503.

Required before merge:
1. Deploy updated `gen3-auth/Code.gs` **and** `gen3-auth/project-data.gs` from `feature/project-visual-design-sync-new11` to the existing Generation 3.1 Apps Script Web App; preserve script properties and existing authentication behavior. Ensure Projects and Project_Access schemas match the versioned source.
2. Verify Apps Script `projectSettingsUpdate` using a test project: owner succeeds, non-owner denied, invalid fields denied, active/inactive and schedule changes read back from Google Sheet, audit event recorded.
3. Confirm Render's GEN3_APPS_SCRIPT_URL points to the published deployment; then merge this release PR and deploy Render.
4. Test real browser status/auth/schedule save, reload persistence, failed request, cache invalidation, and login/logout.

No unverified success claims; never update production GAS or main without the release gate.
