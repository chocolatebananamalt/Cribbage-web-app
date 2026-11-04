begin;
-- Fresh initial publication only. Existing accepted receipts and historical
-- currentness are unchanged. Audited later reseating keeps permanent IDs.
-- No new tables, RPC signatures, grants or human permissions. Own-name display only.
do $migration$
declare definition text; marker text; guard text;
begin
  definition:=pg_get_functiondef('app.publish_director_reviewed_event_schedule_core_v1(uuid,uuid,uuid,jsonb,uuid)'::regprocedure);
  marker:='    select sev.game_count into v_game_count';
  guard:=$patch$    if exists (select 1 from jsonb_array_elements(p_matches) initial_row(value)
      where initial_row.value->>'gameNumber'='1' and
        (initial_row.value->>'sideAVerificationId' is distinct from initial_row.value->>'sideATableSeat'
         or initial_row.value->>'sideBVerificationId' is distinct from initial_row.value->>'sideBTableSeat')) then
      raise exception using errcode='P0001',message='invalid schedule';
    end if;

$patch$;
  if (length(definition)-length(replace(definition,marker,'')))/length(marker)<>1
    or position('return v_existing.response_payload;' in definition)>position(marker in definition)
    or position('return v_existing.response_payload;' in definition)=0 then
    raise exception 'Unexpected standard publisher/replay layout; refusing modification';
  end if;
  execute replace(definition,marker,guard||marker);

  definition:=pg_get_functiondef('public.publish_odd_field_makeup_schedule_v1(uuid,uuid,uuid,jsonb,uuid)'::regprocedure);
  marker:=' else plan:=app.derive_odd_field_makeup_plan_v1';
  guard:=$patch$ elsif jsonb_typeof(request->'regularMatches') is distinct from 'array' then code:='invalid_schedule';
 elsif exists(select 1 from jsonb_array_elements(request->'regularMatches') initial_row(value)
   where initial_row.value->>'gameNumber'='1' and
    (initial_row.value->>'sideAVerificationId' is distinct from initial_row.value->>'sideATableSeat'
     or initial_row.value->>'sideBVerificationId' is distinct from initial_row.value->>'sideBTableSeat'))then code:='invalid_schedule';
$patch$;
  if (length(definition)-length(replace(definition,marker,'')))/length(marker)<>1
    or position('return prior.response_payload;' in definition)>position(marker in definition)
    or position('return prior.response_payload;' in definition)=0 then
    raise exception 'Unexpected odd publisher/replay layout; refusing modification';
  end if;
  execute replace(definition,marker,guard||marker);
  definition:=pg_get_functiondef('public.get_my_assigned_games_v1(uuid)'::regprocedure);
  marker:=$reader$'progressionStatus',progress.status$reader$;
  guard:=$reader$'playerName',coalesce((select roster.claimed_display_name from app.tournament_roster_entries roster where roster.id=participant.roster_entry_id and roster.tournament_id=p_tournament_id),(select profile.display_name from app.profiles profile where profile.id=participant.profile_id)),'progressionStatus',progress.status$reader$;
  if (length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then
    raise exception 'Unexpected assigned-games reader layout; refusing modification';
  end if;
  execute replace(definition,marker,guard);
end $migration$;
-- Intentionally leave derive_odd_field_makeup_plan_v1 and all existing
-- publication/currentness/amendment evidence untouched. Game-1 sit-outs have
-- no row to check; later returns/rotations are not constrained by this rule.
notify pgrst,'reload schema';
commit;
