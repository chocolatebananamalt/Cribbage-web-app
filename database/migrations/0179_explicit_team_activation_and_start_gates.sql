-- Make supported two-person team scoring an explicit, audited setup action.
-- This replaces the broad insert triggers removed by migration 0178.

create or replace function public.enable_supported_team_scoring_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_ids jsonb,p_parent_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request_hash text; derived_hex text; derived_operation_id uuid; prior app.operation_receipts%rowtype;
  receipt_id uuid:=extensions.gen_random_uuid(); response jsonb; event_id_value uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' or jsonb_typeof(p_event_ids)<>'array'
    or jsonb_array_length(p_event_ids)>32 or p_parent_operation_id is null then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then
    return jsonb_build_object('status','rejected','code','not_director');
  end if;
  if exists(select 1 from jsonb_array_elements_text(p_event_ids) item where item!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  request_hash:=encode(extensions.digest(convert_to(jsonb_build_array('enable_supported_team_scoring_v1',p_actor_id,p_tournament_id,p_event_ids,p_parent_operation_id)::text,'utf8'),'sha256'),'hex');
  derived_hex:=encode(extensions.digest(convert_to(p_parent_operation_id::text||':enable-supported-team-scoring','utf8'),'sha256'),'hex');
  derived_operation_id:=(substr(derived_hex,1,8)||'-'||substr(derived_hex,9,4)||'-4'||substr(derived_hex,14,3)||'-a'||substr(derived_hex,18,3)||'-'||substr(derived_hex,21,12))::uuid;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-event-enable:'||p_tournament_id::text,0));
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=derived_operation_id;
  if found then
    if prior.request_hash<>request_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
    return prior.response_payload;
  end if;
  if (select count(*) from app.events event_row where event_row.tournament_id=p_tournament_id and event_row.id in(select value::uuid from jsonb_array_elements_text(p_event_ids)))<>jsonb_array_length(p_event_ids)
    or exists(select 1 from app.events event_row where event_row.tournament_id=p_tournament_id and event_row.id in(select value::uuid from jsonb_array_elements_text(p_event_ids)) and event_row.format not in('doubles','canadian_doubles'))
    or exists(select 1 from app.events event_row where event_row.tournament_id=p_tournament_id and event_row.id in(select value::uuid from jsonb_array_elements_text(p_event_ids)) and (exists(select 1 from app.event_team_starts start_record where start_record.event_id=event_row.id) or exists(select 1 from app.event_team_score_submissions submission where submission.event_id=event_row.id))) then
    return jsonb_build_object('status','rejected','code','event_not_upgradeable');
  end if;
  update app.events set scoring_method='digital' where tournament_id=p_tournament_id and id in(select value::uuid from jsonb_array_elements_text(p_event_ids)) and scoring_method<>'digital';
  response:=jsonb_build_object('status','supported_team_scoring_enabled','eventIds',p_event_ids,'eventCount',jsonb_array_length(p_event_ids));
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(receipt_id,p_actor_id,p_tournament_id,'enable_supported_team_scoring_v1',p_tournament_id,request_hash,derived_operation_id,'accepted',response,clock_timestamp());
  for event_id_value in select value::uuid from jsonb_array_elements_text(p_event_ids) loop
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
      values(p_tournament_id,p_actor_id,receipt_id,'event',event_id_value,'supported_team_scoring_enabled',jsonb_build_object('parentOperationId',p_parent_operation_id,'scoringMethod','digital'));
  end loop;
  return response;
end $$;
revoke all on function public.enable_supported_team_scoring_v1(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.enable_supported_team_scoring_v1(uuid,uuid,jsonb,uuid) to service_role;

-- Team seating is published only after registration closes. Completeness is
-- rechecked at commit so a publication can never expose a partial directory.
create or replace function app.assert_team_seating_complete_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare assignment_count integer; team_count integer;
begin
  if not exists(select 1 from app.tournaments tournament where tournament.id=new.tournament_id and tournament.registration_status='closed') then
    raise exception 'team seating requires closed registration';
  end if;
  select count(*) into assignment_count from app.event_team_seating_assignments assignment where assignment.publication_id=new.id;
  select count(*) into team_count from app.event_team_entries entry where entry.event_id=new.event_id and entry.tournament_id=new.tournament_id;
  if team_count<2 or assignment_count<>team_count then raise exception 'team seating is incomplete'; end if;
  return new;
end $$;
drop trigger if exists event_team_seating_complete on app.event_team_seating_publications;
create constraint trigger event_team_seating_complete after insert on app.event_team_seating_publications
deferrable initially deferred for each row execute function app.assert_team_seating_complete_v1();

-- Start remains the final fail-closed boundary even if data was inserted by a
-- trusted maintenance path instead of the public RPC.
create or replace function app.assert_team_start_ready_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from app.tournaments tournament where tournament.id=new.tournament_id and tournament.status='open' and tournament.registration_status='closed')
    or not exists(select 1 from app.event_team_seating_publications seating where seating.event_id=new.event_id and seating.tournament_id=new.tournament_id)
    or not exists(select 1 from app.event_team_schedule_publications publication where publication.id=new.schedule_publication_id and publication.event_id=new.event_id and publication.tournament_id=new.tournament_id)
    or exists(select 1 from app.event_team_entries entry left join lateral(select * from app.event_team_entry_versions version where version.team_entry_id=entry.id order by version.version desc limit 1) current_version on true where entry.event_id=new.event_id and (current_version.id is null or (current_version.scorecard_type='digital' and (current_version.designated_scorer_profile_id is null or not exists(select 1 from app.event_team_members member where member.team_id=entry.team_id and member.profile_id=current_version.designated_scorer_profile_id))))) then
    raise exception 'team event is not ready to start';
  end if;
  return new;
end $$;
drop trigger if exists event_team_start_ready on app.event_team_starts;
create trigger event_team_start_ready before insert on app.event_team_starts
for each row execute function app.assert_team_start_ready_v1();

notify pgrst,'reload schema';
