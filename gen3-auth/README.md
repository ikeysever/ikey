# iKey Gen3 registration — isolated development
This directory is intentionally **not mounted by server.js** and is not deployed.
Existing /api/login, admin session, and old database APIs remain untouched.

## Database
Original spreadsheet has four new tabs: Gen3_Users, Auth_Tokens, Auth_Sessions, Auth_Audit_Logs.
Legacy Users and all other 10 legacy tabs are preserved.
Do not rename or delete legacy tabs without explicit approval.

## Planned registration contract
POST /api/auth/register
Body: {"email":"student@example.com","password":"at-least-8","display_name":"Student"}
Returns 201 with a user_id and a 7-day sliding HttpOnly cookie on success.
Passwords must be scrypt/Argon2id/bcrypt hashes, never plaintext.
New accounts have global_role=user and account_status=active.
Registration must atomically enforce case-insensitive email uniqueness.

## Integration blockers
1. Choose Render workspace; review service/env configuration.
2. Select and provision an authenticated, atomic backend writer for Sheets (e.g. Apps Script LockService).
3. Implement authenticated DB adapter, error handling, auditing, sessions and rate limiting.
4. Implement Google OAuth/OIDC, email sender, token flows and full tests.
5. Review the PR before mounting routes in server.js; do not deploy prematurely.

This branch includes a static registration UI and a **fail-closed** Express route scaffold.
No endpoint reports registration success until the secure persistence adapter is implemented.
