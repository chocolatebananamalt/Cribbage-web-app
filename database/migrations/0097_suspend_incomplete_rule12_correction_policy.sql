-- Keep the incomplete Rule 12 correction feature unavailable at every write
-- boundary. The application routes are release-gated, but an authenticated
-- director could otherwise invoke the underlying policy writer directly.
-- Re-enabling requires an explicit, separately reviewed migration after the
-- independent-card correction model and the complete Rule 12.2 fixtures exist.

revoke all on function public.configure_correction_policy(uuid, boolean, smallint, integer, uuid) from authenticated;
