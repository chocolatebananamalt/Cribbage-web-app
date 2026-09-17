-- Cross-source roster identity guard and append-only pre-play withdrawal.

create table app.roster_entry_lifecycle_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  roster_entry_id uuid not null,
  version integer not null check (version > 0),
  event_type text not null check (event_type in ('withdrawn','reinstated')),
  reason_code text not null check (reason_code in ('duplicate_entry','player_withdrew','unable_to_attend','administrative_correction','other')),
  note text,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  recorded_at timestamptz not null default now(),
  foreign key (roster_entry_id,tournament_id) references app.tournament_roster_entries(id,tournament_id) on delete restrict,
  foreign key (operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique (roster_entry_id,version)
);
alter table app.roster_entry_lifecycle_events enable row level security;
alter table app.roster_entry_lifecycle_events force row level security;
revoke all on table app.roster_entry_lifecycle_events from public,anon,authenticated;
create trigger roster_entry_lifecycle_events_immutable before update or delete on app.roster_entry_lifecycle_events for each row execute function app.reject_immutable_history();
create index roster_entry_lifecycle_events_tournament_roster_version_idx on app.roster_entry_lifecycle_events(tournament_id,roster_entry_id,version desc);

create function app.roster_identity_outcome_v1(p_tournament_id uuid,p_name text,p_email text,p_acc text,p_excluded_claim_id uuid default null)
returns text language plpgsql security definer set search_path='' as $$
declare v_hard boolean:=false;v_withdrawn boolean:=false;v_weak boolean:=false;v_key text;
begin
  foreach v_key in array array_remove(array[
    case when p_acc is null then null else 'roster-identity:acc:'||p_tournament_id::text||':'||p_acc end,
    case when p_email is null then null else 'roster-identity:email:'||p_tournament_id::text||':'||p_email end,
    case when p_email is null then null else 'roster-identity:name-email:'||p_tournament_id::text||':'||p_name||':'||p_email end
  ],null) loop perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key,0)); end loop;
  with active_roster as (
    select r.* from app.tournament_roster_entries r
    left join lateral (select e.event_type from app.roster_entry_lifecycle_events e where e.roster_entry_id=r.id order by e.version desc limit 1) lifecycle on true
    where r.tournament_id=p_tournament_id and coalesce(lifecycle.event_type,'active')<>'withdrawn'
  ), active_claims as (
    select c.* from app.registration_claims c where c.tournament_id=p_tournament_id and c.id is distinct from p_excluded_claim_id and c.status not in('rejected','withdrawn')
  )
  select exists(select 1 from active_roster r where (p_acc is not null and r.claimed_normalized_acc_number=p_acc) or (p_email is not null and r.claimed_normalized_name=p_name and r.claimed_normalized_email=p_email))
      or exists(select 1 from active_claims c where (p_acc is not null and c.normalized_acc_number=p_acc) or (p_email is not null and c.normalized_name=p_name and c.normalized_email=p_email))
    into v_hard;
  if v_hard then return 'duplicate'; end if;
  select exists(select 1 from app.tournament_roster_entries r join lateral (select e.event_type from app.roster_entry_lifecycle_events e where e.roster_entry_id=r.id order by e.version desc limit 1) lifecycle on true where r.tournament_id=p_tournament_id and lifecycle.event_type='withdrawn' and ((p_acc is not null and r.claimed_normalized_acc_number=p_acc) or (p_email is not null and r.claimed_normalized_name=p_name and r.claimed_normalized_email=p_email))) into v_withdrawn;
  if v_withdrawn then return 'withdrawn'; end if;
  with active_roster as (
    select r.* from app.tournament_roster_entries r left join lateral (select e.event_type from app.roster_entry_lifecycle_events e where e.roster_entry_id=r.id order by e.version desc limit 1) lifecycle on true
    where r.tournament_id=p_tournament_id and coalesce(lifecycle.event_type,'active')<>'withdrawn'
  ), active_claims as (select c.* from app.registration_claims c where c.tournament_id=p_tournament_id and c.id is distinct from p_excluded_claim_id and c.status not in('rejected','withdrawn'))
  select exists(select 1 from active_roster r where r.claimed_normalized_name=p_name or (p_email is not null and r.claimed_normalized_email=p_email))
      or exists(select 1 from active_claims c where c.normalized_name=p_name or (p_email is not null and c.normalized_email=p_email)) into v_weak;
  return case when v_weak then 'review' else 'clear' end;
end $$;
revoke all on function app.roster_identity_outcome_v1(uuid,text,text,text,uuid) from public,anon,authenticated;

alter function public.submit_registration_claim_v4(uuid,bytea,text,text,text,text,text,text,uuid) rename to submit_registration_claim_v4_before_identity_guard;
create function public.submit_registration_claim_v4(p_link_id uuid,p_digest bytea,p_first_name text,p_last_name text,p_email text,p_acc_number text,p_intended_payment_method text,p_scorecard_type text,p_client_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tournament uuid;v_name text;v_email text;v_acc text;v_outcome text;v_result jsonb;
begin
  if p_first_name is null or p_last_name is null or p_email is null or p_acc_number is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  v_name:=lower(regexp_replace(trim(p_first_name)||' '||trim(p_last_name),'[[:space:]]+',' ','g'));v_email:=lower(trim(p_email));v_acc:=nullif(trim(p_acc_number),'');
  if v_acc is not null and v_acc !~ '^[A-Z]{2}[0-9]+$' then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  select tournament_id into v_tournament from app.tournament_registration_links where id=p_link_id and app.fixed_32_byte_equal(token_digest,p_digest);if not found then return jsonb_build_object('status','unavailable');end if;
  v_outcome:=app.roster_identity_outcome_v1(v_tournament,v_name,v_email,v_acc,null);
  if v_outcome in('duplicate','withdrawn') then return jsonb_build_object('status','rejected','code','already_registered');end if;
  v_result:=public.submit_registration_claim_v4_before_identity_guard(p_link_id,p_digest,p_first_name,p_last_name,p_email,p_acc_number,p_intended_payment_method,p_scorecard_type,p_client_operation_id);
  if v_outcome='review' and v_result->>'status'='received' then update app.registration_claims set status='needs_review' where tournament_id=v_tournament and client_operation_id=p_client_operation_id;end if;
  return v_result;
end $$;
revoke all on function public.submit_registration_claim_v4_before_identity_guard(uuid,bytea,text,text,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.submit_registration_claim_v4(uuid,bytea,text,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.submit_registration_claim_v4(uuid,bytea,text,text,text,text,text,text,uuid) to service_role;

alter function public.create_roster_entry_from_registration_claim(uuid,uuid,uuid) rename to create_roster_entry_from_registration_claim_before_identity_guard;
create function public.create_roster_entry_from_registration_claim(p_tournament_id uuid,p_approval_decision_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_claim app.registration_claims%rowtype;v_outcome text;
begin
  if auth.uid() is null or not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=auth.uid() and r.role in('director','co_director')) then return public.create_roster_entry_from_registration_claim_before_identity_guard(p_tournament_id,p_approval_decision_id,p_idempotency_key);end if;
  select c.* into v_claim from app.registration_claim_decisions d join app.registration_claims c on c.id=d.claim_id and c.tournament_id=d.tournament_id where d.id=p_approval_decision_id and d.tournament_id=p_tournament_id;
  if found then
    v_outcome:=app.roster_identity_outcome_v1(p_tournament_id,v_claim.normalized_name,v_claim.normalized_email,v_claim.normalized_acc_number,v_claim.id);
    if v_outcome='duplicate' then return jsonb_build_object('status','rejected','code','duplicate_roster_entry','approvalDecisionId',p_approval_decision_id);end if;
    if v_outcome='withdrawn' then return jsonb_build_object('status','rejected','code','withdrawn_roster_entry','approvalDecisionId',p_approval_decision_id);end if;
    if v_outcome='review' then return jsonb_build_object('status','rejected','code','potential_duplicate','approvalDecisionId',p_approval_decision_id);end if;
  end if;
  return public.create_roster_entry_from_registration_claim_before_identity_guard(p_tournament_id,p_approval_decision_id,p_idempotency_key);
end $$;
revoke all on function public.create_roster_entry_from_registration_claim_before_identity_guard(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.create_roster_entry_from_registration_claim(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_roster_entry_from_registration_claim(uuid,uuid,uuid) to authenticated;

create function public.set_roster_entry_active_status_v1(p_actor_id uuid,p_tournament_id uuid,p_roster_entry_id uuid,p_action text,p_reason_code text,p_note text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_entry app.tournament_roster_entries%rowtype;v_current text;v_version integer;v_hash text;v_existing app.operation_receipts%rowtype;v_receipt uuid;v_response jsonb;v_error text;v_code text;
begin begin
  if p_actor_id is null or p_tournament_id is null or p_roster_entry_id is null or p_action not in('withdraw','reinstate') or p_reason_code not in('duplicate_entry','player_withdrew','unable_to_attend','administrative_correction','other') or p_idempotency_key is null or length(coalesce(p_note,''))>500 or (p_reason_code='other' and length(trim(coalesce(p_note,'')))<1) then raise exception using errcode='P0001',message='invalid request';end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then raise exception using errcode='P0001',message='director role required';end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('set_roster_entry_active_status_v1',p_tournament_id::text,p_roster_entry_id::text,p_action,p_reason_code,coalesce(trim(p_note),''))::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_existing.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency conflict';end if;return v_existing.response_payload;end if;
  select * into v_entry from app.tournament_roster_entries where id=p_roster_entry_id and tournament_id=p_tournament_id for update;if not found then raise exception using errcode='P0001',message='roster entry unavailable';end if;
  select event_type,version into v_current,v_version from app.roster_entry_lifecycle_events where roster_entry_id=p_roster_entry_id order by version desc limit 1;v_current:=coalesce(v_current,'active');v_version:=coalesce(v_version,0);
  if (p_action='withdraw' and v_current='withdrawn') or (p_action='reinstate' and v_current<>'withdrawn') then raise exception using errcode='P0001',message='invalid state transition';end if;
  if exists(select 1 from app.event_play_starts where tournament_id=p_tournament_id) or exists(select 1 from app.event_team_starts where tournament_id=p_tournament_id) or exists(select 1 from app.roster_payment_events where tournament_id=p_tournament_id and roster_entry_id=p_roster_entry_id) or exists(select 1 from app.event_participants where tournament_id=p_tournament_id and roster_entry_id=p_roster_entry_id) or exists(select 1 from app.initial_seating_assignments where tournament_id=p_tournament_id and roster_entry_id=p_roster_entry_id) or exists(select 1 from app.roster_check_in_events where tournament_id=p_tournament_id and roster_entry_id=p_roster_entry_id) then raise exception using errcode='P0001',message='downstream activity requires event workflow';end if;
  v_response:=jsonb_build_object('status',case when p_action='withdraw' then 'roster_entry_withdrawn' else 'roster_entry_reinstated' end,'rosterEntryId',p_roster_entry_id,'active',p_action='reinstate','version',v_version+1);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'set_roster_entry_active_status_v1',p_roster_entry_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.roster_entry_lifecycle_events(tournament_id,roster_entry_id,version,event_type,reason_code,note,actor_profile_id,operation_receipt_id) values(p_tournament_id,p_roster_entry_id,v_version+1,case when p_action='withdraw' then 'withdrawn' else 'reinstated' end,p_reason_code,nullif(trim(p_note),''),p_actor_id,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'tournament_roster_entry',p_roster_entry_id,case when p_action='withdraw' then 'roster_entry_withdrawn' else 'roster_entry_reinstated' end,v_response||jsonb_build_object('reasonCode',p_reason_code));return v_response;
exception when sqlstate 'P0001' then get stacked diagnostics v_error=message_text;v_code:=case v_error when 'director role required' then 'not_director' when 'roster entry unavailable' then 'roster_entry_unavailable' when 'invalid state transition' then 'invalid_state_transition' when 'downstream activity requires event workflow' then 'downstream_activity_requires_event_workflow' when 'idempotency conflict' then 'idempotency_conflict' else 'invalid_request' end;return jsonb_build_object('status','rejected','code',v_code,'rosterEntryId',p_roster_entry_id);end;end $$;
revoke all on function public.set_roster_entry_active_status_v1(uuid,uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.set_roster_entry_active_status_v1(uuid,uuid,uuid,text,text,text,uuid) to service_role;

alter function public.create_manual_roster_entry_v3(uuid,uuid,text,text,text,text,text,uuid) rename to create_manual_roster_entry_v3_before_acc_guard;
create function public.create_manual_roster_entry_v3(p_actor_id uuid,p_tournament_id uuid,p_first_name text,p_last_name text,p_email text,p_acc_number text,p_scorecard_type text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_name text;v_email text;v_acc text;v_outcome text;
begin
  v_name:=lower(regexp_replace(trim(coalesce(p_first_name,''))||' '||trim(coalesce(p_last_name,'')),'[[:space:]]+',' ','g'));v_email:=nullif(lower(trim(coalesce(p_email,''))), '');v_acc:=nullif(trim(coalesce(p_acc_number,'')), '');
  if v_acc is not null and v_acc !~ '^[A-Z]{2}[0-9]+$' then return jsonb_build_object('status','rejected','code','invalid_manual_entry');end if;
  if length(v_name)>1 then
    v_outcome:=app.roster_identity_outcome_v1(p_tournament_id,v_name,v_email,v_acc,null);
    if v_outcome='duplicate' then return jsonb_build_object('status','rejected','code','duplicate_roster_entry');end if;
    if v_outcome='withdrawn' then return jsonb_build_object('status','rejected','code','withdrawn_roster_entry');end if;
    if v_outcome='review' then return jsonb_build_object('status','rejected','code','potential_duplicate');end if;
  end if;
  return public.create_manual_roster_entry_v3_before_acc_guard(p_actor_id,p_tournament_id,p_first_name,p_last_name,p_email,p_acc_number,p_scorecard_type,p_idempotency_key);
end $$;
revoke all on function public.create_manual_roster_entry_v3_before_acc_guard(uuid,uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.create_manual_roster_entry_v3(uuid,uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_manual_roster_entry_v3(uuid,uuid,text,text,text,text,text,uuid) to service_role;

alter function public.import_roster_csv_v3(uuid,uuid,jsonb,uuid) rename to import_roster_csv_v3_before_acc_guard;
create function public.import_roster_csv_v3(p_actor_id uuid,p_tournament_id uuid,p_rows jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row jsonb;v_name text;v_email text;v_acc text;v_outcome text;
begin
  if jsonb_typeof(p_rows)<>'array' or exists(select 1 from jsonb_array_elements(p_rows) x where nullif(trim(x->>'accNumber'),'') is not null and trim(x->>'accNumber') !~ '^[A-Z]{2}[0-9]+$') then return jsonb_build_object('status','rejected','code','invalid_roster_batch');end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_name:=lower(regexp_replace(trim(v_row->>'firstName')||' '||trim(v_row->>'lastName'),'[[:space:]]+',' ','g'));v_email:=nullif(lower(trim(v_row->>'email')),'');v_acc:=nullif(trim(v_row->>'accNumber'),'');v_outcome:=app.roster_identity_outcome_v1(p_tournament_id,v_name,v_email,v_acc,null);
    if v_outcome='duplicate' then return jsonb_build_object('status','rejected','code','duplicate_roster_entry');end if;
    if v_outcome='withdrawn' then return jsonb_build_object('status','rejected','code','withdrawn_roster_entry');end if;
    if v_outcome='review' then return jsonb_build_object('status','rejected','code','potential_duplicate');end if;
  end loop;
  return public.import_roster_csv_v3_before_acc_guard(p_actor_id,p_tournament_id,p_rows,p_idempotency_key);
end $$;
revoke all on function public.import_roster_csv_v3_before_acc_guard(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.import_roster_csv_v3(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.import_roster_csv_v3(uuid,uuid,jsonb,uuid) to service_role;

create function public.get_tournament_roster_workspace_v2(p_tournament_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select case when auth.uid() is not null and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=auth.uid() and r.role in('director','co_director')) then jsonb_build_object(
    'rosterEntries',coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId',e.id,'sourceClaimId',e.source_claim_id,'approvalDecisionId',e.approval_decision_id,'source',e.source_kind,'displayName',e.claimed_display_name,'email',e.claimed_email,'accNumber',e.claimed_acc_number,'scorecardType',e.scorecard_type,'scorecardPreferenceVersion',e.scorecard_preference_version,'createdAt',e.created_at,'active',true) order by e.created_at) from app.tournament_roster_entries e left join lateral (select x.event_type from app.roster_entry_lifecycle_events x where x.roster_entry_id=e.id order by x.version desc limit 1) lifecycle on true where e.tournament_id=p_tournament_id and coalesce(lifecycle.event_type,'active')<>'withdrawn'),'[]'::jsonb),
    'withdrawnRosterEntries',coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId',e.id,'sourceClaimId',e.source_claim_id,'approvalDecisionId',e.approval_decision_id,'source',e.source_kind,'displayName',e.claimed_display_name,'email',e.claimed_email,'accNumber',e.claimed_acc_number,'scorecardType',e.scorecard_type,'scorecardPreferenceVersion',e.scorecard_preference_version,'createdAt',e.created_at,'active',false,'reasonCode',lifecycle.reason_code,'note',lifecycle.note,'recordedAt',lifecycle.recorded_at) order by lifecycle.recorded_at desc) from app.tournament_roster_entries e join lateral (select x.event_type,x.reason_code,x.note,x.recorded_at from app.roster_entry_lifecycle_events x where x.roster_entry_id=e.id order by x.version desc limit 1) lifecycle on true where e.tournament_id=p_tournament_id and lifecycle.event_type='withdrawn'),'[]'::jsonb),
    'promotionCandidates',coalesce((select jsonb_agg(jsonb_build_object('approvalDecisionId',d.id,'sourceClaimId',c.id,'displayName',c.display_name,'email',c.email,'accNumber',c.acc_number,'intendedPaymentMethod',c.intended_payment_method,'scorecardType',c.requested_scorecard_type,'submittedAt',c.submitted_at) order by c.submitted_at) from app.registration_claim_decisions d join app.registration_claims c on c.id=d.claim_id and c.tournament_id=d.tournament_id left join app.tournament_roster_entries e on e.approval_decision_id=d.id where d.tournament_id=p_tournament_id and d.decision='approved_for_roster' and e.id is null),'[]'::jsonb)
  ) else null end
$$;
revoke all on function public.get_tournament_roster_workspace_v2(uuid) from public,anon,authenticated;
grant execute on function public.get_tournament_roster_workspace_v2(uuid) to authenticated;

notify pgrst,'reload schema';
