-- Supervised Standard Singles playoff placements, kept separate from
-- qualifying-round rank and from provisional financial claims.

create table app.standard_singles_playoff_result_versions (
  id uuid primary key,
  tournament_id uuid not null,
  event_id uuid not null,
  qualification_result_version_id uuid not null,
  version integer not null check (version > 0),
  supersedes_playoff_result_version_id uuid,
  placement_count integer not null check (placement_count >= 2),
  recorded_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  recorded_at timestamptz not null,
  foreign key (qualification_result_version_id,tournament_id,event_id)
    references app.qualification_result_versions(id,tournament_id,event_id) on delete restrict,
  foreign key (supersedes_playoff_result_version_id,tournament_id,event_id,qualification_result_version_id)
    references app.standard_singles_playoff_result_versions(id,tournament_id,event_id,qualification_result_version_id) on delete restrict,
  foreign key (operation_receipt_id,tournament_id)
    references app.operation_receipts(id,tournament_id) on delete restrict,
  unique (event_id,version),
  unique (id,tournament_id,event_id,qualification_result_version_id)
);

create table app.standard_singles_playoff_placement_rows (
  playoff_result_version_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  qualification_result_version_id uuid not null,
  participant_id uuid not null,
  placement integer not null check (placement > 0),
  display_name_snapshot text not null check (length(trim(display_name_snapshot)) between 1 and 160),
  primary key (playoff_result_version_id,participant_id),
  unique (playoff_result_version_id,placement),
  foreign key (playoff_result_version_id,tournament_id,event_id,qualification_result_version_id)
    references app.standard_singles_playoff_result_versions(id,tournament_id,event_id,qualification_result_version_id) on delete restrict,
  foreign key (qualification_result_version_id,participant_id)
    references app.qualification_result_rows(result_version_id,participant_id) on delete restrict
);

create table app.standard_singles_playoff_result_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  attempted_event_id uuid not null,
  attempted_operation_id uuid not null,
  attempted_request_hash text not null check (length(attempted_request_hash)=64),
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null check (reason_code='idempotency_conflict'),
  created_at timestamptz not null default now()
);

-- New settlement saves bind the provisional money draft to one exact playoff
-- result without rewriting the already-hosted immutable settlement tables.
alter table app.standard_singles_settlement_drafts
  add constraint settlement_drafts_playoff_binding_identity_unique
  unique (id,tournament_id,event_id,qualification_result_version_id);

create table app.standard_singles_settlement_playoff_bindings (
  settlement_draft_id uuid primary key,
  tournament_id uuid not null,
  event_id uuid not null,
  qualification_result_version_id uuid not null,
  playoff_result_version_id uuid not null,
  bound_at timestamptz not null default clock_timestamp(),
  foreign key (settlement_draft_id,tournament_id,event_id,qualification_result_version_id)
    references app.standard_singles_settlement_drafts(id,tournament_id,event_id,qualification_result_version_id) on delete restrict,
  foreign key (playoff_result_version_id,tournament_id,event_id,qualification_result_version_id)
    references app.standard_singles_playoff_result_versions(id,tournament_id,event_id,qualification_result_version_id) on delete restrict
);

do $$ declare table_name text; begin
  foreach table_name in array array[
    'standard_singles_playoff_result_versions','standard_singles_playoff_placement_rows',
    'standard_singles_playoff_result_conflicts','standard_singles_settlement_playoff_bindings'
  ] loop
    execute format('alter table app.%I enable row level security',table_name);
    execute format('alter table app.%I force row level security',table_name);
    execute format('revoke all on table app.%I from public,anon,authenticated',table_name);
  end loop;
end $$;

create trigger playoff_result_versions_immutable before update or delete on app.standard_singles_playoff_result_versions for each row execute function app.reject_immutable_history();
create trigger playoff_placement_rows_immutable before update or delete on app.standard_singles_playoff_placement_rows for each row execute function app.reject_immutable_history();
create trigger playoff_result_conflicts_immutable before update or delete on app.standard_singles_playoff_result_conflicts for each row execute function app.reject_immutable_history();
create trigger settlement_playoff_bindings_immutable before update or delete on app.standard_singles_settlement_playoff_bindings for each row execute function app.reject_immutable_history();

create index playoff_result_versions_scope_idx on app.standard_singles_playoff_result_versions(tournament_id,event_id,version desc);
create index playoff_result_versions_qualification_idx on app.standard_singles_playoff_result_versions(qualification_result_version_id,tournament_id,event_id);
create index playoff_result_versions_supersedes_idx on app.standard_singles_playoff_result_versions(supersedes_playoff_result_version_id);
create index playoff_result_versions_actor_idx on app.standard_singles_playoff_result_versions(recorded_by_profile_id);
create index playoff_result_versions_receipt_idx on app.standard_singles_playoff_result_versions(operation_receipt_id,tournament_id);
create index playoff_rows_qualification_participant_idx on app.standard_singles_playoff_placement_rows(qualification_result_version_id,participant_id);
create index playoff_result_conflicts_actor_idx on app.standard_singles_playoff_result_conflicts(actor_profile_id,created_at desc);
create index playoff_result_conflicts_receipt_idx on app.standard_singles_playoff_result_conflicts(prior_receipt_id);
create index settlement_playoff_bindings_scope_idx on app.standard_singles_settlement_playoff_bindings(tournament_id,event_id,qualification_result_version_id);
create index settlement_playoff_bindings_result_idx on app.standard_singles_settlement_playoff_bindings(playoff_result_version_id,tournament_id,event_id,qualification_result_version_id);

create or replace function public.record_standard_singles_playoff_placements_v1(
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
      or p_expected_version is null or p_expected_version<0 or p_operation_id is null then
      raise exception 'invalid playoff placement request';
    end if;
    v_hash:=encode(extensions.digest(convert_to(jsonb_build_array(
      'record_standard_singles_playoff_placements_v1',p_actor_id,p_tournament_id,p_event_id,
      p_qualification_result_version_id,p_expected_version,p_placements)::text,'utf8'),'sha256'),'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('standard-singles-post-event:'||p_event_id::text,0));
    perform 1 from app.tournaments t where t.id=p_tournament_id and t.status='open' for update;
    if not found then raise exception 'tournament unavailable'; end if;
    perform 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director') for update;
    if not found then raise exception 'director role required'; end if;
    v_authorized:=true;
    select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
    if found then
      if v_existing.tournament_id<>p_tournament_id or v_existing.operation_type<>'record_standard_singles_playoff_placements_v1'
        or v_existing.target_id<>p_event_id or v_existing.request_hash<>v_hash then
        insert into app.standard_singles_playoff_result_conflicts(tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)
        values(p_tournament_id,p_actor_id,p_event_id,p_operation_id,v_hash,case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
        return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
      end if;
      return v_existing.response_payload;
    end if;
    select * into v_qualification from app.qualification_result_versions q
      where q.id=p_qualification_result_version_id and q.tournament_id=p_tournament_id and q.event_id=p_event_id for update;
    if not found or exists(select 1 from app.qualification_result_versions newer where newer.event_id=p_event_id and newer.version>v_qualification.version)
      or not exists(select 1 from app.events e where e.id=p_event_id and e.tournament_id=p_tournament_id and e.format='standard_singles' and e.scoring_method='digital') then
      raise exception 'qualification result unavailable';
    end if;
    select coalesce(max(version),0) into v_current_version from app.standard_singles_playoff_result_versions where event_id=p_event_id;
    select id into v_prior_id from app.standard_singles_playoff_result_versions where event_id=p_event_id order by version desc limit 1;
    if p_expected_version<>v_current_version then raise exception 'stale playoff placement version'; end if;
    if p_placements is null or jsonb_typeof(p_placements)<>'array' or jsonb_array_length(p_placements)<2
      or jsonb_array_length(p_placements)>v_qualification.qualifier_count
      or exists(select 1 from jsonb_array_elements(p_placements) item where jsonb_typeof(item)<>'object'
        or (select count(*) from jsonb_object_keys(item))<>2 or not(item?'participantId' and item?'placement'))
      or exists(select 1 from jsonb_array_elements(p_placements) item where (item->>'placement')!~'^[1-9][0-9]*$'
        or (item->>'participantId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      or (select count(distinct (item->>'participantId')::uuid) from jsonb_array_elements(p_placements) item)<>jsonb_array_length(p_placements)
      or (select count(distinct (item->>'placement')::integer) from jsonb_array_elements(p_placements) item)<>jsonb_array_length(p_placements)
      or (select min((item->>'placement')::integer) from jsonb_array_elements(p_placements) item)<>1
      or (select max((item->>'placement')::integer) from jsonb_array_elements(p_placements) item)<>jsonb_array_length(p_placements)
      or (select count(*) from jsonb_array_elements(p_placements) item join app.qualification_result_rows q
          on q.result_version_id=p_qualification_result_version_id and q.participant_id=(item->>'participantId')::uuid and q.qualification_status='qualified')<>jsonb_array_length(p_placements)
    then raise exception 'invalid playoff placements'; end if;
    v_response:=jsonb_build_object('status','playoff_placements_recorded','tournamentId',p_tournament_id,'eventId',p_event_id,
      'qualificationResultVersionId',p_qualification_result_version_id,'playoffResultVersionId',v_result_id,
      'version',v_current_version+1,'supersedesPlayoffResultVersionId',v_prior_id,'placementCount',jsonb_array_length(p_placements),'recordedAt',v_recorded_at);
    insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(v_receipt_id,p_tournament_id,p_actor_id,'record_standard_singles_playoff_placements_v1',p_event_id,v_hash,p_operation_id,'accepted',v_response,v_recorded_at);
    insert into app.standard_singles_playoff_result_versions(id,tournament_id,event_id,qualification_result_version_id,version,supersedes_playoff_result_version_id,placement_count,recorded_by_profile_id,operation_receipt_id,recorded_at)
      values(v_result_id,p_tournament_id,p_event_id,p_qualification_result_version_id,v_current_version+1,v_prior_id,jsonb_array_length(p_placements),p_actor_id,v_receipt_id,v_recorded_at);
    insert into app.standard_singles_playoff_placement_rows(playoff_result_version_id,tournament_id,event_id,qualification_result_version_id,participant_id,placement,display_name_snapshot)
      select v_result_id,p_tournament_id,p_event_id,p_qualification_result_version_id,q.participant_id,(item->>'placement')::integer,q.display_name_snapshot
      from jsonb_array_elements(p_placements) item join app.qualification_result_rows q on q.result_version_id=p_qualification_result_version_id and q.participant_id=(item->>'participantId')::uuid;
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
      values(p_tournament_id,p_actor_id,v_receipt_id,'standard_singles_playoff_result_version',v_result_id,
        'standard_singles_playoff_placements_recorded',
        case when v_prior_id is null then null else jsonb_build_object('supersedesPlayoffResultVersionId',v_prior_id,'priorVersion',v_current_version) end,
        v_response);
    return v_response;
  exception when others then
    if sqlerrm in('tournament unavailable','director role required','qualification result unavailable','stale playoff placement version','invalid playoff placements','invalid playoff placement request') then
      v_code:=case sqlerrm when 'tournament unavailable' then 'tournament_unavailable' when 'director role required' then 'not_director'
        when 'qualification result unavailable' then 'qualification_result_unavailable' when 'stale playoff placement version' then 'stale_version'
        when 'invalid playoff placements' then 'invalid_placements' else 'invalid_request' end;
      v_response:=jsonb_build_object('status','rejected','code',v_code,'eventId',p_event_id);
      if v_authorized and p_operation_id is not null and v_hash is not null then
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
        perform 1 from app.tournaments t where t.id=p_tournament_id and t.status='open' for update;
        if not found then return v_response; end if;
        perform 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director') for update;
        if not found then return v_response; end if;
        select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
        if found then
          if v_existing.tournament_id<>p_tournament_id or v_existing.operation_type<>'record_standard_singles_playoff_placements_v1'
            or v_existing.target_id<>p_event_id or v_existing.request_hash<>v_hash then
            insert into app.standard_singles_playoff_result_conflicts(tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)
            values(p_tournament_id,p_actor_id,p_event_id,p_operation_id,v_hash,case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
            return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
          end if;
          return v_existing.response_payload;
        end if;
        insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
        values(p_tournament_id,p_actor_id,'record_standard_singles_playoff_placements_v1',coalesce(p_event_id,p_tournament_id),v_hash,p_operation_id,'rejected',v_response,clock_timestamp())
        returning id into v_receipt_id;
        insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
          values(p_tournament_id,p_actor_id,v_receipt_id,'standard_singles_playoff_result_version',coalesce(p_event_id,p_tournament_id),
            'standard_singles_playoff_placements_rejected',v_response);
      end if;
      return v_response;
    end if;
    raise;
  end;
end $$;

create or replace function public.get_standard_singles_playoff_placement_workspace_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with allowed as(select 1 where coalesce(auth.role(),'')='service_role' and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director'))),
 qv as(select * from app.qualification_result_versions where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1),
 current_result as(select * from app.standard_singles_playoff_result_versions where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1)
select jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'qualificationResultVersionId',qv.id,
 'currentVersion',coalesce(current_result.version,0),
 'qualifierChoices',coalesce((select jsonb_agg(jsonb_build_object('participantId',r.participant_id,'displayName',r.display_name_snapshot,'qualificationRank',r.ranking_ordinal) order by r.ranking_ordinal) from app.qualification_result_rows r where r.result_version_id=qv.id and r.qualification_status='qualified'),'[]'::jsonb),
 'playoffResult',case when current_result.id is null then null else jsonb_build_object('playoffResultVersionId',current_result.id,'version',current_result.version,'recordedAt',current_result.recorded_at,'recordedBy',coalesce(nullif(trim(p.display_name),''),'Director or co-director'),
   'placements',coalesce((select jsonb_agg(jsonb_build_object('participantId',row.participant_id,'displayName',row.display_name_snapshot,'placement',row.placement) order by row.placement) from app.standard_singles_playoff_placement_rows row where row.playoff_result_version_id=current_result.id),'[]'::jsonb)) end,
 'capabilities',jsonb_build_object('mrpCalculation',false,'qPoolCalculation',false,'payoutCalculation',false,'publication',false))
from allowed cross join qv left join current_result on true left join app.profiles p on p.id=current_result.recorded_by_profile_id
$$;

create or replace function public.get_standard_singles_playoff_placement_reconciliation_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when coalesce(auth.role(),'')='service_role' and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director'))
 then jsonb_build_object('authorized',true,'result',(select receipt.response_payload from app.operation_receipts receipt where receipt.actor_profile_id=p_actor_id and receipt.tournament_id=p_tournament_id and receipt.operation_type='record_standard_singles_playoff_placements_v1' and receipt.target_id=p_event_id and receipt.client_operation_id=p_operation_id limit 1)) else null end
$$;

create or replace function public.save_standard_singles_settlement_draft_v2(
 p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_qualification_result_version_id uuid,p_playoff_result_version_id uuid,
 p_expected_version integer,p_placements jsonb,p_awards jsonb,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_hash text; v_existing app.operation_receipts%rowtype; v_authorized boolean:=false; v_internal_operation_id uuid;
 v_base jsonb; v_response jsonb; v_code text; v_settlement_id uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server-only settlement draft'; end if;
 begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_qualification_result_version_id is null or p_playoff_result_version_id is null or p_operation_id is null then raise exception 'invalid settlement request'; end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('save_standard_singles_settlement_draft_v2',p_actor_id,p_tournament_id,p_event_id,p_qualification_result_version_id,p_playoff_result_version_id,p_expected_version,p_placements,p_awards)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('standard-singles-post-event:'||p_event_id::text,0));
  perform 1 from app.tournaments t where t.id=p_tournament_id and t.status='open' for update;
  if not found then raise exception 'tournament unavailable'; end if;
  perform 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director') for update;
  if not found then raise exception 'director role required'; end if; v_authorized:=true;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then
   if v_existing.tournament_id<>p_tournament_id or v_existing.operation_type<>'save_standard_singles_settlement_draft_v2' or v_existing.target_id<>p_event_id or v_existing.request_hash<>v_hash then
    insert into app.standard_singles_settlement_conflicts(tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)
    values(p_tournament_id,p_actor_id,p_event_id,p_operation_id,v_hash,case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
    return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
   end if; return v_existing.response_payload;
  end if;
  perform 1 from app.standard_singles_playoff_result_versions result
   where result.id=p_playoff_result_version_id and result.tournament_id=p_tournament_id and result.event_id=p_event_id and result.qualification_result_version_id=p_qualification_result_version_id
     and not exists(select 1 from app.standard_singles_playoff_result_versions newer where newer.event_id=p_event_id and newer.version>result.version) for update;
  if not found then raise exception 'playoff result unavailable'; end if;
  if p_placements is null or jsonb_typeof(p_placements)<>'array' or exists(select 1 from jsonb_array_elements(p_placements) claim
    where jsonb_typeof(claim)<>'object' or not(claim?'participantId' and claim?'placement')
      or (claim->>'participantId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or (claim->>'placement')!~'^[1-9][0-9]*$'
      or not exists(select 1 from app.standard_singles_playoff_placement_rows row where row.playoff_result_version_id=p_playoff_result_version_id and row.participant_id=(claim->>'participantId')::uuid and row.placement=(claim->>'placement')::integer)) then
    raise exception 'placement does not match playoff result';
  end if;
  v_internal_operation_id:=(substr(md5(p_operation_id::text||':settlement-v1'),1,8)||'-'||substr(md5(p_operation_id::text||':settlement-v1'),9,4)||'-4'||substr(md5(p_operation_id::text||':settlement-v1'),14,3)||'-8'||substr(md5(p_operation_id::text||':settlement-v1'),18,3)||'-'||substr(md5(p_operation_id::text||':settlement-v1'),21,12))::uuid;
  v_base:=public.save_standard_singles_settlement_draft_v1(p_actor_id,p_tournament_id,p_event_id,p_qualification_result_version_id,p_expected_version,p_placements,p_awards,v_internal_operation_id);
  if v_base->>'status'<>'settlement_draft_saved' then
   insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_tournament_id,p_actor_id,'save_standard_singles_settlement_draft_v2',p_event_id,v_hash,p_operation_id,'rejected',v_base,clock_timestamp());
   return v_base;
  end if;
  v_settlement_id:=(v_base->>'settlementDraftId')::uuid;
  insert into app.standard_singles_settlement_playoff_bindings(settlement_draft_id,tournament_id,event_id,qualification_result_version_id,playoff_result_version_id)
   values(v_settlement_id,p_tournament_id,p_event_id,p_qualification_result_version_id,p_playoff_result_version_id);
  v_response:=v_base||jsonb_build_object('playoffResultVersionId',p_playoff_result_version_id);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
   values(p_tournament_id,p_actor_id,'save_standard_singles_settlement_draft_v2',p_event_id,v_hash,p_operation_id,'accepted',v_response,clock_timestamp());
  return v_response;
 exception when others then
  if sqlerrm in('tournament unavailable','director role required','playoff result unavailable','placement does not match playoff result','invalid settlement request') then
   v_code:=case sqlerrm when 'tournament unavailable' then 'tournament_unavailable' when 'director role required' then 'not_director' when 'playoff result unavailable' then 'playoff_result_unavailable' when 'placement does not match playoff result' then 'playoff_placement_mismatch' else 'invalid_request' end;
   v_response:=jsonb_build_object('status','rejected','code',v_code,'eventId',p_event_id);
   if v_authorized and p_operation_id is not null and v_hash is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
    perform 1 from app.tournaments t where t.id=p_tournament_id and t.status='open' for update;
    if not found then return v_response; end if;
    perform 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director') for update;
    if not found then return v_response; end if;
    select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
    if found then
     if v_existing.tournament_id<>p_tournament_id or v_existing.operation_type<>'save_standard_singles_settlement_draft_v2' or v_existing.target_id<>p_event_id or v_existing.request_hash<>v_hash then
      insert into app.standard_singles_settlement_conflicts(tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)
      values(p_tournament_id,p_actor_id,p_event_id,p_operation_id,v_hash,case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
      return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
     end if;
     return v_existing.response_payload;
    end if;
    insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_tournament_id,p_actor_id,'save_standard_singles_settlement_draft_v2',coalesce(p_event_id,p_tournament_id),v_hash,p_operation_id,'rejected',v_response,clock_timestamp());
   end if;
   return v_response;
  end if; raise;
 end;
end $$;

create or replace function public.get_standard_singles_settlement_workspace_v2(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb; v_playoff jsonb; v_binding uuid; begin
 v_base:=public.get_standard_singles_settlement_workspace_v1(p_actor_id,p_tournament_id,p_event_id);
 if v_base is null then return null; end if;
 select jsonb_build_object('playoffResultVersionId',r.id,'version',r.version,'recordedAt',r.recorded_at,
   'placements',coalesce((select jsonb_agg(jsonb_build_object('participantId',row.participant_id,'displayName',row.display_name_snapshot,'placement',row.placement) order by row.placement) from app.standard_singles_playoff_placement_rows row where row.playoff_result_version_id=r.id),'[]'::jsonb))
 into v_playoff from app.standard_singles_playoff_result_versions r where r.tournament_id=p_tournament_id and r.event_id=p_event_id order by r.version desc limit 1;
 if v_base->'draft' is not null and v_base->'draft'<>'null'::jsonb then
  select b.playoff_result_version_id into v_binding from app.standard_singles_settlement_playoff_bindings b where b.settlement_draft_id=(v_base->'draft'->>'settlementDraftId')::uuid;
  v_base:=jsonb_set(v_base,'{draft}',(v_base->'draft')||jsonb_build_object('playoffResultVersionId',v_binding),false);
 end if;
 return v_base||jsonb_build_object('playoffResult',v_playoff);
end $$;

create or replace function public.get_standard_singles_settlement_reconciliation_v2(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when coalesce(auth.role(),'')='service_role' and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then jsonb_build_object('authorized',true,'result',(select receipt.response_payload from app.operation_receipts receipt where receipt.actor_profile_id=p_actor_id and receipt.tournament_id=p_tournament_id and receipt.operation_type='save_standard_singles_settlement_draft_v2' and receipt.target_id=p_event_id and receipt.client_operation_id=p_operation_id limit 1)) else null end
$$;

revoke all on function public.record_standard_singles_playoff_placements_v1(uuid,uuid,uuid,uuid,integer,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_playoff_placement_workspace_v1(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_playoff_placement_reconciliation_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_standard_singles_settlement_draft_v2(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_settlement_workspace_v2(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_settlement_reconciliation_v2(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.record_standard_singles_playoff_placements_v1(uuid,uuid,uuid,uuid,integer,jsonb,uuid) to service_role;
grant execute on function public.get_standard_singles_playoff_placement_workspace_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.get_standard_singles_playoff_placement_reconciliation_v1(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.save_standard_singles_settlement_draft_v2(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid) to service_role;
grant execute on function public.get_standard_singles_settlement_workspace_v2(uuid,uuid,uuid) to service_role;
grant execute on function public.get_standard_singles_settlement_reconciliation_v2(uuid,uuid,uuid,uuid) to service_role;
