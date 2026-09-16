-- A scoreless legacy paper team event has an immutable paper-only ruleset.
-- Its guarded Digital/Paper upgrade must append a documented Appendix-B
-- ruleset and repoint only that unstarted event; it must never rewrite the
-- original paper configuration or its setup activation history.

create or replace function app.enable_supported_doubles_ruleset_v1()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.format in('doubles','canadian_doubles') then
    new.name:=case when new.format='doubles' then 'ACC 2025 Traditional Doubles' else 'ACC 2025 Canadian Doubles' end || ' / ruleset ' || new.id::text;
    new.source_reference:='ACC Official Tournament Rules 2025 Appendix B; sha256=db284283420259c99cfcc960bfdf4a6b79c95a5fc1bee02b1817b4af4a02f9fd; scope=two_person_'||new.format||'_digital_and_paper_team_scoring';
    new.approved_at:=coalesce(new.approved_at,clock_timestamp());
  end if;
  return new;
end $$;
drop trigger if exists ruleset_enable_supported_doubles on app.ruleset_versions;
create trigger ruleset_enable_supported_doubles before insert on app.ruleset_versions for each row execute function app.enable_supported_doubles_ruleset_v1();

create or replace function public.enable_supported_team_scoring_v1(p_actor_id uuid,p_tournament_id uuid,p_event_ids jsonb,p_parent_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request_hash text;derived_hex text;derived_operation_id uuid;prior app.operation_receipts%rowtype;
  receipt_id uuid:=extensions.gen_random_uuid();response jsonb;event_id_value uuid;event_row app.events%rowtype;ruleset_id_value uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' or jsonb_typeof(p_event_ids)<>'array' or jsonb_array_length(p_event_ids)<1
     or jsonb_array_length(p_event_ids)>32 or p_parent_operation_id is null
     or (select count(distinct value) from jsonb_array_elements_text(p_event_ids))<>jsonb_array_length(p_event_ids)
     or exists(select 1 from jsonb_array_elements_text(p_event_ids) item where item!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then
    return jsonb_build_object('status','rejected','code','not_director');
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
  if not exists(select 1 from app.tournaments where id=p_tournament_id and status in('draft','open') and registration_status='open') then
    return jsonb_build_object('status','rejected','code','event_not_upgradeable');
  end if;
  for event_id_value in select value::uuid from jsonb_array_elements_text(p_event_ids) order by value loop
    select * into event_row from app.events where id=event_id_value and tournament_id=p_tournament_id for update;
    if not found or event_row.format not in('doubles','canadian_doubles') or event_row.scoring_method<>'manual'
       or exists(select 1 from app.event_team_seating_publications where event_id=event_id_value)
       or exists(select 1 from app.event_team_schedule_publications where event_id=event_id_value)
       or exists(select 1 from app.event_team_games where event_id=event_id_value)
       or exists(select 1 from app.event_team_starts where event_id=event_id_value)
       or exists(select 1 from app.event_team_score_submissions where event_id=event_id_value)
       or exists(select 1 from app.event_team_score_confirmations where event_id=event_id_value)
       or exists(select 1 from app.event_team_scorelines where event_id=event_id_value)
       or exists(select 1 from app.event_team_score_corrections where event_id=event_id_value)
       or exists(select 1 from app.event_team_score_correction_reviews where event_id=event_id_value)
       or exists(select 1 from app.event_team_offline_capabilities where event_id=event_id_value)
       or exists(select 1 from app.event_team_offline_replays where event_id=event_id_value)
       or exists(select 1 from app.event_team_paper_score_evidence where event_id=event_id_value)
       or exists(select 1 from app.event_team_paper_score_reviews where event_id=event_id_value) then
      return jsonb_build_object('status','rejected','code','event_not_upgradeable');
    end if;
  end loop;
  response:=jsonb_build_object('status','supported_team_scoring_enabled','eventIds',p_event_ids,'eventCount',jsonb_array_length(p_event_ids),'rulesetUpgraded',true);
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(receipt_id,p_actor_id,p_tournament_id,'enable_supported_team_scoring_v1',p_tournament_id,request_hash,derived_operation_id,'accepted',response,clock_timestamp());
  for event_id_value in select value::uuid from jsonb_array_elements_text(p_event_ids) order by value loop
    select * into event_row from app.events where id=event_id_value and tournament_id=p_tournament_id for update;
    ruleset_id_value:=extensions.gen_random_uuid();
    insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at)
      values(ruleset_id_value,p_tournament_id,'Appendix B team-scoring upgrade / event '||event_id_value::text,event_row.format,null,null,null);
    update app.events set scoring_method='digital',ruleset_version_id=ruleset_id_value where id=event_id_value and tournament_id=p_tournament_id;
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
      values(p_tournament_id,p_actor_id,receipt_id,'event',event_id_value,'supported_team_scoring_enabled',jsonb_build_object('scoringMethod','manual','rulesetVersionId',event_row.ruleset_version_id),jsonb_build_object('scoringMethod','digital','rulesetVersionId',ruleset_id_value,'rulesetSource','ACC Official Tournament Rules 2025 Appendix B'));
  end loop;
  return response;
end $$;
revoke all on function public.enable_supported_team_scoring_v1(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.enable_supported_team_scoring_v1(uuid,uuid,jsonb,uuid) to service_role;

notify pgrst,'reload schema';
