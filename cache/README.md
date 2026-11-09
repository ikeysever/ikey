# iKey 3.1 cache refactor — staging only

- Branch: feature/preloading-3-1-staging. No main, Render, GAS, Sheets or physical device changes.
- New cache modules are not mounted in server.js and make no upstream calls on import. There is no measured API reduction yet.
- Snapshot adapter is NOT a GAS incremental feed. It requires complete:true with a verified complete list; never treat a db.select page limited to 100 as complete.
- Before integration: verify deployed GAS version, complete source pagination or change feed, publish/expiry filtering, tenant isolation, backup restore, staging environment separation, and full tests.
- Never cache credentials, session decisions, admin secrets, or device commands. Physical unlock stays disabled.
- Local package tests passed 11/11; GitHub CI not yet verified. Run node --test cache/*.test.js.
- Rollback: these files are not imported by production routes. Coordinate shared-file edits in multi-AI register.
