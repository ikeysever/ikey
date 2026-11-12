# iKey 3.1 feature_modules storage migration (staging only)

The five-step project wizard now submits `feature_modules` as an array of allowed IDs. The Render API validates and serializes the array as JSON into the `Projects.feature_modules` column. The project-list API parses and validates it on readback.

## Required storage change before enabling non-empty module selection
In the **staging** spreadsheet's `Projects` tab, append exactly one new header in the first row:

```
feature_modules
```

Keep existing columns and data unchanged. Existing projects may have a blank cell, interpreted as `[]`. The new column must be visible through keyed `db.schema` for table `Projects`, and keyed `db.insert` must echo the stored value in `record.feature_modules`. Do not change production GAS or spreadsheet without separate release verification.

## Release checks
1. Check `db.schema` includes `feature_modules`; a non-empty selection otherwise returns HTTP 503 `FEATURE_MODULE_STORAGE_NOT_READY` before inserting a project.
2. Create a staging project selecting two modules; confirm the saved `Projects.feature_modules` cell contains a JSON array of the exact IDs.
3. Query `GET /api/projects` with the same account and verify the decoded `feature_modules` array.
4. Verify unknown, duplicate and invalid IDs return HTTP 400 without insert.
5. Verify non-owner project access is denied. Feature selection is configuration only; it does not enable physical unlocking or authorization routes.

The current storage migration has **not** been executed on the live spreadsheet.
