-- LOCAL PROPOSAL. New disclosed policy and physical-cut attestations only.
-- No historical policy/review changes, award writer, settlement or money movement.
create table app.q_operating_policies_v2 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id), event_id uuid not null,
 pool_version_id uuid not null unique references app.tournament_setup_q_pool_versions(id),
 method text not null check(method in('equal-paid-playoff-qualifiers-v2','graduated-paid-card-rank-v2')),
 ratio integer, schedule_id text,
 disclosure_reference text not null check(length(trim(disclosure_reference)) between 1 and 500 and disclosure_reference !~ '[[:cntrl:]]'),
 actor_id uuid not null references app.profiles(id), operation_receipt_id uuid not null,
 published_at timestamptz not null default clock_timestamp(),
 check((method='equal-paid-playoff-qualifiers-v2' and ratio is null and schedule_id is null) or
  (method='graduated-paid-card-rank-v2' and ratio is not null and schedule_id is not null and
   ((ratio=6 and schedule_id in('friend-q-p2-10-6-v1','friend-q-p3-20-6-v1','friend-q-p4-50-6-v1')) or
    (ratio=4 and schedule_id in('friend-q-p5-10-4-v1','friend-q-p6-20-4-v1','friend-q-p7-50-4-v1'))))),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id)
);
create table app.q_cut_attestations_v2 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id),
 pool_version_id uuid not null references app.tournament_setup_q_pool_versions(id),
 policy_id uuid not null references app.q_operating_policies_v2(id),
 source_digest text not null check(source_digest ~ '^[a-f0-9]{64}$'),
 group_digest text not null check(group_digest ~ '^[a-f0-9]{64}$'),
 participant_ids_low_first jsonb not null check(jsonb_typeof(participant_ids_low_first)='array' and jsonb_array_length(participant_ids_low_first) between 2 and 256),
 reason text not null check(length(trim(reason)) between 1 and 500 and reason !~ '[[:cntrl:]]'),
 actor_id uuid not null references app.profiles(id), operation_receipt_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 unique(pool_version_id,source_digest,group_digest),
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id)
);
do $$declare n text;begin foreach n in array array['q_operating_policies_v2','q_cut_attestations_v2'] loop
 execute format('alter table app.%I enable row level security',n);
 execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 execute format('create index %I on app.%I(tournament_id)',n||'_tournament_idx',n);
 execute format('create index %I on app.%I(actor_id)',n||'_actor_idx',n);
 execute format('create index %I on app.%I(operation_receipt_id,tournament_id)',n||'_receipt_idx',n);
end loop;end$$;
create index q_operating_policy_event_idx on app.q_operating_policies_v2(event_id,tournament_id);
create index q_cut_policy_idx on app.q_cut_attestations_v2(policy_id);

-- Same tournament row lock as all legacy/new receipt and membership writers.
-- Cross-version exclusivity prevents a legacy client freezing a different policy.
create function app.guard_q_operating_disclosure_v2() returns trigger language plpgsql security definer set search_path='' as $$
declare p app.q_operating_policies_v2%rowtype;x jsonb;prefix text;
begin
 perform 1 from app.tournaments where id=new.tournament_id for no key update;
 if tg_table_name='q_pool_policies_v1' then
  if exists(select 1 from app.q_operating_policies_v2 where tournament_id=new.tournament_id) then raise exception 'policy_frozen';end if;
 elsif tg_table_name='q_operating_policies_v2' then
  if exists(select 1 from app.q_pool_policies_v1 where tournament_id=new.tournament_id) then raise exception 'policy_frozen';end if;
 elsif tg_table_name='roster_payment_events' then
  if new.event_type='received' and exists(select 1 from app.q_operating_policies_v2 where tournament_id=new.tournament_id and new.payment_received_at<published_at) then raise exception 'q_policy_backdated_receipt';end if;
 else
  for x in select value from jsonb_array_elements(new.request->'pools') where value->>'elected'='true' loop
   select * into p from app.q_operating_policies_v2 where tournament_id=new.tournament_id and event_id=new.event_id and pool_version_id=(x->>'poolVersionId')::uuid;
   if found then
    prefix:='Q policy '||p.id::text||': ';
    if left(coalesce(x->>'consentReference',''),length(prefix))<>prefix or length(trim(substr(x->>'consentReference',length(prefix)+1)))=0 then raise exception 'q_policy_acknowledgment_required';end if;
   end if;
  end loop;
 end if;
 return new;
end$$;
revoke all on function app.guard_q_operating_disclosure_v2() from public,anon,authenticated,service_role;
create trigger q_operating_legacy_policy_guard before insert on app.q_pool_policies_v1 for each row execute function app.guard_q_operating_disclosure_v2();
create trigger q_operating_policy_guard before insert on app.q_operating_policies_v2 for each row execute function app.guard_q_operating_disclosure_v2();
create trigger q_operating_receipt_guard before insert on app.roster_payment_events for each row execute function app.guard_q_operating_disclosure_v2();
create trigger q_operating_election_guard before insert on app.q_pool_membership_versions_v1 for each row execute function app.guard_q_operating_disclosure_v2();

create function public.get_q_operating_workspace_v2(p_actor_id uuid,p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s jsonb;b jsonb;c jsonb;policies jsonb;cards jsonb;cuts jsonb;manifest jsonb;digest text;blocks jsonb;eid uuid;qid uuid;
begin
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director') then return null;end if;
 s:=public.get_q_pool_preview_sources_v1(p_actor_id,p_tournament_id);if s is null then return null;end if;
 b:=app.q_obligation_sources_v1(p_actor_id,p_tournament_id);c:=app.q_pool_context_v1(p_tournament_id);eid:=(c->>'eventId')::uuid;
 qid:=(s->'qualification'->>'id')::uuid;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'poolVersionId',pool_version_id,'method',method,'ratio',ratio,'scheduleId',schedule_id,'disclosureReference',disclosure_reference,'publishedAt',published_at)order by pool_version_id),'[]') into policies from app.q_operating_policies_v2 where tournament_id=p_tournament_id and event_id=eid;
 select coalesce(jsonb_agg(jsonb_build_object('participantId',participant_id,'gamePoints',game_points,'gamesWon',games_won,'plusPoints',plus_points,
  'qualified',qualification_status='qualified','qualificationRank',case when qualification_status='qualified' then ranking_ordinal else null end)order by ranking_ordinal),'[]') into cards
 from app.qualification_result_rows where result_version_id=qid;
 select coalesce(jsonb_agg(value order by value),'[]') into blocks from (select distinct value from jsonb_array_elements(coalesce(s->'blockers','[]')||coalesce(b->'blockers','[]')) where value<>'"q_sources_blocked"'::jsonb)v;
 if qid is null then blocks:=blocks||'"finalized_qualification_required"'::jsonb;end if;
 if exists(select 1 from app.q_pool_policies_v1 where tournament_id=p_tournament_id) then blocks:=blocks||'"legacy_policy_preserved"'::jsonb;end if;
 manifest:=jsonb_build_object('version','friend-operating-v2','pdfSha256','f7549bd181bdfd0c08695547293d32811b5406ef1aa3c171bba221420238924d',
  'legacySources',s,'scoreFinancialManifest',b->'manifest','policies',policies,'cards',cards,'blockers',blocks);
 digest:=encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex');
 select coalesce(jsonb_agg(jsonb_build_object('poolVersionId',pool_version_id,'sourceDigest',source_digest,'participantIdsLowFirst',participant_ids_low_first,'recordedBy',actor_id,'reason',reason)order by id),'[]') into cuts
 from app.q_cut_attestations_v2 where tournament_id=p_tournament_id and source_digest=digest;
 return jsonb_build_object('tournamentId',p_tournament_id,'membership',s->'membership','canPublish',s->>'canPublish'='true' and not exists(select 1 from app.q_pool_policies_v1 where tournament_id=p_tournament_id),
  'policies',policies,'cards',cards,'cuts',cuts,'sourceDigest',digest,'blockers',blocks);
end$$;

create function public.save_q_operating_policy_v2(p_actor_id uuid,p_tournament_id uuid,p_request jsonb,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w jsonb;c jsonb;pol app.q_operating_policies_v2%rowtype;prior app.operation_receipts%rowtype;h text;response jsonb;code text;pid uuid;rid uuid:=extensions.gen_random_uuid();op uuid:=extensions.gen_random_uuid();
 pool jsonb;ids jsonb;groupids jsonb;tuple jsonb;gd text;setupcode text;fee integer;ratio integer;sid text;cutid uuid;
begin
 if p_actor_id is null or p_tournament_id is null or p_operation_id is null then return null;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 c:=app.q_pool_context_v1(p_tournament_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qualification-finalization:'||(c->>'eventId'),0));
 perform 1 from app.tournaments where id=p_tournament_id and status in('draft','open','pending_finalization') for no key update;
 if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director' for update;
 if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('q_operating_v2',p_tournament_id,p_request)::text,'utf8'),'sha256'),'hex');
 select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if prior.tournament_id=p_tournament_id and prior.operation_type='q_operating_v2' and prior.request_hash=h then return prior.response_payload;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 begin
  if jsonb_typeof(p_request) is distinct from 'object' or jsonb_typeof(p_request->'poolVersionId') is distinct from 'string' or p_request->>'poolVersionId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'invalid_request';end if;
  pid:=(p_request->>'poolVersionId')::uuid;w:=public.get_q_operating_workspace_v2(p_actor_id,p_tournament_id);
  select value into pool from jsonb_array_elements(w->'membership'->'pools') where value->>'poolVersionId'=pid::text;
  if pool is null then raise exception 'pool_version_mismatch';end if;
  if p_request->>'action'='publish' then
   if (select count(*) from jsonb_object_keys(p_request))<>7 or not p_request ?& array['action','poolVersionId','method','ratio','scheduleId','disclosureReference','disclosed']
    or p_request->'disclosed' is distinct from 'true'::jsonb or jsonb_typeof(p_request->'disclosureReference') is distinct from 'string' or length(trim(p_request->>'disclosureReference')) not between 1 and 500 or p_request->>'disclosureReference' ~ '[[:cntrl:]]' then raise exception 'invalid_request';end if;
   if exists(select 1 from app.q_pool_policies_v1 where pool_version_id=pid) or exists(select 1 from app.q_operating_policies_v2 where pool_version_id=pid) then raise exception 'policy_frozen';end if;
   if c->>'started'='true' then raise exception 'entries_locked';end if;
   if w->>'canPublish' is distinct from 'true' then raise exception 'collection_or_consent_already_started';end if;
   select pool_type_code,entry_fee_cents into setupcode,fee from app.tournament_setup_q_pool_versions where id=pid and tournament_id=p_tournament_id;
   if p_request->>'method'='equal-paid-playoff-qualifiers-v2' then
    if p_request->'ratio' is distinct from 'null'::jsonb or p_request->'scheduleId' is distinct from 'null'::jsonb then raise exception 'invalid_request';end if;
    if setupcode<>'Equal (Pays All Equally)' then raise exception 'setup_method_conflict';end if;
    ratio:=null;sid:=null;
   elsif p_request->>'method'='graduated-paid-card-rank-v2' then
    if p_request->'ratio' not in('4'::jsonb,'6'::jsonb) or jsonb_typeof(p_request->'scheduleId') is distinct from 'string' then raise exception 'invalid_request';end if;
    ratio:=(p_request->>'ratio')::integer;sid:=p_request->>'scheduleId';
    if setupcode<>('Graduated (1-in-'||ratio::text||')') then raise exception 'setup_method_conflict';end if;
    if sid is distinct from (case when fee=1000 and ratio=6 then 'friend-q-p2-10-6-v1' when fee=2000 and ratio=6 then 'friend-q-p3-20-6-v1' when fee=5000 and ratio=6 then 'friend-q-p4-50-6-v1' when fee=1000 and ratio=4 then 'friend-q-p5-10-4-v1' when fee=2000 and ratio=4 then 'friend-q-p6-20-4-v1' when fee=5000 and ratio=4 then 'friend-q-p7-50-4-v1' else null end) or fee not in(1000,2000,5000) then raise exception 'chart_review_required';end if;
   else raise exception 'invalid_request';end if;
   response:=jsonb_build_object('status','q_policy_published','policyId',rid,'poolVersionId',pid);
  elsif p_request->>'action'='cut' then
   if (select count(*) from jsonb_object_keys(p_request))<>5 or not p_request ?& array['action','poolVersionId','expectedSourceDigest','participantIdsLowFirst','reason']
    or jsonb_typeof(p_request->'reason') is distinct from 'string' or length(trim(p_request->>'reason')) not between 1 and 500 or p_request->>'reason' ~ '[[:cntrl:]]'
    or jsonb_typeof(p_request->'expectedSourceDigest') is distinct from 'string' or p_request->>'expectedSourceDigest' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_request->'participantIdsLowFirst') is distinct from 'array' or jsonb_array_length(p_request->'participantIdsLowFirst') not between 2 and 256 then raise exception 'invalid_request';end if;
   if p_request->>'expectedSourceDigest' is distinct from w->>'sourceDigest' then raise exception 'stale_source';end if;
   if jsonb_array_length(w->'blockers')<>0 then raise exception 'sources_blocked';end if;
   select * into pol from app.q_operating_policies_v2 where pool_version_id=pid and tournament_id=p_tournament_id;
   if not found or pol.method<>'graduated-paid-card-rank-v2' then raise exception 'policy_required';end if;
   ids:=p_request->'participantIdsLowFirst';
   if exists(select 1 from jsonb_array_elements(ids)x where jsonb_typeof(x)<>'string' or x#>>'{}' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') or (select count(distinct value) from jsonb_array_elements(ids))<>jsonb_array_length(ids) then raise exception 'invalid_request';end if;
   select jsonb_build_array(r->'gamePoints',r->'gamesWon',r->'plusPoints') into tuple from jsonb_array_elements(w->'cards')r where r->'participantId'=ids->0;
   select coalesce(jsonb_agg(r->'participantId' order by r->>'participantId'),'[]') into groupids from jsonb_array_elements(w->'cards')r
    where jsonb_build_array(r->'gamePoints',r->'gamesWon',r->'plusPoints')=tuple and exists(select 1 from jsonb_array_elements(w->'membership'->'entries')e cross join lateral jsonb_array_elements(e->'pools')ep where e->>'participantId'=r->>'participantId' and ep->>'poolVersionId'=pid::text and ep->>'elected'='true' and ep->>'paidEntryEligible'='true' and e->>'allocationCurrent'='true' and (ep->>'amountAllocatedMinor')::integer=(pool->>'feeMinor')::integer and starts_with(ep->>'consentReference','Q policy '||pol.id::text||': '));
   if (select jsonb_agg(value order by value) from jsonb_array_elements(ids)) is distinct from groupids then raise exception 'cut_group_mismatch';end if;
   gd:=encode(extensions.digest(convert_to(groupids::text,'utf8'),'sha256'),'hex');
   if exists(select 1 from app.q_cut_attestations_v2 where pool_version_id=pid and source_digest=w->>'sourceDigest' and group_digest=gd) then raise exception 'cut_already_recorded';end if;
   response:=jsonb_build_object('status','q_cut_recorded','cutId',rid,'poolVersionId',pid);
  else raise exception 'invalid_request';end if;
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(op,p_tournament_id,p_actor_id,'q_operating_v2',pid,h,p_operation_id,'accepted',response,now());
  if p_request->>'action'='publish' then
   insert into app.q_operating_policies_v2(id,tournament_id,event_id,pool_version_id,method,ratio,schedule_id,disclosure_reference,actor_id,operation_receipt_id)values(rid,p_tournament_id,(c->>'eventId')::uuid,pid,p_request->>'method',ratio,sid,trim(p_request->>'disclosureReference'),p_actor_id,op);
  else
   insert into app.q_cut_attestations_v2(id,tournament_id,pool_version_id,policy_id,source_digest,group_digest,participant_ids_low_first,reason,actor_id,operation_receipt_id)values(rid,p_tournament_id,pid,pol.id,w->>'sourceDigest',gd,ids,trim(p_request->>'reason'),p_actor_id,op);
  end if;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,op,'q_operating_v2',rid,case when p_request->>'action'='publish' then 'q_operating_policy_frozen' else 'q_physical_cut_attested' end,response);
  return response;
 exception when raise_exception or invalid_text_representation then
  code:=case when sqlerrm in('invalid_request','pool_version_mismatch','policy_frozen','entries_locked','collection_or_consent_already_started','setup_method_conflict','chart_review_required','stale_source','sources_blocked','policy_required','cut_group_mismatch','cut_already_recorded') then sqlerrm else 'invalid_request' end;
  response:=jsonb_build_object('status','rejected','code',code);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload)values(p_tournament_id,p_actor_id,'q_operating_v2',p_tournament_id,h,p_operation_id,'rejected',response);return response;
 end;
end$$;
create function public.get_q_operating_reconciliation_v2(p_actor_id uuid,p_tournament_id uuid,p_operation_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director') then jsonb_build_object('authorized',true,'result',(select response_payload from app.operation_receipts where tournament_id=p_tournament_id and actor_profile_id=p_actor_id and client_operation_id=p_operation_id and operation_type='q_operating_v2')) else null end
$$;
revoke all on function public.get_q_operating_workspace_v2(uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_q_operating_policy_v2(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.get_q_operating_reconciliation_v2(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_q_operating_workspace_v2(uuid,uuid) to service_role;
grant execute on function public.save_q_operating_policy_v2(uuid,uuid,jsonb,uuid) to service_role;
grant execute on function public.get_q_operating_reconciliation_v2(uuid,uuid,uuid) to service_role;
