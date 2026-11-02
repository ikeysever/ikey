# Device authentication release — 2026-11-02

User authorized creation and deployment of device authentication only. main was not modified. Existing Render service srv-db1jeuk9v7es73fs5n2g deployed exact commit 13cbce2c6713903fc12872fbcb653969f1ca80b3; deploy dep-dbk03imc6qcc73d4pr3g became live at 03:22:24 UTC (11:22:24 Asia/Taipei).

## Scope
POST /api/device/auth and GET /api/device/me. Fifteen-minute signed bearer tokens, scrypt password verification against existing preregistered Devices, bounded process-local login limiter. No command routes, actuator control, GAS edits or database mutations. IKEY_DEVICE_TOKEN_SECRET added through Render environment configuration; value not recorded. Other environment values preserved.

## Validation
Three local Node test suites passed: login and identity, forged/expired tokens and disabled device, missing configuration, invalid input and rate limits. Mock storage only. Full repository suite not run in this environment.
Live HTTP: health 200 with ikey-api 3.1; device/me without token 401 UNAUTHORIZED; device/auth with empty object 400 INVALID_REQUEST; device/commands/next 404 NOT_FOUND. Actual ESP32 device credential login remains to be tested locally; do not publish credentials or tokens.

## Recovery
Previous application commit b755128181f8f27dd99b645db58650a0b6f836e6, last pre-feature deploy dep-dbk034flk1mc73af3rv0. If needed, deploy that exact application commit via Render; no database rollback required since this release makes no database mutations. Auto deploy remains disabled; main still does not contain this release. A later deployment of main would remove these authentication endpoints until deliberately integrated.

## Observed follow-up
Build npm audit reported one high severity dependency finding; details were not investigated or fixed in this narrowly scoped release.
