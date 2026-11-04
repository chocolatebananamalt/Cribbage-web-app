-- LOCAL proposal only. No legacy receipt, election, award or settlement is rewritten.
-- The first allocation slice supports one activated Standard Main and no Side Pools.
create table app.q_pool_membership_versions_v1 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id),
 event_id uuid not null,
 roster_entry_id uuid not null,
 version integer not null check(version>0),
 request jsonb not null,
 actor_id uuid not null references app.profiles(id),
 operation_receipt_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(roster_entry_id,tournament_id) references app.tournament_roster_entries(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id),
 unique(tournament_id,event_id,roster_entry_id,version),
 unique(id,tournament_id,event_id,roster_entry_id)
);
create table app.q_pool_allocation_versions_v1 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id),
 event_id uuid not null,
 roster_entry_id uuid not null,
 version integer not null check(version>0),
 membership_version_id uuid not null,
 receipt_id uuid not null,
 obligation_version integer not null check(obligation_version>0),
 setup_event_version_id uuid not null references app.tournament_setup_event_versions(id),
 request jsonb not null,
 actor_id uuid not null references app.profiles(id),
 operation_receipt_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(roster_entry_id,tournament_id) references app.tournament_roster_entries(id,tournament_id),
 foreign key(membership_version_id,tournament_id,event_id,roster_entry_id)
   references app.q_pool_membership_versions_v1(id,tournament_id,event_id,roster_entry_id),
 foreign key(receipt_id,roster_entry_id,tournament_id) references app.roster_payment_events(id,roster_entry_id,tournament_id),
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id),
 unique(tournament_id,event_id,roster_entry_id,version)
);
do $$ declare n text; begin
 foreach n in array array['q_pool_membership_versions_v1','q_pool_allocation_versions_v1'] loop
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
  execute format('create index %I on app.%I(actor_id)',n||'_actor_idx',n);
  execute format('create index %I on app.%I(operation_receipt_id,tournament_id)',n||'_receipt_idx',n);
 end loop;
end $$;
create index q_pool_membership_roster_idx on app.q_pool_membership_versions_v1(roster_entry_id,tournament_id);
create index q_pool_membership_event_idx on app.q_pool_membership_versions_v1(event_id,tournament_id);
create index q_pool_allocation_roster_idx on app.q_pool_allocation_versions_v1(roster_entry_id,tournament_id);
create index q_pool_allocation_event_idx on app.q_pool_allocation_versions_v1(event_id,tournament_id);
create index q_pool_allocation_membership_idx on app.q_pool_allocation_versions_v1(membership_version_id,tournament_id,event_id,roster_entry_id);
create index q_pool_allocation_payment_idx on app.q_pool_allocation_versions_v1(receipt_id,roster_entry_id,tournament_id);
create index q_pool_allocation_setup_idx on app.q_pool_allocation_versions_v1(setup_event_version_id);

create function app.q_pool_context_v1(p_tournament_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with a as (
 select a.event_id,a.setup_event_version_id,s.entry_fee_cents,s.event_kind,s.format_code,s.style_code,e.name,e.operational_state
 from app.tournament_setup_activations a join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id and s.tournament_id=a.tournament_id
 join app.events e on e.id=a.event_id and e.tournament_id=a.tournament_id
 where a.tournament_id=p_tournament_id order by a.created_at,a.id limit 1
 ) select jsonb_build_object('eventId',a.event_id,'setupEventVersionId',a.setup_event_version_id,'eventName',a.name,'baseFeeMinor',a.entry_fee_cents,
 'supported',a.event_kind='main' and a.format_code='standard_singles' and a.style_code='Standard' and a.operational_state='active'
  and (select count(*) from app.events where tournament_id=p_tournament_id)=1
  and (select count(*) from app.tournament_setup_activations where tournament_id=p_tournament_id)=1
  and not exists(select 1 from app.tournament_setup_side_pool_versions s where s.tournament_id=p_tournament_id)
  and not exists(select 1 from app.event_side_pools s where s.tournament_id=p_tournament_id)
  and (select count(*) from app.tournament_setup_q_pool_versions p where p.setup_event_version_id=a.setup_event_version_id) between 1 and 2
  and not exists(select 1 from app.tournament_setup_q_pool_versions p where p.setup_event_version_id=a.setup_event_version_id and p.entry_fee_cents<=0),
 'started',exists(select 1 from app.event_play_starts where event_id=a.event_id),
 'pools',coalesce((select jsonb_agg(jsonb_build_object('poolVersionId',p.id,'slot',p.slot,'name','Q Pool '||p.slot||' - '||p.pool_type_code,'feeMinor',p.entry_fee_cents) order by p.slot)
 from app.tournament_setup_q_pool_versions p where p.setup_event_version_id=a.setup_event_version_id),'[]'::jsonb)) from a
$$;
revoke all on function app.q_pool_context_v1(uuid) from public,anon,authenticated,service_role;

-- Validate exact field sets before casts. The public RPC also validates all scope and source facts.
create function app.valid_q_pool_request_v1(r jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare p jsonb; keys text[]; begin
 if jsonb_typeof(r)<>'object' or not r ?& array['action','rosterEntryId','expectedVersion','correction','reason','pools'] then return false; end if;
 keys:=case r->>'action' when 'membership' then array['action','rosterEntryId','expectedVersion','correction','reason','pools']
 when 'allocation' then array['action','rosterEntryId','expectedVersion','correction','reason','pools','membershipVersionId','receiptId','obligationVersion','baseMinor'] else null end;
 if keys is null or (select count(*) from jsonb_object_keys(r))<>cardinality(keys) or not r ?& keys
  or jsonb_typeof(r->'rosterEntryId')<>'string' or r->>'rosterEntryId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  or jsonb_typeof(r->'expectedVersion')<>'number' or r->>'expectedVersion' !~ '^[0-9]{1,9}$'
  or jsonb_typeof(r->'correction')<>'boolean' or jsonb_typeof(r->'reason')<>'string' or length(trim(r->>'reason')) not between 1 and 500
  or octet_length(r->>'reason')>2000 or jsonb_typeof(r->'pools')<>'array' or jsonb_array_length(r->'pools') not between 1 and 2 then return false; end if;
 if r->>'action'='allocation' and (jsonb_typeof(r->'membershipVersionId')<>'string' or r->>'membershipVersionId' !~ '^[0-9a-fA-F-]{36}$'
  or jsonb_typeof(r->'receiptId')<>'string' or r->>'receiptId' !~ '^[0-9a-fA-F-]{36}$'
  or jsonb_typeof(r->'obligationVersion')<>'number' or r->>'obligationVersion' !~ '^[1-9][0-9]{0,8}$'
  or jsonb_typeof(r->'baseMinor')<>'number' or r->>'baseMinor' !~ '^[0-9]{1,9}$') then return false; end if;
 for p in select value from jsonb_array_elements(r->'pools') loop
  if jsonb_typeof(p)<>'object' or jsonb_typeof(p->'poolVersionId')<>'string' or p->>'poolVersionId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
  if r->>'action'='membership' then
   if (select count(*) from jsonb_object_keys(p))<>3 or not p ?& array['poolVersionId','elected','consentReference'] or jsonb_typeof(p->'elected')<>'boolean'
    or jsonb_typeof(p->'consentReference')<>'string' or length(p->>'consentReference')>500 or octet_length(p->>'consentReference')>2000
    or (p->>'elected'='true' and length(trim(p->>'consentReference'))=0) then return false; end if;
  else
   if (select count(*) from jsonb_object_keys(p))<>2 or not p ?& array['poolVersionId','amountMinor'] or jsonb_typeof(p->'amountMinor')<>'number' or p->>'amountMinor' !~ '^[0-9]{1,9}$' then return false; end if;
  end if;
 end loop;
 return (select count(distinct value->>'poolVersionId')=jsonb_array_length(r->'pools') from jsonb_array_elements(r->'pools'));
exception when others then return false; end $$;
revoke all on function app.valid_q_pool_request_v1(jsonb) from public,anon,authenticated,service_role;

create function public.save_q_pool_membership_v1(p_actor_id uuid,p_tournament_id uuid,p_request jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; receipt app.operation_receipts%rowtype; payment app.roster_payment_events%rowtype;
 obligation app.roster_payment_obligation_versions%rowtype; member app.q_pool_membership_versions_v1%rowtype;
 tid uuid:=p_tournament_id; eid uuid; rid uuid; op uuid; vid uuid:=extensions.gen_random_uuid(); v integer; h text; response jsonb; code text;
 pool jsonb; item jsonb; elected boolean; due bigint; total bigint; started_at timestamptz; correction boolean;
begin
 if p_actor_id is null or tid is null or p_operation_id is null or app.valid_q_pool_request_v1(p_request) is distinct from true then
  return jsonb_build_object('status','rejected','code','invalid_request','rosterEntryId',p_request->>'rosterEntryId'); end if;
 rid:=(p_request->>'rosterEntryId')::uuid; correction:=(p_request->>'correction')::boolean;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform 1 from app.tournaments where id=tid for no key update;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable','rosterEntryId',rid); end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=p_actor_id and role in('director','co_director') for update;
 if not found then return jsonb_build_object('status','rejected','code','not_director','rosterEntryId',rid); end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('q_pool_membership_v1',tid,p_request)::text,'utf8'),'sha256'),'hex');
 select * into receipt from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if receipt.tournament_id=tid and receipt.request_hash=h and receipt.operation_type='q_pool_membership_v1' then return receipt.response_payload; end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict','rosterEntryId',rid);
 end if;
 -- All known rejections are retained operation receipts; a retry cannot silently change meaning after state changes.
 begin
  if not exists(select 1 from app.tournaments where id=tid and status in('draft','open','pending_finalization')) then raise exception 'tournament_unavailable'; end if;
  c:=app.q_pool_context_v1(tid); if c is null or c->>'supported' is distinct from 'true' then raise exception 'unsupported_scope'; end if;
  eid:=(c->>'eventId')::uuid;
  perform 1 from app.tournament_roster_entries where id=rid and tournament_id=tid for no key update;
  if not found or not exists(select 1 from app.event_participants where tournament_id=tid and event_id=eid and roster_entry_id=rid and status in('registered','checked_in'))
    or coalesce((select event_type from app.roster_entry_lifecycle_events where tournament_id=tid and roster_entry_id=rid order by version desc limit 1),'active')='withdrawn' then raise exception 'participant_unavailable'; end if;
  perform 1 from app.event_participants where tournament_id=tid and event_id=eid and roster_entry_id=rid and status in('registered','checked_in') for no key update;
  if not found then raise exception 'participant_unavailable'; end if;
  if exists(select 1 from app.event_settlement_drafts_v5 where event_id=eid) or exists(select 1 from app.standard_singles_settlement_drafts where event_id=eid) then raise exception 'settlement_started'; end if;
  if jsonb_array_length(p_request->'pools')<>jsonb_array_length(c->'pools') or exists(select 1 from jsonb_array_elements(p_request->'pools') x
   where not exists(select 1 from jsonb_array_elements(c->'pools') y where y->>'poolVersionId'=x->>'poolVersionId')) then raise exception 'pool_version_mismatch'; end if;
  select * into member from app.q_pool_membership_versions_v1 where tournament_id=tid and event_id=eid and roster_entry_id=rid order by version desc limit 1;
  select s.started_at into started_at from app.event_play_starts s where s.event_id=eid;
  if correction and not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=p_actor_id and role='director') then raise exception 'correction_requires_director'; end if;
  if started_at is not null then
   if not correction then raise exception 'entries_locked'; end if;
   if member.id is null then raise exception 'late_new_election_unsupported'; end if;
   if exists(select 1 from jsonb_array_elements(case when p_request->>'action'='membership' then p_request->'pools' else member.request->'pools' end) x
    where x->>'elected'='true' and not exists(select 1 from app.q_pool_membership_versions_v1 m cross join lateral jsonb_array_elements(m.request->'pools') prior
     where m.tournament_id=tid and m.event_id=eid and m.roster_entry_id=rid and m.recorded_at<started_at
       and prior->>'poolVersionId'=x->>'poolVersionId' and prior->>'elected'='true')) then raise exception 'late_new_election_unsupported'; end if;
  end if;
  if p_request->>'action'='membership' then
   v:=coalesce(member.version,0);
   if correction and v=0 then raise exception 'correction_requires_prior_record'; end if;
   if v<>(p_request->>'expectedVersion')::integer then raise exception 'stale_version'; end if;
   response:=jsonb_build_object('status','q_pool_saved','action',p_request->>'action','rosterEntryId',rid,'version',v+1,'versionId',vid);
   insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(extensions.gen_random_uuid(),tid,p_actor_id,'q_pool_membership_v1',rid,h,p_operation_id,'accepted',response,now()) returning id into op;
   insert into app.q_pool_membership_versions_v1(id,tournament_id,event_id,roster_entry_id,version,request,actor_id,operation_receipt_id)
    values(vid,tid,eid,rid,v+1,p_request,p_actor_id,op);
  else
   select coalesce(max(version),0) into v from app.q_pool_allocation_versions_v1 where tournament_id=tid and event_id=eid and roster_entry_id=rid;
   if correction and v=0 then raise exception 'correction_requires_prior_record'; end if;
   if v<>(p_request->>'expectedVersion')::integer then raise exception 'stale_version'; end if;
   if member.id is null or member.id<>(p_request->>'membershipVersionId')::uuid then raise exception 'stale_membership'; end if;
   select * into payment from app.roster_payment_events where tournament_id=tid and roster_entry_id=rid order by version desc limit 1;
   if payment.id is null or payment.id<>(p_request->>'receiptId')::uuid or payment.event_type<>'received' then raise exception 'stale_receipt'; end if;
   if started_at is not null and not exists(select 1 from app.q_pool_allocation_versions_v1 prior where prior.tournament_id=tid and prior.event_id=eid and prior.roster_entry_id=rid and prior.receipt_id=payment.id and prior.recorded_at<started_at) then raise exception 'late_payment_unsupported'; end if;
   select * into obligation from app.roster_payment_obligation_versions where tournament_id=tid and roster_entry_id=rid order by version desc limit 1;
   if obligation.id is null or obligation.version<>(p_request->>'obligationVersion')::integer then raise exception 'stale_obligation'; end if;
   due:=(c->>'baseFeeMinor')::bigint; total:=(p_request->>'baseMinor')::bigint;
   if total>due then raise exception 'allocation_exceeds_fee'; end if;
   for pool in select value from jsonb_array_elements(c->'pools') loop
    select (x->>'elected')::boolean into elected from jsonb_array_elements(member.request->'pools') x where x->>'poolVersionId'=pool->>'poolVersionId';
    select x into item from jsonb_array_elements(p_request->'pools') x where x->>'poolVersionId'=pool->>'poolVersionId';
    if elected then due:=due+(pool->>'feeMinor')::bigint; end if;
    if (item->>'amountMinor')::bigint>(case when elected then (pool->>'feeMinor')::bigint else 0 end) then raise exception 'allocation_exceeds_fee'; end if;
    total:=total+(item->>'amountMinor')::bigint;
   end loop;
   if due<>obligation.amount_owed_minor then raise exception 'obligation_breakdown_mismatch'; end if;
   if total<>payment.amount_minor then raise exception 'allocation_receipt_mismatch'; end if;
   response:=jsonb_build_object('status','q_pool_saved','action',p_request->>'action','rosterEntryId',rid,'version',v+1,'versionId',vid);
   insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(tid,p_actor_id,'q_pool_membership_v1',rid,h,p_operation_id,'accepted',response,now()) returning id into op;
   insert into app.q_pool_allocation_versions_v1(id,tournament_id,event_id,roster_entry_id,version,membership_version_id,receipt_id,obligation_version,setup_event_version_id,request,actor_id,operation_receipt_id)
    values(vid,tid,eid,rid,v+1,member.id,payment.id,obligation.version,(c->>'setupEventVersionId')::uuid,p_request,p_actor_id,op);
  end if;
  response:=jsonb_build_object('status','q_pool_saved','action',p_request->>'action','rosterEntryId',rid,'version',v+1,'versionId',vid);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(tid,p_actor_id,op,'q_pool_membership',vid,'q_pool_'||(p_request->>'action')||'_saved',response);
  return response;
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=sqlerrm; if code not in('tournament_unavailable','unsupported_scope','participant_unavailable','settlement_started','pool_version_mismatch','correction_requires_director','entries_locked','late_new_election_unsupported','stale_version','stale_membership','stale_receipt','late_payment_unsupported','stale_obligation','allocation_exceeds_fee','obligation_breakdown_mismatch','allocation_receipt_mismatch','correction_requires_prior_record') then code:='invalid_request'; end if;
  response:=jsonb_build_object('status','rejected','code',code,'rosterEntryId',rid);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
   values(tid,p_actor_id,'q_pool_membership_v1',rid,h,p_operation_id,'rejected',response,now());
  return response;
 end;
end $$;

create function public.get_q_pool_membership_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c jsonb; rows jsonb:='[]'; r record; m app.q_pool_membership_versions_v1%rowtype; a app.q_pool_allocation_versions_v1%rowtype;
 pay app.roster_payment_events%rowtype; owe app.roster_payment_obligation_versions%rowtype; current boolean; pool jsonb; x jsonb; p jsonb; elected boolean; due bigint; amount integer; base integer; poolrows jsonb; started_at timestamptz;
begin
 if p_actor_id is null or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return null; end if;
 c:=app.q_pool_context_v1(p_tournament_id); if c is null then return null; end if;
 select s.started_at into started_at from app.event_play_starts s where s.event_id=(c->>'eventId')::uuid;
 for r in select roster.id,roster.claimed_display_name,participant.id participant_id,participant.status
  from app.event_participants participant join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id and roster.tournament_id=participant.tournament_id
  where participant.tournament_id=p_tournament_id and participant.event_id=(c->>'eventId')::uuid order by roster.claimed_normalized_name,roster.id loop
  select * into m from app.q_pool_membership_versions_v1 where tournament_id=p_tournament_id and event_id=(c->>'eventId')::uuid and roster_entry_id=r.id order by version desc limit 1;
  select * into a from app.q_pool_allocation_versions_v1 where tournament_id=p_tournament_id and event_id=(c->>'eventId')::uuid and roster_entry_id=r.id order by version desc limit 1;
  select * into pay from app.roster_payment_events where tournament_id=p_tournament_id and roster_entry_id=r.id order by version desc limit 1;
  select * into owe from app.roster_payment_obligation_versions where tournament_id=p_tournament_id and roster_entry_id=r.id order by version desc limit 1;
  due:=(c->>'baseFeeMinor')::bigint; poolrows:='[]';
  for pool in select value from jsonb_array_elements(c->'pools') loop
   select value into x from jsonb_array_elements(coalesce(m.request->'pools','[]')) where value->>'poolVersionId'=pool->>'poolVersionId';
   if x->>'elected'='true' then due:=due+(pool->>'feeMinor')::bigint; end if;
  end loop;
  current:=coalesce(c->>'supported'='true' and a.id is not null and a.membership_version_id=m.id and a.receipt_id=pay.id and pay.event_type='received'
   and a.obligation_version=owe.version and owe.amount_owed_minor=due and a.setup_event_version_id=(c->>'setupEventVersionId')::uuid
   and r.status in('registered','checked_in') and coalesce((select event_type from app.roster_entry_lifecycle_events where tournament_id=p_tournament_id and roster_entry_id=r.id order by version desc limit 1),'active')<>'withdrawn',false);
  base:=case when current then (a.request->>'baseMinor')::integer else 0 end;
  for pool in select value from jsonb_array_elements(c->'pools') loop
   select value into x from jsonb_array_elements(coalesce(m.request->'pools','[]')) where value->>'poolVersionId'=pool->>'poolVersionId';
   elected:=coalesce(x->>'elected'='true',false);
   select value into p from jsonb_array_elements(coalesce(a.request->'pools','[]')) where value->>'poolVersionId'=pool->>'poolVersionId';
   amount:=case when current then coalesce((p->>'amountMinor')::integer,0) else 0 end;
   poolrows:=poolrows||jsonb_build_array(jsonb_build_object('poolVersionId',pool->>'poolVersionId','elected',elected,'consentReference',coalesce(x->>'consentReference',''),
    'prePlayElected',case when started_at is null then elected else exists(select 1 from app.q_pool_membership_versions_v1 prior cross join lateral jsonb_array_elements(prior.request->'pools') prior_pool where prior.tournament_id=p_tournament_id and prior.event_id=(c->>'eventId')::uuid and prior.roster_entry_id=r.id and prior.recorded_at<started_at and prior_pool->>'poolVersionId'=pool->>'poolVersionId' and prior_pool->>'elected'='true') end,
    'amountOwedMinor',case when elected then (pool->>'feeMinor')::integer else 0 end,'amountAllocatedMinor',amount,
    'paidEntryEligible',current and elected and base=(c->>'baseFeeMinor')::integer and amount=(pool->>'feeMinor')::integer));
  end loop;
  rows:=rows||jsonb_build_array(jsonb_build_object('rosterEntryId',r.id,'participantId',r.participant_id,'displayName',r.claimed_display_name,
   'membershipVersion',coalesce(m.version,0),'membershipVersionId',m.id,'pools',poolrows,'allocationVersion',coalesce(a.version,0),
   'receiptId',case when pay.event_type='received' then pay.id else null end,'receiptVersion',coalesce(pay.version,0),'receivedMinor',case when pay.event_type='received' then pay.amount_minor else 0 end,
   'obligationVersion',coalesce(owe.version,0),'obligationMinor',owe.amount_owed_minor,'allocationCurrent',current,'baseAllocatedMinor',base,
   'reason',case when a.id is not null and not current then 'Source changed: review receipt, obligation, membership and configuration before reallocating.' else null end));
 end loop;
 return jsonb_build_object('tournamentId',p_tournament_id,'eventId',c->>'eventId','eventName',c->>'eventName',
  'canCorrect',exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director'),
  'started',c->'started','supported',c->'supported','blockedReason',case when c->>'supported'='true' then null else 'This first slice requires one active Standard Main, positive configured Q Pool fees and no Side Pools or other events.' end,
  'baseFeeMinor',(c->>'baseFeeMinor')::integer,'pools',c->'pools','entries',rows);
end $$;
create function public.get_q_pool_membership_reconciliation_v1(p_actor_id uuid,p_tournament_id uuid,p_operation_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when p_actor_id is not null and exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))
 then jsonb_build_object('authorized',true,'result',(select response_payload from app.operation_receipts where tournament_id=p_tournament_id and actor_profile_id=p_actor_id and client_operation_id=p_operation_id and operation_type='q_pool_membership_v1')) else null end
$$;
revoke all on function public.save_q_pool_membership_v1(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.get_q_pool_membership_workspace_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_q_pool_membership_reconciliation_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_q_pool_membership_v1(uuid,uuid,jsonb,uuid) to service_role;
grant execute on function public.get_q_pool_membership_workspace_v1(uuid,uuid) to service_role;
grant execute on function public.get_q_pool_membership_reconciliation_v1(uuid,uuid,uuid) to service_role;
