-- LOCAL WORK IN PROGRESS: internal arithmetic only, not an allocation authority.
-- Caller must independently resolve every live ledger source, verify ownership,
-- event/participant/pool eligibility and prevent overlap between physical receipts
-- and side election evidence before this predicate may be used by a writer.
-- It is deliberately private and does not modify or reclassify historical rows.
begin;
create function app.multi_event_allocation_arithmetic_v1(sources jsonb, allocations jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare s jsonb; a jsonb; source_kind text;
begin
  if jsonb_typeof(sources) is distinct from 'array' or jsonb_typeof(allocations) is distinct from 'array'
    or jsonb_array_length(sources) > 50000 or jsonb_array_length(allocations) > 250000 then return false; end if;
  for s in select value from jsonb_array_elements(sources) loop
    if jsonb_typeof(s) is distinct from 'object' or (select count(*) from jsonb_object_keys(s)) <> 3
      or not (s ?& array['kind','id','amountMinor']) or jsonb_typeof(s->'kind') is distinct from 'string'
      or s->>'kind' not in ('roster_receipt','side_election','expense')
      or jsonb_typeof(s->'id') is distinct from 'string'
      or s->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(s->'amountMinor') is distinct from 'number'
      or s->>'amountMinor' !~ '^[1-9][0-9]{0,8}$' then return false; end if;
  end loop;
  if (select count(*) <> count(distinct (value->>'kind', value->>'id')) from jsonb_array_elements(sources)) then return false; end if;
  for a in select value from jsonb_array_elements(allocations) loop
    if jsonb_typeof(a) is distinct from 'object' or (select count(*) from jsonb_object_keys(a)) <> 6
      or not (a ?& array['sourceKind','sourceId','eventId','component','componentId','amountMinor'])
      or jsonb_typeof(a->'sourceKind') is distinct from 'string'
      or jsonb_typeof(a->'component') is distinct from 'string'
      or a->>'sourceKind' not in ('roster_receipt','side_election','expense')
      or jsonb_typeof(a->'sourceId') is distinct from 'string'
      or a->>'sourceId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(a->'eventId') is distinct from 'string'
      or a->>'eventId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(a->'amountMinor') is distinct from 'number'
      or a->>'amountMinor' !~ '^[1-9][0-9]{0,8}$' then return false; end if;
    source_kind := a->>'sourceKind';
    if source_kind = 'roster_receipt' and a->>'component' not in ('base','q')
      or source_kind = 'side_election' and a->>'component' is distinct from 'side'
      or source_kind = 'expense' and a->>'component' is distinct from 'expense' then return false; end if;
    if a->>'component' in ('base','expense') and a->'componentId' is distinct from 'null'::jsonb then return false; end if;
    if a->>'component' in ('q','side') and (jsonb_typeof(a->'componentId') is distinct from 'string'
      or a->>'componentId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then return false; end if;
  end loop;
  if (select count(*) <> count(distinct (value->>'sourceKind',value->>'sourceId',value->>'eventId',value->>'component',coalesce(value->>'componentId','')))
      from jsonb_array_elements(allocations)) then return false; end if;
  if exists(with src as materialized (select value->>'kind' kind,value->>'id' id,(value->>'amountMinor')::numeric amount from jsonb_array_elements(sources)),
    sums as materialized (select value->>'sourceKind' kind,value->>'sourceId' id,sum((value->>'amountMinor')::numeric) amount from jsonb_array_elements(allocations) group by value->>'sourceKind',value->>'sourceId')
    select 1 from src full join sums using(kind,id) where src.id is null or sums.id is null or src.amount is distinct from sums.amount) then return false; end if;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;
revoke all on function app.multi_event_allocation_arithmetic_v1(jsonb,jsonb) from public,anon,authenticated,service_role;

-- A separate opt-in source domain. This does not feed the existing V8/V9
-- accounting writers and does not create, amend or reinterpret legacy receipts.
create table app.multi_event_finance_modes_v1 (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null unique references app.tournaments(id),
  evidence_kind text not null check(evidence_kind='simulation'),
  actor_id uuid not null references app.profiles(id),
  operation_receipt_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id)
);
create table app.multi_event_finance_sources_v1 (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id),
  source_kind text not null check(source_kind in ('receipt','expense')),
  version integer not null default 1 check(version=1),
  evidence_kind text not null check(evidence_kind='simulation'),
  roster_entry_id uuid,
  amount_minor integer not null check(amount_minor between 1 and 100000000),
  currency_code text not null default 'USD' check(currency_code='USD'),
  allocations jsonb not null check(jsonb_typeof(allocations)='array'),
  source_bindings jsonb not null check(jsonb_typeof(source_bindings)='array'),
  reason text not null check(length(reason) between 1 and 500),
  actor_id uuid not null references app.profiles(id),
  operation_receipt_id uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  foreign key(roster_entry_id,tournament_id) references app.tournament_roster_entries(id,tournament_id),
  foreign key(tournament_id) references app.multi_event_finance_modes_v1(tournament_id),
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id),
  check ((source_kind='receipt' and roster_entry_id is not null) or (source_kind='expense' and roster_entry_id is null))
);
do $$ declare n text; begin
 foreach n in array array['multi_event_finance_modes_v1','multi_event_finance_sources_v1'] loop
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 end loop;
end $$;
create index multi_event_finance_sources_tournament_v1_idx on app.multi_event_finance_sources_v1(tournament_id,recorded_at,id);
create index multi_event_finance_sources_actor_v1_idx on app.multi_event_finance_sources_v1(actor_id);
create index multi_event_finance_sources_receipt_v1_idx on app.multi_event_finance_sources_v1(operation_receipt_id,tournament_id);

-- A later legacy write invalidates this separate domain. Never add the two
-- ledgers or infer whether two unlinked source records represent one payment.
create function app.multi_event_legacy_finance_absent_v1(tid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from app.roster_payment_events where tournament_id=tid)
 and not exists(select 1 from app.tournament_expense_events where tournament_id=tid)
 and not exists(select 1 from app.q_pool_allocation_versions_v1 where tournament_id=tid)
 and not exists(select 1 from app.event_side_pool_election_versions where tournament_id=tid)
 and not exists(select 1 from app.event_side_pool_team_election_versions where tournament_id=tid)
 and not exists(select 1 from app.q_pool_membership_versions_v1 where tournament_id=tid)
 and not exists(select 1 from app.q_pool_policies_v1 where tournament_id=tid)
 and not exists(select 1 from app.q_operating_policies_v2 where tournament_id=tid)
 and not exists(select 1 from app.event_side_pool_policy_versions where tournament_id=tid)
 and not exists(select 1 from app.side_pool_graduated_policies_v2 where tournament_id=tid)
 and not exists(select 1 from app.side_pool_recipient_policies_v3 where tournament_id=tid)
 and not exists(select 1 from app.event_side_pool_payout_versions where tournament_id=tid)
 and not exists(select 1 from app.event_side_pool_team_payout_versions where tournament_id=tid)
 and not exists(select 1 from app.event_side_pool_reconciliations where tournament_id=tid)
 and not exists(select 1 from app.event_side_pool_payout_reviews where tournament_id=tid)
 and not exists(select 1 from app.event_side_pool_payout_review_versions where tournament_id=tid)
 and not exists(select 1 from app.side_pool_amount_reviews_v2 where tournament_id=tid)
 and not exists(select 1 from app.side_pool_recipient_reviews_v3 where tournament_id=tid)
 and not exists(select 1 from app.q_obligation_reviews_v1 where tournament_id=tid)
 and not exists(select 1 from app.q_obligation_reviews_v2 where tournament_id=tid)
 and not exists(select 1 from app.prize_accounting_drafts_v8 where tournament_id=tid)
 and not exists(select 1 from app.prize_accounting_finals_v8 where tournament_id=tid)
 and not exists(select 1 from app.prize_accounting_drafts_v9 where tournament_id=tid)
 and not exists(select 1 from app.prize_accounting_finals_v9 where tournament_id=tid)
 and not exists(select 1 from app.standard_singles_settlement_drafts where tournament_id=tid)
 and not exists(select 1 from app.standard_singles_settlement_final_versions where tournament_id=tid)
 and not exists(select 1 from app.event_settlement_drafts_v5 where tournament_id=tid)
 and not exists(select 1 from app.event_settlement_finals_v2 where tournament_id=tid)
 and not exists(select 1 from app.q_accounting_drafts_v6 where tournament_id=tid)
 and not exists(select 1 from app.q_accounting_finals_v6 where tournament_id=tid)
 and not exists(select 1 from app.no_q_accounting_drafts_v7 where tournament_id=tid)
 and not exists(select 1 from app.no_q_accounting_finals_v7 where tournament_id=tid);
$$;
revoke all on function app.multi_event_legacy_finance_absent_v1(uuid) from public,anon,authenticated,service_role;

-- Existing writers lock the tournament before inserting; repeat that lock here
-- so activation and legacy inserts cannot both pass their respective checks.
-- No legacy records are rewritten and no session-variable bypass is provided.
create function app.guard_legacy_finance_when_multi_event_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from app.tournaments where id=new.tournament_id for update;
 if exists(select 1 from app.multi_event_finance_modes_v1 where tournament_id=new.tournament_id) then raise exception 'multi_event_finance_mode_active';end if;
 return new;
end $$;
revoke all on function app.guard_legacy_finance_when_multi_event_v1() from public,anon,authenticated,service_role;
do $$ declare n text; begin
 foreach n in array array['roster_payment_events','tournament_expense_events','q_pool_allocation_versions_v1',
  'event_side_pool_election_versions','event_side_pool_team_election_versions','event_side_pool_payout_versions','event_side_pool_team_payout_versions','event_side_pool_reconciliations','event_side_pool_payout_reviews','event_side_pool_payout_review_versions','side_pool_amount_reviews_v2','side_pool_recipient_reviews_v3','q_obligation_reviews_v1','q_obligation_reviews_v2',
  'q_operating_policies_v2','q_pool_policies_v1','q_pool_membership_versions_v1','event_side_pool_policy_versions','side_pool_graduated_policies_v2','side_pool_recipient_policies_v3',
  'prize_accounting_drafts_v8','prize_accounting_finals_v8','prize_accounting_drafts_v9','prize_accounting_finals_v9',
  'standard_singles_settlement_drafts','standard_singles_settlement_final_versions','event_settlement_drafts_v5','event_settlement_finals_v2',
  'q_accounting_drafts_v6','q_accounting_finals_v6','no_q_accounting_drafts_v7','no_q_accounting_finals_v7'] loop
  execute format('create trigger %I before insert on app.%I for each row execute function app.guard_legacy_finance_when_multi_event_v1()',n||'_multi_event_guard_v1',n);
 end loop;
end $$;

create function public.activate_multi_event_finance_v1(actor uuid,tid uuid,evidence text,op uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior app.operation_receipts%rowtype; h text; receipt uuid:=extensions.gen_random_uuid(); mid uuid:=extensions.gen_random_uuid(); result jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'
   or actor is null or tid is null or op is null or evidence is null or evidence not in('observed','simulation') then return null; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||op::text,0));
 perform 1 from app.tournaments where id=tid and status='open' for update;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable'); end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director' for update;
 if not found then return jsonb_build_object('status','rejected','code','not_director'); end if;
 if evidence<>'simulation' then return jsonb_build_object('status','rejected','code','unsupported_evidence_kind'); end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('multi_event_finance_activate_v1',tid,evidence)::text,'utf8'),'sha256'),'hex');
 select * into prior from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if prior.tournament_id=tid and prior.operation_type='multi_event_finance_activate_v1' and prior.request_hash=h then return prior.response_payload; end if; return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
 if exists(select 1 from app.multi_event_finance_modes_v1 where tournament_id=tid) then return jsonb_build_object('status','rejected','code','mode_already_active'); end if;
 if not app.multi_event_legacy_finance_absent_v1(tid) then return jsonb_build_object('status','rejected','code','legacy_finance_present'); end if;
 if not exists(select 1 from app.events where tournament_id=tid and operational_state='active') then return jsonb_build_object('status','rejected','code','active_event_required'); end if;
 if exists(select 1 from app.event_play_starts s join app.events e on e.id=s.event_id and e.tournament_id=s.tournament_id where s.tournament_id=tid and e.operational_state='active') then return jsonb_build_object('status','rejected','code','event_already_started'); end if;
 if evidence='simulation' and exists(select 1 from app.events e where e.tournament_id=tid and e.operational_state='active' and not exists(select 1 from app.synthetic_paper_fixtures_v1 f join app.synthetic_paper_deployments_v1 d on d.project_ref=f.project_ref where f.tournament_id=tid and f.event_id=e.id and f.project_ref='nnhcnvksxgxnpvdqjgpg')) then return jsonb_build_object('status','rejected','code','synthetic_fixture_required'); end if;
 result:=jsonb_build_object('status','multi_event_finance_activated','modeId',mid,'evidenceKind',evidence,'moneyMoved',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(receipt,tid,actor,'multi_event_finance_activate_v1',tid,h,op,'accepted',result,clock_timestamp());
 insert into app.multi_event_finance_modes_v1(id,tournament_id,evidence_kind,actor_id,operation_receipt_id) values(mid,tid,evidence,actor,receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(tid,actor,receipt,'multi_event_finance_mode',mid,'multi_event_finance_activated',result);
 return result;
end $$;
revoke all on function public.activate_multi_event_finance_v1(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.activate_multi_event_finance_v1(uuid,uuid,text,uuid) to service_role;

-- Narrow groundwork: base-entry receipts and explicit event expense splits.
-- Q and Side components fail closed until dedicated election/consent and
-- single-source receipt contracts are implemented. No payout is calculated.
create function public.record_multi_event_finance_source_v1(actor uuid,tid uuid,request jsonb,op uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mode app.multi_event_finance_modes_v1%rowtype; prior app.operation_receipts%rowtype; h text; receipt uuid:=extensions.gen_random_uuid(); sid uuid:=extensions.gen_random_uuid(); result jsonb; workspace jsonb;
 line jsonb; total numeric:=0; eid uuid; rid uuid; fee integer; aid uuid; setup_id uuid; participant_id uuid; bindings jsonb:='[]'::jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' or actor is null or tid is null or op is null then return null; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||op::text,0));
 perform 1 from app.tournaments where id=tid and status='open' for update;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable'); end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director' for update;
 if not found then return jsonb_build_object('status','rejected','code','not_director'); end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('multi_event_finance_source_v1',tid,request)::text,'utf8'),'sha256'),'hex');
 select * into prior from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if prior.tournament_id=tid and prior.operation_type='multi_event_finance_source_v1' and prior.request_hash=h then return prior.response_payload; end if; return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
 select * into mode from app.multi_event_finance_modes_v1 where tournament_id=tid;
 if mode.id is null or not app.multi_event_legacy_finance_absent_v1(tid) then return jsonb_build_object('status','rejected','code','finance_mode_unavailable'); end if;
 workspace:=public.get_multi_event_finance_workspace_v1(actor,tid);
 if workspace->>'status' is distinct from 'available' then return jsonb_build_object('status','rejected','code','source_changed'); end if;
 if jsonb_typeof(request) is distinct from 'object' or (select count(*) from jsonb_object_keys(request))<>6
  or not(request ?& array['kind','rosterEntryId','amountMinor','allocations','reason','reviewed']) or request->'reviewed' is distinct from 'true'::jsonb
  or jsonb_typeof(request->'kind') is distinct from 'string' or request->>'kind' not in ('receipt','expense')
  or jsonb_typeof(request->'amountMinor') is distinct from 'number' or request->>'amountMinor' !~ '^[1-9][0-9]{0,7}$'
  or jsonb_typeof(request->'allocations') is distinct from 'array' or jsonb_array_length(request->'allocations') not between 1 and 32
  or jsonb_typeof(request->'reason') is distinct from 'string' or length(trim(request->>'reason')) not between 1 and 500
  or request->>'reason'<>trim(request->>'reason') or request->>'reason'~'[[:cntrl:]]' then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
 if mode.evidence_kind='simulation' and position('TEST ONLY SYNTHETIC:' in request->>'reason')<>1 then return jsonb_build_object('status','rejected','code','synthetic_label_required'); end if;
 if request->>'kind'='expense' and request->'rosterEntryId' is distinct from 'null'::jsonb then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
 if request->>'kind'='receipt' then
  if jsonb_typeof(request->'rosterEntryId') is distinct from 'string' or request->>'rosterEntryId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  rid:=(request->>'rosterEntryId')::uuid;
  if not exists(select 1 from app.tournament_roster_entries where id=rid and tournament_id=tid) then return jsonb_build_object('status','rejected','code','roster_unavailable'); end if;
 end if;
 if (select count(*)<>count(distinct value->>'eventId') from jsonb_array_elements(request->'allocations')) then return jsonb_build_object('status','rejected','code','duplicate_event'); end if;
 for line in select value from jsonb_array_elements(request->'allocations') loop
  if jsonb_typeof(line) is distinct from 'object' or (select count(*) from jsonb_object_keys(line))<>2 or not(line ?& array['eventId','amountMinor'])
   or jsonb_typeof(line->'eventId') is distinct from 'string' or line->>'eventId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(line->'amountMinor') is distinct from 'number' or line->>'amountMinor' !~ '^[1-9][0-9]{0,7}$' then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  eid:=(line->>'eventId')::uuid; total:=total+(line->>'amountMinor')::numeric;
  select v.entry_fee_cents,a.id,v.id into fee,aid,setup_id from app.events e join app.tournament_setup_activations a on a.tournament_id=e.tournament_id and a.event_id=e.id join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id and v.tournament_id=e.tournament_id
   where e.id=eid and e.tournament_id=tid and e.operational_state='active';
  if not found then return jsonb_build_object('status','rejected','code','event_unavailable'); end if;
  if mode.evidence_kind='simulation' and not exists(select 1 from app.synthetic_paper_fixtures_v1 f join app.synthetic_paper_deployments_v1 d on d.project_ref=f.project_ref where f.tournament_id=tid and f.event_id=eid and f.project_ref='nnhcnvksxgxnpvdqjgpg') then return jsonb_build_object('status','rejected','code','synthetic_fixture_required'); end if;
  if request->>'kind'='receipt' then
   if (select count(*) from app.event_participants p where p.tournament_id=tid and p.event_id=eid and p.roster_entry_id=rid and p.status in('registered','checked_in'))<>1 then return jsonb_build_object('status','rejected','code','participant_unavailable'); end if;
   select p.id into participant_id from app.event_participants p where p.tournament_id=tid and p.event_id=eid and p.roster_entry_id=rid and p.status in('registered','checked_in');
   if not found then return jsonb_build_object('status','rejected','code','participant_unavailable'); end if;
   if fee is null or fee<=0 or fee<>(line->>'amountMinor')::integer then return jsonb_build_object('status','rejected','code','base_fee_mismatch'); end if;
   if exists(select 1 from app.event_play_starts where event_id=eid and tournament_id=tid) then return jsonb_build_object('status','rejected','code','event_already_started'); end if;
   if exists(select 1 from app.tournament_setup_q_pool_versions where setup_event_version_id=setup_id) or exists(select 1 from app.tournament_setup_side_pool_versions where setup_event_version_id=setup_id) or exists(select 1 from app.event_side_pools where tournament_id=tid and event_id=eid) then return jsonb_build_object('status','rejected','code','pool_components_unsupported'); end if;
   if exists(select 1 from app.multi_event_finance_sources_v1 s cross join lateral jsonb_array_elements(s.allocations) x where s.tournament_id=tid and s.source_kind='receipt' and s.roster_entry_id=rid and x->>'eventId'=eid::text) then return jsonb_build_object('status','rejected','code','base_already_recorded'); end if;
  else participant_id:=null; end if;
  bindings:=bindings||jsonb_build_array(jsonb_build_object('eventId',eid,'activationId',aid,'setupEventVersionId',setup_id,'participantId',participant_id));
 end loop;
 if total<>(request->>'amountMinor')::numeric then return jsonb_build_object('status','rejected','code','non_conserving_allocation'); end if;
 result:=jsonb_build_object('status','multi_event_source_recorded','sourceId',sid,'version',1,'kind',request->>'kind','evidenceKind',mode.evidence_kind,'moneyMoved',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(receipt,tid,actor,'multi_event_finance_source_v1',tid,h,op,'accepted',result,clock_timestamp());
 insert into app.multi_event_finance_sources_v1(id,tournament_id,source_kind,evidence_kind,roster_entry_id,amount_minor,allocations,source_bindings,reason,actor_id,operation_receipt_id) values(sid,tid,request->>'kind',mode.evidence_kind,rid,(request->>'amountMinor')::integer,request->'allocations',bindings,request->>'reason',actor,receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(tid,actor,receipt,'multi_event_finance_source',sid,'multi_event_finance_source_recorded',result);
 return result;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');
 when raise_exception then if sqlerrm='multi_event_source_overlap' then return jsonb_build_object('status','rejected','code','base_already_recorded');end if;raise;
end $$;
revoke all on function public.record_multi_event_finance_source_v1(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.record_multi_event_finance_source_v1(uuid,uuid,jsonb,uuid) to service_role;

create function public.get_multi_event_finance_workspace_v1(actor uuid,tid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare mode app.multi_event_finance_modes_v1%rowtype; source app.multi_event_finance_sources_v1%rowtype; line jsonb; binding jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')) then return null; end if;
 select * into mode from app.multi_event_finance_modes_v1 where tournament_id=tid;
 if mode.id is null then return jsonb_build_object('status','not_enabled'); end if;
 if not app.multi_event_legacy_finance_absent_v1(tid) then return jsonb_build_object('status','blocked','code','legacy_finance_present'); end if;
 if mode.evidence_kind='simulation' and exists(select 1 from app.events e where e.tournament_id=tid and e.operational_state='active' and not exists(select 1 from app.synthetic_paper_fixtures_v1 f join app.synthetic_paper_deployments_v1 d on d.project_ref=f.project_ref where f.tournament_id=tid and f.event_id=e.id and f.project_ref='nnhcnvksxgxnpvdqjgpg')) then return jsonb_build_object('status','blocked','code','synthetic_fixture_required'); end if;
 for source in select * from app.multi_event_finance_sources_v1 where tournament_id=tid loop
  for line in select value from jsonb_array_elements(source.allocations) loop
   select value into binding from jsonb_array_elements(source.source_bindings) where value->>'eventId'=line->>'eventId';
   if not exists(select 1 from app.events e join app.tournament_setup_activations a on a.event_id=e.id and a.tournament_id=e.tournament_id join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id and v.tournament_id=e.tournament_id
    where e.tournament_id=tid and e.id::text=line->>'eventId' and e.operational_state='active'
     and a.id::text=binding->>'activationId' and v.id::text=binding->>'setupEventVersionId'
     and (source.source_kind='expense' or (v.entry_fee_cents=(line->>'amountMinor')::integer and not exists(select 1 from app.tournament_setup_q_pool_versions q where q.setup_event_version_id=v.id) and not exists(select 1 from app.tournament_setup_side_pool_versions sp where sp.setup_event_version_id=v.id) and not exists(select 1 from app.event_side_pools pool where pool.tournament_id=tid and pool.event_id=e.id) and exists(select 1 from app.event_participants p where p.id::text=binding->>'participantId' and p.tournament_id=tid and p.event_id=e.id and p.roster_entry_id=source.roster_entry_id and p.status in('registered','checked_in'))))
     and (mode.evidence_kind<>'simulation' or exists(select 1 from app.synthetic_paper_fixtures_v1 f join app.synthetic_paper_deployments_v1 d on d.project_ref=f.project_ref where f.tournament_id=tid and f.event_id=e.id and f.project_ref='nnhcnvksxgxnpvdqjgpg'))) then
    return jsonb_build_object('status','blocked','code','source_changed');
   end if;
  end loop;
 end loop;
 return jsonb_build_object('status','available','modeId',mode.id,'evidenceKind',mode.evidence_kind,'sources',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'version',s.version,'kind',s.source_kind,'evidenceKind',s.evidence_kind,'rosterEntryId',s.roster_entry_id,'amountMinor',s.amount_minor,'allocations',s.allocations,'reason',s.reason,'recordedAt',s.recorded_at) order by s.recorded_at,s.id) from app.multi_event_finance_sources_v1 s where s.tournament_id=tid),'[]'::jsonb),'accountingAvailable',false,'moneyMoved',false);
end $$;
revoke all on function public.get_multi_event_finance_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_multi_event_finance_workspace_v1(uuid,uuid) to service_role;

-- Scoped inspection only: these amounts are not classified expenses, a prize
-- budget, a payout, or a reconciled accounting result.
create function public.get_multi_event_finance_event_workspace_v1(actor uuid,tid uuid,eid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare all_sources jsonb; items jsonb; base_total numeric; expense_total numeric;
begin
 all_sources:=public.get_multi_event_finance_workspace_v1(actor,tid);
 if all_sources is null then return null; end if;
 if all_sources->>'status' is distinct from 'available' then return all_sources; end if;
 if not exists(select 1 from app.events where id=eid and tournament_id=tid and operational_state='active') then return null; end if;
 select coalesce(jsonb_agg(jsonb_build_object('sourceId',s.id,'version',s.version,'kind',s.source_kind,'evidenceKind',s.evidence_kind,'amountMinor',(line->>'amountMinor')::integer,'reason',s.reason,'recordedAt',s.recorded_at) order by s.recorded_at,s.id),'[]'::jsonb),
  coalesce(sum((line->>'amountMinor')::numeric) filter(where s.source_kind='receipt'),0),
  coalesce(sum((line->>'amountMinor')::numeric) filter(where s.source_kind='expense'),0)
 into items,base_total,expense_total
 from app.multi_event_finance_sources_v1 s cross join lateral jsonb_array_elements(s.allocations) line
 where s.tournament_id=tid and line->>'eventId'=eid::text;
 if base_total>9007199254740991 or expense_total>9007199254740991 then return jsonb_build_object('status','blocked','code','amount_out_of_range'); end if;
 return jsonb_build_object('status','available','tournamentId',tid,'eventId',eid,'evidenceKind',all_sources->>'evidenceKind','currencyCode','USD','baseReceiptMinor',base_total::bigint,'allocatedExpenseMinor',expense_total::bigint,'sources',items,'accountingAvailable',false,'moneyMoved',false);
end $$;
revoke all on function public.get_multi_event_finance_event_workspace_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_multi_event_finance_event_workspace_v1(uuid,uuid,uuid) to service_role;
commit;
