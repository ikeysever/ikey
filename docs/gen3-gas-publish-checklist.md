# iKey 3.1 — Apps Script production rollout checklist

## Current situation
The versioned Gen3 Apps Script sources in the development branch include the project membership, invitation, and settings actions. Publishing these files to the **existing** Gen3 Apps Script deployment is a separate action from merging GitHub code.

## Preflight
1. Open the existing Gen3 Apps Script project, not the legacy iKey database project.
2. Back up its current deployed version and note the existing deployment ID.
3. Confirm script properties GEN3_SPREADSHEET_ID and GEN3_API_KEY are present. Do not copy values to GitHub or logs.
4. Run inspectGen3Setup() in the script editor. Every required tab must report ok.
5. Confirm Project_Access header order matches the versioned HEADERS.Project_Access schema before publishing. Do not reorder existing populated columns without a migration.

## Publish
1. Copy the reviewed Code.gs and project-data.gs from the same approved commit; keep both files version-aligned.
2. Create a new version of the existing Web App deployment. Do not change deployment identity or execute-as settings unintentionally.
3. Keep the Render environment variables pointing to the verified Gen3 deployment. Never expose GEN3_APPS_SCRIPT_KEY in the browser.

## Acceptance tests
- Owner creates project and obtains an invitation code.
- Direct join works for a second account; approval join stays pending until reviewed.
- Unauthorized account cannot edit project settings, invite policy, membership, or other projects.
- Owner changes status, authorization mode and schedule; a new read returns the saved values.
- Invalid field and invalid origin requests are rejected.
- Audit history records privileged operations.

## Production gate
Do not merge PR #74 or PR #72 solely because a build passes. Require the published GAS version and actual database readback test results.
