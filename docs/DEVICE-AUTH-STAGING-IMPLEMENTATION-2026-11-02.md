# iKey 3.1 — Device Authentication staging implementation

Date: 2026-11-02  
Branch: `feature/esp32-device-auth-staging`  
Status: source implementation only; no GAS or Render deployment.

## Scope and safety boundary

This implementation is limited to the named staging branch. It does not modify `main`, invoke Apps Script sync, change deployed GAS, read/change Script Properties, write a spreadsheet, change Render configuration, deploy Render, or actuate a physical lock.

The historical live-sheet audit observed a `Devices` tab but did not prove the deployed Gen3 Apps Script points to that workbook. This implementation uses a separate `DeviceAuth_Devices` tab in an explicitly configured isolated staging spreadsheet. It never falls back to `GEN3_SPREADSHEET_ID`.

## API contract

`POST /api/device/auth` accepts `{"device_id":"Y8R69EXB","password":"<private device password>"}`. Success returns a 15-minute HMAC-SHA256 bearer token, `token_type: Bearer`, and `expires_in: 900`; it never returns a password hash.

- malformed input: HTTP 400 / `INVALID_REQUEST`
- unknown, inactive or incorrect credentials: HTTP 401 / `INVALID_CREDENTIALS`
- more than five attempts per IP/device per minute: HTTP 429 / `RATE_LIMITED`
- missing token secret: HTTP 503 / `DEVICE_AUTH_NOT_CONFIGURED`
- GAS/storage unavailable: HTTP 503 / `DEVICE_AUTH_UNAVAILABLE`

`GET /api/device/me` requires `Authorization: Bearer <token>`. The server validates signature, issuer, audience, subject, issue time, expiry and nonce format, then rechecks device status. The in-memory simulation uses the same claims and the same dedicated device lookup adapter. Responses use `Cache-Control: no-store`.

## GAS storage contract

Narrow server-to-GAS actions: `deviceAuthFindById`, `deviceAuthCreateAtomic`, `deviceAuthListPreRegistered`, `deviceAuthGetById`.

Exact staging sheet headers: `device_id,password_hash,status,created_by_user_id,created_at,updated_at`.

Registration is serialized with Apps Script `LockService` and checks uniqueness before append. List/status actions omit `password_hash`. Credential lookup returns the verifier only to the trusted Render server; it must never be exposed by a browser route or logged.

## Isolated staging setup still required

1. Create a new, separate test spreadsheet. Do not use `iKey_Database` or a production workbook.
2. In a dedicated staging Apps Script project, set Script Property `IKEY_DEVICE_AUTH_STAGING_SPREADSHEET_ID` to that test spreadsheet ID.
3. Run `setupDeviceAuthStagingSheet(spreadsheetId)` only after confirming the argument exactly matches that staging property. It creates the tab if absent and refuses to overwrite a mismatched header row.
4. Deploy that Apps Script code only to a test deployment, not the existing production Web App.
5. Configure a separate staging Render service with its own `GEN3_APPS_SCRIPT_URL`, `GEN3_APPS_SCRIPT_KEY`, and newly generated `IKEY_DEVICE_TOKEN_SECRET` (at least 32 random bytes). Never commit secrets.
6. Only after separate authorization, deploy staging and run HTTP/GAS integration tests with a test device. No production deployment or physical unlock is part of this implementation.

## Automated tests

`tests/device-auth-api.test.js` covers successful token issuance/identity verification, unknown device, wrong password, inactive device, malformed request, missing secret, storage failure, token tampering, rate limiting and static GAS contract checks. CI does not prove GAS deployment, spreadsheet configuration or ESP32 hardware authentication.
