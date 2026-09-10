# Database migrations

`migrations/` is the ordered database history for the reviewed Standard Singles
slice. The connected pilot and the disposable test database each have the
current 0001–0068 chain applied; the pilot remains a pilot, not a production
release. The application deliberately exposes no direct client DML against
the private `app` schema. Public and authenticated RPCs are narrowly granted
and must enforce their own role and tournament scope.

Before any new migration can reach the pilot, it must be exercised first on
the disposable test database with synthetic data, reviewed for RLS/grants and
transaction safety, and accompanied by the required acceptance evidence,
recovery plan, and approved ACC fixtures. Use synthetic fixtures only.
