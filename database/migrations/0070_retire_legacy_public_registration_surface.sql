-- Retire the legacy bearer-token-in-path registration implementation before
-- the fragment-only v2 lifecycle may be enabled. This is forward-only: claim
-- history remains intact, while no v1 link can accept new public intake.

do $$
begin
  if exists (
    select 1
    from app.registration_claims c
    left join app.tournament_registration_links l on l.id = c.registration_link_id
    where l.id is null or l.tournament_id <> c.tournament_id
  ) then
    raise exception using errcode = 'P0001', message = 'legacy registration-link history is incoherent';
  end if;
end;
$$;

update app.tournament_registration_links
set enabled = false,
    disabled_at = coalesce(disabled_at, now())
where enabled or disabled_at is null;

revoke all on function public.get_public_registration_context(text) from public, anon, authenticated;
revoke all on function public.submit_public_registration_claim(text, text, text, text, text, uuid) from public, anon, authenticated;
drop function public.get_public_registration_context(text);
drop function public.submit_public_registration_claim(text, text, text, text, text, uuid);
