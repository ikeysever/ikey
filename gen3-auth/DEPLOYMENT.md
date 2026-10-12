# iKey Gen3 authentication deployment gate

Status: **MailApp-only account flows prepared; the Render API is fail-closed until the dedicated Apps Script Web App passes a read-only version/authorization check.**

## Existing system isolation
- Existing `/api/login`, legacy user sheets, dashboard, device routes, and animations are untouched.
- New API: `/api/auth/*`; new UI: `/gen3/login.html`, `register.html`, `forgot-password.html`, `verify-email.html`, `reset-password.html`, `account.html`.
- Server mounts Gen3 **only** if `GEN3_AUTH_ENABLED=true` and every required environment variable is present. Do not flip the switch until Apps Script deployment and Google/MailApp validation succeed.
- Render auto-deploys changes to `main`. Merge only after CI and real E2E staging verification.

## Spreadsheet
Existing spreadsheet `1vOfpbIQ4px03vip_4zDq1t2KlRP9vUeg4R9JJ0OMXnc` retains all 11 legacy tabs.
Gen3_Users now has two **appended** columns:
- M: `email_verified_at`
- N: `username`
The original 12 columns and their order are preserved. Existing records may have blank values.
Other Gen3 tabs: `Auth_Tokens`, `Auth_Sessions`, `Auth_Audit_Logs`.

## Deploy Apps Script FIRST
The source is `gen3-auth/apps-script/Code.gs`. Update the standalone iKey Gen3 Auth API script and deploy a new Web App version. Existing deployed Apps Script is **not** updated by a GitHub commit.
Retain its existing script properties `GEN3_SPREADSHEET_ID`, `GEN3_API_KEY` (do not expose the secret).
Verify operations: `health`, `sendMail`, `registerAtomic`, `findByLogin`, `createToken`, `consumeTokenAtomic`, `registerGoogleAtomic`, `findByGoogleSub`, `linkGoogleAtomic`, `throttleAtomic`.
Verify 14-column Gen3_Users header; no legacy tab writes.

## Render environment (set in dashboard, never in GitHub)
- `GEN3_AUTH_ENABLED=true` **only after** all checks below pass.
- `GEN3_APPS_SCRIPT_URL` existing deployed Gen3 Web App URL
- `GEN3_APPS_SCRIPT_KEY` existing shared key
- **No Resend configuration is needed.** The MailApp sender is the Google account authorized to run the dedicated Apps Script Web App.
- `GOOGLE_OAUTH_CLIENT_ID` Google Cloud OAuth Web client ID
- `GOOGLE_OAUTH_CLIENT_SECRET` corresponding secret

Google Cloud OAuth authorized redirect URI (exact):
`https://ikey.onrender.com/api/auth/google/callback`
Authorized origin:
`https://ikey.onrender.com`
Consent screen must be configured/published appropriately; verify user eligibility.

## Functional acceptance tests
1. Register a new username/email, verify row status is pending and email contains a 30-minute one-time link.
2. Login must fail before verification. Verify email and login with username **and** email.
3. Duplicate username/email must fail atomically. MailApp verification works with rate limits.
4. Forgot password returns generic response for unknown emails, reset link expires after 15 minutes and cannot be used twice.
5. Password reset revokes old sessions. Re-login succeeds only with new password.
6. Google login creates a verified account, validates Google-issued ID token audience/issuer/nonce/expiry; existing email accounts are **not** silently linked.
7. Authenticated user explicitly links Google with same verified email; another user's Google subject cannot be linked.
8. Legacy login, admin, project center, ESP32/LINE endpoints, original welcome and other animations still work.
9. CI: `node --test gen3-auth/core.test.js gen3-auth/apps-script.test.js gen3-auth/routes.test.js`, plus existing `iKey CI` jobs.
10. After staging and configuration verification, merge to main and check Render deploy status is `live`, then run smoke tests against the actual domain.

## Known limitations / release blockers
- No connected Apps Script editing/deployment action; manual script version deployment or a configured CI Apps Script API service account is required.
- Google OAuth Web client credentials and Apps Script MailApp permission must be provisioned externally.
- Browser E2E with real Google identity and delivered email has not been run.
- Gen3 sessions do **not** authenticate the legacy dashboard automatically; migration requires explicit design and security testing. Do not remove legacy login until complete.
- Google account linking requires authenticated Gen3 session; this is intentionally not automatic.

## Activation and live test checklist (MailApp-only)

1. In [Google Apps Script](https://script.google.com/home/projects), open the **dedicated** `iKey_Gen3_Auth_API` project (never the legacy database script). Replace its `Code.gs` with the reviewed file in this repository; save.
2. Ensure Script Properties `GEN3_SPREADSHEET_ID` and `GEN3_API_KEY` still exist. **Do not paste their values into GitHub or ChatGPT.**
3. Deploy > Manage deployments > Edit the dedicated Web App > **New version** > Deploy. Authorize Google Sheets and MailApp permissions for the executing Google account. Do not overwrite any legacy deployment.
4. The deployed `health` action must return `version: "gen3-mailapp-v2"`, `storage: true`, and `mail_ready: true` (the latter requires MailApp authorization and available daily quota). `/api/auth/status` shows only booleans and never secrets.
5. Set/retain `GEN3_APPS_SCRIPT_URL` and `GEN3_APPS_SCRIPT_KEY` in Render service `ikey`, then set `GEN3_AUTH_ENABLED=true`. The Node.js server verifies the Apps Script health response before allowing account writes. If the Web App is outdated or unreachable, the account API responds 503 and does not write registration data.
6. Confirm `https://ikey.onrender.com/api/auth/status` reports `enabled:true,mail:true`. Register a **test account**, receive and verify the email, log in at `/gen3/login.html`, view `/gen3/account.html`, log out, request password reset, and verify the link works once only.
7. Google OAuth is independent: add `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in Render and authorize redirect `https://ikey.onrender.com/api/auth/google/callback`. Google remains unavailable until configured.
8. Legacy `/api/login` and the main dashboard remain separate from `ikey_gen3_session`; Gen3 login never grants admin rights automatically.

**Rollback:** set `GEN3_AUTH_ENABLED=false` in Render to disable Gen3 writes immediately; existing legacy login, LINE, ESP32, and Sheets remain unchanged. The Google Apps Script source committed to GitHub is **not** automatically deployed by Render.

## Main website login, approved welcome, and homepage (October 2026)

- `/` now shows the Gen3 username/email + password form by default. Its POST target is `/api/auth/login` and success is verified with `/api/auth/me`; only then does the approved `public/welcome-padlock.js` animation play and reveal the existing `#homePage`.
- Google OAuth callback and the standalone `/gen3/login.html` also return to `/?welcome=1`. The homepage controller checks the Gen3 session before playing welcome; a forged query string cannot authenticate a visitor.
- Refreshing the website restores only a verified Gen3 or existing legacy administrator session. No password or session secret is stored in browser storage.
- The original administrator UI is **not** the default login screen. It is accessible only through the small `/?legacy=1` administrator entry. Existing `/api/login` and signed admin sessions remain unchanged until a separate, reviewed migration.
- Gen3 users have `global_role:user` and **do not inherit legacy superadmin rights**. Protected admin endpoints continue to validate the separate administrator session on the server.
- Logout revokes the appropriate Gen3 or legacy session. The Gen3 account sidebar links to `/gen3/account.html`.
- **Activation remains blocked if** `/api/auth/status` shows `enabled:false`. This is a real upstream Apps Script deployment/configuration issue; the UI must not pretend that login, MailApp or Google OAuth works until independently verified.
- Rollback the homepage login change by reverting the relevant GitHub commit; no legacy login data or Google Sheet records are deleted by this UI migration.

## Diagnosing a blocked signup

The status endpoint returns `enabled`, `mail`, `google` and a safe `reason` category (no API keys, spreadsheet IDs or OAuth secrets). The Render startup log prints only whether each required setting is configured.

| reason | What to check |
|---|---|
| CONFIG_MISSING | Render service ikey needs GEN3_AUTH_ENABLED=true, a dedicated Apps Script Web App GEN3_APPS_SCRIPT_URL, and matching GEN3_APPS_SCRIPT_KEY (32+ chars). |
| APPS_SCRIPT_AUTH_FAILED | Apps Script Script Property GEN3_API_KEY must exactly match Render GEN3_APPS_SCRIPT_KEY. Never paste either value into a chat, repository, or screenshot. |
| APPS_SCRIPT_SHEET_NOT_SET | Apps Script Script Property GEN3_SPREADSHEET_ID must point to the existing iKey_Database. |
| APPS_SCRIPT_SCHEMA_MISMATCH | The executing Apps Script account needs edit access to the spreadsheet, and the four Gen3 tab headers must match HEADERS exactly. |
| APPS_SCRIPT_VERSION_MISMATCH | Save the current gen3-auth/apps-script/Code.gs and deploy a **new Web App version** of the dedicated script. A GitHub or Render deploy does not update Apps Script. |
| APPS_SCRIPT_NON_JSON_RESPONSE | Confirm the dedicated Web App deployment URL ends with /exec and the Web App access settings allow the Render server to call it without a Google login HTML page. The API key still authenticates each POST. |
| APPS_SCRIPT_HTTP_ERROR, APPS_SCRIPT_TIMEOUT, APPS_SCRIPT_CONNECTION_FAILED | Inspect the Apps Script deployment and Render connectivity; never change the legacy script to resolve this. |
| MAILAPP_NOT_READY | In the Apps Script editor run inspectGen3Setup to authorize Sheets and MailApp, then check remaining MailApp daily quota. |

In the dedicated Apps Script editor, run the read-only `inspectGen3Setup` function. It returns only property presence, sheet header checks, MailApp authorization and quota availability, and a `ready` boolean; it does not create, update or delete any spreadsheet rows.

Google sign-in is separately enabled by the Google Cloud OAuth consent configuration, an OAuth **Web application** client, and the two Render variables `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`. Its authorized redirect URI is `https://ikey.onrender.com/api/auth/google/callback`. Do not silently merge existing email accounts with Google accounts.

## MailApp authorization when `inspectGen3Setup` returns `mailAuthorized:false`

1. Open the **dedicated** Gen3 Apps Script project and replace `Code.gs` with the current source from this repository; save.
2. Select `authorizeGen3MailApp` in the editor function dropdown and click **Run**. This only reads the remaining daily MailApp quota; it **does not send an email**.
3. If Google displays an authorization dialog, grant the requested access with the script owner account. If the run fails, inspect the editor's **Execution log** for the exact Google error (do not share account identifiers, script URLs, keys or tokens).
4. If `appsscript.json` contains an explicit `oauthScopes` list, it must include `https://www.googleapis.com/auth/script.send_mail` and the spreadsheet scope needed by `SpreadsheetApp.openById`. If no explicit `oauthScopes` is present, Apps Script normally infers scopes from the code; do not create a manifest unnecessarily.
5. Run `inspectGen3Setup` again. It should show `mailAuthorized:true` and `mailQuotaAvailable:true`. Save and deploy a **new version** of the existing Web App deployment (not a new URL) if source code was updated. Then refresh `/api/auth/status`.

`MAILAPP_PERMISSION_REQUIRED` means the editor caught an authorization or scope-related error. `MAILAPP_CHECK_FAILED` means a different MailApp error. Both are safe classifications, not the original exception message.
