-- Two guards that refuse work the director is entitled to do.
--
-- Both are single conditions inside large functions that are otherwise correct,
-- so each is patched in place from its own deployed source. The replace() is
-- asserted: if the anchor text ever moves, the migration raises instead of
-- silently doing nothing, which is the failure mode a blind replace would have.
--
-- 1. Exceptional Event Changes could never run in the window it exists for.
--
-- change_event_lifecycle_v1 requires registration_status='open'. But
-- start_event_play_v1 and the team starts REQUIRE registration_status='closed',
-- and the director closes registration from the Seating page. So across the
-- whole interval "registration closed, play not started" the Cancel/Retire and
-- Cancel/Replace buttons render, enable, and open their confirmation dialog,
-- and the RPC then refuses with registration_not_open. That interval is exactly
-- when a director cancels an under-subscribed Satellite.
--
-- Relaxing this does NOT weaken the real protection. The function separately
-- rejects event_already_started from app.event_play_starts and
-- app.event_team_starts, both scoped to p_event_id, and that guard is what
-- makes a lifecycle change safe. Registration state was never the safety
-- property; it was standing in for one.
--
-- 2. Removing one player from the roster died tournament-wide.
--
-- set_roster_entry_active_status_v1 blocks withdraw/reinstate when there is
-- downstream activity. Four of its six predicates scope to p_roster_entry_id.
-- The two start predicates do not: they ask only whether ANY event in the
-- tournament has started. So the moment the first event starts, no player can
-- be withdrawn, including one enrolled in nothing, with no payment, no seat and
-- no check-in. The confirm panel meanwhile promises that withdrawal preserves
-- registration, payments, seating and audit history, which is the opposite of
-- what the guard does.
--
-- Scoped to the player's own events instead, through app.event_participants for
-- singles and app.event_team_members for team events. A membership predicate is
-- added alongside, so a team member is blocked exactly as an event_participants
-- row already blocks a singles player rather than falling through the gap that
-- scoping the start predicates would otherwise open.
do $do$
declare v_src text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'change_event_lifecycle_v1';
  if v_src is null then raise exception 'change_event_lifecycle_v1 is not present'; end if;

  v_new := replace(v_src,
    'v_tournament.registration_status <> ''open''',
    'v_tournament.registration_status not in (''open'', ''closed'')');
  if v_new = v_src then
    raise exception 'change_event_lifecycle_v1: registration_status guard not found, refusing to apply';
  end if;
  execute v_new;
end
$do$;

do $do$
declare v_src text; v_new text; v_old_guard text; v_new_guard text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_roster_entry_active_status_v1';
  if v_src is null then raise exception 'set_roster_entry_active_status_v1 is not present'; end if;

  v_old_guard :=
    'exists(select 1 from app.event_play_starts where tournament_id=p_tournament_id)'
    || ' or exists(select 1 from app.event_team_starts where tournament_id=p_tournament_id)';

  v_new_guard :=
    'exists(select 1 from app.event_play_starts s join app.event_participants ep'
    || ' on ep.event_id=s.event_id and ep.tournament_id=s.tournament_id'
    || ' where s.tournament_id=p_tournament_id and ep.roster_entry_id=p_roster_entry_id)'
    || ' or exists(select 1 from app.event_team_starts s join app.event_team_members m'
    || ' on m.event_id=s.event_id and m.tournament_id=s.tournament_id'
    || ' where s.tournament_id=p_tournament_id and m.roster_entry_id=p_roster_entry_id)'
    || ' or exists(select 1 from app.event_team_members where tournament_id=p_tournament_id and roster_entry_id=p_roster_entry_id)';

  v_new := replace(v_src, v_old_guard, v_new_guard);
  if v_new = v_src then
    raise exception 'set_roster_entry_active_status_v1: start guard not found, refusing to apply';
  end if;
  execute v_new;
end
$do$;
