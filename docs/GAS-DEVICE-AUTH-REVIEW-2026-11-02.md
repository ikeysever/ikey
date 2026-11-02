# iKey 3.1 — GAS device-action security review (2026-11-02)

Status: **READ-ONLY REVIEW / NOT DEPLOYED**. Target branch: `feature/esp32-device-auth-staging`. No production database changes, no main merge, no Render deployment, no physical lock operation.

## Reviewed sources
- User-provided `程式碼.gs` V14 diagnostic candidate: `doPost` checks shared `GEN3_API_KEY` then dispatches `factoryDeviceRegister`, `factoryDeviceCredentialGet`, `factoryDeviceBind`, `factoryDeviceList`, `factoryDeviceUpdate` to `ikeyFactoryDeviceAction`.
- User-provided `gas-device-actions.gs`: strict header checks for `Factory_Devices` and `Project_Devices`; script-lock protected register/bind/update; list and credential lookup.
- User-provided `gas-device-authorization.gs`: `ikeyVerifyDeviceActor_` checks active `Gen3_Users` account, configured super-admin ID list for registration, and `executeProjectAccess('projectAccessGet', ...).project_role === 'admin'` for other actions.
- Existing staging `lib/atomic-command-service.js`, `lib/device-command-gateway.js` and device-control integration contract.

## Verified findings
1. **Shared API key is service authentication, not human authentication.** The GAS actor verifier reads `p.actor_user_id`; the code alone cannot prove Render derived this ID from a valid session. Never allow browser-supplied actor IDs to pass through unchanged.
2. **Credential disclosure risk:** `factoryDeviceCredentialGet` returns `credential_kdf`, `credential_salt`, `credential_hash` to any caller passing the project-admin role check. A hash is still sensitive verifier material. Keep this action unavailable to browser-facing routes pending a reviewed device-auth protocol.
3. **Super-admin action scope:** `factoryDeviceRegister` uses `IKEY_SUPER_ADMIN_USER_IDS`; the remaining actions require project admin, including credential get. Need verify super-admin access policy and real `projectAccessGet` return shape.
4. **Binding and update authorization:** `factoryDeviceBind` checks device is registered and not already bound, but authorization is based on project role. `factoryDeviceUpdate` targets the exact project/device pair; list filters by project.
5. **Schema dependency:** device actions require exact headers in `Factory_Devices` and `Project_Devices`. Prior read-only inspection of `iKey_Database` did not find these tabs; do not create them in production without explicit approval and a verified deployment-to-spreadsheet mapping.
6. **No command actions in supplied dispatcher:** `deviceCommandCreateAtomic`, `deviceCommandClaimAtomic`, `deviceCommandReportAtomic`, `deviceCommandGet`, `deviceCommandExpireAtomic` are not registered by the supplied `doPost`. Staging gateway is not mounted.
7. **Gateway/state-machine contract mismatch:** `device-command-gateway.js` claim calls GAS without a claim token; `atomic-command-service.js` claim requires a >=32-character token. Define token generation and ownership before wiring.
8. **Device ID format mismatch:** GAS accepts `[A-Za-z0-9_-]{6,64}`; isolated atomic service accepts exactly eight uppercase base32-like characters `[A-HJ-NP-Z2-9]{8}`. Must choose canonical device identity format; never silently reject already registered devices.
9. **Claim token secrecy:** `atomic-command-service.js` stores a token hash and omits it from returned claim object. Need a secure, authenticated way to deliver a claim proof to device without leaking it to administrators, and retain recovery semantics across retries.
10. **Durability:** isolated atomic service needs injected shared transactional storage; existing Sheets generic `db.*` CRUD is not sufficient to guarantee atomic claim/report transitions.

## Required implementation gates
- Confirm `projectAccessGet` semantics and actual trusted Render actor injection, including session expiry/revocation, CSRF and disabled-user handling.
- Agree canonical device ID and dedicated credential verification/provisioning path. Deny verifier disclosure by default.
- Define and test an end-to-end claim-proof protocol, idempotency and expiry transitions.
- Implement dedicated GAS command actions using a single script lock, exact schema, append-only sanitized events, and fail-closed validation; test against isolated Sheets only.
- Align Render gateway and firmware with the same protocol. Never actuate based on HTTP 200 alone.
- Verify all automated security/replay/concurrency tests, then obtain separate authorization for staging deployment and physical lock validation.

## Evidence and limits
This review compares supplied source and staging repository code. It does **not** establish that the V14 candidate is the live deployed version, that GAS points to the inspected workbook, or that the physical lock is safe. No secrets or user rows were inspected.

## Development history
2026-11-02: Reviewed three user-supplied GAS source files and staging command prototypes; recorded authorization, credential, schema, device-ID and claim-token integration gaps. No production changes.
