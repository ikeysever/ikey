# iKey 3.1 系統公告 API

## Scope and deployment boundary

This implementation is isolated on `feature/system-announcements-staging-20261102`.
It does not modify `main`, the live Apps Script project, production spreadsheet,
Render environment variables, or any production deployment.

The Render API uses the existing Gen3 server-to-server Apps Script adapter. The
browser never receives `GEN3_APPS_SCRIPT_KEY` or the spreadsheet ID.

## Approved Google Sheets tables

Run `gas/setup-system-announcement-tables.gs` manually in the existing Gen3
Apps Script project only after reviewing the actual deployed `doPost` source
and confirming `GEN3_SPREADSHEET_ID` points to the intended staging spreadsheet.
The setup function creates missing sheets, writes headers only to a genuinely
empty sheet, refuses mismatched existing headers, and adds both names to
`IKEY_DB_ALLOWED_TABLES`. It does not clear or replace existing data.

### System_Announcements

`announcement_id, title, content, category, priority, status,
created_by_user_id, updated_by_user_id, created_at, updated_at,
published_at, scheduled_at, expires_at, archived_at, deleted_at`

- `announcement_id`: UUID primary key.
- `category`: `system | maintenance | feature | administrative | other`.
- `priority`: `urgent | important | normal`.
- `status`: `draft | scheduled | published | archived | deleted`.
- `content`: up to 10,000 characters at the API boundary.

### System_Announcement_Reads

`read_id, announcement_id, user_id, read_at`

`read_id` is SHA-256 of `user_id:announcement_id`, making repeated reads
idempotent while the Sheets engine enforces primary-key uniqueness.

## Render API

### Public

- `GET /api/announcements`: published, non-expired announcements ordered by
  priority and publication date.
- `GET /api/announcements/:id`: one published, non-expired announcement.
- `POST /api/announcements/:id/read`: requires a valid Gen3 session; records
  one read per user and announcement.

### Super administrator

All routes below require the HttpOnly Gen3 session cookie and
`global_role === "super_admin"`.

- `GET /api/admin/announcements?include_trash=true`
- `GET /api/admin/announcements/:id`
- `POST /api/admin/announcements`
- `PUT /api/admin/announcements/:id`
- `POST /api/admin/announcements/:id/publish`
- `POST /api/admin/announcements/:id/unpublish`
- `POST /api/admin/announcements/:id/restore`
- `DELETE /api/admin/announcements/:id` (soft delete only)

Mutating routes validate the same-origin header when supplied. All API responses
are marked `Cache-Control: no-store`. The announcement UI uses the existing
same-origin session cookie and never handles API secrets.

### Scheduled publishing

Configure `ANNOUNCEMENTS_CRON_SECRET` in the staging Render environment with a
random secret of at least 32 characters. A Render Cron Job (or another trusted
scheduler) must POST once per minute to
`/api/internal/announcements/publish-due` with
`Authorization: Bearer <secret>`. The endpoint compares the secret in constant
time, publishes due records, and archives records whose expiry has already
passed. No cron job or secret is created by this repository change.

## Storage constraints

The generic Sheets engine supports exact-match reads, inserts, updates, and
soft deletion; it is not a relational database and does not provide multi-table
ACID transactions. Read receipts use deterministic IDs to make duplicate
inserts safe. The engine's bounded text-field ceiling is 12,000 characters;
the HTTP API imposes the stricter 10,000-character announcement content limit.

## Required staging verification

1. Review and integrate the GAS dispatch into the actual existing Gen3 `doPost`
   after API-key validation. Do not add a second `doPost`.
2. Run `setupSystemAnnouncementTables()` against the staging spreadsheet only.
3. Deploy the Apps Script staging/test version and verify legacy auth actions
   still work plus `db.health`, `db.schema`, `db.insert`, `db.select`,
   and `db.update`.
4. Configure the two staging Render environment variables:
   `GEN3_APPS_SCRIPT_URL`, `GEN3_APPS_SCRIPT_KEY` (existing staging values),
   and `ANNOUNCEMENTS_CRON_SECRET` (new random staging-only value).
5. Run `npm test`; then test public visibility, role denial, create/edit,
   draft/publish/unpublish, scheduled publishing, soft-delete/restore, expiry,
   and per-user read idempotency against staging.
6. Open a PR for review. Do not merge or deploy production without separate
   approval.

## Current limitation

This repository branch contains the staging implementation and a guarded GAS
sheet setup script. It does not prove that the live Apps Script source has been
safely integrated, that the staging spreadsheet tables have been created, that
Render staging secrets are configured, or that a Cron Job exists. Those steps
must be completed and verified before calling the API operational.
