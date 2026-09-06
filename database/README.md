# Database migrations

No production database exists yet. `migrations/0001_vertical_slice_core.sql` is a local, unapplied first-draft schema contract for the reviewed Standard Singles slice. It is not connected to Supabase, exposes no RPCs, and grants no direct client DML. Before application, the team must add authenticated role-aware policies, server transaction tests, a recovery plan, and reviewed ACC fixtures. Use synthetic fixtures only.
