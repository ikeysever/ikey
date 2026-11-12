# Project invitations — staging rollout contract

The staging branch now exposes authenticated `POST /api/projects/:projectId/invitations` with body `{"role":"member"}`. It is owner-only, same-origin, and generates a cryptographically random 24-byte token. Only SHA-256 of the token is stored. The token is returned once, after the database confirms the inserted record.

**This is invitation issuance only, not a completed join workflow.** Do not send invitations to end users until token redemption, atomic single-use enforcement, and membership readback are implemented and tested.

## Required staging storage

Create a separate `Project_Invitations` tab in the staging spreadsheet with exactly these header columns:

```
invitation_id,project_id,created_by_user_id,token_hash,role,expires_at,status,created_at
```

The `IKEY_DB_ALLOWED_TABLES` Script Property must include `Project_Invitations` **in staging only**, after reviewing the generic database API's table authorization. The API fails closed with 503 when the table is unavailable or the schema is incomplete.

## Next implementation gates

1. Atomic one-time invitation redemption must verify expiry, hash and target project, then create membership without a replay window.
2. Introduce and validate a dedicated membership table and role transitions; do not treat the legacy `Project_Members` request-members table as project access without verifying its semantics.
3. Add owner invitation management UI and revocation only after atomic operations and readback are available.
4. Run staging integration tests with two separate authenticated users, plus replay, expiry and cross-project tests.
5. Never enable physical unlock based on invitation or unverified membership.
