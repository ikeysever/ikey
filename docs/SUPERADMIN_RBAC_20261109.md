# iKey 3.1 — Super-admin navigation and page authorization (2026-11-09)

## Requirement
Ordinary authenticated users must not see the super-admin navigation entry, management dashboard or management buttons. Direct requests to admin HTML must also be rejected server-side.

## Design
- Treat `/api/auth/me` as the authoritative source of `user.global_role`; do not trust local storage or user-supplied role.
- Render super-admin links hidden by default and reveal only for verified `super_admin`.
- Guard `/super-admin.html`, `/admin-accounts.html` and `/admin-accounts-preview.html` before `express.static`. Invalid sessions redirect to login, ordinary users receive 403, backend failures fail closed with 503.
- Existing admin API authorization remains in place; frontend hiding alone is not security.

## Files changed
- `server.js`: management HTML authorization middleware
- `public/admin-nav-guard.js`: verified-role navigation reveal
- `public/home.html`, `public/projects.html`, `public/account.html`, `public/device-settings.html`, `public/super-admin.html`: hidden-by-default links and shared guard

## Validation still required
- Run `npm test` and inspect results.
- Test logged-out, ordinary user, super-admin, revoked session, expired session and unavailable store for direct admin page access.
- Verify the admin navigation is absent from initial paint for ordinary users and visible to super-admins after validation.
- Audit any other links generated dynamically or in additional page templates.
- Verify all sensitive API routes enforce server-side authorization; never treat a static page guard as sufficient protection.

## Release safety
Staging branch only. No main modification, merge, Render deployment, GAS mutation, or production database write was performed as part of this change.
