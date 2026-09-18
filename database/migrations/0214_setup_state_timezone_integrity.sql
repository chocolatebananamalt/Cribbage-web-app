-- Enforce the same State/Territory-aware IANA time-zone boundary on the
-- database that Tournament Setup presents in the application.

create or replace function app.validate_tournament_setup_state_timezone_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Historical revisions intentionally retain an empty State/Territory.
  if trim(new.state_territory)='' then return new; end if;
  if new.timezone_name not in(
    'America/Anchorage','Pacific/Honolulu','America/Los_Angeles',
    'America/Denver','America/Chicago','America/New_York',
    'America/Phoenix','America/Puerto_Rico','Pacific/Pago_Pago','Pacific/Guam'
  ) then raise exception 'invalid tournament time zone'; end if;
  if (new.state_territory='Alaska' and new.timezone_name<>'America/Anchorage')
    or (new.state_territory='Hawaii' and new.timezone_name<>'Pacific/Honolulu')
    or (new.state_territory='Arizona' and new.timezone_name<>'America/Phoenix')
    or (new.state_territory in('Puerto Rico','U.S. Virgin Islands') and new.timezone_name<>'America/Puerto_Rico')
    or (new.state_territory='American Samoa' and new.timezone_name<>'Pacific/Pago_Pago')
    or (new.state_territory in('Guam','Northern Mariana Islands') and new.timezone_name<>'Pacific/Guam')
    or (new.state_territory not in('Alaska','Hawaii','Arizona','Puerto Rico','U.S. Virgin Islands','American Samoa','Guam','Northern Mariana Islands')
      and new.timezone_name not in('America/Los_Angeles','America/Denver','America/Chicago','America/New_York')) then
    raise exception 'time zone does not match State/Territory';
  end if;
  return new;
end $$;
revoke all on function app.validate_tournament_setup_state_timezone_v1() from public,anon,authenticated;

create trigger tournament_setup_revision_timezone_validation
before insert on app.tournament_setup_revisions
for each row execute function app.validate_tournament_setup_state_timezone_v1();
