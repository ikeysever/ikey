# iBOX binding storage release gate

Status: **NOT VERIFIED — feature remains disabled**.

The Render endpoint `POST /api/projects/:projectId/devices/bind` is guarded by
`IKEY_DEVICE_BINDING_ENABLED === 'true'`. Do not set this flag in production until
the deployed GAS writer has been inspected and tested.

## Observed GAS source review — 2026-11-06

User-provided `project-data.gs` source was reviewed read-only. Its
`executeProjectData(action,p)` explicitly rejects any table other than
`Projects` (`if(name!=="Projects") throw Error("DB_TABLE_NOT_ALLOWED")`).
Its `db.select`, `db.insert` and `db.update` implementations only operate
on `Projects`; the `db.insert` branch requires
`primary_key === "project_id"`. Consequently this source **does not support**
`Project_Devices` reads or inserts, and the new binding endpoint cannot work
against this implementation. It is not yet established that this specific
source is the version deployed and used by Render.

**Release blocker:** identify the actually deployed GAS version, then add a
narrow, locked `Project_Devices` operation with atomic cross-project uniqueness
and dedicated isolated integration tests. Do not enable
`IKEY_DEVICE_BINDING_ENABLED` until that is verified. No production GAS
changes were made during this review.

## Observed GAS device actions — 2026-11-06

User-provided `gas-device-actions.gs` contains a separate device API:
`factoryDeviceList`, `factoryDeviceCredentialGet`,
`factoryDeviceRegister`, `factoryDeviceUpdate`, and `factoryDeviceBind`.
`factoryDeviceBind` acquires `LockService.getScriptLock()`, checks for an
active factory device, checks all existing `Project_Devices.device_id` values,
and appends under the lock. This is a promising atomic duplicate-prevention
implementation **provided all writers use the same lock**.

**Integration mismatch:** PR #101 currently calls generic `db.select` /
`db.insert` with `Devices.password_hash` and `pre_registered`, whereas
this GAS source uses dedicated actions, `Factory_Devices`, scrypt credential
fields, and `active` registration. The existing GAS
`project-data.gs` explicitly rejects `Project_Devices` through its generic
DB API. The current Render endpoint therefore must not be enabled.

**Authorization blocker:** `ikeyDeviceAuthorized_` delegates to
`ikeyVerifyDeviceActor_`. Verify its actual implementation, dispatcher API-key
checks, authenticated actor/session binding, project owner/membership checks,
and deployed version before relying on these actions. The source comment
explicitly delegates project membership/role verification to the dispatcher.
The binding action also currently does not accept or verify a factory password
directly; credential verification must be established in the trusted backend
before any binding.

**Next implementation:** integrate the dedicated GAS action contract with
an explicit, verified server-side credential check; test concurrent duplicate
binding, legacy rows, authorization failure, and all response cases in an
isolated sheet. Do not enable the feature flag or touch production devices.

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
