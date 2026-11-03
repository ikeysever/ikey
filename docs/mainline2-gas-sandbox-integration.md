# iKey Mainline 2 — GAS Sandbox integration handoff

Status: **candidate only**. PR #97 isolated CI: 30/30 passed (run 41675449784). No live GAS execution has occurred.

## Scope
Use a *copy* of the actual iKey_Gen3_Auth_API project (Sandbox). Do not modify its production deployment or Script Properties. Confirm the Sandbox spreadsheet binding uses a non-production copy of Devices. Do not copy production secrets into an untrusted environment.

## Files
- `staging/gas/ikey-device-auth-find-by-id.candidate.gs` provides:
  - `ikeyDeviceAuthFindByIdCandidate_(payload)`
  - `ikeyDeviceAuthDispatchCandidate_(action,payload,fallback)`
- `tests/gas-device-auth-contract.test.js` verifies isolated mock behavior.

## Exact minimal dispatcher change (in the Sandbox copy only)
In the supplied `doPost(e)`, replace the single `const result = action.startsWith('db.')` expression's start with:

```javascript
const result = action === 'deviceAuthFindById'
  ? ikeyDeviceAuthFindByIdCandidate_(payload)
  : action.startsWith('db.')
```

Keep the **entire rest of the original nested ternary unchanged**, including `ikeyDbDispatch_`, `ikeyFactoryDeviceAction`, `executeProjectAccess`, `executeAdminAccount`, and `execute`. Preserve the existing `respond({ok:true,result})` wrapper and API-key verification.

Do **not** add `deviceAuthFindById` to `IKEY_DEVICE_ACTIONS`: that array routes to the incompatible factory-device handler.

## Preflight checks before any Sandbox call
1. Ensure the candidate file is added only to the Sandbox copy and has no duplicate function name.
2. Ensure `GEN3_SPREADSHEET_ID` points to the Sandbox spreadsheet, not production.
3. Confirm `Devices` columns exactly include `device_id,password_hash,status,created_by_user_id,created_at,updated_at`.
4. Confirm stored hashes really use `scrypt:v1:<22 base64url chars>:<86 base64url chars>` and `pre_registered` is the actual eligible state.
5. Verify the Sandbox `execute()` has no existing `deviceAuthFindById` implementation before adding the branch.
6. Do not log device credentials or hash values.

## Expected responses
- Authorized request with known, eligible test ID: `{ok:true,result:{device_id,password_hash,status,...}}`.
- Unknown ID: `{ok:true,result:null}`.
- Invalid payload: `{ok:false,error:'DEVICE_AUTH_INVALID_REQUEST'}`.
- Duplicate ID: `{ok:false,error:'DEVICE_AUTH_DUPLICATE_DEVICE_ID'}`.
- Incorrect API key: `{ok:false,error:'UNAUTHORIZED'}`.
- Existing `factoryDeviceList` and `health` actions continue to dispatch normally.

**Important**: GAS returns the hash to a trusted Render backend, never to a browser or ESP32. Existing `GEN3_API_KEY` check must remain in force.

## Release gate
Do not deploy to production or enable physical unlock until Sandbox integration tests pass, the actual `execute()` dispatcher is reviewed, and explicit approval is obtained.
