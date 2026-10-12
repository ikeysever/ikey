# iKey Gen3 authentication deployment gate

Status: **implementation on feature branch; production activation blocked until all external integrations and end-to-end tests are verified.**

## Existing system isolation
- Existing `/api/login`, legacy user sheets, dashboard, device routes, and animations are untouched.
- New API: `/api/auth/*`; new UI: `/gen3/login.html`, `register.html`, `forgot-password.html`, `verify-email.html`, `reset-password.html`.
- Server mounts Gen3 **only** if `GEN3_AUTH_ENABLED=true` and every required environment variable is present. Do not flip the switch until Apps Script deployment and Google/Resend validation succeed.
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
Verify new operations: `registerAtomic`, `findByLogin`, `createToken`, `consumeTokenAtomic`, `registerGoogleAtomic`, `findByGoogleSub`, `linkGoogleAtomic`, `throttleAtomic`.
Verify 14-column Gen3_Users header; no legacy tab writes.

## Render environment (set in dashboard, never in GitHub)
- `GEN3_AUTH_ENABLED=true` **only after** all checks below pass.
- `GEN3_APPS_SCRIPT_URL` existing deployed Gen3 Web App URL
- `GEN3_APPS_SCRIPT_KEY` existing shared key
- `RESEND_API_KEY` Resend API key for verified sender domain
- `GEN3_MAIL_FROM` verified sender, e.g. `iKey <noreply@yourdomain.tld>`
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
3. Duplicate username/email must fail atomically. Resend verification works with rate limits.
4. Forgot password returns generic response for unknown emails, reset link expires after 15 minutes and cannot be used twice.
5. Password reset revokes old sessions. Re-login succeeds only with new password.
6. Google login creates a verified account, validates Google-issued ID token audience/issuer/nonce/expiry; existing email accounts are **not** silently linked.
7. Authenticated user explicitly links Google with same verified email; another user's Google subject cannot be linked.
8. Legacy login, admin, project center, ESP32/LINE endpoints, original welcome and other animations still work.
9. CI: `node --test gen3-auth/core.test.js gen3-auth/apps-script.test.js gen3-auth/routes.test.js`, plus existing `iKey CI` jobs.
10. After staging and configuration verification, merge to main and check Render deploy status is `live`, then run smoke tests against the actual domain.

## Known limitations / release blockers
- No connected Apps Script editing/deployment action; manual script version deployment or a configured CI Apps Script API service account is required.
- Google OAuth Web client credentials and verified transactional sender must be provisioned externally.
- Browser E2E with real Google identity and delivered email has not been run.
- Gen3 sessions do **not** authenticate the legacy dashboard automatically; migration requires explicit design and security testing. Do not remove legacy login until complete.
- Google account linking requires authenticated Gen3 session; this is intentionally not automatic.
