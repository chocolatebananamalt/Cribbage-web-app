-- A director-supplied profile UUID is not an acceptable player-identification
-- ceremony. Browser callers must use the future witnessed activation flow,
-- which learns the profile only from verified server claims.
revoke all on function public.link_roster_entry_to_account_v2(uuid, uuid, uuid, uuid) from public, anon, authenticated;
