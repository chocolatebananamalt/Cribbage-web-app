-- Private Standard Singles settlement working-copy v3.
-- MRP values are director-transcribed claims, never calculated or ACC-approved.

create table app.standard_singles_settlement_mrp_claims (
  settlement_draft_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  qualification_result_version_id uuid not null,
  participant_id uuid not null,
  mrp_points integer not null check (mrp_points >= 0),
  evidence_note text not null check (
    evidence_note = trim(evidence_note)
    and length(evidence_note) between 1 and 500
    and octet_length(evidence_note) <= 2000
    and evidence_note !~ '[[:cntrl:]]'
  ),
  primary key (settlement_draft_id, participant_id),
  foreign key (settlement_draft_id,tournament_id,event_id,qualification_result_version_id)
    references app.standard_singles_settlement_drafts(id,tournament_id,event_id,qualification_result_version_id) on delete restrict,
  foreign key (qualification_result_version_id,participant_id)
    references app.qualification_result_rows(result_version_id,participant_id) on delete restrict
);

alter table app.standard_singles_settlement_mrp_claims enable row level security;
alter table app.standard_singles_settlement_mrp_claims force row level security;
revoke all on table app.standard_singles_settlement_mrp_claims from public,anon,authenticated;
create trigger settlement_mrp_claims_immutable before update or delete
  on app.standard_singles_settlement_mrp_claims for each row execute function app.reject_immutable_history();
create index settlement_mrp_claims_qualification_participant_idx
  on app.standard_singles_settlement_mrp_claims(qualification_result_version_id,participant_id);
create index settlement_mrp_claims_scope_idx
  on app.standard_singles_settlement_mrp_claims(tournament_id,event_id,settlement_draft_id);

create or replace function public.save_standard_singles_settlement_draft_v3(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_qualification_result_version_id uuid,
  p_playoff_result_version_id uuid,p_expected_version integer,p_placements jsonb,p_awards jsonb,
  p_mrp_claims jsonb,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_hash text; v_existing app.operation_receipts%rowtype; v_authorized boolean:=false;
  v_internal_operation_id uuid; v_base jsonb; v_response jsonb; v_code text;
  v_settlement_id uuid; v_receipt_id uuid; v_conflict_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then
    raise exception using errcode='P0001',message='server-only settlement working copy';
  end if;
  begin
    if p_actor_id is null or p_tournament_id is null or p_event_id is null
      or p_qualification_result_version_id is null or p_playoff_result_version_id is null
      or p_expected_version is null or p_expected_version<0 or p_placements is null
      or jsonb_typeof(p_placements)<>'array' or p_awards is null or jsonb_typeof(p_awards)<>'array'
      or p_mrp_claims is null or jsonb_typeof(p_mrp_claims)<>'array'
      or jsonb_array_length(p_mrp_claims)>128 or p_operation_id is null then
      raise exception using errcode='P0001',message='invalid settlement v3 request';
    end if;
    if exists(select 1 from jsonb_array_elements(p_mrp_claims) claim
      where jsonb_typeof(claim)<>'object'
        or (select count(*) from jsonb_object_keys(claim))<>3
        or not (claim ?& array['participantId','mrpPoints','evidenceNote'])
        or (claim->>'participantId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or jsonb_typeof(claim->'mrpPoints')<>'number'
        or (claim->>'mrpPoints')!~'^(0|[1-9][0-9]*)$'
        or (claim->>'mrpPoints')::numeric>2147483647
        or jsonb_typeof(claim->'evidenceNote')<>'string'
        or claim->>'evidenceNote'<>trim(claim->>'evidenceNote')
        or length(claim->>'evidenceNote') not between 1 and 500
        or octet_length(claim->>'evidenceNote')>2000
        or claim->>'evidenceNote'~'[[:cntrl:]]')
      or (select count(distinct (claim->>'participantId')::uuid) from jsonb_array_elements(p_mrp_claims) claim)<>jsonb_array_length(p_mrp_claims) then
      raise exception using errcode='P0001',message='invalid mrp claims';
    end if;

    v_hash:=encode(extensions.digest(convert_to(jsonb_build_array(
      'save_standard_singles_settlement_draft_v3',p_actor_id,p_tournament_id,p_event_id,
      p_qualification_result_version_id,p_playoff_result_version_id,p_expected_version,
      p_placements,p_awards,p_mrp_claims)::text,'utf8'),'sha256'),'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('standard-singles-post-event:'||p_event_id::text,0));
    perform 1 from app.tournaments tournament_row
      where tournament_row.id=p_tournament_id and tournament_row.status='open' for update;
    if not found then raise exception using errcode='P0001',message='tournament unavailable'; end if;
    perform 1 from app.tournament_roles role_row
      where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id
        and role_row.role in('director','co_director') for update;
    if not found then raise exception using errcode='P0001',message='director role required'; end if;
    v_authorized:=true;

    select * into v_existing from app.operation_receipts receipt
      where receipt.actor_profile_id=p_actor_id and receipt.client_operation_id=p_operation_id;
    if found then
      if v_existing.tournament_id<>p_tournament_id
        or v_existing.operation_type<>'save_standard_singles_settlement_draft_v3'
        or v_existing.target_id<>p_event_id or v_existing.request_hash<>v_hash then
        v_conflict_id:=extensions.gen_random_uuid();
        insert into app.standard_singles_settlement_conflicts(
          id,tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,
          attempted_request_hash,prior_receipt_id,reason_code
        ) values (v_conflict_id,p_tournament_id,p_actor_id,p_event_id,p_operation_id,v_hash,
          case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
        insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)
        values(p_tournament_id,p_actor_id,'standard_singles_settlement_request',p_event_id,
          'settlement_working_copy_v3_idempotency_conflict',jsonb_build_object(
            'status','rejected','code','idempotency_conflict','conflictId',v_conflict_id,
            'attemptedOperationId',p_operation_id));
        return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
      end if;
      return v_existing.response_payload;
    end if;

    if not exists(select 1 from app.qualification_result_versions result
      where result.id=p_qualification_result_version_id and result.tournament_id=p_tournament_id
        and result.event_id=p_event_id and not exists(select 1 from app.qualification_result_versions newer
          where newer.event_id=result.event_id and newer.version>result.version))
      or exists(select 1 from jsonb_array_elements(p_mrp_claims) claim
        where not exists(select 1 from app.qualification_result_rows result_row
          where result_row.result_version_id=p_qualification_result_version_id
            and result_row.participant_id=(claim->>'participantId')::uuid
            and result_row.qualification_status='qualified')) then
      raise exception using errcode='P0001',message='mrp claim scope unavailable';
    end if;

    v_internal_operation_id:=(substr(md5(p_operation_id::text||':settlement-v2'),1,8)||'-'||
      substr(md5(p_operation_id::text||':settlement-v2'),9,4)||'-4'||
      substr(md5(p_operation_id::text||':settlement-v2'),14,3)||'-8'||
      substr(md5(p_operation_id::text||':settlement-v2'),18,3)||'-'||
      substr(md5(p_operation_id::text||':settlement-v2'),21,12))::uuid;
    v_base:=public.save_standard_singles_settlement_draft_v2(
      p_actor_id,p_tournament_id,p_event_id,p_qualification_result_version_id,
      p_playoff_result_version_id,p_expected_version,p_placements,p_awards,v_internal_operation_id);
    if v_base->>'status'<>'settlement_draft_saved' then
      v_response:=v_base;
      insert into app.operation_receipts(
        tournament_id,actor_profile_id,operation_type,target_id,request_hash,
        client_operation_id,outcome,response_payload,applied_at
      ) values(p_tournament_id,p_actor_id,'save_standard_singles_settlement_draft_v3',p_event_id,
        v_hash,p_operation_id,'rejected',v_response,clock_timestamp()) returning id into v_receipt_id;
      insert into app.audit_events(
        tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state
      ) values(p_tournament_id,p_actor_id,v_receipt_id,'standard_singles_settlement_request',p_event_id,
        'settlement_working_copy_v3_rejected',v_response);
      return v_response;
    end if;

    v_settlement_id:=(v_base->>'settlementDraftId')::uuid;
    insert into app.standard_singles_settlement_mrp_claims(
      settlement_draft_id,tournament_id,event_id,qualification_result_version_id,
      participant_id,mrp_points,evidence_note
    ) select v_settlement_id,p_tournament_id,p_event_id,p_qualification_result_version_id,
      (claim->>'participantId')::uuid,(claim->>'mrpPoints')::integer,claim->>'evidenceNote'
      from jsonb_array_elements(p_mrp_claims) claim;
    v_response:=v_base||jsonb_build_object('mrpClaimCount',jsonb_array_length(p_mrp_claims));
    insert into app.operation_receipts(
      tournament_id,actor_profile_id,operation_type,target_id,request_hash,
      client_operation_id,outcome,response_payload,applied_at
    ) values(p_tournament_id,p_actor_id,'save_standard_singles_settlement_draft_v3',p_event_id,
      v_hash,p_operation_id,'accepted',v_response,clock_timestamp()) returning id into v_receipt_id;
    insert into app.audit_events(
      tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state
    ) values(p_tournament_id,p_actor_id,v_receipt_id,'standard_singles_settlement_draft',v_settlement_id,
      'settlement_working_copy_v3_saved',v_response);
    return v_response;
  exception when sqlstate 'P0001' then
    v_code:=case sqlerrm
      when 'tournament unavailable' then 'tournament_unavailable'
      when 'director role required' then 'not_director'
      when 'mrp claim scope unavailable' then 'mrp_claim_scope_unavailable'
      when 'invalid mrp claims' then 'invalid_mrp_claims'
      else 'invalid_request' end;
    v_response:=jsonb_build_object('status','rejected','code',v_code,'eventId',p_event_id);
    if v_authorized and p_operation_id is not null and v_hash is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
      perform 1 from app.tournaments tournament_row
        where tournament_row.id=p_tournament_id and tournament_row.status='open' for update;
      if not found then return v_response; end if;
      perform 1 from app.tournament_roles role_row
        where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id
          and role_row.role in('director','co_director') for update;
      if not found then return v_response; end if;
      select * into v_existing from app.operation_receipts receipt
        where receipt.actor_profile_id=p_actor_id and receipt.client_operation_id=p_operation_id;
      if found then
        if v_existing.tournament_id<>p_tournament_id
          or v_existing.operation_type<>'save_standard_singles_settlement_draft_v3'
          or v_existing.target_id<>p_event_id or v_existing.request_hash<>v_hash then
          v_conflict_id:=extensions.gen_random_uuid();
          insert into app.standard_singles_settlement_conflicts(
            id,tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,
            attempted_request_hash,prior_receipt_id,reason_code
          ) values(v_conflict_id,p_tournament_id,p_actor_id,p_event_id,p_operation_id,v_hash,
            case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
          insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)
          values(p_tournament_id,p_actor_id,'standard_singles_settlement_request',p_event_id,
            'settlement_working_copy_v3_idempotency_conflict',jsonb_build_object(
              'status','rejected','code','idempotency_conflict','conflictId',v_conflict_id,
              'attemptedOperationId',p_operation_id));
          return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
        end if;
        return v_existing.response_payload;
      end if;
      insert into app.operation_receipts(
        tournament_id,actor_profile_id,operation_type,target_id,request_hash,
        client_operation_id,outcome,response_payload,applied_at
      ) values(p_tournament_id,p_actor_id,'save_standard_singles_settlement_draft_v3',p_event_id,
        v_hash,p_operation_id,'rejected',v_response,clock_timestamp()) returning id into v_receipt_id;
      insert into app.audit_events(
        tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state
      ) values(p_tournament_id,p_actor_id,v_receipt_id,'standard_singles_settlement_request',p_event_id,
        'settlement_working_copy_v3_rejected',v_response);
    end if;
    return v_response;
  end;
end $$;

create or replace function public.get_standard_singles_settlement_workspace_v3(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb; v_draft_id uuid; v_qualification_id uuid; v_claims jsonb;
begin
  v_base:=public.get_standard_singles_settlement_workspace_v2(p_actor_id,p_tournament_id,p_event_id);
  if v_base is null then return null; end if;
  if v_base->'draft' is not null and v_base->'draft'<>'null'::jsonb then
    v_draft_id:=(v_base->'draft'->>'settlementDraftId')::uuid;
    select draft.qualification_result_version_id into v_qualification_id
      from app.standard_singles_settlement_drafts draft
      where draft.id=v_draft_id and draft.tournament_id=p_tournament_id and draft.event_id=p_event_id;
    if v_qualification_id is null then return null; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'participantId',claim.participant_id,'mrpPoints',claim.mrp_points,
      'evidenceNote',claim.evidence_note) order by result_row.ranking_ordinal),'[]'::jsonb)
      into v_claims
      from app.standard_singles_settlement_mrp_claims claim
      join app.qualification_result_rows result_row
        on result_row.result_version_id=claim.qualification_result_version_id
        and result_row.participant_id=claim.participant_id
      where claim.settlement_draft_id=v_draft_id and claim.tournament_id=p_tournament_id
        and claim.event_id=p_event_id and claim.qualification_result_version_id=v_qualification_id;
    v_base:=jsonb_set(v_base,'{draft}',(v_base->'draft')||jsonb_build_object(
      'qualificationResultVersionId',v_qualification_id,'mrpClaims',v_claims),false);
  end if;
  return jsonb_set(v_base,'{capabilities}',jsonb_build_object(
    'publication',false,'approval',false,'officialExport',false,
    'mrpTranscription',true,'mrpCalculation',false),false);
end $$;

create or replace function public.get_standard_singles_settlement_reconciliation_v3(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
  select case when coalesce(current_setting('request.jwt.claim.role',true),'')='service_role'
    and exists(select 1 from app.tournament_roles role_row
      where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id
        and role_row.role in('director','co_director'))
  then jsonb_build_object('authorized',true,'result',(
    select receipt.response_payload from app.operation_receipts receipt
    where receipt.actor_profile_id=p_actor_id and receipt.tournament_id=p_tournament_id
      and receipt.operation_type='save_standard_singles_settlement_draft_v3'
      and receipt.target_id=p_event_id and receipt.client_operation_id=p_operation_id limit 1
  )) else null end
$$;

revoke all on function public.save_standard_singles_settlement_draft_v3(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_settlement_workspace_v3(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_settlement_reconciliation_v3(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_standard_singles_settlement_draft_v3(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid) to service_role;
grant execute on function public.get_standard_singles_settlement_workspace_v3(uuid,uuid,uuid) to service_role;
grant execute on function public.get_standard_singles_settlement_reconciliation_v3(uuid,uuid,uuid,uuid) to service_role;
