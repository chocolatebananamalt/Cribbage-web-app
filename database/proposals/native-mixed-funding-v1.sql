-- LOCAL, UNEXECUTED, DEFAULT-OFF CANDIDATE.
-- Separate simulated entry-funding journal for one sealed-later TEST ONLY
-- native mixed admission. It never writes the ordinary obligation/payment
-- ledgers, never satisfies paid check-in, and never claims bank receipt, real
-- money, refund, payout or finalization authority. Optional pools and a
-- sanctioning assessment require separate reviewed sources.
begin;

-- Both candidates are still unexecuted. Pin their source/capture entrypoints
-- before the first intent exists so timestamptz JSON cannot vary with a
-- caller's session TimeZone. Existing stored captures are never rewritten.
alter function app.native_mixed_admission_base_source_v1(uuid,uuid)set timezone='UTC';
alter function app.save_native_mixed_admission_intent_v1(uuid,uuid,uuid,jsonb)set timezone='UTC';
alter function app.seal_native_mixed_admission_v1(uuid,uuid,uuid,jsonb)set timezone='UTC';

create function app.native_mixed_funding_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

-- Quarantine begins at the admission intent, before simulated collection.
-- Preserve the prior function's conservative missing/unknown-shape behavior.
create or replace function app.native_ledger_has_mixed_scope_v1(tid uuid)returns boolean
language plpgsql security definer set search_path=''as $$
declare n text;r regclass;enrolled boolean;
begin
 foreach n in array array[
  'app.synthetic_mixed_fixtures_v1','app.synthetic_mixed_finance_scopes_v1',
  'app.native_mixed_admission_intents_v1','app.native_mixed_funding_scopes_v1'
 ]loop
  r:=to_regclass(n);if r is null then continue;end if;
  if not exists(select 1 from pg_catalog.pg_attribute where attrelid=r and attname='tournament_id'
    and atttypid='uuid'::regtype and not attisdropped)then return null;end if;
  execute format('select exists(select 1 from %s where tournament_id=$1)',r)into enrolled using tid;
  if enrolled then return true;end if;
 end loop;
 return false;
exception when undefined_table or undefined_column then return null;
end$$;

create table app.native_mixed_funding_operations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,action text not null check(action in('scope','entry')),
 request_payload jsonb not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array(
  'native-mixed-funding-v1',action,actor_id,operation_id,tournament_id,event_id,request_payload
 )::text,'utf8'),'sha256'),'hex'))
);

create table app.native_mixed_funding_scopes_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 version integer not null default 1 check(version=1),actor_id uuid not null,operation_id uuid not null,nonce uuid not null,
 admission_intent_id uuid not null,admission_intent_version integer not null,
 admission_source_digest text not null check(admission_source_digest~'^[a-f0-9]{64}$'),
 operational_binding_id uuid not null,entry_fee_minor bigint not null
  check(entry_fee_minor between 300 and 500399958596721 and entry_fee_minor%100=0),
 participant_count integer not null default 18 check(participant_count=18),
 digital_count integer not null default 6 check(digital_count=6),paper_count integer not null default 12 check(paper_count=12),
 source_capture jsonb not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 reason text not null check(reason=trim(reason)and length(reason)between 1 and 500 and reason!~'[[:cntrl:]]'),
 actual_money_received boolean not null default false check(not actual_money_received),
 bank_receipt_verified boolean not null default false check(not bank_receipt_verified),
 money_moved boolean not null default false check(not money_moved),
 refund_authorized boolean not null default false check(not refund_authorized),
 payout_authorized boolean not null default false check(not payout_authorized),
 finalization_authorized boolean not null default false check(not finalization_authorized),
 created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id),unique(tournament_id,event_id,nonce),unique(actor_id,operation_id),
 unique(id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(admission_intent_id,tournament_id,event_id)
  references app.native_mixed_admission_intents_v1(id,tournament_id,event_id),
 foreign key(operational_binding_id)references app.event_settings_operational_bindings_v1(id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_funding_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

create table app.native_mixed_funding_contexts_v1(
 id uuid primary key default extensions.gen_random_uuid(),scope_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,actor_id uuid not null,operation_id uuid not null,
 roster_entry_id uuid not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 backend_pid integer not null,transaction_id bigint not null,created_at timestamptz not null default clock_timestamp(),
 unique(actor_id,operation_id),unique(id,tournament_id,event_id),
 foreign key(scope_id,tournament_id,event_id)references app.native_mixed_funding_scopes_v1(id,tournament_id,event_id),
 foreign key(roster_entry_id,tournament_id)references app.tournament_roster_entries(id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_funding_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

create table app.native_mixed_funding_obligations_v1(
 id uuid primary key default extensions.gen_random_uuid(),scope_id uuid not null,context_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,version integer not null default 1 check(version=1),
 roster_entry_id uuid not null,participant_id uuid not null,mode text not null check(mode in('digital','paper')),
 profile_id uuid,amount_minor bigint not null check(amount_minor between 1 and 9007199254740991),
 actor_id uuid not null,operation_id uuid not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 unique(scope_id,roster_entry_id),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(scope_id,tournament_id,event_id)references app.native_mixed_funding_scopes_v1(id,tournament_id,event_id),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_funding_contexts_v1(id,tournament_id,event_id),
 foreign key(roster_entry_id,tournament_id)references app.tournament_roster_entries(id,tournament_id),
 foreign key(participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_funding_operations_v1(actor_id,operation_id,tournament_id,event_id),
 check((mode='digital'and profile_id is not null)or(mode='paper'and profile_id is null))
);

create table app.native_mixed_funding_receipts_v1(
 id uuid primary key default extensions.gen_random_uuid(),scope_id uuid not null,context_id uuid not null,
 obligation_id uuid not null,tournament_id uuid not null,event_id uuid not null,version integer not null default 1 check(version=1),
 roster_entry_id uuid not null,amount_minor bigint not null check(amount_minor between 1 and 9007199254740991),
 currency_code text not null default'USD'check(currency_code='USD'),
 method text not null default'simulated'check(method='simulated'),simulated_received_at timestamptz not null,
 actor_id uuid not null,operation_id uuid not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 actual_money_received boolean not null default false check(not actual_money_received),
 bank_receipt_verified boolean not null default false check(not bank_receipt_verified),
 money_moved boolean not null default false check(not money_moved),
 created_at timestamptz not null default clock_timestamp(),
 unique(scope_id,roster_entry_id),unique(obligation_id),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(scope_id,tournament_id,event_id)references app.native_mixed_funding_scopes_v1(id,tournament_id,event_id),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_funding_contexts_v1(id,tournament_id,event_id),
 foreign key(obligation_id,tournament_id,event_id)references app.native_mixed_funding_obligations_v1(id,tournament_id,event_id),
 foreign key(roster_entry_id,tournament_id)references app.tournament_roster_entries(id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_funding_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

create table app.native_mixed_funding_provenance_v1(
 context_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 entity_kind text not null check(entity_kind in('obligation','receipt')),entity_id uuid not null,
 row_digest text not null check(row_digest~'^[a-f0-9]{64}$'),
 actual_money_received boolean not null default false check(not actual_money_received),
 bank_receipt_verified boolean not null default false check(not bank_receipt_verified),
 money_moved boolean not null default false check(not money_moved),
 refund_authorized boolean not null default false check(not refund_authorized),
 payout_authorized boolean not null default false check(not payout_authorized),
 finalization_authorized boolean not null default false check(not finalization_authorized),
 created_at timestamptz not null default clock_timestamp(),primary key(entity_kind,entity_id),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_funding_contexts_v1(id,tournament_id,event_id)
);

create table app.native_mixed_funding_outcomes_v1(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_funding_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

do $$declare n text;begin foreach n in array array[
 'native_mixed_funding_operations_v1','native_mixed_funding_scopes_v1','native_mixed_funding_contexts_v1',
 'native_mixed_funding_obligations_v1','native_mixed_funding_receipts_v1','native_mixed_funding_provenance_v1',
 'native_mixed_funding_outcomes_v1'
]loop execute format('alter table app.%I owner to postgres',n);
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on table app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;

-- Preserve the reviewed pre-funding financial-idle predicate byte-for-byte,
-- then make admission-intent corrections fail closed once a scope is pinned.
-- Funding entries use the preserved predicate so their own isolated rows do
-- not masquerade as ordinary financial history.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.native_mixed_admission_finance_idle_v1(uuid,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION app.native_mixed_admission_finance_idle_v1(tid uuid, eid uuid)',
  'FUNCTION app.native_mixed_admission_finance_idle_before_funding_v1(tid uuid, eid uuid)');
 if p=d then raise exception'native mixed admission finance-idle clone anchor changed';end if;execute p;
end$$;
create or replace function app.native_mixed_admission_finance_idle_v1(tid uuid,eid uuid)returns boolean
language sql stable security definer set search_path=''as $$
 select app.native_mixed_admission_finance_idle_before_funding_v1(tid,eid)is true
 and not exists(select 1 from app.native_mixed_funding_scopes_v1 where tournament_id=tid and event_id=eid)
$$;

create function app.native_mixed_funding_lifecycle_open_v1(tid uuid,eid uuid)returns boolean
language sql stable security definer set search_path=''as $$
 select not exists(select 1 from app.event_play_starts where tournament_id=tid and event_id=eid)
 and app.native_mixed_admission_score_history_empty_v1(tid,eid)is true
 and not exists(select 1 from app.native_mixed_admission_seals_v1 where tournament_id=tid and event_id=eid)
$$;

-- A funding scope is a new isolated simulation domain. It never adopts or
-- coexists with an older simulation scope or any native optional Finance,
-- income or fund-review history.
create function app.native_mixed_funding_other_domains_idle_v1(tid uuid,eid uuid)returns boolean
language sql stable security definer set search_path=''as $$select
 not exists(select 1 from app.synthetic_mixed_finance_scopes_v1 where tournament_id=tid)
 and not exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.multi_event_finance_modes_v1 where tournament_id=tid)
 and not exists(select 1 from app.native_optional_pool_ownership_revisions_v2 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.native_optional_finance_revisions_v2 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.native_optional_fund_reviews_v2 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.native_unrestricted_income_sources_v1 where tournament_id=tid and event_id=eid)
$$;

-- Reserve actor operation IDs reciprocally. Funding writers already consult
-- the admission domain; admission corrections/seals must also see funding.
create or replace function app.native_mixed_admission_operation_reserved_v1(actor uuid,op uuid)returns boolean
language sql stable security definer set search_path=''as $$select
 exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)
 or exists(select 1 from app.random_seating_operations_v1 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.reviewed_initial_seating_publications_v1 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_optional_pool_ownership_operations_v2 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_optional_finance_operations_v2 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_optional_finance_adoption_operations_v2 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_optional_income_operations_v2 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_optional_fund_operations_v2 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_optional_final_operations_v2 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_mixed_funding_operations_v1 where actor_id=actor and operation_id=op)
$$;

create function app.native_mixed_funding_scope_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array[
  'expectedAdmissionIntentId','expectedAdmissionIntentVersion','expectedAdmissionSourceDigest',
  'expectedOperationalBindingId','kind','nonce','operationId','reason']
 and v->>'kind'='native-mixed-funding-scope-v1'
 and coalesce(v->>'operationId','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and coalesce(v->>'nonce','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and coalesce(v->>'expectedAdmissionIntentId','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and coalesce(v->>'expectedOperationalBindingId','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and coalesce(v->>'expectedAdmissionSourceDigest','')~'^[a-f0-9]{64}$'
 and jsonb_typeof(v->'expectedAdmissionIntentVersion')='number'
 and coalesce(v->>'expectedAdmissionIntentVersion','')~'^[1-9][0-9]{0,9}$'
 and(v->>'expectedAdmissionIntentVersion')::bigint<=2147483647
 and jsonb_typeof(v->'reason')='string'and v->>'reason'=trim(v->>'reason')
 and length(v->>'reason')between 1 and 500 and(v->>'reason')!~'[[:cntrl:]]'$$;

create function app.native_mixed_funding_entry_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array[
  'expectedScopeDigest','expectedScopeId','expectedVersion','kind','operationId','reason','rosterEntryId','simulatedReceivedAt']
 and v->>'kind'='native-mixed-funding-entry-v1'
 and coalesce(v->>'operationId','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and coalesce(v->>'expectedScopeId','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and coalesce(v->>'rosterEntryId','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and coalesce(v->>'expectedScopeDigest','')~'^[a-f0-9]{64}$'
 and v->'expectedVersion'='0'::jsonb
 and jsonb_typeof(v->'simulatedReceivedAt')='string'
 and(v->>'simulatedReceivedAt')~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
 and jsonb_typeof(v->'reason')='string'and v->>'reason'=trim(v->>'reason')
 and length(v->>'reason')between 1 and 500 and(v->>'reason')!~'[[:cntrl:]]'$$;

create function app.lock_native_mixed_funding_sources_v1()returns void
language plpgsql security definer set search_path=''as $$begin
 perform app.lock_native_ledger_sources_v1();perform app.lock_event_settings_playoff_sources_v1();
 lock table app.native_mixed_admission_operations_v1,app.native_mixed_admission_intents_v1,app.native_mixed_admission_seals_v1,
  app.native_mixed_funding_operations_v1,app.native_mixed_funding_scopes_v1,app.native_mixed_funding_contexts_v1,
  app.native_mixed_funding_obligations_v1,app.native_mixed_funding_receipts_v1,app.native_mixed_funding_provenance_v1,
  app.native_mixed_funding_outcomes_v1,app.event_settings_operational_bindings_v1,app.events,app.event_participants,
  app.tournament_roster_entries,app.roster_account_links,app.roster_payment_obligation_versions,app.roster_payment_events,
  app.tournament_expense_events,app.late_player_refund_decisions,
  app.synthetic_mixed_finance_scopes_v1,app.synthetic_paper_fixtures_v1,app.multi_event_finance_modes_v1,
  app.native_optional_pool_ownership_revisions_v2,app.native_optional_finance_revisions_v2,app.native_optional_fund_reviews_v2,
  app.native_unrestricted_income_sources_v1,app.native_unrestricted_income_records_v1,app.native_optional_income_records_v2
  in share mode nowait;
end$$;

create function app.native_mixed_funding_operation_reserved_v1(actor uuid,op uuid)returns boolean
language sql stable security definer set search_path=''as $$select
 app.native_mixed_admission_operation_reserved_v1(actor,op)
 or exists(select 1 from app.native_mixed_admission_operations_v1 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_mixed_funding_operations_v1 where actor_id=actor and operation_id=op)$$;

create function app.native_mixed_funding_scope_bound_v1(scope_value uuid)returns boolean
language sql stable security definer set search_path=''set timezone='UTC'as $$
 select exists(select 1 from app.native_mixed_funding_scopes_v1 s
 join app.native_mixed_admission_intents_v1 i on i.id=s.admission_intent_id and i.tournament_id=s.tournament_id and i.event_id=s.event_id
 join app.native_mixed_funding_operations_v1 o on o.actor_id=s.actor_id and o.operation_id=s.operation_id
 join app.native_mixed_funding_outcomes_v1 x on x.actor_id=o.actor_id and x.operation_id=o.operation_id
 where s.id=scope_value and o.action='scope'and o.tournament_id=s.tournament_id and o.event_id=s.event_id
  and s.admission_intent_version=i.version and s.admission_source_digest=i.source_digest
  and s.operational_binding_id=i.operational_binding_id
  and s.entry_fee_minor=(i.setup_event_capture->>'entry_fee_cents')::bigint
  and app.native_mixed_funding_scope_request_valid_v1(o.request_payload)is true
  and o.request_payload->>'operationId'=o.operation_id::text
  and o.request_payload->>'nonce'=s.nonce::text
  and o.request_payload->>'expectedAdmissionIntentId'=s.admission_intent_id::text
  and(o.request_payload->>'expectedAdmissionIntentVersion')::integer=s.admission_intent_version
  and o.request_payload->>'expectedAdmissionSourceDigest'=s.admission_source_digest
  and o.request_payload->>'expectedOperationalBindingId'=s.operational_binding_id::text
  and s.source_capture=jsonb_build_object('kind','native-mixed-funding-scope-source-v1','admissionIntent',to_jsonb(i),
   'baseSource',i.base_source_capture,'entryFeeMinor',s.entry_fee_minor,'participantCount',18,'digitalCount',6,'paperCount',12,
   'optionalPoolSourceAvailable',false,'assessmentSourceAvailable',false,'paidCheckInAuthorized',false,'ordinaryCheckInSource',false,
   'actualMoneyReceived',false,'bankReceiptVerified',false,'moneyMoved',false,'refundAuthorized',false,
   'payoutAuthorized',false,'finalizationAuthorized',false)
  and s.source_digest=encode(extensions.digest(convert_to(jsonb_build_array(
   'native-mixed-funding-scope-source-v1',s.tournament_id,s.event_id,s.source_capture)::text,'utf8'),'sha256'),'hex')
  and x.result=jsonb_build_object('kind','native-mixed-funding-receipt-v1','action','scope','status','accepted',
   'code','native_mixed_funding_scope_recorded','actorId',s.actor_id,'tournamentId',s.tournament_id,'eventId',s.event_id,
   'operationId',s.operation_id,'scopeId',s.id,'version',1,'sourceDigest',s.source_digest,'request',o.request_payload,
   'optionalPoolSourceAvailable',false,'assessmentSourceAvailable',false,'paidCheckInAuthorized',false,'ordinaryCheckInSource',false,
   'actualMoneyReceived',false,'bankReceiptVerified',false,'moneyMoved',false,'refundAuthorized',false,
   'payoutAuthorized',false,'finalizationAuthorized',false))
$$;

create function app.native_mixed_funding_entry_bound_v1(obligation_value uuid)returns boolean
language sql stable security definer set search_path=''set timezone='UTC'as $$
 select exists(select 1 from app.native_mixed_funding_obligations_v1 b
 join app.native_mixed_funding_receipts_v1 r on r.obligation_id=b.id and r.scope_id=b.scope_id
 join app.native_mixed_funding_contexts_v1 c on c.id=b.context_id and c.id=r.context_id
 join app.native_mixed_funding_operations_v1 o on o.actor_id=b.actor_id and o.operation_id=b.operation_id
 join app.native_mixed_funding_outcomes_v1 x on x.actor_id=o.actor_id and x.operation_id=o.operation_id
 join app.native_mixed_funding_scopes_v1 s on s.id=b.scope_id and s.tournament_id=b.tournament_id and s.event_id=b.event_id
 join app.native_mixed_funding_provenance_v1 pb on pb.entity_kind='obligation'and pb.entity_id=b.id and pb.context_id=c.id
 join app.native_mixed_funding_provenance_v1 pr on pr.entity_kind='receipt'and pr.entity_id=r.id and pr.context_id=c.id
 where b.id=obligation_value and o.action='entry'and o.tournament_id=b.tournament_id and o.event_id=b.event_id
  and c.scope_id=s.id and c.actor_id=o.actor_id and c.operation_id=o.operation_id and c.roster_entry_id=b.roster_entry_id
  and c.request_hash=o.request_hash and r.actor_id=o.actor_id and r.operation_id=o.operation_id
  and r.tournament_id=b.tournament_id and r.event_id=b.event_id and r.roster_entry_id=b.roster_entry_id
  and app.native_mixed_funding_entry_request_valid_v1(o.request_payload)is true
  and o.request_payload->>'operationId'=o.operation_id::text and o.request_payload->>'expectedScopeId'=s.id::text
  and o.request_payload->>'expectedScopeDigest'=s.source_digest and o.request_payload->>'rosterEntryId'=b.roster_entry_id::text
  and to_char(r.simulated_received_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')=o.request_payload->>'simulatedReceivedAt'
  and b.amount_minor=s.entry_fee_minor and r.amount_minor=b.amount_minor and r.currency_code='USD'and r.method='simulated'
  and b.source_digest=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-funding-obligation-v1',
   s.source_digest,b.roster_entry_id,b.participant_id,b.mode,b.profile_id,b.amount_minor)::text,'utf8'),'sha256'),'hex')
  and r.source_digest=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-funding-receipt-row-v1',
   b.source_digest,r.simulated_received_at,r.amount_minor,'USD','simulated')::text,'utf8'),'sha256'),'hex')
  and pb.tournament_id=b.tournament_id and pb.event_id=b.event_id
  and pb.row_digest=encode(extensions.digest(to_jsonb(b)::text,'sha256'),'hex')
  and pr.tournament_id=r.tournament_id and pr.event_id=r.event_id
  and pr.row_digest=encode(extensions.digest(to_jsonb(r)::text,'sha256'),'hex')
  and not pb.actual_money_received and not pb.bank_receipt_verified and not pb.money_moved
  and not pb.refund_authorized and not pb.payout_authorized and not pb.finalization_authorized
  and not pr.actual_money_received and not pr.bank_receipt_verified and not pr.money_moved
  and not pr.refund_authorized and not pr.payout_authorized and not pr.finalization_authorized
  and x.result=jsonb_build_object('kind','native-mixed-funding-receipt-v1','action','entry','status','accepted',
   'code','native_mixed_funding_entry_recorded','actorId',b.actor_id,'tournamentId',b.tournament_id,'eventId',b.event_id,
   'operationId',b.operation_id,'scopeId',s.id,'rosterEntryId',b.roster_entry_id,'obligationId',b.id,'receiptId',r.id,
   'amountMinor',b.amount_minor,'sourceDigest',r.source_digest,'request',o.request_payload,
   'optionalPoolSourceAvailable',false,'assessmentSourceAvailable',false,'paidCheckInAuthorized',false,'ordinaryCheckInSource',false,
   'actualMoneyReceived',false,'bankReceiptVerified',false,'moneyMoved',false,'refundAuthorized',false,
   'payoutAuthorized',false,'finalizationAuthorized',false))
$$;

create function app.save_native_mixed_funding_scope_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare op uuid;rh text;old app.native_mixed_funding_operations_v1%rowtype;prior jsonb;
 intent app.native_mixed_admission_intents_v1%rowtype;base jsonb;scope_id uuid:=extensions.gen_random_uuid();fee bigint;
 capture jsonb;digest text;response jsonb;code text;
begin
 if app.native_mixed_funding_enabled_v1()is distinct from true then return jsonb_build_object('kind','native-mixed-funding-receipt-v1','action','scope','status','rejected','code','feature_unavailable','actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);end if;
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 begin
  if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='P0001',message='unsupported_isolation';end if;
  if app.native_mixed_funding_scope_request_valid_v1(request)is distinct from true then raise exception using errcode='P0001',message='invalid_request';end if;
  op:=(request->>'operationId')::uuid;rh:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-funding-v1','scope',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
  if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-funding-v1:'||tid::text||':'||eid::text,0))then raise exception using errcode='55P03',message='busy';end if;
  perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'for update nowait;if not found then raise exception using errcode='P0001',message='test_scope_required';end if;
  perform 1 from app.profiles where id=actor for key share nowait;if not found then return null;end if;
  perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
  perform app.lock_native_mixed_funding_sources_v1();
  select*into old from app.native_mixed_funding_operations_v1 where actor_id=actor and operation_id=op;
  if found then if old.action<>'scope'or old.tournament_id<>tid or old.event_id<>eid or old.request_hash<>rh or old.request_payload is distinct from request then raise exception using errcode='P0001',message='operation_conflict';end if;
   select result into prior from app.native_mixed_funding_outcomes_v1 where actor_id=actor and operation_id=op;if prior is null then raise exception using errcode='55P03',message='busy';end if;return prior;end if;
  if app.native_mixed_funding_operation_reserved_v1(actor,op)then raise exception using errcode='P0001',message='operation_conflict';end if;
  select*into intent from app.native_mixed_admission_intents_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
  if intent.id is null or intent.id<>(request->>'expectedAdmissionIntentId')::uuid
   or intent.version<>(request->>'expectedAdmissionIntentVersion')::integer or intent.source_digest<>request->>'expectedAdmissionSourceDigest'
   or intent.operational_binding_id<>(request->>'expectedOperationalBindingId')::uuid
   or exists(select 1 from app.native_mixed_admission_seals_v1 where tournament_id=tid and event_id=eid)
  then raise exception using errcode='P0001',message='admission_intent_changed';end if;
  base:=app.native_mixed_admission_base_source_v1(tid,eid);
  if base is distinct from intent.base_source_capture then raise exception using errcode='P0001',message='admission_source_changed';end if;
  if app.native_mixed_admission_finance_idle_before_funding_v1(tid,eid)is distinct from true
   or app.native_mixed_funding_other_domains_idle_v1(tid,eid)is distinct from true
   or app.native_mixed_funding_lifecycle_open_v1(tid,eid)is distinct from true
   or exists(select 1 from app.native_mixed_funding_scopes_v1 where tournament_id=tid and event_id=eid)
  then raise exception using errcode='P0001',message='precollection_scope_required';end if;
  fee:=(intent.setup_event_capture->>'entry_fee_cents')::bigint;
  if fee not between 300 and 500399958596721 or fee%100<>0 then raise exception using errcode='P0001',message='entry_fee_unavailable';end if;
  capture:=jsonb_build_object('kind','native-mixed-funding-scope-source-v1','admissionIntent',to_jsonb(intent),
   'baseSource',base,'entryFeeMinor',fee,'participantCount',18,'digitalCount',6,'paperCount',12,
   'optionalPoolSourceAvailable',false,'assessmentSourceAvailable',false,'paidCheckInAuthorized',false,'ordinaryCheckInSource',false,
   'actualMoneyReceived',false,'bankReceiptVerified',false,'moneyMoved',false,'refundAuthorized',false,'payoutAuthorized',false,'finalizationAuthorized',false);
  digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-funding-scope-source-v1',tid,eid,capture)::text,'utf8'),'sha256'),'hex');
  response:=jsonb_build_object('kind','native-mixed-funding-receipt-v1','action','scope','status','accepted','code','native_mixed_funding_scope_recorded',
   'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'scopeId',scope_id,'version',1,'sourceDigest',digest,'request',request,
   'optionalPoolSourceAvailable',false,'assessmentSourceAvailable',false,'paidCheckInAuthorized',false,'ordinaryCheckInSource',false,
   'actualMoneyReceived',false,'bankReceiptVerified',false,'moneyMoved',false,'refundAuthorized',false,'payoutAuthorized',false,'finalizationAuthorized',false);
  insert into app.native_mixed_funding_operations_v1 values(actor,op,tid,eid,'scope',request,rh,clock_timestamp());
  insert into app.native_mixed_funding_scopes_v1(id,tournament_id,event_id,actor_id,operation_id,nonce,admission_intent_id,admission_intent_version,
   admission_source_digest,operational_binding_id,entry_fee_minor,source_capture,source_digest,reason)
   values(scope_id,tid,eid,actor,op,(request->>'nonce')::uuid,intent.id,intent.version,intent.source_digest,intent.operational_binding_id,fee,capture,digest,request->>'reason');
  insert into app.native_mixed_funding_outcomes_v1 values(actor,op,tid,eid,response,clock_timestamp());return response;
 exception when lock_not_available or sqlstate'55P03'then return jsonb_build_object('kind','native-mixed-funding-receipt-v1','action','scope','status','retry_exact','code','source_busy','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request);
  when sqlstate'P0001'then get stacked diagnostics code=message_text;if code not in('unsupported_isolation','invalid_request','test_scope_required','operation_conflict','admission_intent_changed','admission_source_changed','precollection_scope_required','entry_fee_unavailable')then raise;end if;
  return jsonb_build_object('kind','native-mixed-funding-receipt-v1','action','scope','status','rejected','code',code,'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);end;
end$$;

create function app.record_native_mixed_funding_entry_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare op uuid;rh text;old app.native_mixed_funding_operations_v1%rowtype;prior jsonb;scope_row app.native_mixed_funding_scopes_v1%rowtype;
 participant jsonb;roster uuid;participant_id uuid;profile uuid;mode_value text;received timestamptz;
 context_id uuid:=extensions.gen_random_uuid();obligation_id uuid:=extensions.gen_random_uuid();receipt_id uuid:=extensions.gen_random_uuid();
 obligation_digest text;receipt_digest text;obligation_row jsonb;receipt_row jsonb;response jsonb;code text;
begin
 if app.native_mixed_funding_enabled_v1()is distinct from true then return jsonb_build_object('kind','native-mixed-funding-receipt-v1','action','entry','status','rejected','code','feature_unavailable','actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);end if;
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 begin
  if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='P0001',message='unsupported_isolation';end if;
  if app.native_mixed_funding_entry_request_valid_v1(request)is distinct from true then raise exception using errcode='P0001',message='invalid_request';end if;
  op:=(request->>'operationId')::uuid;roster:=(request->>'rosterEntryId')::uuid;received:=(request->>'simulatedReceivedAt')::timestamptz;
  if to_char(received at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>request->>'simulatedReceivedAt'
  then raise exception using errcode='P0001',message='invalid_request';end if;
  rh:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-funding-v1','entry',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
  if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-funding-v1:'||tid::text||':'||eid::text,0))then raise exception using errcode='55P03',message='busy';end if;
  perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'for update nowait;if not found then raise exception using errcode='P0001',message='test_scope_required';end if;
  perform 1 from app.profiles where id=actor for key share nowait;if not found then return null;end if;
  perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
  perform app.lock_native_mixed_funding_sources_v1();
  select*into old from app.native_mixed_funding_operations_v1 where actor_id=actor and operation_id=op;
  if found then if old.action<>'entry'or old.tournament_id<>tid or old.event_id<>eid or old.request_hash<>rh or old.request_payload is distinct from request then raise exception using errcode='P0001',message='operation_conflict';end if;
   select result into prior from app.native_mixed_funding_outcomes_v1 where actor_id=actor and operation_id=op;if prior is null then raise exception using errcode='55P03',message='busy';end if;return prior;end if;
  if app.native_mixed_funding_operation_reserved_v1(actor,op)then raise exception using errcode='P0001',message='operation_conflict';end if;
  select*into scope_row from app.native_mixed_funding_scopes_v1 where id=(request->>'expectedScopeId')::uuid and tournament_id=tid and event_id=eid;
  if scope_row.id is null or scope_row.source_digest<>request->>'expectedScopeDigest'
   or scope_row.admission_intent_id is distinct from(select id from app.native_mixed_admission_intents_v1 where tournament_id=tid and event_id=eid order by version desc limit 1)
   or app.native_mixed_admission_base_source_v1(tid,eid)is distinct from scope_row.source_capture->'baseSource'
   or exists(select 1 from app.native_mixed_admission_seals_v1 where tournament_id=tid and event_id=eid)
  then raise exception using errcode='P0001',message='funding_scope_changed';end if;
  if app.native_mixed_admission_finance_idle_before_funding_v1(tid,eid)is distinct from true
   or app.native_mixed_funding_other_domains_idle_v1(tid,eid)is distinct from true
  then raise exception using errcode='P0001',message='ordinary_financial_history_exists';end if;
  if app.native_mixed_funding_lifecycle_open_v1(tid,eid)is distinct from true then raise exception using errcode='P0001',message='prestart_funding_required';end if;
  select value into participant from jsonb_array_elements(scope_row.source_capture#>'{baseSource,roster}')where value->>'rosterEntryId'=roster::text;
  if participant is null or participant->>'mode'not in('digital','paper')then raise exception using errcode='P0001',message='roster_entry_unavailable';end if;
  participant_id:=(participant->>'participantId')::uuid;mode_value:=participant->>'mode';profile:=nullif(participant->>'profileId','')::uuid;
  if exists(select 1 from app.native_mixed_funding_obligations_v1 where scope_id=scope_row.id and roster_entry_id=roster)
  then raise exception using errcode='P0001',message='entry_already_recorded';end if;
  obligation_digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-funding-obligation-v1',scope_row.source_digest,roster,participant_id,mode_value,profile,scope_row.entry_fee_minor)::text,'utf8'),'sha256'),'hex');
  receipt_digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-funding-receipt-row-v1',obligation_digest,received,scope_row.entry_fee_minor,'USD','simulated')::text,'utf8'),'sha256'),'hex');
  insert into app.native_mixed_funding_operations_v1 values(actor,op,tid,eid,'entry',request,rh,clock_timestamp());
  insert into app.native_mixed_funding_contexts_v1 values(context_id,scope_row.id,tid,eid,actor,op,roster,rh,pg_backend_pid(),txid_current(),clock_timestamp());
  insert into app.native_mixed_funding_obligations_v1(id,scope_id,context_id,tournament_id,event_id,roster_entry_id,participant_id,mode,profile_id,amount_minor,actor_id,operation_id,source_digest)
   values(obligation_id,scope_row.id,context_id,tid,eid,roster,participant_id,mode_value,profile,scope_row.entry_fee_minor,actor,op,obligation_digest);
  insert into app.native_mixed_funding_receipts_v1(id,scope_id,context_id,obligation_id,tournament_id,event_id,roster_entry_id,amount_minor,simulated_received_at,actor_id,operation_id,source_digest)
   values(receipt_id,scope_row.id,context_id,obligation_id,tid,eid,roster,scope_row.entry_fee_minor,received,actor,op,receipt_digest);
  select to_jsonb(x)into obligation_row from app.native_mixed_funding_obligations_v1 x where x.id=obligation_id;
  select to_jsonb(x)into receipt_row from app.native_mixed_funding_receipts_v1 x where x.id=receipt_id;
  insert into app.native_mixed_funding_provenance_v1(context_id,tournament_id,event_id,entity_kind,entity_id,row_digest)
   values(context_id,tid,eid,'obligation',obligation_id,encode(extensions.digest(obligation_row::text,'sha256'),'hex')),
    (context_id,tid,eid,'receipt',receipt_id,encode(extensions.digest(receipt_row::text,'sha256'),'hex'));
  response:=jsonb_build_object('kind','native-mixed-funding-receipt-v1','action','entry','status','accepted','code','native_mixed_funding_entry_recorded',
   'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'scopeId',scope_row.id,'rosterEntryId',roster,
   'obligationId',obligation_id,'receiptId',receipt_id,'amountMinor',scope_row.entry_fee_minor,'sourceDigest',receipt_digest,'request',request,
   'optionalPoolSourceAvailable',false,'assessmentSourceAvailable',false,'paidCheckInAuthorized',false,'ordinaryCheckInSource',false,
   'actualMoneyReceived',false,'bankReceiptVerified',false,'moneyMoved',false,'refundAuthorized',false,'payoutAuthorized',false,'finalizationAuthorized',false);
  insert into app.native_mixed_funding_outcomes_v1 values(actor,op,tid,eid,response,clock_timestamp());return response;
 exception when lock_not_available or sqlstate'55P03'then return jsonb_build_object('kind','native-mixed-funding-receipt-v1','action','entry','status','retry_exact','code','source_busy','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request);
 when invalid_text_representation or datetime_field_overflow then code:='invalid_request';return jsonb_build_object('kind','native-mixed-funding-receipt-v1','action','entry','status','rejected','code',code,'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request);
 when sqlstate'P0001'then get stacked diagnostics code=message_text;if code not in('unsupported_isolation','invalid_request','test_scope_required','operation_conflict','funding_scope_changed','ordinary_financial_history_exists','prestart_funding_required','roster_entry_unavailable','entry_already_recorded')then raise;end if;
  return jsonb_build_object('kind','native-mixed-funding-receipt-v1','action','entry','status','rejected','code',code,'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);end;
end$$;

-- Owner-only complete projection for a future separately reviewed admission
-- seal dispatcher. These rows still do not satisfy QR/desk paid attendance or
-- normal Start; the projection says so explicitly and has no public grant.
create function app.native_mixed_funding_seal_source_v1(tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$
declare s app.native_mixed_funding_scopes_v1%rowtype;base jsonb;entries jsonb;
 obligation_total bigint;receipt_total bigint;source jsonb;digest text;begin
 if app.native_mixed_funding_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_funding_sources_v1();select*into s from app.native_mixed_funding_scopes_v1 where tournament_id=tid and event_id=eid;
 base:=app.native_mixed_admission_base_source_v1(tid,eid);
 if s.id is null or s.admission_intent_id is distinct from(select id from app.native_mixed_admission_intents_v1 where tournament_id=tid and event_id=eid order by version desc limit 1)
  or base is distinct from s.source_capture->'baseSource'
  or exists(select 1 from app.native_mixed_admission_seals_v1 x where x.tournament_id=tid and x.event_id=eid and x.intent_id<>s.admission_intent_id)
  or app.native_mixed_admission_finance_idle_before_funding_v1(tid,eid)is distinct from true
  or app.native_mixed_funding_other_domains_idle_v1(tid,eid)is distinct from true
  or app.native_mixed_funding_scope_bound_v1(s.id)is distinct from true
 then return jsonb_build_object('status','blocked','code','funding_scope_changed');end if;
 if jsonb_array_length(base->'roster')<>18
  or(select count(*)from app.native_mixed_funding_contexts_v1 where scope_id=s.id)<>18
  or(select count(*)from app.native_mixed_funding_obligations_v1 where scope_id=s.id)<>18
  or(select count(*)from app.native_mixed_funding_receipts_v1 where scope_id=s.id)<>18
  or(select count(*)from app.native_mixed_funding_provenance_v1 p join app.native_mixed_funding_contexts_v1 c on c.id=p.context_id where c.scope_id=s.id)<>36
  or(select count(*)from app.native_mixed_funding_operations_v1 o where o.tournament_id=tid and o.event_id=eid and o.action='entry')<>18
  or(select count(*)from app.native_mixed_funding_outcomes_v1 x join app.native_mixed_funding_operations_v1 o on o.actor_id=x.actor_id and o.operation_id=x.operation_id
    where o.tournament_id=tid and o.event_id=eid and o.action='entry')<>18
  or exists(select 1 from app.native_mixed_funding_operations_v1 o where o.tournament_id=tid and o.event_id=eid and o.action='entry'
    and not exists(select 1 from app.native_mixed_funding_contexts_v1 c where c.actor_id=o.actor_id and c.operation_id=o.operation_id and c.scope_id=s.id))
  or exists(select 1 from app.native_mixed_funding_contexts_v1 c where c.scope_id=s.id and not exists(
    select 1 from app.native_mixed_funding_obligations_v1 o where o.context_id=c.id and o.scope_id=s.id))
  or exists(select 1 from app.native_mixed_funding_obligations_v1 o left join app.native_mixed_funding_receipts_v1 r on r.obligation_id=o.id
    where o.scope_id=s.id and(r.id is null or r.amount_minor<>o.amount_minor or o.amount_minor<>s.entry_fee_minor))
  or exists(select 1 from app.native_mixed_funding_obligations_v1 o where o.scope_id=s.id
    and app.native_mixed_funding_entry_bound_v1(o.id)is distinct from true)
  or exists(select 1 from jsonb_array_elements(base->'roster') b where not exists(
    select 1 from app.native_mixed_funding_obligations_v1 o where o.scope_id=s.id
     and o.roster_entry_id=(b->>'rosterEntryId')::uuid and o.participant_id=(b->>'participantId')::uuid
     and o.mode=b->>'mode'and o.profile_id is not distinct from nullif(b->>'profileId','')::uuid))
  or exists(select 1 from app.native_mixed_funding_obligations_v1 o where o.scope_id=s.id and not exists(
    select 1 from jsonb_array_elements(base->'roster') b where o.roster_entry_id=(b->>'rosterEntryId')::uuid
     and o.participant_id=(b->>'participantId')::uuid and o.mode=b->>'mode'
     and o.profile_id is not distinct from nullif(b->>'profileId','')::uuid))
 then return jsonb_build_object('status','blocked','code','complete_simulated_funding_required');end if;
 select jsonb_agg(jsonb_build_object('version',o.version,'rosterEntryId',o.roster_entry_id,'participantId',o.participant_id,'mode',o.mode,'profileId',o.profile_id,'fixedId',null,
  'obligation',jsonb_build_object('obligationId',o.id,'amountMinor',o.amount_minor),'receipt',jsonb_build_object('receiptId',r.id,'amountMinor',r.amount_minor,'currency',r.currency_code,'method',r.method,
   'simulatedReceivedAt',to_char(r.simulated_received_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  'operationId',o.operation_id,'contextId',o.context_id,'sourceDigest',r.source_digest)order by o.roster_entry_id),sum(o.amount_minor),sum(r.amount_minor)
 into entries,obligation_total,receipt_total from app.native_mixed_funding_obligations_v1 o
 join app.native_mixed_funding_receipts_v1 r on r.obligation_id=o.id where o.scope_id=s.id;
 if obligation_total is distinct from s.entry_fee_minor*18 or receipt_total is distinct from obligation_total
 then return jsonb_build_object('status','blocked','code','simulated_totals_mismatch');end if;
 source:=jsonb_build_object('scopeId',s.id,'version',s.version,'admissionIntentId',s.admission_intent_id,'admissionIntentVersion',s.admission_intent_version,
  'admissionSourceDigest',s.admission_source_digest,'operationalBindingId',s.operational_binding_id,'entryFeeMinor',s.entry_fee_minor,
  'participantCount',18,'digitalCount',6,'paperCount',12,'sourceDigest',s.source_digest);
 digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-funding-source-v1',tid,eid,source,entries,obligation_total,receipt_total)::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('status','source_available','kind','native-mixed-funding-source-v1','tournamentId',tid,'eventId',eid,
  'scope',source,'entries',entries,'totals',jsonb_build_object('entryCount',18,'obligationMinor',obligation_total,'receiptMinor',receipt_total),'sourceDigest',digest,
  'optionalPoolSourceAvailable',false,'assessmentSourceAvailable',false,'paidCheckInAuthorized',false,'ordinaryCheckInSource',false,
  'actualMoneyReceived',false,'bankReceiptVerified',false,'moneyMoved',false,'refundAuthorized',false,'payoutAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.native_mixed_funding_source_v1(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$declare v jsonb;begin
 if app.native_mixed_funding_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'
  or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 v:=app.native_mixed_funding_seal_source_v1(tid,eid);
 return case when v is null then null else v||jsonb_build_object('actorId',actor)end;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.get_native_mixed_funding_operation_v1(actor uuid,tid uuid,eid uuid,op uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$declare o app.native_mixed_funding_operations_v1%rowtype;r jsonb;begin
 if app.native_mixed_funding_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 select*into o from app.native_mixed_funding_operations_v1 where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;if not found then return null;end if;
 select result into r from app.native_mixed_funding_outcomes_v1 where actor_id=actor and operation_id=op;
 return case when r is null then null else jsonb_build_object('kind','native-mixed-funding-operation-v1','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'action',o.action,'request',o.request_payload,'receipt',r,'historicalReceipt',true,'currentSourceVerified',false)end;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

do $$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_funding_enabled_v1()'::regprocedure,'app.native_ledger_has_mixed_scope_v1(uuid)'::regprocedure,
 'app.native_mixed_funding_scope_request_valid_v1(jsonb)'::regprocedure,'app.native_mixed_funding_entry_request_valid_v1(jsonb)'::regprocedure,
 'app.lock_native_mixed_funding_sources_v1()'::regprocedure,'app.native_mixed_funding_operation_reserved_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_admission_finance_idle_before_funding_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_admission_finance_idle_v1(uuid,uuid)'::regprocedure,'app.native_mixed_funding_lifecycle_open_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_funding_other_domains_idle_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_admission_operation_reserved_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_funding_scope_bound_v1(uuid)'::regprocedure,'app.native_mixed_funding_entry_bound_v1(uuid)'::regprocedure,
 'app.save_native_mixed_funding_scope_v1(uuid,uuid,uuid,jsonb)'::regprocedure,'app.record_native_mixed_funding_entry_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.native_mixed_funding_seal_source_v1(uuid,uuid)'::regprocedure,'app.native_mixed_funding_source_v1(uuid,uuid,uuid)'::regprocedure,
 'app.get_native_mixed_funding_operation_v1(uuid,uuid,uuid,uuid)'::regprocedure
]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$$;
commit;
