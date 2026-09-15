-- Automatic, source-versioned Main/Consolation MRP calculation.
-- Source: ACC published MainMRPs2017ver2.pdf and ConsMRPs2017ver2.pdf,
-- both explicitly effective 2016-08-01. Satellite events remain excluded.

alter table app.standard_singles_playoff_placement_rows
  add column mrp_playoff_exit_round smallint check (mrp_playoff_exit_round between 1 and 9);

create or replace function app.standard_singles_automatic_mrps_v1(
  p_tournament_id uuid,p_event_id uuid,p_qualification_result_version_id uuid,p_playoff_result_version_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_kind text; v_format text; v_games integer; v_qualifiers integer;
  v_scale integer; v_playoff_scale integer; v_threshold integer;
  v_count integer; v_rows jsonb;
  v_source text := 'ACC published MRP schedule effective 2016-08-01';
begin
  select setup_event.event_kind,setup_event.format_code,setup_event.game_count,qualification.qualifier_count
    into v_kind,v_format,v_games,v_qualifiers
    from app.qualification_result_versions qualification
    join app.tournament_setup_activations activation
      on activation.tournament_id=qualification.tournament_id and activation.event_id=qualification.event_id
    join app.tournament_setup_event_versions setup_event on setup_event.id=activation.setup_event_version_id
    where qualification.id=p_qualification_result_version_id
      and qualification.tournament_id=p_tournament_id and qualification.event_id=p_event_id;
  if v_kind not in ('main','consolation') or v_format<>'standard_singles' then
    return jsonb_build_object('status','blocked','sourceVersion','acc-published-mrp-2016-08-01','effectiveDate','2016-08-01','code','unsupported_event');
  end if;
  if v_kind='main' then
    v_scale:=5; v_playoff_scale:=7;
    v_threshold:=case v_games when 12 then 14 when 14 then 17 when 16 then 20 when 18 then 22 when 20 then 25 when 21 then 26 when 22 then 27 end;
  else
    v_scale:=3; v_playoff_scale:=4;
    v_threshold:=case v_games when 7 then 9 when 8 then 11 when 9 then 12 when 10 then 13 when 12 then 16 end;
  end if;
  if v_threshold is null then
    return jsonb_build_object('status','blocked','sourceVersion','acc-published-mrp-2016-08-01','effectiveDate','2016-08-01','code','unsupported_game_count');
  end if;
  select count(*) into v_count from app.standard_singles_playoff_placement_rows row_data
    join app.qualification_result_rows qualifier on qualifier.result_version_id=p_qualification_result_version_id
      and qualifier.participant_id=row_data.participant_id and qualifier.qualification_status='qualified'
    where row_data.playoff_result_version_id=p_playoff_result_version_id and row_data.mrp_playoff_exit_round is not null;
  if v_count<>v_qualifiers then
    return jsonb_build_object('status','blocked','sourceVersion','acc-published-mrp-2016-08-01','effectiveDate','2016-08-01','code','complete_playoff_rounds_required');
  end if;
  if exists(select 1 from app.qualification_result_rows row_data
      where row_data.result_version_id=p_qualification_result_version_id and row_data.qualification_status='qualified'
        and row_data.ranking_ordinal<=ceil(v_qualifiers::numeric/2)::integer and row_data.game_points<v_threshold) then
    return jsonb_build_object('status','blocked','sourceVersion','acc-published-mrp-2016-08-01','effectiveDate','2016-08-01','code','below_published_threshold');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'participantId',qualifier.participant_id,'displayName',qualifier.display_name_snapshot,
    'qualificationRank',qualifier.ranking_ordinal,'gamePoints',qualifier.game_points,
    'qualifyingMrp',case when qualifier.ranking_ordinal<=ceil(v_qualifiers::numeric/2)::integer
      then v_scale*(qualifier.game_points-v_threshold+1) else v_scale end,
    'playoffMrp',v_playoff_scale*row_data.mrp_playoff_exit_round*(row_data.mrp_playoff_exit_round+1)/2,
    'totalMrp',(case when qualifier.ranking_ordinal<=ceil(v_qualifiers::numeric/2)::integer
      then v_scale*(qualifier.game_points-v_threshold+1) else v_scale end)
      +v_playoff_scale*row_data.mrp_playoff_exit_round*(row_data.mrp_playoff_exit_round+1)/2,
    'evidenceNote',v_source) order by qualifier.ranking_ordinal),'[]'::jsonb) into v_rows
    from app.qualification_result_rows qualifier
    join app.standard_singles_playoff_placement_rows row_data
      on row_data.qualification_result_version_id=qualifier.result_version_id and row_data.participant_id=qualifier.participant_id
    where qualifier.result_version_id=p_qualification_result_version_id and qualifier.qualification_status='qualified'
      and row_data.playoff_result_version_id=p_playoff_result_version_id;
  return jsonb_build_object('status','available','sourceVersion','acc-published-mrp-2016-08-01','effectiveDate','2016-08-01','rows',v_rows);
end $$;
revoke all on function app.standard_singles_automatic_mrps_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.record_standard_singles_playoff_placements_v2(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_qualification_result_version_id uuid,
  p_expected_version integer,p_placements jsonb,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_hash text; v_existing app.operation_receipts%rowtype; v_authorized boolean:=false;
  v_qualification app.qualification_result_versions%rowtype; v_current_version integer; v_prior_id uuid;
  v_result_id uuid:=extensions.gen_random_uuid(); v_receipt_id uuid:=extensions.gen_random_uuid();
  v_recorded_at timestamptz:=clock_timestamp(); v_response jsonb; v_code text;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'server-only playoff placement recording'; end if;
  begin
    if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_qualification_result_version_id is null
      or p_expected_version is null or p_expected_version<0 or p_operation_id is null then raise exception 'invalid playoff placement request'; end if;
    v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('record_standard_singles_playoff_placements_v2',p_actor_id,p_tournament_id,p_event_id,p_qualification_result_version_id,p_expected_version,p_placements)::text,'utf8'),'sha256'),'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('standard-singles-post-event:'||p_event_id::text,0));
    perform 1 from app.tournaments tournament_row where tournament_row.id=p_tournament_id and tournament_row.status='open' for update;
    if not found then raise exception 'tournament unavailable'; end if;
    perform 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director') for update;
    if not found then raise exception 'director role required'; end if; v_authorized:=true;
    select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
    if found then
      if v_existing.tournament_id<>p_tournament_id or v_existing.operation_type<>'record_standard_singles_playoff_placements_v2' or v_existing.target_id<>p_event_id or v_existing.request_hash<>v_hash then
        insert into app.standard_singles_playoff_result_conflicts(tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)
          values(p_tournament_id,p_actor_id,p_event_id,p_operation_id,v_hash,case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
        return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
      end if; return v_existing.response_payload;
    end if;
    select * into v_qualification from app.qualification_result_versions qualification where qualification.id=p_qualification_result_version_id and qualification.tournament_id=p_tournament_id and qualification.event_id=p_event_id for update;
    if not found or exists(select 1 from app.qualification_result_versions newer where newer.event_id=p_event_id and newer.version>v_qualification.version)
      or not exists(select 1 from app.events event_row where event_row.id=p_event_id and event_row.tournament_id=p_tournament_id and event_row.format='standard_singles' and event_row.scoring_method='digital') then raise exception 'qualification result unavailable'; end if;
    select coalesce(max(version),0) into v_current_version from app.standard_singles_playoff_result_versions where event_id=p_event_id;
    select id into v_prior_id from app.standard_singles_playoff_result_versions where event_id=p_event_id order by version desc limit 1;
    if p_expected_version<>v_current_version then raise exception 'stale playoff placement version'; end if;
    if p_placements is null or jsonb_typeof(p_placements)<>'array' or jsonb_array_length(p_placements)<>v_qualification.qualifier_count
      or exists(select 1 from jsonb_array_elements(p_placements) item where jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>3 or not(item ?& array['participantId','placement','mrpPlayoffExitRound'])
        or (item->>'participantId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or (item->>'placement')!~'^[1-9][0-9]*$' or (item->>'mrpPlayoffExitRound')!~'^[1-9]$')
      or (select count(distinct (item->>'participantId')::uuid) from jsonb_array_elements(p_placements) item)<>v_qualification.qualifier_count
      or (select count(distinct (item->>'placement')::integer) from jsonb_array_elements(p_placements) item)<>v_qualification.qualifier_count
      or (select min((item->>'placement')::integer) from jsonb_array_elements(p_placements) item)<>1
      or (select max((item->>'placement')::integer) from jsonb_array_elements(p_placements) item)<>v_qualification.qualifier_count
      or (select count(*) from jsonb_array_elements(p_placements) item join app.qualification_result_rows qualifier on qualifier.result_version_id=p_qualification_result_version_id and qualifier.participant_id=(item->>'participantId')::uuid and qualifier.qualification_status='qualified')<>v_qualification.qualifier_count
    then raise exception 'invalid playoff placements'; end if;
    v_response:=jsonb_build_object('status','playoff_placements_recorded','tournamentId',p_tournament_id,'eventId',p_event_id,'qualificationResultVersionId',p_qualification_result_version_id,'playoffResultVersionId',v_result_id,'version',v_current_version+1,'supersedesPlayoffResultVersionId',v_prior_id,'placementCount',v_qualification.qualifier_count,'recordedAt',v_recorded_at);
    insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt_id,p_tournament_id,p_actor_id,'record_standard_singles_playoff_placements_v2',p_event_id,v_hash,p_operation_id,'accepted',v_response,v_recorded_at);
    insert into app.standard_singles_playoff_result_versions(id,tournament_id,event_id,qualification_result_version_id,version,supersedes_playoff_result_version_id,placement_count,recorded_by_profile_id,operation_receipt_id,recorded_at) values(v_result_id,p_tournament_id,p_event_id,p_qualification_result_version_id,v_current_version+1,v_prior_id,v_qualification.qualifier_count,p_actor_id,v_receipt_id,v_recorded_at);
    insert into app.standard_singles_playoff_placement_rows(playoff_result_version_id,tournament_id,event_id,qualification_result_version_id,participant_id,placement,display_name_snapshot,mrp_playoff_exit_round)
      select v_result_id,p_tournament_id,p_event_id,p_qualification_result_version_id,qualifier.participant_id,(item->>'placement')::integer,qualifier.display_name_snapshot,(item->>'mrpPlayoffExitRound')::integer from jsonb_array_elements(p_placements) item join app.qualification_result_rows qualifier on qualifier.result_version_id=p_qualification_result_version_id and qualifier.participant_id=(item->>'participantId')::uuid;
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state) values(p_tournament_id,p_actor_id,v_receipt_id,'standard_singles_playoff_result_version',v_result_id,'standard_singles_playoff_placements_recorded_v2',case when v_prior_id is null then null else jsonb_build_object('supersedesPlayoffResultVersionId',v_prior_id,'priorVersion',v_current_version) end,v_response);
    return v_response;
  exception when others then
    if sqlerrm in('tournament unavailable','director role required','qualification result unavailable','stale playoff placement version','invalid playoff placements','invalid playoff placement request') then
      v_code:=case sqlerrm when 'tournament unavailable' then 'tournament_unavailable' when 'director role required' then 'not_director' when 'qualification result unavailable' then 'qualification_result_unavailable' when 'stale playoff placement version' then 'stale_version' when 'invalid playoff placements' then 'invalid_placements' else 'invalid_request' end;
      v_response:=jsonb_build_object('status','rejected','code',v_code,'eventId',p_event_id);
      if v_authorized and p_operation_id is not null and v_hash is not null then
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
        perform 1 from app.tournaments tournament_row where tournament_row.id=p_tournament_id and tournament_row.status='open' for update; if not found then return v_response; end if;
        perform 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director') for update; if not found then return v_response; end if;
        select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
        if found then
          if v_existing.tournament_id<>p_tournament_id or v_existing.operation_type<>'record_standard_singles_playoff_placements_v2' or v_existing.target_id<>p_event_id or v_existing.request_hash<>v_hash then
            insert into app.standard_singles_playoff_result_conflicts(tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code) values(p_tournament_id,p_actor_id,p_event_id,p_operation_id,v_hash,case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict'); return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
          end if; return v_existing.response_payload;
        end if;
        insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_tournament_id,p_actor_id,'record_standard_singles_playoff_placements_v2',coalesce(p_event_id,p_tournament_id),v_hash,p_operation_id,'rejected',v_response,clock_timestamp()) returning id into v_receipt_id;
        insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt_id,'standard_singles_playoff_result_version',coalesce(p_event_id,p_tournament_id),'standard_singles_playoff_placements_v2_rejected',v_response);
      end if; return v_response;
    end if; raise;
  end;
end $$;

create or replace function public.get_standard_singles_playoff_placement_workspace_v2(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with allowed as(select 1 where coalesce(auth.role(),'')='service_role' and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director'))),
qv as(select * from app.qualification_result_versions where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1),
current_result as(select * from app.standard_singles_playoff_result_versions where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1)
select jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'qualificationResultVersionId',qv.id,'currentVersion',coalesce(current_result.version,0),
 'qualifierChoices',coalesce((select jsonb_agg(jsonb_build_object('participantId',r.participant_id,'displayName',r.display_name_snapshot,'qualificationRank',r.ranking_ordinal) order by r.ranking_ordinal) from app.qualification_result_rows r where r.result_version_id=qv.id and r.qualification_status='qualified'),'[]'::jsonb),
 'playoffResult',case when current_result.id is null then null else jsonb_build_object('playoffResultVersionId',current_result.id,'version',current_result.version,'recordedAt',current_result.recorded_at,'recordedBy',coalesce(nullif(trim(p.display_name),''),'Director or co-director'),
   'placements',coalesce((select jsonb_agg(jsonb_build_object('participantId',row_data.participant_id,'displayName',row_data.display_name_snapshot,'placement',row_data.placement,'mrpPlayoffExitRound',row_data.mrp_playoff_exit_round) order by row_data.placement) from app.standard_singles_playoff_placement_rows row_data where row_data.playoff_result_version_id=current_result.id),'[]'::jsonb)) end,
 'capabilities',jsonb_build_object('mrpCalculation',true,'qPoolCalculation',false,'payoutCalculation',false,'publication',false))
from allowed cross join qv left join current_result on true left join app.profiles p on p.id=current_result.recorded_by_profile_id
$$;

create or replace function public.get_standard_singles_settlement_workspace_v4(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb; v_auto jsonb; v_qualification_id uuid; v_playoff_id uuid;
begin
  v_base:=public.get_standard_singles_settlement_workspace_v3(p_actor_id,p_tournament_id,p_event_id); if v_base is null then return null; end if;
  v_qualification_id:=(v_base->>'qualificationResultVersionId')::uuid; v_playoff_id:=(v_base->'playoffResult'->>'playoffResultVersionId')::uuid;
  if v_playoff_id is null then v_auto:=jsonb_build_object('status','blocked','sourceVersion','acc-published-mrp-2016-08-01','effectiveDate','2016-08-01','code','complete_playoff_rounds_required'); else v_auto:=app.standard_singles_automatic_mrps_v1(p_tournament_id,p_event_id,v_qualification_id,v_playoff_id); end if;
  return v_base||jsonb_build_object('automaticMrp',v_auto,'capabilities',jsonb_build_object('publication',false,'approval',false,'officialExport',false,'mrpTranscription',false,'mrpCalculation',true));
end $$;

create or replace function public.save_standard_singles_settlement_draft_v4(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_qualification_result_version_id uuid,p_playoff_result_version_id uuid,
  p_expected_version integer,p_placements jsonb,p_awards jsonb,p_mrp_claims jsonb,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_auto jsonb; v_expected jsonb; v_inner_id uuid; v_result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'server-only settlement draft'; end if;
  v_auto:=app.standard_singles_automatic_mrps_v1(p_tournament_id,p_event_id,p_qualification_result_version_id,p_playoff_result_version_id);
  if v_auto->>'status'<>'available' then return jsonb_build_object('status','rejected','code','automatic_mrp_unavailable','eventId',p_event_id); end if;
  select coalesce(jsonb_agg(jsonb_build_object('participantId',row_data->>'participantId','mrpPoints',(row_data->>'totalMrp')::integer,'evidenceNote',row_data->>'evidenceNote') order by (row_data->>'qualificationRank')::integer),'[]'::jsonb) into v_expected from jsonb_array_elements(v_auto->'rows') row_data;
  if p_mrp_claims is distinct from v_expected then return jsonb_build_object('status','rejected','code','automatic_mrp_mismatch','eventId',p_event_id); end if;
  v_inner_id:=(substr(md5(p_operation_id::text||':settlement-v4'),1,8)||'-'||substr(md5(p_operation_id::text||':settlement-v4'),9,4)||'-4'||substr(md5(p_operation_id::text||':settlement-v4'),14,3)||'-8'||substr(md5(p_operation_id::text||':settlement-v4'),18,3)||'-'||substr(md5(p_operation_id::text||':settlement-v4'),21,12))::uuid;
  v_result:=public.save_standard_singles_settlement_draft_v3(p_actor_id,p_tournament_id,p_event_id,p_qualification_result_version_id,p_playoff_result_version_id,p_expected_version,p_placements,p_awards,p_mrp_claims,v_inner_id);
  return v_result;
end $$;

create or replace function public.get_standard_singles_settlement_reconciliation_v4(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select public.get_standard_singles_settlement_reconciliation_v3(p_actor_id,p_tournament_id,p_event_id,
  (substr(md5(p_operation_id::text||':settlement-v4'),1,8)||'-'||substr(md5(p_operation_id::text||':settlement-v4'),9,4)||'-4'||substr(md5(p_operation_id::text||':settlement-v4'),14,3)||'-8'||substr(md5(p_operation_id::text||':settlement-v4'),18,3)||'-'||substr(md5(p_operation_id::text||':settlement-v4'),21,12))::uuid)
$$;

revoke all on function public.record_standard_singles_playoff_placements_v2(uuid,uuid,uuid,uuid,integer,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_playoff_placement_workspace_v2(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_settlement_workspace_v4(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_standard_singles_settlement_draft_v4(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_settlement_reconciliation_v4(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.record_standard_singles_playoff_placements_v2(uuid,uuid,uuid,uuid,integer,jsonb,uuid) to service_role;
grant execute on function public.get_standard_singles_playoff_placement_workspace_v2(uuid,uuid,uuid) to service_role;
grant execute on function public.get_standard_singles_settlement_workspace_v4(uuid,uuid,uuid) to service_role;
grant execute on function public.save_standard_singles_settlement_draft_v4(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid) to service_role;
grant execute on function public.get_standard_singles_settlement_reconciliation_v4(uuid,uuid,uuid,uuid) to service_role;

notify pgrst,'reload schema';
