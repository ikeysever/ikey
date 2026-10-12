# iKey Gen3 account system — development branch

**Status:** NOT DEPLOYABLE. This directory is deliberately not mounted by `server.js`.
Existing /api/login, superadmin session and legacy database routes are untouched.

## Existing spreadsheet
The original spreadsheet has four new tabs:
- Gen3_Users (12 columns)
- Auth_Tokens (8 columns)
- Auth_Sessions (8 columns)
- Auth_Audit_Logs (9 columns)

All 11 legacy tabs remain intact; do not delete or rename them before migration approval.

## Implemented in this branch
- `register.html`: isolated responsive registration UI with basic client-side checks.
- `core.js`: Node scrypt salted password hashing/verification, account-status guard,
  7-day session token generation with SHA-256 hashes.
- `routes.js`: **unmounted** Express route factory for registration, password login,
  session lookup/renewal, logout, preliminary rate limiting and audit calls.
- `core.test.js`: Node built-in test runner unit tests; execute `node --test gen3-auth/core.test.js`.

## Important integration contract
`routes.js` requires a trusted server-side `store` adapter providing:
`registerAtomic`, `findByEmail`, `recordLoginFailureAtomic`,
`recordLoginSuccessAtomic`, `createSession`, `findSessionByHash`,
`findById`, `touchSession`, `revokeSession`, `audit`.

The adapter MUST implement atomic normalized-email uniqueness and status transitions.
**Google Sheets itself does not enforce uniqueness or transactions.** Use an
authenticated writer with locking, or a transactional database.
Never expose Sheet write credentials or password hashes to the browser.

## Remaining before deployment
1. Authenticated, atomic data adapter, storage credentials and audit durability.
2. Cross-instance rate limiting; safe session renewal under concurrency; CSRF protection.
3. Google OIDC with verified email, stable sub, state/nonce and secure linking.
4. Email delivery and single-use 15-minute token workflows.
5. Password change, unlink, account deletion and other DB-001..023 requirements.
6. Integration and security tests, configuration validation and Render staging.
7. Only after tests and approval, mount routes and expose frontend from public/.

## Contract clarification
Successful registration responds HTTP 201 with a user record, and the user
then signs in explicitly. Login sets a 7-day sliding HttpOnly cookie.
No production service or secret has been changed by this branch.
