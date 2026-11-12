# Project invitations — staging rollout contract

The staging branch now exposes authenticated `POST /api/projects/:projectId/invitations` with body `{"role":"member"}`. It is owner-only, same-origin, and generates a cryptographically random 24-byte token. Only SHA-256 of the token is stored. The token is returned once, after the database confirms the inserted record.

**The staging branch contains issuance, redemption, and owner-only membership readback code, but no live staging GAS integration has been verified.** Do not send invitations to end users until live integration, concurrency and authorization acceptance tests pass.

## Required staging storage

Create a separate `Project_Invitations` tab in the staging spreadsheet with exactly these header columns:

```
invitation_id,project_id,created_by_user_id,token_hash,role,expires_at,status,created_at,redeemed_by_user_id,membership_id
```

The `IKEY_DB_ALLOWED_TABLES` Script Property must include `Project_Invitations` **in staging only**, after reviewing the generic database API's table authorization. The API fails closed with 503 when the table is unavailable or the schema is incomplete.

## Remaining release gates

1. Deploy the staging-only GAS redemption action to an isolated test deployment and verify expiry, hash, project status, and single-use behavior with actual Sheets writes.
2. Provision and validate the dedicated staging `Project_Memberships` tab; define and test role transitions. Do not treat legacy `Project_Members` requests as access grants.
3. Implement owner invitation management UI and revocation after live atomic operations and readback are verified.
4. Run staging integration tests with two separate authenticated users, plus replay, expiry and cross-project tests.
5. Never enable physical unlock based on invitation or unverified membership.

## Atomic redemption implementation now present in staging branch

`POST /api/project-invitations/redeem` accepts `{"invitation_token":"..."}` from an authenticated, same-origin session. Render hashes the token and invokes the dedicated keyed GAS action `project.invitation.redeem`. GAS uses `LockService.getScriptLock()` and a resumable two-phase flow: reserve the invitation as `redeeming` for the authenticated actor and a fixed membership ID, append or verify the membership, then finalize as `redeemed`. A retry by the same actor can recover interrupted writes; another actor cannot take over a reserved token. This is not a cross-sheet ACID transaction and must be validated against real Sheets behavior.

Additional staging tab required:

```
Project_Memberships
membership_id,project_id,user_id,role,status,created_at
```

Add `Project_Memberships` to staging `IKEY_DB_ALLOWED_TABLES`. The atomic GAS action itself must be deployed as part of the same staging GAS version. This code has not been deployed to production.

**Remaining blockers:** actual staging GAS integration, concurrent redemption test with two authenticated accounts, owner invitation management UI, and role enforcement for member project access. Owner-only member readback and Node-based fault-injection simulation exist but are not live staging acceptance tests. Do not promote to main until resolved.

## Partial reservation fault injection

The staging GAS handler now also supports retries when Sheets persists only the reserving actor or actor plus membership ID while the invitation status is still `pending`. A different actor is rejected; the original actor reuses the previously stored membership ID. The executable GAS simulation covers failed status writes, failed membership append, failed flush after append, and finalization failure.

This remains a simulation, **not a staging GAS deployment or two-account live concurrency verification**. GAS/Sheets do not provide a cross-sheet ACID transaction; a lock and idempotent recovery reduce replay and partial-write risk but do not replace integration tests.
