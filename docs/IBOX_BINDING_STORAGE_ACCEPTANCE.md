# iBOX binding storage release gate

Status: **NOT VERIFIED — feature remains disabled**.

The Render endpoint `POST /api/projects/:projectId/devices/bind` is guarded by
`IKEY_DEVICE_BINDING_ENABLED === 'true'`. Do not set this flag in production until
the deployed GAS writer has been inspected and tested.

## Required storage contract

- `db.insert` into `Project_Devices` must validate the exact allowed columns,
  `device_id`, and `binding_id`; no caller-supplied arbitrary columns.
- Under a **single GAS ScriptLock**, check **all** existing
  `Project_Devices.device_id` values and reject any duplicate, including across
  different `project_id` values. Check and append must be within the same lock.
- `binding_id` uniqueness alone is not sufficient unless GAS also verifies that
  it is exactly the normalized `device_id` and that all prior rows obey this
  invariant. Legacy rows may have UUID binding IDs.
- The writer must return `inserted: true` and the persisted record only after a
  verified append; ambiguous failures must not be retried blindly.
- Never expose device password hashes through browser-facing API responses.
- The web API's pre-insert `db.select` is only a usability check and **does not**
  prevent concurrent cross-project bindings.

## Isolated acceptance tests (never use live devices or production sheet)

1. Empty test sheet: bind factory device A to project P1, expect one row.
2. Repeat A in P1, expect conflict, still one row.
3. Concurrent bind A in P1 and P2, expect exactly one success and one persisted row.
4. Prepopulate a legacy row with `binding_id != device_id`, then try A in P2:
   expect conflict.
5. Invalid factory password: no row added.
6. GAS timeout / unknown result: no success response from Render, inspect sheet
   before retry.
7. Missing ScriptLock or malformed response: fail closed.
8. Confirm all test results with actual deployed GAS source/version and sheet
   snapshot, not merely regex-based CI checks.

## Deployment criteria

Only after the above are verified: add true integration tests, review the PR,
merge into main, deploy Render, and enable the feature flag deliberately.
Physical unlock is outside this change.
