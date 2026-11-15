-- UNEXECUTED PRIVATE PROPOSAL. Requires native-event-ledger-source-reader-v1.sql
-- and existing custom-payout-q-setup-save-v2 / event-settings-transaction-v3
-- exact JavaScript trim and UTF-16 length helpers.
-- No grants or public wrappers. Records reviewed allocation of existing native
-- evidence, not cash receipt, payout authorization or disbursement. Table locks
-- deliberately trade concurrency for a complete commit-current source snapshot.
begin;
create table app.native_ledger_allocation_operations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id),request_payload jsonb not null,
 request_hash text not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('native-ledger-allocation-v1',actor_id,tournament_id,operation_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.native_ledger_allocation_outcomes_v1(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,
 result jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),foreign key(actor_id,operation_id,tournament_id)
 references app.native_ledger_allocation_operations_v1(actor_id,operation_id,tournament_id)
);
alter table app.native_ledger_allocation_operations_v1 enable row level security;
alter table app.native_ledger_allocation_outcomes_v1 enable row level security;
revoke all on table app.native_ledger_allocation_operations_v1,app.native_ledger_allocation_outcomes_v1 from public,anon,authenticated,service_role;
create table app.native_ledger_allocation_revisions_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id),
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 version integer not null check(version>0),prior_revision_id uuid,
 request_payload jsonb not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 snapshot jsonb not null,reason text not null,created_at timestamptz not null default clock_timestamp(),
 unique(actor_id,operation_id),unique(tournament_id,version),unique(id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id)references app.native_ledger_allocation_operations_v1(actor_id,operation_id,tournament_id),
 foreign key(prior_revision_id,tournament_id)references app.native_ledger_allocation_revisions_v1(id,tournament_id),
 check(reason=app.custom_payout_classification_text_v2(reason)and app.event_settings_js_text_length_v3(reason)between 1 and 500),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('native-ledger-allocation-v1',actor_id,tournament_id,operation_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
alter table app.native_ledger_allocation_revisions_v1 enable row level security;
revoke all on table app.native_ledger_allocation_revisions_v1 from public,anon,authenticated,service_role;
create function app.native_ledger_allocation_immutable_v1()returns trigger
language plpgsql set search_path=''as $$begin raise exception 'native_ledger_allocation_history_is_immutable';end$$;
create trigger native_ledger_allocation_immutable_v1 before update or delete on app.native_ledger_allocation_revisions_v1
for each row execute function app.native_ledger_allocation_immutable_v1();
create trigger native_ledger_operations_immutable_v1 before update or delete on app.native_ledger_allocation_operations_v1
for each row execute function app.native_ledger_allocation_immutable_v1();
create trigger native_ledger_outcomes_immutable_v1 before update or delete on app.native_ledger_allocation_outcomes_v1
for each row execute function app.native_ledger_allocation_immutable_v1();
create function app.finish_native_ledger_operation_v1(tid uuid,op uuid,result_value jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();r app.native_ledger_allocation_operations_v1%rowtype;outcome jsonb;
begin
 select*into strict r from app.native_ledger_allocation_operations_v1 where actor_id=a and operation_id=op and tournament_id=tid;
 if result_value->>'status'not in('accepted','rejected')then raise exception 'invalid_native_ledger_terminal_outcome';end if;
 outcome:=result_value||jsonb_build_object('actorId',a,'operationId',op,'tournamentId',tid,'request',r.request_payload,'moneyMoved',false,'payoutAuthorized',false);
 insert into app.native_ledger_allocation_outcomes_v1(actor_id,operation_id,tournament_id,result)values(a,op,tid,outcome);
 return outcome;
end$$;


-- All tables used by the native reader are frozen against INSERT/UPDATE/DELETE
-- for this short transaction, including writers which do not lock tournaments.
-- No fallback to weaker row locks or a client-provided source is permitted.
create function app.lock_native_ledger_sources_v1()returns void
language plpgsql security definer set search_path=''as $$
declare n text;r regclass;
begin
 lock table app.events,app.tournament_setup_activations,app.tournament_setup_event_versions,
 app.tournament_setup_q_pool_versions,app.event_side_pools,app.roster_payment_events,
 app.tournament_expense_events,app.event_participants,app.q_pool_membership_versions_v1,
 app.q_pool_allocation_versions_v1,app.event_side_pool_election_versions,
 app.event_side_pool_team_election_versions,app.multi_event_finance_modes_v1,
 app.synthetic_paper_fixtures_v1 in share mode nowait;
 foreach n in array array['app.synthetic_mixed_fixtures_v1','app.synthetic_mixed_finance_scopes_v1']loop
  r:=to_regclass(n);if r is not null then execute format('lock table %s in share mode nowait',r);end if;
 end loop;
end$$;

create function app.save_native_ledger_allocation_v1(tid uuid,v jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;h text;old app.native_ledger_allocation_operations_v1%rowtype;prior_outcome jsonb;
 head app.native_ledger_allocation_revisions_v1%rowtype;cur jsonb;facts jsonb;row_value jsonb;part jsonb;
 native jsonb;receipt boolean;sources jsonb:='[]';parts jsonb;seen text[]:='{}';keys_seen text[];k text;
 amount numeric;allocated numeric;event_id uuid;fee numeric;rid uuid;next_version integer;snap jsonb;part_count integer:=0;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(v)is distinct from'object'or(select count(*)from jsonb_object_keys(v))<>7
 or not(v?&array['operationId','expectedRevisionId','sourceDigest','allocations','reason','reviewed','kind'])
 or v->>'kind'is distinct from'native-ledger-allocation-v1'
 or jsonb_typeof(v->'operationId')is distinct from'string'or(v->>'operationId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or not(v->'expectedRevisionId'='null'::jsonb or(jsonb_typeof(v->'expectedRevisionId')='string'and(v->>'expectedRevisionId')~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
 or jsonb_typeof(v->'sourceDigest')is distinct from'string'or(v->>'sourceDigest')!~'^[a-f0-9]{64}$'
 or v->'reviewed'is distinct from'true'::jsonb or jsonb_typeof(v->'reason')is distinct from'string'
 or v->>'reason'<>app.custom_payout_classification_text_v2(v->>'reason')or app.event_settings_js_text_length_v3(v->>'reason')not between 1 and 500 or(v->>'reason')~U&'[\0001-\001F\007F]'
 or jsonb_typeof(v->'allocations')is distinct from'array'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if jsonb_array_length(v->'allocations')>10000 or octet_length(v::text)>4000000 then return jsonb_build_object('status','rejected','code','technical_resource_bound');end if;
 op:=(v->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;
 if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-ledger-allocation-v1',a,tid,op,v)::text,'utf8'),'sha256'),'hex');
 select*into old from app.native_ledger_allocation_operations_v1 where actor_id=a and operation_id=op;
 if found then
  if old.tournament_id<>tid or old.request_hash<>h or old.request_payload<>v then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  select result into prior_outcome from app.native_ledger_allocation_outcomes_v1 where actor_id=a and operation_id=op and tournament_id=tid;
  if not found then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
  return prior_outcome||jsonb_build_object('replayed',true,'historicalReceipt',true,'fundAvailable',false);
 end if;
 insert into app.native_ledger_allocation_operations_v1(actor_id,operation_id,tournament_id,request_payload,request_hash)values(a,op,tid,v,h);
 perform app.lock_native_ledger_sources_v1();
 cur:=app.get_native_event_ledger_sources_v1(tid);
 if cur->>'status'='retry_exact'then raise lock_not_available;end if;
 if cur->>'status'is distinct from'sources_available'or cur->>'actorId'is distinct from a::text or cur->>'tournamentId'is distinct from tid::text then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','native_source_unavailable'));end if;
 if cur->>'sourceDigest'is distinct from v->>'sourceDigest'then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','source_changed'));end if;
 facts:=cur->'facts';
 if facts->'existingOptionalAllocationEvidence'is distinct from'false'::jsonb then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','native_optional_pool_bridge_required'));end if;
 select*into head from app.native_ledger_allocation_revisions_v1 where tournament_id=tid order by version desc limit 1;
 if coalesce(head.id::text,'')<>coalesce(v->>'expectedRevisionId','')then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','allocation_revision_changed'));end if;
 if jsonb_array_length(v->'allocations')<>jsonb_array_length(facts->'receiptEvents')+jsonb_array_length(facts->'expenseEvents')then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','source_coverage_incomplete'));end if;
 for row_value in select value from jsonb_array_elements(v->'allocations')loop
  if jsonb_typeof(row_value)is distinct from'object'or(select count(*)from jsonb_object_keys(row_value))<>2 or not(row_value?&array['sourceId','allocations'])
   or jsonb_typeof(row_value->'sourceId')is distinct from'string'or(row_value->>'sourceId')=any(seen)or jsonb_typeof(row_value->'allocations')is distinct from'array'then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','invalid_allocation'));end if;
  seen:=array_append(seen,row_value->>'sourceId');receipt:=true;
  select value into native from jsonb_array_elements(facts->'receiptEvents')where value->>'sourceId'=row_value->>'sourceId';
  if native is null then receipt:=false;select value into native from jsonb_array_elements(facts->'expenseEvents')where value->>'sourceId'=row_value->>'sourceId';end if;
  if native is null then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','foreign_or_void_source'));end if;
  amount:=(native->>'amountMinor')::numeric;
  if amount<=0 or amount>9007199254740991 or amount<>trunc(amount)then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','invalid_native_amount'));end if;
  allocated:=0;keys_seen:='{}';parts:=row_value->'allocations';part_count:=part_count+jsonb_array_length(parts);
  if part_count>50000 then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','technical_resource_bound'));end if;
  for part in select value from jsonb_array_elements(parts)loop
   if jsonb_typeof(part)is distinct from'object'or(select count(*)from jsonb_object_keys(part))<>5 or not(part?&array['eventId','bucket','poolId','amountMinor','classificationReviewed'])
   or jsonb_typeof(part->'eventId')is distinct from'string'or(part->>'eventId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or part->'poolId'is distinct from'null'::jsonb or part->'classificationReviewed'is distinct from'true'::jsonb
   or jsonb_typeof(part->'amountMinor')is distinct from'number'or(part->>'amountMinor')!~'^[1-9][0-9]*$'
   or(part->>'amountMinor')::numeric>9007199254740991 then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','invalid_allocation_part'));end if;
   event_id:=(part->>'eventId')::uuid;
   if not(facts->'eventIds'?event_id::text)then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','foreign_event'));end if;
   k:=event_id::text||':'||coalesce(part->>'bucket','');
   if k=any(keys_seen)then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','duplicate_allocation'));end if;keys_seen:=array_append(keys_seen,k);
   if receipt then
    select(value->>'entryFeeMinor')::numeric into fee from jsonb_array_elements(facts->'activationBindings')where value->>'eventId'=event_id::text;
    if part->>'bucket'is distinct from'regular_entry'or not(native->'eligibleEventIds'?event_id::text)or fee is null or(part->>'amountMinor')::numeric>fee then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','base_allocation_ineligible'));end if;
   elsif coalesce(part->>'bucket','')not in('player_benefit','operating_expense')then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','expense_classification_required'));end if;
   allocated:=allocated+(part->>'amountMinor')::numeric;
  end loop;
  if allocated<>amount then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','nonconserving_allocation'));end if;
  sources:=sources||jsonb_build_array(jsonb_build_object('sourceId',native->>'sourceId','physicalEvidenceId',native->>'sourceId','kind',case when receipt then'entry_receipt'else'expense'end,'amountMinor',amount,'state','active','allocations',parts));
 end loop;
 -- Never activate a negative event fund or overflow the shared safe-integer DTO.
 if exists(select 1 from jsonb_array_elements(facts->'eventIds')e cross join lateral(
  select coalesce(sum(case when p->>'bucket'='regular_entry'then(p->>'amountMinor')::numeric else-(p->>'amountMinor')::numeric end),0)fund,
  coalesce(sum((p->>'amountMinor')::numeric),0)gross from jsonb_array_elements(sources)s cross join lateral jsonb_array_elements(s->'allocations')p where p->>'eventId'=e#>>'{}')x where x.fund<0 or x.gross>9007199254740991)
 then return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','rejected','code','negative_or_unsafe_event_fund'));end if;
 next_version:=coalesce(head.version,0)+1;rid:=extensions.gen_random_uuid();
 snap:=jsonb_build_object('kind','event-ledger-snapshot-v1','tournamentId',tid,'sourceDigest',cur->>'sourceDigest','sourceVersion',next_version,'complete',true,'mode','documented_actual','eventIds',facts->'eventIds','pools',facts->'pools','sources',sources);
 insert into app.native_ledger_allocation_revisions_v1(id,tournament_id,actor_id,operation_id,version,prior_revision_id,request_payload,request_hash,source_digest,snapshot,reason)
 values(rid,tid,a,op,next_version,head.id,v,h,cur->>'sourceDigest',snap,v->>'reason');
 return app.finish_native_ledger_operation_v1(tid,op,jsonb_build_object('status','accepted','replayed',false,'historicalReceipt',false,'revisionId',rid,'version',next_version,'operationId',op,'actorId',a,'tournamentId',tid,'request',v,'snapshot',snap,'moneyMoved',false,'payoutAuthorized',false));
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
-- Current read never presents a retained allocation as a current fund after
-- receipt, participation, activation or expense evidence changes.
create function app.get_native_ledger_allocation_v1(tid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();cur jsonb;head app.native_ledger_allocation_revisions_v1%rowtype;
begin
 if a is null then return jsonb_build_object('status','blocked','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;
 if not found then return jsonb_build_object('status','blocked','code','not_director');end if;
 perform app.lock_native_ledger_sources_v1();cur:=app.get_native_event_ledger_sources_v1(tid);
 if cur->>'status'='retry_exact'then return cur;end if;
 if cur->>'status'is distinct from'sources_available'or cur->>'actorId'is distinct from a::text or cur->>'tournamentId'is distinct from tid::text then return jsonb_build_object('status','blocked','code','native_source_unavailable');end if;
 select*into head from app.native_ledger_allocation_revisions_v1 where tournament_id=tid order by version desc limit 1;
 if not found then return jsonb_build_object('status','unallocated','revisionId',null,'sourceDigest',cur->>'sourceDigest','fundAvailable',false);end if;
 if head.source_digest is distinct from cur->>'sourceDigest'then return jsonb_build_object('status','stale','revisionId',head.id,'version',head.version,'fundAvailable',false,'code','native_source_changed');end if;
 return jsonb_build_object('status','current','revisionId',head.id,'version',head.version,'snapshot',head.snapshot,'fundAvailable',true,'moneyMoved',false,'payoutAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Exact actor-bound immutable receipt lookup. A historical receipt proves only
-- that operation committed, never that its retained source is still current.
create function app.get_native_ledger_allocation_operation_v1(tid uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();r app.native_ledger_allocation_operations_v1%rowtype;outcome jsonb;
begin
 if a is null then return jsonb_build_object('status','blocked','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;
 if not found then return jsonb_build_object('status','blocked','code','not_director');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into r from app.native_ledger_allocation_operations_v1 where actor_id=a and operation_id=op and tournament_id=tid;
 if not found then return jsonb_build_object('status','unknown','actorId',a,'tournamentId',tid,'operationId',op);end if;
 select result into outcome from app.native_ledger_allocation_outcomes_v1 where actor_id=a and operation_id=op and tournament_id=tid;
 if not found then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
 return outcome||jsonb_build_object('historicalReceipt',true,'fundAvailable',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
alter function app.finish_native_ledger_operation_v1(uuid,uuid,jsonb)owner to postgres;
alter function app.native_ledger_allocation_immutable_v1()owner to postgres;
alter function app.lock_native_ledger_sources_v1()owner to postgres;
alter function app.save_native_ledger_allocation_v1(uuid,jsonb)owner to postgres;
alter function app.get_native_ledger_allocation_v1(uuid)owner to postgres;
alter function app.get_native_ledger_allocation_operation_v1(uuid,uuid)owner to postgres;
revoke all on function app.finish_native_ledger_operation_v1(uuid,uuid,jsonb),app.native_ledger_allocation_immutable_v1(),app.lock_native_ledger_sources_v1(),app.save_native_ledger_allocation_v1(uuid,jsonb),app.get_native_ledger_allocation_v1(uuid),app.get_native_ledger_allocation_operation_v1(uuid,uuid)from public,anon,authenticated,service_role;
commit;
