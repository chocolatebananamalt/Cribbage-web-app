-- The already-applied pilot confirmation RPC is also protected at the data
-- boundary so a stale client cannot finalize an event after eligibility changes.

create or replace function app.require_confirmation_game_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from app.canonical_games cg
    join app.tournaments t on t.id = cg.tournament_id and t.status = 'open'
    join app.events e on e.id = cg.event_id and e.tournament_id = cg.tournament_id
    join app.ruleset_versions rv on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id
    where cg.id = new.canonical_game_id
      and cg.tournament_id = new.tournament_id
      and cg.event_id = new.event_id
      and e.format = 'standard_singles'
      and e.scoring_method = 'digital'
      and rv.format = 'standard_singles'
      and rv.approved_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'event is not approved for digital scoring';
  end if;
  return new;
end;
$$;

revoke all on function app.require_confirmation_game_eligibility() from public, anon, authenticated;

drop trigger if exists require_confirmation_game_eligibility on app.score_confirmations;
create trigger require_confirmation_game_eligibility
before insert on app.score_confirmations
for each row execute function app.require_confirmation_game_eligibility();
