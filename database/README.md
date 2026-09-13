# Database migrations

`migrations/` is the ordered database history for the reviewed Standard Singles
slice. The shared pilot currently ends at `0089_foreign_key_coverage`; the
separate disposable synthetic-data validation project carries later reviewed
work. The shared pilot remains a pilot, not a production release. The
application deliberately exposes no direct client DML against the private
`app` schema. Public and authenticated RPCs are narrowly granted and must
enforce their own role and tournament scope.

Before any new migration can reach the pilot, it must be exercised first on
the disposable test database with synthetic data, reviewed for RLS/grants and
transaction safety, and accompanied by the required acceptance evidence,
recovery plan, and approved ACC fixtures. Use synthetic fixtures only. The
exact shared-pilot change-control process is in
`docs/operations/PILOT_MIGRATION_CHANGE_CONTROL.md`.
