-- Freeze participant identity when either the source or destination event has
-- a published schedule. This closes the UPDATE case where a participant could
-- otherwise be moved from an unpublished event into a published event.

create or replace function app.protect_scheduled_event_participant()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from app.event_schedule_publications p where p.event_id = new.event_id) then
      raise exception 'published event participant set is immutable';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if exists (select 1 from app.event_schedule_publications p where p.event_id = old.event_id) then
      raise exception 'published event participant set is immutable';
    end if;
    return old;
  end if;

  if exists (
    select 1 from app.event_schedule_publications p
    where p.event_id in (old.event_id, new.event_id)
  ) and (
    new.tournament_id is distinct from old.tournament_id
    or new.event_id is distinct from old.event_id
    or new.profile_id is distinct from old.profile_id
    or new.roster_entry_id is distinct from old.roster_entry_id
    or new.table_seat is distinct from old.table_seat
  ) then
    raise exception 'published event participant identity is immutable';
  end if;

  return new;
end;
$$;

revoke all on function app.protect_scheduled_event_participant()
  from public, anon, authenticated;
