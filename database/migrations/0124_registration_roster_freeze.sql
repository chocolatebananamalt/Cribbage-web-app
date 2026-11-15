-- Keep roster membership aligned with the registration window and open
-- registration when an approved setup activation first opens a tournament.

create or replace function app.require_open_registration_for_roster_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app
as $$
declare
  v_tournament_status text;
  v_registration_status text;
begin
  select t.status, t.registration_status
    into v_tournament_status, v_registration_status
  from app.tournaments t
  where t.id = new.tournament_id
  for update;

  if not found
     or v_tournament_status not in ('draft', 'open')
     or v_registration_status <> 'open' then
    raise exception using
      errcode = 'P0001',
      message = 'registration is closed; roster membership is frozen';
  end if;

  return new;
end;
$$;

revoke all on function app.require_open_registration_for_roster_insert() from public, anon, authenticated;

drop trigger if exists tournament_roster_entries_require_open_registration
  on app.tournament_roster_entries;
create trigger tournament_roster_entries_require_open_registration
before insert on app.tournament_roster_entries
for each row execute function app.require_open_registration_for_roster_insert();

create or replace function app.open_registration_on_tournament_activation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app
as $$
begin
  if old.status = 'draft'
     and new.status = 'open'
     and old.registration_status = 'closed'
     and exists (
       select 1
       from app.tournament_setup_activations activation
       where activation.tournament_id = old.id
     ) then
    new.registration_status := 'open';
  end if;

  return new;
end;
$$;

revoke all on function app.open_registration_on_tournament_activation() from public, anon, authenticated;

drop trigger if exists tournaments_open_registration_on_activation on app.tournaments;
create trigger tournaments_open_registration_on_activation
before update of status on app.tournaments
for each row execute function app.open_registration_on_tournament_activation();
