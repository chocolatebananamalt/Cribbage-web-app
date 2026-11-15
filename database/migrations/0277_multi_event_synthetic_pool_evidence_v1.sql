-- LOCAL WORK IN PROGRESS. Explicit event-keyed synthetic disclosures/elections;
-- no payments, source allocation, payout authority or physical consent claims.
begin;
create table app.multi_event_pool_disclosures_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.multi_event_finance_modes_v1(tournament_id),
 event_id uuid not null,setup_event_version_id uuid not null references app.tournament_setup_event_versions(id),
 pool_kind text not null check(pool_kind in('q','side')),pool_definition_id uuid not null,pool_id uuid,
 method text not null check(method in('equal-paid-playoff-qualifiers-v2','graduated-acc-weighted-largest-remainder-5usd-v2')),
 ratio integer,fee_minor integer not null check(fee_minor>=500 and mod(fee_minor,500)=0),
 disclosure_reference text not null check(length(trim(disclosure_reference)) between 21 and 500 and left(disclosure_reference,20)='TEST ONLY SYNTHETIC:' and length(trim(substr(disclosure_reference,21)))>0),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,published_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(tournament_id,event_id,pool_kind,pool_definition_id),unique(id,tournament_id,event_id),
 check((pool_kind='q' and pool_id is null) or (pool_kind='side' and pool_id is not null)),
 check((method='equal-paid-playoff-qualifiers-v2' and pool_kind='q' and ratio is null) or (method='graduated-acc-weighted-largest-remainder-5usd-v2' and ratio in(4,6,8,10)))
);
create table app.multi_event_pool_elections_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,policy_id uuid not null,
 participant_id uuid not null,roster_entry_id uuid not null,version integer not null check(version between 1 and 256),elected boolean not null,
 reason text not null check(length(trim(reason)) between 21 and 500 and left(reason,20)='TEST ONLY SYNTHETIC:' and length(trim(substr(reason,21)))>0),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 foreign key(policy_id,tournament_id,event_id)references app.multi_event_pool_disclosures_v1(id,tournament_id,event_id),
 foreign key(participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 foreign key(roster_entry_id,tournament_id)references app.tournament_roster_entries(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),unique(policy_id,participant_id,version)
);
do $$declare n text;begin foreach n in array array['multi_event_pool_disclosures_v1','multi_event_pool_elections_v1']loop
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 execute format('create index %I on app.%I(tournament_id,event_id)',n||'_event_idx',n);
 execute format('create index %I on app.%I(actor_id)',n||'_actor_idx',n);
 execute format('create index %I on app.%I(operation_receipt_id,tournament_id)',n||'_receipt_idx',n);
end loop;end$$;

-- 0274 serializes and excludes all legacy policy/election domains on opt-in.

create function public.publish_multi_event_pool_disclosure_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare mode app.multi_event_finance_modes_v1%rowtype;prior app.operation_receipts%rowtype;h text;receipt uuid:=extensions.gen_random_uuid();pid uuid:=extensions.gen_random_uuid();res jsonb;
 setup_id uuid;defid uuid;pool uuid;kind text;method text;selected text;fee integer;ratio integer; actual_ratio integer;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' or actor is null or tid is null or eid is null or op is null then return null;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||op::text,0));
 perform 1 from app.tournaments where id=tid and status='open' for update;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director' for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('multi_event_pool_disclosure_v1',tid,eid,req)::text,'utf8'),'sha256'),'hex');
 select * into prior from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if prior.tournament_id=tid and prior.operation_type='multi_event_pool_disclosure_v1' and prior.request_hash=h then return prior.response_payload;end if;return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select * into mode from app.multi_event_finance_modes_v1 where tournament_id=tid;
 if mode.id is null or mode.evidence_kind<>'simulation' or public.get_multi_event_finance_workspace_v1(actor,tid)->>'status' is distinct from 'available' then return jsonb_build_object('status','rejected','code','finance_mode_unavailable');end if;
 if jsonb_typeof(req) is distinct from 'object' or (select count(*) from jsonb_object_keys(req))<>6 or not(req?&array['kind','poolDefinitionId','method','ratio','disclosureReference','disclosed']) or req->'disclosed' is distinct from 'true'::jsonb
  or jsonb_typeof(req->'kind') is distinct from 'string' or req->>'kind' not in('q','side')
  or jsonb_typeof(req->'poolDefinitionId') is distinct from 'string' or req->>'poolDefinitionId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or jsonb_typeof(req->'method') is distinct from 'string' or req->>'method' not in('equal-paid-playoff-qualifiers-v2','graduated-acc-weighted-largest-remainder-5usd-v2')
  or jsonb_typeof(req->'disclosureReference') is distinct from 'string' or length(req->>'disclosureReference') not between 21 and 500 or left(req->>'disclosureReference',20)<>'TEST ONLY SYNTHETIC:' or length(trim(substr(req->>'disclosureReference',21)))=0 or req->>'disclosureReference'<>trim(req->>'disclosureReference') or req->>'disclosureReference'~'[[:cntrl:]]' then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 kind:=req->>'kind';defid:=(req->>'poolDefinitionId')::uuid;method:=req->>'method';
 if method='equal-paid-playoff-qualifiers-v2' then if kind<>'q' or req->'ratio' is distinct from 'null'::jsonb then return jsonb_build_object('status','rejected','code','unsupported_policy');end if;ratio:=null;
 else if jsonb_typeof(req->'ratio') is distinct from 'number' or req->>'ratio' not in('4','6','8','10') then return jsonb_build_object('status','rejected','code','invalid_request');end if;ratio:=(req->>'ratio')::integer;end if;
 select a.setup_event_version_id into setup_id from app.events e join app.tournament_setup_activations a on a.event_id=e.id and a.tournament_id=e.tournament_id where e.id=eid and e.tournament_id=tid and e.operational_state='active';
 if setup_id is null then return jsonb_build_object('status','rejected','code','event_unavailable');end if;
 if exists(select 1 from app.event_play_starts where event_id=eid and tournament_id=tid) then return jsonb_build_object('status','rejected','code','event_already_started');end if;
 if exists(select 1 from app.multi_event_finance_sources_v1 s cross join lateral jsonb_array_elements(s.allocations) x where s.tournament_id=tid and s.source_kind='receipt' and x->>'eventId'=eid::text) then return jsonb_build_object('status','rejected','code','collection_already_started');end if;
 if exists(select 1 from app.multi_event_pool_receipts_v1 s cross join lateral jsonb_array_elements(s.components) x where s.tournament_id=tid and x->>'eventId'=eid::text) then return jsonb_build_object('status','rejected','code','collection_already_started');end if;
 if kind='q' then
  select q.pool_type_code,q.entry_fee_cents into selected,fee from app.tournament_setup_q_pool_versions q where q.id=defid and q.tournament_id=tid and q.setup_event_version_id=setup_id;
  if not found then return jsonb_build_object('status','rejected','code','pool_unavailable');end if;
  if exists(select 1 from app.q_pool_policies_v1 where tournament_id=tid and pool_version_id=defid) or exists(select 1 from app.q_operating_policies_v2 where tournament_id=tid and pool_version_id=defid) then return jsonb_build_object('status','rejected','code','legacy_policy_present');end if;
  if method='equal-paid-playoff-qualifiers-v2' and selected<>'Equal (Pays All Equally)' then return jsonb_build_object('status','rejected','code','setup_method_conflict');end if;
  if method='graduated-acc-weighted-largest-remainder-5usd-v2' and (ratio not in(4,6) or selected<>'Graduated (1-in-'||ratio::text||')') then return jsonb_build_object('status','rejected','code','setup_method_conflict');end if;
 else
  select s.payout_type,d.entry_fee_minor,d.pool_id into selected,fee,pool from app.event_side_pool_definition_versions d join app.tournament_setup_side_pool_materializations m on m.pool_id=d.pool_id and m.event_id=d.event_id and m.tournament_id=d.tournament_id join app.tournament_setup_side_pool_versions s on s.id=m.setup_side_pool_version_id and s.tournament_id=m.tournament_id
   where d.id=defid and d.event_id=eid and d.tournament_id=tid and d.active and s.setup_event_version_id=setup_id and d.id=(select d2.id from app.event_side_pool_definition_versions d2 where d2.pool_id=d.pool_id order by d2.version desc limit 1);
  if not found then return jsonb_build_object('status','rejected','code','pool_unavailable');end if;
  if exists(select 1 from app.event_side_pool_policy_versions where tournament_id=tid and pool_id=pool) or exists(select 1 from app.side_pool_graduated_policies_v2 where tournament_id=tid and pool_id=pool) then return jsonb_build_object('status','rejected','code','legacy_policy_present');end if;
  if method<>'graduated-acc-weighted-largest-remainder-5usd-v2' or selected is distinct from 'graduated-1-in-'||ratio::text then return jsonb_build_object('status','rejected','code','setup_method_conflict');end if;
 end if;
 if fee<500 or mod(fee,500)<>0 then return jsonb_build_object('status','rejected','code','unsupported_fee');end if;
 if exists(select 1 from app.multi_event_pool_disclosures_v1 where tournament_id=tid and event_id=eid and pool_kind=kind and pool_definition_id=defid) then return jsonb_build_object('status','rejected','code','policy_frozen');end if;
 res:=jsonb_build_object('status','synthetic_pool_policy_disclosed','policyId',pid,'eventId',eid,'kind',kind,'poolDefinitionId',defid,'moneyMoved',false,'humanConsentClaimed',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,tid,actor,'multi_event_pool_disclosure_v1',eid,h,op,'accepted',res,clock_timestamp());
 insert into app.multi_event_pool_disclosures_v1(id,tournament_id,event_id,setup_event_version_id,pool_kind,pool_definition_id,pool_id,method,ratio,fee_minor,disclosure_reference,actor_id,operation_receipt_id)values(pid,tid,eid,setup_id,kind,defid,pool,method,ratio,fee,req->>'disclosureReference',actor,receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,receipt,'multi_event_pool_disclosure',pid,'synthetic_pool_policy_disclosed',res);return res;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');end$$;
revoke all on function public.publish_multi_event_pool_disclosure_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.publish_multi_event_pool_disclosure_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;

create function public.record_multi_event_simulated_pool_election_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare mode app.multi_event_finance_modes_v1%rowtype;prior app.operation_receipts%rowtype;policy app.multi_event_pool_disclosures_v1%rowtype;participant app.event_participants%rowtype;
 h text;receipt uuid:=extensions.gen_random_uuid();recordid uuid:=extensions.gen_random_uuid();res jsonb;v integer;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' or actor is null or tid is null or eid is null or op is null then return null;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||op::text,0));
 perform 1 from app.tournaments where id=tid and status='open' for update;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director' for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('multi_event_simulated_election_v1',tid,eid,req)::text,'utf8'),'sha256'),'hex');
 select * into prior from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if prior.tournament_id=tid and prior.operation_type='multi_event_simulated_election_v1' and prior.request_hash=h then return prior.response_payload;end if;return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select * into mode from app.multi_event_finance_modes_v1 where tournament_id=tid;
 if mode.id is null or mode.evidence_kind<>'simulation' or public.get_multi_event_finance_workspace_v1(actor,tid)->>'status' is distinct from 'available' then return jsonb_build_object('status','rejected','code','finance_mode_unavailable');end if;
 if jsonb_typeof(req) is distinct from 'object' or (select count(*) from jsonb_object_keys(req))<>6 or not(req?&array['policyId','participantId','expectedVersion','elected','reason','reviewed']) or req->'reviewed' is distinct from 'true'::jsonb
  or jsonb_typeof(req->'policyId') is distinct from 'string' or req->>'policyId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or jsonb_typeof(req->'participantId') is distinct from 'string' or req->>'participantId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or jsonb_typeof(req->'expectedVersion') is distinct from 'number' or req->>'expectedVersion'!~'^(0|[1-9][0-9]{0,2})$' or (req->>'expectedVersion')::integer>255
  or jsonb_typeof(req->'elected') is distinct from 'boolean' or jsonb_typeof(req->'reason') is distinct from 'string'
  or length(req->>'reason') not between 21 and 500 or left(req->>'reason',20)<>'TEST ONLY SYNTHETIC:' or length(trim(substr(req->>'reason',21)))=0 or req->>'reason'<>trim(req->>'reason') or req->>'reason'~'[[:cntrl:]]' then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 select * into policy from app.multi_event_pool_disclosures_v1 where id=(req->>'policyId')::uuid and tournament_id=tid and event_id=eid;
 if not found then return jsonb_build_object('status','rejected','code','policy_unavailable');end if;
 if not exists(select 1 from app.events e join app.tournament_setup_activations a on a.event_id=e.id and a.tournament_id=e.tournament_id where e.id=eid and e.tournament_id=tid and e.operational_state='active' and a.setup_event_version_id=policy.setup_event_version_id) then return jsonb_build_object('status','rejected','code','source_changed');end if;
 if policy.pool_kind='side' and not exists(select 1 from app.event_side_pool_definition_versions d where d.id=policy.pool_definition_id and d.pool_id=policy.pool_id and d.tournament_id=tid and d.event_id=eid and d.active and d.id=(select latest.id from app.event_side_pool_definition_versions latest where latest.pool_id=d.pool_id order by latest.version desc limit 1)) then return jsonb_build_object('status','rejected','code','source_changed');end if;
 if exists(select 1 from app.event_play_starts where event_id=eid and tournament_id=tid) then return jsonb_build_object('status','rejected','code','event_already_started');end if;
 select * into participant from app.event_participants where id=(req->>'participantId')::uuid and event_id=eid and tournament_id=tid and roster_entry_id is not null and status in('registered','checked_in');
 if not found then return jsonb_build_object('status','rejected','code','participant_unavailable');end if;
 if exists(select 1 from app.multi_event_finance_sources_v1 s cross join lateral jsonb_array_elements(s.allocations) x where s.tournament_id=tid and s.source_kind='receipt' and s.roster_entry_id=participant.roster_entry_id and x->>'eventId'=eid::text) then return jsonb_build_object('status','rejected','code','collection_already_started');end if;
 if exists(select 1 from app.multi_event_pool_receipts_v1 s cross join lateral jsonb_array_elements(s.components) x where s.tournament_id=tid and s.roster_entry_id=participant.roster_entry_id and x->>'eventId'=eid::text) then return jsonb_build_object('status','rejected','code','collection_already_started');end if;
 select coalesce(max(version),0)into v from app.multi_event_pool_elections_v1 where policy_id=policy.id and participant_id=participant.id;
 if v<>(req->>'expectedVersion')::integer then return jsonb_build_object('status','rejected','code','stale_version');end if;
 res:=jsonb_build_object('status','synthetic_pool_election_recorded','electionId',recordid,'policyId',policy.id,'eventId',eid,'participantId',participant.id,'version',v+1,'elected',req->'elected','moneyMoved',false,'humanConsentClaimed',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,tid,actor,'multi_event_simulated_election_v1',eid,h,op,'accepted',res,clock_timestamp());
 insert into app.multi_event_pool_elections_v1(id,tournament_id,event_id,policy_id,participant_id,roster_entry_id,version,elected,reason,actor_id,operation_receipt_id)values(recordid,tid,eid,policy.id,participant.id,participant.roster_entry_id,v+1,(req->>'elected')::boolean,req->>'reason',actor,receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,receipt,'multi_event_pool_election',recordid,'synthetic_pool_election_recorded',res);return res;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');end$$;
revoke all on function public.record_multi_event_simulated_pool_election_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.record_multi_event_simulated_pool_election_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;

create function public.get_multi_event_synthetic_pool_workspace_v1(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare finance jsonb;policies jsonb;elections jsonb;
begin
 finance:=public.get_multi_event_finance_workspace_v1(actor,tid);if finance is null then return null;end if;
 if finance->>'status' is distinct from 'available' then return finance;end if;
 if finance->>'evidenceKind' is distinct from 'simulation' then return jsonb_build_object('status','blocked','code','synthetic_mode_required');end if;
 if not exists(select 1 from app.events where id=eid and tournament_id=tid and operational_state='active') then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('policyId',p.id,'eventId',p.event_id,'kind',p.pool_kind,'poolDefinitionId',p.pool_definition_id,'poolId',p.pool_id,'method',p.method,'ratio',p.ratio,'feeMinor',p.fee_minor,'disclosureReference',p.disclosure_reference,
  'current',exists(select 1 from app.tournament_setup_activations a where a.tournament_id=tid and a.event_id=eid and a.setup_event_version_id=p.setup_event_version_id) and (p.pool_kind='q' or exists(select 1 from app.event_side_pool_definition_versions d where d.id=p.pool_definition_id and d.pool_id=p.pool_id and d.event_id=eid and d.tournament_id=tid and d.active and d.id=(select x.id from app.event_side_pool_definition_versions x where x.pool_id=d.pool_id order by x.version desc limit 1)))) order by p.published_at,p.id),'[]') into policies
 from app.multi_event_pool_disclosures_v1 p where p.tournament_id=tid and p.event_id=eid;
 select coalesce(jsonb_agg(jsonb_build_object('electionId',x.id,'policyId',x.policy_id,'participantId',x.participant_id,'rosterEntryId',x.roster_entry_id,'version',x.version,'elected',x.elected,'reason',x.reason,'recordedAt',x.recorded_at) order by x.recorded_at,x.id),'[]') into elections
 from app.multi_event_pool_elections_v1 x where x.tournament_id=tid and x.event_id=eid and x.version=(select max(y.version) from app.multi_event_pool_elections_v1 y where y.policy_id=x.policy_id and y.participant_id=x.participant_id);
 return jsonb_build_object('status','available','tournamentId',tid,'eventId',eid,'policies',policies,'elections',elections,'humanConsentClaimed',false,'paymentsAvailable',false,'moneyMoved',false);
end$$;
revoke all on function public.get_multi_event_synthetic_pool_workspace_v1(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_multi_event_synthetic_pool_workspace_v1(uuid,uuid,uuid)to service_role;

-- A single immutable synthetic receipt owns every base and elected pool line.
-- This is a source record only; no authoritative payout or payment is made.
create table app.multi_event_pool_receipts_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.multi_event_finance_modes_v1(tournament_id),
 roster_entry_id uuid not null,amount_minor integer not null check(amount_minor between 1 and 100000000),currency_code text not null default 'USD' check(currency_code='USD'),
 components jsonb not null check(jsonb_typeof(components)='array'),bindings jsonb not null check(jsonb_typeof(bindings)='array'),
 reason text not null check(length(reason) between 21 and 500 and left(reason,20)='TEST ONLY SYNTHETIC:'),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 foreign key(roster_entry_id,tournament_id)references app.tournament_roster_entries(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id)
);
alter table app.multi_event_pool_receipts_v1 enable row level security;alter table app.multi_event_pool_receipts_v1 force row level security;
revoke all on app.multi_event_pool_receipts_v1 from public,anon,authenticated,service_role;
create trigger multi_event_pool_receipts_v1_immutable before update or delete on app.multi_event_pool_receipts_v1 for each row execute function app.reject_immutable_history();
create index multi_event_pool_receipts_v1_roster_idx on app.multi_event_pool_receipts_v1(tournament_id,roster_entry_id);
create index multi_event_pool_receipts_v1_actor_idx on app.multi_event_pool_receipts_v1(actor_id);
create index multi_event_pool_receipts_v1_receipt_idx on app.multi_event_pool_receipts_v1(operation_receipt_id,tournament_id);

-- V1 base-only writes cannot overlap a receipt already captured by this domain.
create function app.guard_multi_event_v1_overlap_v1()returns trigger language plpgsql security definer set search_path=''as $$
begin
 perform 1 from app.tournaments where id=new.tournament_id for update;
 if new.source_kind='receipt' and exists(select 1 from app.multi_event_pool_receipts_v1 p cross join lateral jsonb_array_elements(p.components) c cross join lateral jsonb_array_elements(new.allocations) n where p.tournament_id=new.tournament_id and p.roster_entry_id=new.roster_entry_id and c->>'eventId'=n->>'eventId') then raise exception'multi_event_source_overlap';end if;
 return new;
end$$;
revoke all on function app.guard_multi_event_v1_overlap_v1()from public,anon,authenticated,service_role;
create trigger multi_event_v1_source_overlap_v1 before insert on app.multi_event_finance_sources_v1 for each row execute function app.guard_multi_event_v1_overlap_v1();

create function public.record_multi_event_synthetic_pool_receipt_v1(actor uuid,tid uuid,req jsonb,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare prior app.operation_receipts%rowtype;h text;receipt uuid:=extensions.gen_random_uuid();sid uuid:=extensions.gen_random_uuid();res jsonb;finance jsonb;
 rid uuid;eventrow jsonb;part jsonb;pol app.multi_event_pool_disclosures_v1%rowtype;elect app.multi_event_pool_elections_v1%rowtype;
 eid uuid;participant uuid;setup_id uuid;aid uuid;fee integer;total numeric:=0;expected_q integer;expected_side integer;seen_q integer;seen_side integer;pool_workspace jsonb;bindings jsonb:='[]'::jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' or actor is null or tid is null or op is null then return null;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||op::text,0));
 perform 1 from app.tournaments where id=tid and status='open' for update;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director' for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('multi_event_synthetic_pool_receipt_v1',tid,req)::text,'utf8'),'sha256'),'hex');
 select * into prior from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if prior.tournament_id=tid and prior.operation_type='multi_event_synthetic_pool_receipt_v1' and prior.request_hash=h then return prior.response_payload;end if;return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 finance:=public.get_multi_event_finance_workspace_v1(actor,tid);
 if finance->>'status' is distinct from 'available' or finance->>'evidenceKind' is distinct from 'simulation' then return jsonb_build_object('status','rejected','code','finance_mode_unavailable');end if;
 if jsonb_typeof(req) is distinct from 'object' or (select count(*) from jsonb_object_keys(req))<>5 or not(req?&array['rosterEntryId','amountMinor','events','reason','reviewed']) or req->'reviewed' is distinct from 'true'::jsonb
  or jsonb_typeof(req->'rosterEntryId') is distinct from 'string' or req->>'rosterEntryId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or jsonb_typeof(req->'amountMinor') is distinct from 'number' or req->>'amountMinor'!~'^[1-9][0-9]{0,7}$'
  or jsonb_typeof(req->'events') is distinct from 'array' or jsonb_array_length(req->'events') not between 1 and 32
  or jsonb_typeof(req->'reason') is distinct from 'string' or length(req->>'reason') not between 21 and 500 or left(req->>'reason',20)<>'TEST ONLY SYNTHETIC:' or length(trim(substr(req->>'reason',21)))=0 or req->>'reason'<>trim(req->>'reason') or req->>'reason'~'[[:cntrl:]]' then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 rid:=(req->>'rosterEntryId')::uuid;if not exists(select 1 from app.tournament_roster_entries where id=rid and tournament_id=tid) then return jsonb_build_object('status','rejected','code','roster_unavailable');end if;
 if (select count(*)<>count(distinct value->>'eventId') from jsonb_array_elements(req->'events')) then return jsonb_build_object('status','rejected','code','duplicate_event');end if;
 for eventrow in select value from jsonb_array_elements(req->'events')loop
  if jsonb_typeof(eventrow) is distinct from 'object' or (select count(*) from jsonb_object_keys(eventrow))<>4 or not(eventrow?&array['eventId','baseMinor','q','side'])
   or jsonb_typeof(eventrow->'eventId') is distinct from 'string' or eventrow->>'eventId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(eventrow->'baseMinor') is distinct from 'number' or eventrow->>'baseMinor'!~'^[1-9][0-9]{0,7}$'
   or jsonb_typeof(eventrow->'q') is distinct from 'array' or jsonb_array_length(eventrow->'q')>2 or jsonb_typeof(eventrow->'side') is distinct from 'array' or jsonb_array_length(eventrow->'side')>6 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  eid:=(eventrow->>'eventId')::uuid;
  select a.id,v.id,v.entry_fee_cents into aid,setup_id,fee from app.events e join app.tournament_setup_activations a on a.tournament_id=e.tournament_id and a.event_id=e.id join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id and v.tournament_id=e.tournament_id where e.id=eid and e.tournament_id=tid and e.operational_state='active';
  if not found then return jsonb_build_object('status','rejected','code','event_unavailable');end if;
  if exists(select 1 from app.event_play_starts where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','event_already_started');end if;
  if fee<=0 or fee<>(eventrow->>'baseMinor')::integer then return jsonb_build_object('status','rejected','code','base_fee_mismatch');end if;
  if (select count(*) from app.event_participants where tournament_id=tid and event_id=eid and roster_entry_id=rid and status in('registered','checked_in'))<>1 then return jsonb_build_object('status','rejected','code','participant_unavailable');end if;
  select id into participant from app.event_participants where tournament_id=tid and event_id=eid and roster_entry_id=rid and status in('registered','checked_in');
  if exists(select 1 from app.multi_event_finance_sources_v1 s cross join lateral jsonb_array_elements(s.allocations) x where s.tournament_id=tid and s.source_kind='receipt' and s.roster_entry_id=rid and x->>'eventId'=eid::text) or exists(select 1 from app.multi_event_pool_receipts_v1 s cross join lateral jsonb_array_elements(s.components) x where s.tournament_id=tid and s.roster_entry_id=rid and x->>'eventId'=eid::text) then return jsonb_build_object('status','rejected','code','base_already_recorded');end if;
  pool_workspace:=public.get_multi_event_synthetic_pool_workspace_v1(actor,tid,eid);
  if pool_workspace->>'status' is distinct from 'available' or exists(select 1 from jsonb_array_elements(pool_workspace->'policies') x where x->>'current' is distinct from 'true') then return jsonb_build_object('status','rejected','code','policy_source_changed');end if;
  if (select count(*)from app.tournament_setup_q_pool_versions where setup_event_version_id=setup_id)<>(select count(*)from app.multi_event_pool_disclosures_v1 where tournament_id=tid and event_id=eid and pool_kind='q') or
   (select count(*)from app.tournament_setup_side_pool_versions where setup_event_version_id=setup_id)<>(select count(*)from app.multi_event_pool_disclosures_v1 where tournament_id=tid and event_id=eid and pool_kind='side') or
   (select count(*)from app.event_side_pools where tournament_id=tid and event_id=eid)<>(select count(*)from app.multi_event_pool_disclosures_v1 where tournament_id=tid and event_id=eid and pool_kind='side') then return jsonb_build_object('status','rejected','code','pool_disclosure_required');end if;
  expected_q:=0;expected_side:=0;seen_q:=jsonb_array_length(eventrow->'q');seen_side:=jsonb_array_length(eventrow->'side');total:=total+fee;
  for pol in select * from app.multi_event_pool_disclosures_v1 where tournament_id=tid and event_id=eid order by id loop
   select * into elect from app.multi_event_pool_elections_v1 where policy_id=pol.id and participant_id=participant order by version desc limit 1;
   if not found or elect.roster_entry_id<>rid then return jsonb_build_object('status','rejected','code','election_required');end if;
   if elect.elected then
    if pol.pool_kind='q' then expected_q:=expected_q+1;else expected_side:=expected_side+1;end if;
    select value into part from jsonb_array_elements(case when pol.pool_kind='q' then eventrow->'q' else eventrow->'side' end) where value->>'policyId'=pol.id::text;
    if part is null or jsonb_typeof(part) is distinct from 'object' or (select count(*) from jsonb_object_keys(part))<>3 or not(part?&array['policyId','electionId','amountMinor']) or part->>'electionId' is distinct from elect.id::text or jsonb_typeof(part->'amountMinor') is distinct from 'number' or part->>'amountMinor' is distinct from pol.fee_minor::text then return jsonb_build_object('status','rejected','code','pool_allocation_mismatch');end if;
    total:=total+pol.fee_minor;
   end if;
  end loop;
  if expected_q<>seen_q or expected_side<>seen_side or (select count(*)<>count(distinct value->>'policyId') from jsonb_array_elements(eventrow->'q')) or (select count(*)<>count(distinct value->>'policyId') from jsonb_array_elements(eventrow->'side')) then return jsonb_build_object('status','rejected','code','pool_allocation_mismatch');end if;
  bindings:=bindings||jsonb_build_array(jsonb_build_object('eventId',eid,'activationId',aid,'setupEventVersionId',setup_id,'participantId',participant));
 end loop;
 if total<>(req->>'amountMinor')::numeric then return jsonb_build_object('status','rejected','code','non_conserving_allocation');end if;
 res:=jsonb_build_object('status','synthetic_pool_receipt_recorded','receiptId',sid,'version',1,'moneyMoved',false,'humanConsentClaimed',false,'accountingAvailable',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,tid,actor,'multi_event_synthetic_pool_receipt_v1',tid,h,op,'accepted',res,clock_timestamp());
 insert into app.multi_event_pool_receipts_v1(id,tournament_id,roster_entry_id,amount_minor,components,bindings,reason,actor_id,operation_receipt_id)values(sid,tid,rid,(req->>'amountMinor')::integer,req->'events',bindings,req->>'reason',actor,receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,receipt,'multi_event_pool_receipt',sid,'synthetic_pool_receipt_recorded',res);return res;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');end$$;
revoke all on function public.record_multi_event_synthetic_pool_receipt_v1(uuid,uuid,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.record_multi_event_synthetic_pool_receipt_v1(uuid,uuid,jsonb,uuid)to service_role;

-- The earlier base-only event reader must never omit newly recorded pool
-- receipts and present its partial sum as the complete event source.
alter function public.get_multi_event_finance_event_workspace_v1(uuid,uuid,uuid) rename to get_multi_event_finance_event_workspace_before_pool_v1;
revoke all on function public.get_multi_event_finance_event_workspace_before_pool_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
create function public.get_multi_event_finance_event_workspace_v1(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare base jsonb;begin
 base:=public.get_multi_event_finance_event_workspace_before_pool_v1(actor,tid,eid);
 if base is null or base->>'status' is distinct from 'available' then return base;end if;
 if exists(select 1 from app.multi_event_pool_receipts_v1 r cross join lateral jsonb_array_elements(r.components) c where r.tournament_id=tid and c->>'eventId'=eid::text)then return jsonb_build_object('status','blocked','code','pooled_receipts_require_new_reader');end if;
 return base;
end$$;
revoke all on function public.get_multi_event_finance_event_workspace_v1(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_multi_event_finance_event_workspace_v1(uuid,uuid,uuid)to service_role;

-- Currentness checks cover the whole shared receipt, not only the queried event:
-- a stale second event must not leave its first event looking reconciled.
create function app.multi_event_pool_receipt_current_v1(actor uuid,tid uuid,receipt_id uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare r app.multi_event_pool_receipts_v1%rowtype;line jsonb;binding jsonb;part jsonb;pol app.multi_event_pool_disclosures_v1%rowtype;elect app.multi_event_pool_elections_v1%rowtype;
 eid uuid;participant uuid;setup_id uuid;fee integer;expected_q integer;expected_side integer;total numeric:=0;
begin
 select * into r from app.multi_event_pool_receipts_v1 where id=receipt_id and tournament_id=tid;if not found then return false;end if;
 for line in select value from jsonb_array_elements(r.components)loop
  eid:=(line->>'eventId')::uuid;select value into binding from jsonb_array_elements(r.bindings)where value->>'eventId'=eid::text;
  select a.setup_event_version_id,v.entry_fee_cents into setup_id,fee from app.events e join app.tournament_setup_activations a on a.event_id=e.id and a.tournament_id=e.tournament_id join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id and v.tournament_id=e.tournament_id where e.id=eid and e.tournament_id=tid and e.operational_state='active' and a.id::text=binding->>'activationId' and v.id::text=binding->>'setupEventVersionId';
  if not found or fee is distinct from (line->>'baseMinor')::integer then return false;end if;
  select p.id into participant from app.event_participants p where p.id::text=binding->>'participantId' and p.tournament_id=tid and p.event_id=eid and p.roster_entry_id=r.roster_entry_id and p.status in('registered','checked_in');
  if not found or (select count(*) from app.event_participants p where p.tournament_id=tid and p.event_id=eid and p.roster_entry_id=r.roster_entry_id and p.status in('registered','checked_in'))<>1 then return false;end if;
  if exists(select 1 from app.multi_event_finance_sources_v1 s cross join lateral jsonb_array_elements(s.allocations) x where s.tournament_id=tid and s.source_kind='receipt' and s.roster_entry_id=r.roster_entry_id and x->>'eventId'=eid::text) or exists(select 1 from app.multi_event_pool_receipts_v1 other cross join lateral jsonb_array_elements(other.components) x where other.tournament_id=tid and other.id<>r.id and other.roster_entry_id=r.roster_entry_id and x->>'eventId'=eid::text) then return false;end if;
  if exists(select 1 from app.multi_event_pool_disclosures_v1 p where p.tournament_id=tid and p.event_id=eid and (p.setup_event_version_id<>setup_id or (p.pool_kind='side' and not exists(select 1 from app.event_side_pool_definition_versions d where d.id=p.pool_definition_id and d.pool_id=p.pool_id and d.event_id=eid and d.tournament_id=tid and d.active and d.id=(select latest.id from app.event_side_pool_definition_versions latest where latest.pool_id=d.pool_id order by latest.version desc limit 1))))) then return false;end if;
  if (select count(*)from app.tournament_setup_q_pool_versions where setup_event_version_id=setup_id)<>(select count(*)from app.multi_event_pool_disclosures_v1 where tournament_id=tid and event_id=eid and pool_kind='q') or (select count(*)from app.tournament_setup_side_pool_versions where setup_event_version_id=setup_id)<>(select count(*)from app.multi_event_pool_disclosures_v1 where tournament_id=tid and event_id=eid and pool_kind='side') or (select count(*)from app.event_side_pools where tournament_id=tid and event_id=eid)<>(select count(*)from app.multi_event_pool_disclosures_v1 where tournament_id=tid and event_id=eid and pool_kind='side') then return false;end if;
  expected_q:=0;expected_side:=0;total:=total+fee;
  for pol in select * from app.multi_event_pool_disclosures_v1 where tournament_id=tid and event_id=eid order by id loop
   select * into elect from app.multi_event_pool_elections_v1 where policy_id=pol.id and participant_id=participant order by version desc limit 1;
   if not found or elect.roster_entry_id<>r.roster_entry_id then return false;end if;
   if elect.elected then
    if pol.pool_kind='q'then expected_q:=expected_q+1;else expected_side:=expected_side+1;end if;
    select value into part from jsonb_array_elements(case when pol.pool_kind='q' then line->'q' else line->'side' end)where value->>'policyId'=pol.id::text;
    if part is null or part->>'electionId' is distinct from elect.id::text or part->>'amountMinor' is distinct from pol.fee_minor::text then return false;end if;
    total:=total+pol.fee_minor;
   end if;
  end loop;
  if expected_q<>jsonb_array_length(line->'q') or expected_side<>jsonb_array_length(line->'side') then return false;end if;
 end loop;
 return total=r.amount_minor;
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$$;
revoke all on function app.multi_event_pool_receipt_current_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;

create function public.get_multi_event_synthetic_event_sources_v1(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare finance jsonb;r app.multi_event_pool_receipts_v1%rowtype;line jsonb;p jsonb;pool_workspace jsonb;setup_id uuid;base_total numeric:=0;q_total numeric:=0;side_total numeric:=0;expense_total numeric:=0;
 sources jsonb:='[]'::jsonb;expenses jsonb:='[]'::jsonb;blocks jsonb:='[]'::jsonb;manifest jsonb;participants jsonb;
begin
 finance:=public.get_multi_event_finance_workspace_v1(actor,tid);if finance is null then return null;end if;
 if finance->>'status' is distinct from 'available' then return finance;end if;
 if finance->>'evidenceKind' is distinct from 'simulation' then return jsonb_build_object('status','blocked','code','synthetic_mode_required');end if;
 if not exists(select 1 from app.events where id=eid and tournament_id=tid and operational_state='active') then return null;end if;
 select setup_event_version_id into setup_id from app.tournament_setup_activations where tournament_id=tid and event_id=eid;
 if not found then return jsonb_build_object('status','blocked','code','event_unavailable');end if;
 pool_workspace:=public.get_multi_event_synthetic_pool_workspace_v1(actor,tid,eid);if pool_workspace is null or pool_workspace->>'status' is distinct from 'available' then return jsonb_build_object('status','blocked','code','pool_workspace_unavailable');end if;
 if exists(select 1 from jsonb_array_elements(pool_workspace->'policies')x where x->>'current' is distinct from 'true') or (select count(*)from app.tournament_setup_q_pool_versions where setup_event_version_id=setup_id)<>(select count(*)from app.multi_event_pool_disclosures_v1 where tournament_id=tid and event_id=eid and pool_kind='q') or (select count(*)from app.tournament_setup_side_pool_versions where setup_event_version_id=setup_id)<>(select count(*)from app.multi_event_pool_disclosures_v1 where tournament_id=tid and event_id=eid and pool_kind='side') or (select count(*)from app.event_side_pools where tournament_id=tid and event_id=eid)<>(select count(*)from app.multi_event_pool_disclosures_v1 where tournament_id=tid and event_id=eid and pool_kind='side') then blocks:=blocks||'"pool_disclosure_required"'::jsonb;end if;
 for r in select * from app.multi_event_pool_receipts_v1 where tournament_id=tid and exists(select 1 from jsonb_array_elements(components) x where x->>'eventId'=eid::text) order by id loop
  if app.multi_event_pool_receipt_current_v1(actor,tid,r.id) is distinct from true then return jsonb_build_object('status','blocked','code','pooled_receipt_source_changed');end if;
  select value into line from jsonb_array_elements(r.components)where value->>'eventId'=eid::text;
  base_total:=base_total+(line->>'baseMinor')::numeric;
  for p in select value from jsonb_array_elements(line->'q')loop q_total:=q_total+(p->>'amountMinor')::numeric;end loop;
  for p in select value from jsonb_array_elements(line->'side')loop side_total:=side_total+(p->>'amountMinor')::numeric;end loop;
  sources:=sources||jsonb_build_array(jsonb_build_object('receiptId',r.id,'rosterEntryId',r.roster_entry_id,'eventComponents',line,'bindings',r.bindings,'reason',r.reason,'recordedAt',r.recorded_at));
 end loop;
 for line in select jsonb_build_object('id',s.id,'kind',s.source_kind,'rosterEntryId',s.roster_entry_id,'amountMinor',(x->>'amountMinor')::integer,'reason',s.reason,'recordedAt',s.recorded_at,'binding',s.source_bindings) from app.multi_event_finance_sources_v1 s cross join lateral jsonb_array_elements(s.allocations) x where s.tournament_id=tid and x->>'eventId'=eid::text order by s.id loop
  if line->>'kind'='receipt' then base_total:=base_total+(line->>'amountMinor')::numeric;sources:=sources||jsonb_build_array(line);
  else expense_total:=expense_total+(line->>'amountMinor')::numeric;expenses:=expenses||jsonb_build_array(line);end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('participantId',p.id,'rosterEntryId',p.roster_entry_id,'status',p.status)order by p.id),'[]') into participants from app.event_participants p where p.tournament_id=tid and p.event_id=eid;
 if jsonb_array_length(participants)=0 then blocks:=blocks||'"participant_required"'::jsonb;end if;
 if exists(select 1 from app.event_participants p where p.tournament_id=tid and p.event_id=eid and (p.roster_entry_id is null or p.status not in('registered','checked_in'))) then blocks:=blocks||'"participant_status_unresolved"'::jsonb;end if;
 if exists(select 1 from app.event_participants p where p.tournament_id=tid and p.event_id=eid and p.status in('registered','checked_in') and p.roster_entry_id is not null and not exists(select 1 from jsonb_array_elements(sources)x where x->>'rosterEntryId'=p.roster_entry_id::text)) then blocks:=blocks||'"participant_receipts_incomplete"'::jsonb;end if;
 if greatest(base_total,q_total,side_total,expense_total)>9007199254740991 then return jsonb_build_object('status','blocked','code','amount_out_of_range');end if;
 if jsonb_array_length(sources)=0 then blocks:=blocks||'"receipt_required"'::jsonb;end if;
 if jsonb_array_length(expenses)>0 then blocks:=blocks||'"expense_classification_required"'::jsonb;end if;
 manifest:=jsonb_build_object('version','multi-event-synthetic-event-sources-v1','tournamentId',tid,'eventId',eid,'participants',participants,'sources',sources,'expenses',expenses,'poolWorkspace',pool_workspace);
 return jsonb_build_object('status',case when jsonb_array_length(blocks)>0 then 'blocked' else 'available' end,'tournamentId',tid,'eventId',eid,'currencyCode','USD','baseIncomeMinor',base_total::bigint,'qIncomeMinor',q_total::bigint,'sideIncomeMinor',side_total::bigint,'expenseMinor',expense_total::bigint,'expenseEvidence',expenses,'sources',sources,'participants',participants,'poolWorkspace',pool_workspace,'sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),'blockers',blocks,'accountingAvailable',false,'moneyMoved',false,'humanConsentClaimed',false);
end$$;
revoke all on function public.get_multi_event_synthetic_event_sources_v1(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_multi_event_synthetic_event_sources_v1(uuid,uuid,uuid)to service_role;
commit;
