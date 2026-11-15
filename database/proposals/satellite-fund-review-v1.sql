-- UNEXECUTED local bookkeeping candidate; no award/formula/payment authority.
-- Requires native ledger, shared unrestricted-income roots, V1/V2 journals,
-- addon physical-evidence guards and setup official authorization.
begin;
create function app.satellite_finance_enabled_v1()returns boolean language sql immutable set search_path=''as $$select false$$;
create function app.satellite_finance_writes_enabled_v1()returns boolean language sql immutable set search_path=''as $$select false$$;
create function app.satellite_finance_actor_v1(tid uuid)returns uuid language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();j jsonb:=auth.jwt();sid text;begin
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 if a is null or j->>'sub'is distinct from a::text or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),j->>'role','')<>'authenticated'
 or jsonb_typeof(j->'exp')is distinct from'number'or coalesce(j->>'exp','')!~'^[0-9]{1,16}$'then return null;end if;
 if(j->>'exp')::numeric<=extract(epoch from clock_timestamp())then return null;end if;
 sid:=j->>'session_id';if coalesce(sid,'')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return null;end if;
 perform 1 from auth.users where id=a and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp())for share nowait;if not found then return null;end if;
 perform 1 from auth.sessions where id=sid::uuid and user_id=a and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then return null;end if;
 if app.setup_official_is_primary_director_v1(a,tid)is distinct from true then return null;end if;return a;
end$$;
create table app.satellite_income_records_v1(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,version integer not null check(version>0),
 income_id uuid not null,prior_record_id uuid,physical_evidence_id uuid not null,evidence_reference text not null,
 amount_minor bigint not null check(amount_minor between 0 and 9007199254740991),voided boolean not null,
 label text not null,reason text not null,actor_id uuid not null references app.profiles(id),actor_session_id uuid not null,
 operation_receipt_id uuid not null,source_capture jsonb not null,recorded_at timestamptz not null,
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(tournament_id,income_id)references app.native_unrestricted_income_sources_v1(tournament_id,income_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id,version),unique(id,tournament_id,event_id,income_id),
 foreign key(prior_record_id,tournament_id,event_id,income_id)references app.satellite_income_records_v1(id,tournament_id,event_id,income_id),
 check((voided and amount_minor=0)or(not voided and amount_minor>0)),
 check(app.event_settings_js_text_length_v3(label)between 1 and 200 and label=app.custom_payout_classification_text_v2(label)),
 check(app.event_settings_js_text_length_v3(reason)between 1 and 500 and reason=app.custom_payout_classification_text_v2(reason)),
 check(app.event_settings_js_text_length_v3(evidence_reference)between 1 and 500 and evidence_reference=app.custom_payout_classification_text_v2(evidence_reference))
);
create table app.satellite_fund_reviews_v1(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,version integer not null check(version>0),prior_id uuid,
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),source_capture jsonb not null,
 review_status text not null check(review_status in('reviewed_zero','recorded_complete')),reason text not null,
 actor_id uuid not null references app.profiles(id),actor_session_id uuid not null,operation_receipt_id uuid not null,recorded_at timestamptz not null,
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id,version),unique(id,tournament_id,event_id),
 foreign key(prior_id,tournament_id,event_id)references app.satellite_fund_reviews_v1(id,tournament_id,event_id),check((version=1)=(prior_id is null)),
 check(app.event_settings_js_text_length_v3(reason)between 1 and 500 and reason=app.custom_payout_classification_text_v2(reason))
);
do $$declare t text;begin foreach t in array array['satellite_income_records_v1','satellite_fund_reviews_v1']loop
 execute format('alter table app.%I enable row level security',t);execute format('alter table app.%I force row level security',t);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger immutable_history before update or delete on app.%I for each row execute function app.reject_immutable_history()',t);
 execute format('alter table app.%I owner to postgres',t);end loop;end$$;

create function app.guard_satellite_income_domain_v1()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if tg_table_name='satellite_income_records_v1'then
  if exists(select 1 from app.native_unrestricted_income_records_v1 where tournament_id=new.tournament_id and income_id=new.income_id)
  or exists(select 1 from app.native_optional_income_records_v2 where tournament_id=new.tournament_id and income_id=new.income_id)then raise exception'income_journal_domain_conflict';end if;
  if not exists(select 1 from app.native_unrestricted_income_sources_v1 where tournament_id=new.tournament_id and event_id=new.event_id and income_id=new.income_id and physical_evidence_id=new.physical_evidence_id and evidence_reference=new.evidence_reference)then raise exception'income_evidence_owner_mismatch';end if;
 else if exists(select 1 from app.satellite_income_records_v1 where tournament_id=new.tournament_id and income_id=new.income_id)then raise exception'income_journal_domain_conflict';end if;end if;return new;
end$$;
create trigger aa_satellite_income_domain before insert on app.satellite_income_records_v1 for each row execute function app.guard_satellite_income_domain_v1();
create trigger aa_satellite_income_domain before insert on app.native_unrestricted_income_records_v1 for each row execute function app.guard_satellite_income_domain_v1();
create trigger aa_satellite_income_domain before insert on app.native_optional_income_records_v2 for each row execute function app.guard_satellite_income_domain_v1();

-- Reserve evidence after voids and across future receipt/cost/pool/addon writes.
create function app.guard_satellite_shared_physical_v1()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if tg_table_name='native_unrestricted_income_sources_v1'then
  if exists(select 1 from app.roster_payment_events where id=new.physical_evidence_id)or exists(select 1 from app.tournament_expense_events where id=new.physical_evidence_id)
  or exists(select 1 from app.event_side_pool_election_versions where id=new.physical_evidence_id)or exists(select 1 from app.event_side_pool_team_election_versions where id=new.physical_evidence_id)
  or exists(select 1 from app.q_pool_membership_versions_v1 where id=new.physical_evidence_id)or exists(select 1 from app.q_pool_allocation_versions_v1 where id=new.physical_evidence_id)
  or exists(select 1 from app.consy_addon_receipts_v1 where id=new.physical_evidence_id)then raise exception'income_physical_identity_conflict';end if;
 else if exists(select 1 from app.native_unrestricted_income_sources_v1 where physical_evidence_id=new.id)then raise exception'income_physical_identity_conflict';end if;end if;return new;
end$$;
do $$declare t text;begin foreach t in array array['native_unrestricted_income_sources_v1','roster_payment_events','tournament_expense_events','event_side_pool_election_versions','event_side_pool_team_election_versions','q_pool_membership_versions_v1','q_pool_allocation_versions_v1','consy_addon_receipts_v1']loop
 execute format('create trigger aa_satellite_physical_reservation before insert on app.%I for each row execute function app.guard_satellite_shared_physical_v1()',t);end loop;end$$;

create function app.satellite_fund_source_v1(tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;allocation jsonb;activation jsonb;records jsonb;head_version integer;income numeric;entry numeric;benefits numeric;costs numeric;body jsonb;review app.satellite_fund_reviews_v1%rowtype;begin
 if app.satellite_finance_enabled_v1()is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 actor:=app.satellite_finance_actor_v1(tid);if actor is null then return null;end if;
 allocation:=app.get_native_ledger_allocation_v1(tid);if allocation->>'status'is distinct from'current'then return null;end if;
 lock table app.satellite_income_records_v1,app.satellite_fund_reviews_v1,app.native_unrestricted_income_sources_v1,
 app.native_unrestricted_income_records_v1,app.native_optional_income_records_v2,app.consy_addon_receipts_v1,app.q_pool_membership_versions_v1,app.q_pool_allocation_versions_v1 in share mode nowait;
 select jsonb_build_object('activationId',a.id,'setupEventVersionId',a.setup_event_version_id,'setupRevisionId',a.setup_revision_id)
 into activation from app.tournament_setup_activations a join app.events e on e.id=a.event_id and e.tournament_id=a.tournament_id
 where a.tournament_id=tid and a.event_id=eid and e.event_type='satellite'and e.format='standard_singles'and e.operational_state='active';if activation is null then return null;end if;
 if app.native_optional_income_physical_conflict_v2(tid)or exists(select 1 from app.native_unrestricted_income_sources_v1 r join app.q_pool_membership_versions_v1 q on q.id=r.physical_evidence_id where r.tournament_id=tid)or exists(select 1 from app.native_unrestricted_income_sources_v1 r join app.q_pool_allocation_versions_v1 q on q.id=r.physical_evidence_id where r.tournament_id=tid)or exists(select 1 from app.native_unrestricted_income_sources_v1 r join app.consy_addon_receipts_v1 c on c.id=r.physical_evidence_id where r.tournament_id=tid)then return null;end if;
 -- No legacy/V2 journal is silently absorbed into the new Satellite domain.
 if exists(select 1 from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid)
 or exists(select 1 from app.native_optional_income_records_v2 where tournament_id=tid and event_id=eid)then return null;end if;
 if exists(select 1 from app.native_unrestricted_income_sources_v1 r where r.tournament_id=tid and r.event_id=eid and not exists(select 1 from app.satellite_income_records_v1 h where h.tournament_id=r.tournament_id and h.event_id=r.event_id and h.income_id=r.income_id))then return null;end if;
 if(select count(*)from app.satellite_income_records_v1 where tournament_id=tid and event_id=eid)>10000 then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'incomeId',r.income_id,'priorRecordId',r.prior_record_id,'physicalEvidenceId',r.physical_evidence_id,'evidenceReference',r.evidence_reference,'amountMinor',r.amount_minor,'voided',r.voided,'label',r.label,'reason',r.reason,'recordedBy',r.actor_id,'recordedAt',r.recorded_at)order by r.version),'[]'),coalesce(max(r.version),0)into records,head_version from app.satellite_income_records_v1 r where r.tournament_id=tid and r.event_id=eid;
 select coalesce(sum(h.amount_minor)filter(where not h.voided),0)into income from(select distinct on(income_id)*from app.satellite_income_records_v1 where tournament_id=tid and event_id=eid order by income_id,version desc)h;
 select coalesce(sum((p.value->>'amountMinor')::numeric)filter(where p.value->>'bucket'='regular_entry'),0),coalesce(sum((p.value->>'amountMinor')::numeric)filter(where p.value->>'bucket'='player_benefit'),0),coalesce(sum((p.value->>'amountMinor')::numeric)filter(where p.value->>'bucket'='operating_expense'),0)
 into entry,benefits,costs from jsonb_array_elements(allocation#>'{snapshot,sources}')s(value)cross join lateral jsonb_array_elements(s.value->'allocations')p(value)where s.value->>'state'='active'and p.value->>'eventId'=eid::text;
 if greatest(entry,benefits,costs,income,abs(entry-benefits-costs+income))>9007199254740991 then return null;end if;
 body:=jsonb_build_object('activation',activation,'allocation',allocation,'incomeHeadVersion',head_version,'incomeRecords',records,'totals',jsonb_build_object('regularEntryMinor',entry,'benefitMinor',benefits,'expenseMinor',costs,'additionalIncomeMinor',income,'fundMinor',entry-benefits-costs+income));
 select*into review from app.satellite_fund_reviews_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 return jsonb_build_object('kind','satellite-fund-source-v1','actorId',actor,'tournamentId',tid,'eventId',eid,'capture',body,
 'sourceDigest',encode(extensions.digest(convert_to(jsonb_build_array('satellite-fund-source-v1',actor,tid,eid,body)::text,'utf8'),'sha256'),'hex'),
 'reviewHeadVersion',coalesce(review.version,0),'latestReview',case when review.id is null then null else jsonb_build_object('id',review.id,'version',review.version,'sourceDigest',review.source_digest,'status',review.review_status,'reason',review.reason,'recordedBy',review.actor_id,'recordedAt',review.recorded_at)end,
 'bankReceiptVerified',false,'moneyMoved',false,'payoutAuthorized',false);
end$$;

create function public.get_satellite_fund_source_v1(p_tournament_id uuid,p_event_id uuid)returns jsonb language sql volatile security definer set search_path=''set timezone='UTC'as $$select app.satellite_fund_source_v1(p_tournament_id,p_event_id)$$;
create function public.get_satellite_finance_access_v1(p_tournament_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$declare a uuid;begin
 if app.satellite_finance_enabled_v1()is distinct from true then return null;end if;
 a:=app.satellite_finance_actor_v1(p_tournament_id);if a is null then return null;end if;
 return jsonb_build_object('actorId',a,'sessionId',auth.jwt()->>'session_id','tournamentId',p_tournament_id,'primaryDirector',true);
end$$;
create function app.satellite_finance_request_valid_v1(r jsonb)returns boolean language plpgsql immutable set search_path=''as $$declare k text;n numeric;begin
 if jsonb_typeof(r)is distinct from'object'or octet_length(r::text)>12000 or r->'confirmed'is distinct from'true'::jsonb or coalesce(r->>'action','')not in('income','review')or jsonb_typeof(r->'sourceDigest')is distinct from'string'or coalesce(r->>'sourceDigest','')!~'^[a-f0-9]{64}$'then return false;end if;
 foreach k in array array['incomeHeadVersion','reviewHeadVersion']loop if jsonb_typeof(r->k)is distinct from'number'or coalesce(r->>k,'')!~'^(0|[1-9][0-9]{0,9})$'then return false;end if;n:=(r->>k)::numeric;if n>(case when k='incomeHeadVersion'then 10000 else 2147483646 end)then return false;end if;end loop;
 if jsonb_typeof(r->'reason')is distinct from'string'or app.event_settings_js_text_length_v3(r->>'reason')not between 1 and 500 or r->>'reason'<>app.custom_payout_classification_text_v2(r->>'reason')or r->>'reason'~'[[:cntrl:]]'then return false;end if;
 if r->>'action'='review'then return(select count(*)from jsonb_object_keys(r))=7 and r?&array['action','sourceDigest','incomeHeadVersion','reviewHeadVersion','reason','confirmed','status']and coalesce(r->>'status','')in('reviewed_zero','recorded_complete');end if;
 if(select count(*)from jsonb_object_keys(r))<>13 or not(r?&array['action','sourceDigest','incomeHeadVersion','reviewHeadVersion','reason','confirmed','incomeId','priorRecordId','physicalEvidenceId','evidenceReference','amountMinor','voided','label'])then return false;end if;
 foreach k in array array['incomeId','physicalEvidenceId']loop if coalesce(r->>k,'')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return false;end if;end loop;
 if r->'priorRecordId'<>'null'::jsonb and coalesce(r->>'priorRecordId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return false;end if;
 foreach k in array array['label','evidenceReference']loop if jsonb_typeof(r->k)is distinct from'string'or app.event_settings_js_text_length_v3(r->>k)not between 1 and(case when k='label'then 200 else 500 end)or r->>k<>app.custom_payout_classification_text_v2(r->>k)or r->>k~'[[:cntrl:]]'then return false;end if;end loop;
 if jsonb_typeof(r->'amountMinor')is distinct from'number'or coalesce(r->>'amountMinor','')!~'^(0|[1-9][0-9]{0,15})$'or(r->>'amountMinor')::numeric>9007199254740991 or jsonb_typeof(r->'voided')is distinct from'boolean'then return false;end if;
 return case when(r->>'voided')::boolean then r->'amountMinor'='0'::jsonb and r->'priorRecordId'<>'null'::jsonb else(r->>'amountMinor')::numeric>0 end;
end$$;
-- Writer and source both reserve the tournament before the same source locks.
create function public.record_satellite_finance_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;old app.operation_receipts%rowtype;source jsonb;root app.native_unrestricted_income_sources_v1%rowtype;prior app.satellite_income_records_v1%rowtype;
 review app.satellite_fund_reviews_v1%rowtype;receipt uuid;rid uuid;h text;reply jsonb;line uuid;physical uuid;k text;amount numeric;is_void boolean;begin
 if app.satellite_finance_enabled_v1()is distinct from true or app.satellite_finance_writes_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','blocked','code','isolation_not_supported');end if;
 actor:=app.satellite_finance_actor_v1(tid);if actor is null then return jsonb_build_object('status','blocked','code','not_authorized');end if;
 if app.satellite_finance_request_valid_v1(request)is distinct from true then return jsonb_build_object('status','blocked','code','invalid_request');end if;
 if op is null or jsonb_typeof(request)is distinct from'object'or octet_length(request::text)>12000 or request->'confirmed'is distinct from'true'::jsonb or coalesce(request->>'action','')not in('income','review')then return jsonb_build_object('status','blocked','code','invalid_request');end if;
 if jsonb_typeof(request->'sourceDigest')is distinct from'string'or coalesce(request->>'sourceDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'incomeHeadVersion','')!~'^(0|[1-9][0-9]{0,9})$'or coalesce(request->>'reviewHeadVersion','')!~'^(0|[1-9][0-9]{0,9})$'then return jsonb_build_object('status','blocked','code','invalid_request');end if;
 foreach k in array array['reason']loop if jsonb_typeof(request->k)is distinct from'string'or app.event_settings_js_text_length_v3(request->>k)not between 1 and 500 or request->>k<>app.custom_payout_classification_text_v2(request->>k)or request->>k~'[[:cntrl:]]'then return jsonb_build_object('status','blocked','code','invalid_request');end if;end loop;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0));
 h:=encode(extensions.digest(convert_to(jsonb_build_array('satellite-finance-v1',tid,eid,request)::text,'utf8'),'sha256'),'hex');
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if old.tournament_id=tid and old.target_id=eid and old.operation_type='satellite_finance_v1'and old.request_hash=h then return old.response_payload;end if;return jsonb_build_object('status','blocked','code','operation_conflict');end if;
 perform 1 from app.tournaments where id=tid for update nowait;
 lock table app.satellite_income_records_v1,app.satellite_fund_reviews_v1 in share row exclusive mode nowait;
 source:=app.satellite_fund_source_v1(tid,eid);if source is null or source->>'sourceDigest'is distinct from request->>'sourceDigest'or source#>'{capture,incomeHeadVersion}'is distinct from request->'incomeHeadVersion'or source->'reviewHeadVersion'is distinct from request->'reviewHeadVersion'then return jsonb_build_object('status','blocked','code','source_changed');end if;
 if(request->>'reviewHeadVersion')::numeric>=2147483646 or(request->>'action'='income'and(request->>'incomeHeadVersion')::numeric>=10000)then return jsonb_build_object('status','blocked','code','technical_history_bound');end if;
 receipt:=extensions.gen_random_uuid();rid:=extensions.gen_random_uuid();
 if request->>'action'='income'then
  if(select count(*)from jsonb_object_keys(request))<>13 or not(request?&array['action','sourceDigest','incomeHeadVersion','reviewHeadVersion','reason','confirmed','incomeId','priorRecordId','physicalEvidenceId','evidenceReference','amountMinor','voided','label'])then return jsonb_build_object('status','blocked','code','invalid_request');end if;
  foreach k in array array['incomeId','physicalEvidenceId']loop if coalesce(request->>k,'')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return jsonb_build_object('status','blocked','code','invalid_request');end if;end loop;
  if request->'priorRecordId'<>'null'::jsonb and coalesce(request->>'priorRecordId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return jsonb_build_object('status','blocked','code','invalid_request');end if;
  foreach k in array array['label','evidenceReference']loop if jsonb_typeof(request->k)is distinct from'string'or app.event_settings_js_text_length_v3(request->>k)not between 1 and(case when k='label'then 200 else 500 end)or request->>k<>app.custom_payout_classification_text_v2(request->>k)or request->>k~'[[:cntrl:]]'then return jsonb_build_object('status','blocked','code','invalid_request');end if;end loop;
  if jsonb_typeof(request->'amountMinor')is distinct from'number'or(request->>'amountMinor')!~'^(0|[1-9][0-9]{0,15})$'or(request->>'amountMinor')::numeric>9007199254740991 or jsonb_typeof(request->'voided')is distinct from'boolean'then return jsonb_build_object('status','blocked','code','invalid_request');end if;
  amount:=(request->>'amountMinor')::numeric;is_void:=(request->>'voided')::boolean;if(is_void and amount<>0)or(not is_void and amount=0)then return jsonb_build_object('status','blocked','code','invalid_request');end if;
  line:=(request->>'incomeId')::uuid;physical:=(request->>'physicalEvidenceId')::uuid;
  select*into prior from app.satellite_income_records_v1 where tournament_id=tid and event_id=eid and income_id=line order by version desc limit 1;
  if prior.id is distinct from(request->>'priorRecordId')::uuid or(prior.id is null and is_void)then return jsonb_build_object('status','blocked','code','income_head_changed');end if;
  if is_void and prior.voided then return jsonb_build_object('status','blocked','code','income_already_voided');end if;
  select*into root from app.native_unrestricted_income_sources_v1 where tournament_id=tid and income_id=line;
  if root.income_id is null then
   if prior.id is not null or exists(select 1 from app.native_unrestricted_income_sources_v1 where tournament_id=tid and(physical_evidence_id=physical or lower(evidence_reference)=lower(request->>'evidenceReference')))
   or exists(select 1 from app.roster_payment_events where id=physical)or exists(select 1 from app.tournament_expense_events where id=physical)
   or exists(select 1 from app.event_side_pool_election_versions where id=physical)or exists(select 1 from app.event_side_pool_team_election_versions where id=physical)
   or exists(select 1 from app.q_pool_membership_versions_v1 where id=physical)or exists(select 1 from app.q_pool_allocation_versions_v1 where id=physical)
   or exists(select 1 from app.consy_addon_receipts_v1 where id=physical)then return jsonb_build_object('status','blocked','code','physical_evidence_conflict');end if;
   insert into app.native_unrestricted_income_sources_v1(tournament_id,event_id,income_id,physical_evidence_id,evidence_reference,created_by)values(tid,eid,line,physical,request->>'evidenceReference',actor);
  elsif root.event_id<>eid or root.physical_evidence_id<>physical or root.evidence_reference<>request->>'evidenceReference'then return jsonb_build_object('status','blocked','code','income_owner_changed');end if;
 else
  if(select count(*)from jsonb_object_keys(request))<>7 or not(request?&array['action','sourceDigest','incomeHeadVersion','reviewHeadVersion','reason','confirmed','status'])or request->>'status'is distinct from(case when(source#>>'{capture,totals,additionalIncomeMinor}')::numeric=0 then'reviewed_zero'else'recorded_complete'end)then return jsonb_build_object('status','blocked','code','invalid_request');end if;
  if(source#>>'{capture,totals,fundMinor}')::numeric<0 then return jsonb_build_object('status','blocked','code','recorded_costs_exceed_fund');end if;
 end if;
 if app.satellite_finance_actor_v1(tid)is distinct from actor then raise exception'authorization_changed';end if;
 reply:=jsonb_build_object('status','satellite_finance_recorded','action',request->>'action','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'recordId',rid,'sourceDigest',request->>'sourceDigest','request',request,'historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false,'payoutAuthorized',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,tid,actor,'satellite_finance_v1',eid,h,op,'accepted',reply,clock_timestamp());
 if request->>'action'='income'then
  insert into app.satellite_income_records_v1 values(rid,tid,eid,(request->>'incomeHeadVersion')::integer+1,line,prior.id,physical,request->>'evidenceReference',amount,is_void,request->>'label',request->>'reason',actor,(auth.jwt()->>'session_id')::uuid,receipt,source,clock_timestamp());
 else
  select*into review from app.satellite_fund_reviews_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
  insert into app.satellite_fund_reviews_v1 values(rid,tid,eid,(request->>'reviewHeadVersion')::integer+1,review.id,request->>'sourceDigest',source,request->>'status',request->>'reason',actor,(auth.jwt()->>'session_id')::uuid,receipt,clock_timestamp());
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,receipt,'satellite_finance',rid,'recorded_bookkeeping_only',jsonb_build_object('request',request,'sourceDigest',request->>'sourceDigest','bankReceiptVerified',false,'moneyMoved',false));return reply;
end$$;
-- Explicit retirement fences an uncommitted original nonce. If the record
-- actually committed, return its accepted proof instead of claiming retirement.
create function public.close_satellite_finance_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;old app.operation_receipts%rowtype;h text;receipt uuid;reply jsonb;begin
 if app.satellite_finance_enabled_v1()is distinct from true or app.satellite_finance_writes_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','blocked','code','isolation_not_supported');end if;
 actor:=app.satellite_finance_actor_v1(tid);if actor is null then return jsonb_build_object('status','blocked','code','not_authorized');end if;
 if op is null or app.satellite_finance_request_valid_v1(request)is distinct from true then return jsonb_build_object('status','blocked','code','invalid_request');end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0));
 h:=encode(extensions.digest(convert_to(jsonb_build_array('satellite-finance-v1',tid,eid,request)::text,'utf8'),'sha256'),'hex');
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if old.tournament_id=tid and old.target_id=eid and old.operation_type='satellite_finance_v1'and old.request_hash=h then return old.response_payload;end if;return jsonb_build_object('status','blocked','code','operation_conflict');end if;
 perform 1 from app.tournaments where id=tid for update nowait;
 perform 1 from app.events where id=eid and tournament_id=tid and event_type='satellite'for share nowait;if not found then return jsonb_build_object('status','blocked','code','event_unavailable');end if;
 if app.satellite_finance_actor_v1(tid)is distinct from actor then raise exception'authorization_changed';end if;
 receipt:=extensions.gen_random_uuid();reply:=jsonb_build_object('status','satellite_finance_closed','action',request->>'action','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'recordId',receipt,'sourceDigest',request->>'sourceDigest','request',request,'historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false,'payoutAuthorized',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,tid,actor,'satellite_finance_v1',eid,h,op,'rejected',reply,clock_timestamp());
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,receipt,'satellite_finance',receipt,'explicitly_retired_uncommitted_request',jsonb_build_object('request',request,'operationId',op,'moneyMoved',false));return reply;
end$$;
-- Read-only recovery works while new writes are paused. Not-found is never
-- cancellation proof: an earlier request may still commit after this read.
create function public.get_satellite_finance_operation_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;old app.operation_receipts%rowtype;h text;begin
 if app.satellite_finance_enabled_v1()is distinct from true then return null;end if;
 actor:=app.satellite_finance_actor_v1(tid);if actor is null then return null;end if;
 if op is null or app.satellite_finance_request_valid_v1(request)is distinct from true then return jsonb_build_object('status','blocked','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('satellite-finance-v1',tid,eid,request)::text,'utf8'),'sha256'),'hex');
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if not found then return jsonb_build_object('status','blocked','code','committed_proof_not_found');end if;
 if old.tournament_id=tid and old.target_id=eid and old.operation_type='satellite_finance_v1'and old.request_hash=h then return old.response_payload;end if;
 return jsonb_build_object('status','blocked','code','operation_conflict');
end$$;
do $$declare p regprocedure;begin foreach p in array array[
 'app.satellite_finance_enabled_v1()'::regprocedure,'app.satellite_finance_writes_enabled_v1()'::regprocedure,'app.satellite_finance_actor_v1(uuid)'::regprocedure,'app.guard_satellite_income_domain_v1()'::regprocedure,'app.guard_satellite_shared_physical_v1()'::regprocedure,'app.satellite_finance_request_valid_v1(jsonb)'::regprocedure,
 'app.satellite_fund_source_v1(uuid,uuid)'::regprocedure,'public.get_satellite_fund_source_v1(uuid,uuid)'::regprocedure,'public.get_satellite_finance_access_v1(uuid)'::regprocedure,'public.record_satellite_finance_v1(uuid,uuid,uuid,jsonb)'::regprocedure,'public.close_satellite_finance_v1(uuid,uuid,uuid,jsonb)'::regprocedure,'public.get_satellite_finance_operation_v1(uuid,uuid,uuid,jsonb)'::regprocedure]loop
 execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$$;
commit;
