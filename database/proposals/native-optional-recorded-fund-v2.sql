-- PRIVATE UNEXECUTED CANDIDATE. Reviewed-zero bookkeeping source and review.
-- Depends on native-optional-playoff-source-v2 and native-optional-regular-awards-v2.
-- No final liability writer, bank verification, payout or public grants.
begin;
create function app.native_optional_recorded_fund_enabled_v2()returns boolean
language sql immutable set search_path=''as $$select false$$;

create table app.native_optional_fund_operations_v2(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 request_payload jsonb not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-fund-review-v2',actor_id,operation_id,tournament_id,event_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.native_optional_fund_reviews_v2(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version between 1 and 2147483647),prior_review_id uuid,
 proposal_revision_id uuid not null,ownership_revision_id uuid not null,
 sanctioning_snapshot_id uuid not null,sanctioning_expense_event_id uuid,sanctioning_allocated_minor bigint not null check(sanctioning_allocated_minor between 0 and 9007199254740991),
 review_status text not null check(review_status='reviewed_zero'),source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),source_capture jsonb not null,
 reason text not null,actor_id uuid not null,operation_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,version),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(prior_review_id,tournament_id,event_id)references app.native_optional_fund_reviews_v2(id,tournament_id,event_id),
 foreign key(proposal_revision_id,tournament_id,event_id)references app.native_optional_finance_revisions_v2(id,tournament_id,event_id),
 foreign key(ownership_revision_id,tournament_id,event_id)references app.native_optional_pool_ownership_revisions_v2(id,tournament_id,event_id),
 foreign key(sanctioning_snapshot_id,tournament_id,event_id)references app.event_sanctioning_fee_snapshots(id,tournament_id,event_id),
 foreign key(sanctioning_expense_event_id)references app.tournament_expense_events(id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_optional_fund_operations_v2(actor_id,operation_id,tournament_id,event_id),
 check(reason=app.custom_payout_classification_text_v2(reason)and app.event_settings_js_text_length_v3(reason)between 1 and 2000),
 check((sanctioning_expense_event_id is null and sanctioning_allocated_minor=0)or(sanctioning_expense_event_id is not null and sanctioning_allocated_minor>0))
);
create table app.native_optional_fund_outcomes_v2(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_optional_fund_operations_v2(actor_id,operation_id,tournament_id,event_id)
);
do $$declare n text;begin foreach n in array array['native_optional_fund_operations_v2','native_optional_fund_reviews_v2','native_optional_fund_outcomes_v2']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;

-- Real V2 ownership classifications, never an invented V1 allocation identity.
create function app.native_optional_sanctioning_coverage_v2(tid uuid,eid uuid,ownership_id uuid,requested_expense_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare snap app.event_sanctioning_fee_snapshots%rowtype;started app.event_play_starts%rowtype;
 ownership app.native_optional_pool_ownership_revisions_v2%rowtype;operation app.native_optional_pool_ownership_operations_v2%rowtype;
 expense app.tournament_expense_events%rowtype;amount numeric;matches integer;
begin
 lock table app.event_play_starts,app.event_sanctioning_fee_snapshots,app.tournament_expense_events,
  app.native_optional_pool_ownership_operations_v2,app.native_optional_pool_ownership_revisions_v2,
  app.native_recorded_fund_reviews_v1,app.native_optional_fund_reviews_v2,app.event_settlement_finals_v2,app.event_settlement_drafts_v5 in share mode nowait;
 select*into started from app.event_play_starts where tournament_id=tid and event_id=eid;
 select*into snap from app.event_sanctioning_fee_snapshots where tournament_id=tid and event_id=eid;
 if started.id is null or snap.id is null or snap.event_play_start_id is distinct from started.id
  or snap.eligible_participant_count is distinct from started.participant_count
  or not exists(select 1 from app.events e where e.id=eid and e.tournament_id=tid and e.event_type=snap.event_kind)
  or snap.rate_cents::numeric*snap.eligible_participant_count is distinct from snap.total_cents::numeric
 then return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');end if;
 if snap.total_cents=0 then
  if requested_expense_id is not null then return jsonb_build_object('status','blocked','code','sanctioning_expense_unexpected');end if;
  return jsonb_build_object('status','available','snapshotId',snap.id,'eventPlayStartId',started.id,'rateMinor',snap.rate_cents,'eligibleParticipantCount',snap.eligible_participant_count,'totalMinor',0,'expenseSourceId',null,'allocatedExpenseMinor',0);
 end if;
 if requested_expense_id is null then return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');end if;
 select*into ownership from app.native_optional_pool_ownership_revisions_v2 where id=ownership_id and tournament_id=tid and event_id=eid;
 if ownership.id is null or exists(select 1 from app.native_optional_pool_ownership_revisions_v2 x where x.tournament_id=tid and x.event_id=eid and x.version>ownership.version)then return jsonb_build_object('status','blocked','code','ownership_source_changed');end if;
 select*into operation from app.native_optional_pool_ownership_operations_v2 where actor_id=ownership.actor_id and operation_id=ownership.operation_id and tournament_id=tid and event_id=eid;
 select*into expense from app.tournament_expense_events x where x.id=requested_expense_id and x.tournament_id=tid and x.event_type='recorded'
  and not exists(select 1 from app.tournament_expense_events newer where newer.expense_id=x.expense_id and newer.version>x.version);
 if operation.operation_id is null or expense.id is null then return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');end if;
 select count(*)into matches from jsonb_array_elements(operation.request_payload->'costClassifications')c
  where c->>'expenseEventId'=requested_expense_id::text and c->>'category'in('player_benefit','operating_expense');
 select(x->>'amountMinor')::numeric into amount from jsonb_array_elements(ownership.source_capture#>'{capture,basis,expenses}')x where x->>'expenseEventId'=requested_expense_id::text;
 if matches<>1 or amount is distinct from expense.amount_minor::numeric or amount<snap.total_cents or amount>9007199254740991
 then return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');end if;
 if exists(select 1 from app.native_recorded_fund_reviews_v1 r where r.tournament_id=tid and r.event_id<>eid and r.sanctioning_expense_event_id=requested_expense_id)
  or exists(select 1 from app.native_optional_fund_reviews_v2 r where r.tournament_id=tid and r.event_id<>eid and r.sanctioning_expense_event_id=requested_expense_id)
  or exists(select 1 from app.event_settlement_finals_v2 f join app.event_settlement_drafts_v5 d on d.id=f.draft_id where f.tournament_id=tid and d.sanctioning_expense_event_id=requested_expense_id)
 then return jsonb_build_object('status','blocked','code','sanctioning_expense_reused');end if;
 return jsonb_build_object('status','available','snapshotId',snap.id,'eventPlayStartId',started.id,'rateMinor',snap.rate_cents,'eligibleParticipantCount',snap.eligible_participant_count,'totalMinor',snap.total_cents,'expenseSourceId',requested_expense_id,'allocatedExpenseMinor',amount::bigint);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');
end$$;

create function app.native_optional_recorded_fund_source_v2(actor uuid,tid uuid,eid uuid,sanction_expense_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare recipient jsonb;finance jsonb;editor jsonb;funds jsonb;sanction jsonb;regular jsonb;capture_value jsonb;digest text;
 ownership_id uuid;proposal_id uuid;p jsonb;r jsonb;pot jsonb;annex jsonb:='[]';participants uuid[];pool_ids text[]:='{}';key text;
 amount numeric;sum_minor numeric;regular_minor numeric;qminor numeric:=0;sminor numeric:=0;cost_minor numeric:=0;optional_final_exists boolean:=false;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if app.native_optional_recorded_fund_enabled_v2()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 recipient:=app.get_native_optional_playoff_source_v2(actor,tid,eid);
 if recipient is null or recipient->>'status'is distinct from'source_available'then return recipient;end if;
 -- The final-writer candidate is installed later; absence is not a claim that
 -- finalization exists. Once installed, historical sets close fresh fund reads.
 if to_regclass('app.native_optional_final_award_sets_v2')is not null then
  execute 'select exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=$1 and event_id=$2)'into optional_final_exists using tid,eid;
  if optional_final_exists then return jsonb_build_object('status','blocked','code','final_awards_already_recorded');end if;
 end if;

 lock table app.native_unrestricted_income_sources_v1,app.native_unrestricted_income_records_v1,
  app.native_playoff_final_award_sets_v1,app.native_optional_fund_operations_v2,app.native_optional_fund_reviews_v2,app.native_optional_fund_outcomes_v2 in share mode nowait;
 if app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)
 then return jsonb_build_object('status','blocked','code','existing_financial_liability');end if;
 -- This bounded version supports explicitly reviewed zero additional income only.
 if exists(select 1 from app.native_unrestricted_income_sources_v1 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid)
 then return jsonb_build_object('status','blocked','code','additional_income_source_unsupported');end if;
 finance:=recipient->'nativeFinanceSource';editor:=recipient#>'{proposal,editor}';
 ownership_id:=(recipient#>>'{proposal,ownershipRevisionId}')::uuid;proposal_id:=(recipient#>>'{proposal,revisionId}')::uuid;
 if editor->'history'is distinct from editor#>'{basis,history}'or editor->'lineForm'is distinct from'null'::jsonb or editor->'bandForm'is distinct from'null'::jsonb
 then return jsonb_build_object('status','blocked','code','unrecorded_finance_edit');end if;
 funds:=finance#>'{raw,ownershipSource,funds}';
 if jsonb_typeof(funds)is distinct from'object'then return jsonb_build_object('status','blocked','code','ownership_source_changed');end if;
 for r in select value from jsonb_array_elements(editor#>'{basis,history}')loop
  if r#>>'{line,category}'in('player_benefit','operating_expense')then cost_minor:=cost_minor+(r#>>'{line,amountMinor}')::numeric;
  elsif r#>>'{line,category}'not in('q_pool_fund','side_pool_fund')then return jsonb_build_object('status','blocked','code','additional_income_source_unsupported');end if;
 end loop;
 regular_minor:=(funds->>'regularReceiptsMinor')::numeric-cost_minor;
 if regular_minor<0 or regular_minor>9007199254740991 then return jsonb_build_object('status','blocked','code','recorded_fund_invalid');end if;
 -- Preserve exact current reviewed Q awards and Side paid-card awards separately.
 for p in select value from jsonb_array_elements(finance#>'{raw,ownershipSource,capture,qSource,obligations}')loop
  key:='q:'||(p->>'poolVersionId');sum_minor:=0;participants:='{}';
  if p->>'kind'is distinct from'award'or p->>'status'is distinct from'unpaid'or key=any(pool_ids)or jsonb_typeof(p->'rows')is distinct from'array'or jsonb_array_length(p->'rows')=0 then return jsonb_build_object('status','blocked','code','optional_awards_unresolved');end if;
  pool_ids:=array_append(pool_ids,key);
  for r in select value from jsonb_array_elements(p->'rows')loop
   amount:=(r->>'amountMinor')::numeric;
   if amount<=0 or amount<>trunc(amount)or mod(amount,500)<>0 or amount>9007199254740991 or(r->>'participantId')::uuid=any(participants)
    or not exists(select 1 from app.event_participants ep where ep.id=(r->>'participantId')::uuid and ep.event_id=eid and ep.tournament_id=tid)
   then return jsonb_build_object('status','blocked','code','optional_awards_unresolved');end if;
   participants:=array_append(participants,(r->>'participantId')::uuid);sum_minor:=sum_minor+amount;
  end loop;
  if sum_minor is distinct from(p->>'fundMinor')::numeric then return jsonb_build_object('status','blocked','code','optional_fund_imbalance');end if;
  qminor:=qminor+sum_minor;
  annex:=annex||jsonb_build_array(jsonb_build_object('kind','q','poolId',p->'poolVersionId','policyId',p->'policyId','sourceDigest',finance#>'{raw,ownershipSource,capture,qSource,sourceDigest}',
   'reviewId',finance#>'{raw,ownershipSource,capture,qReview,id}','fundMinor',sum_minor::bigint,'rows',p->'rows','status','unpaid'));
 end loop;
 for pot in select value from jsonb_array_elements(finance#>'{raw,ownershipSource,capture,sideBasis,manifest}')loop
  p:=pot->'source';key:='side:'||(p->>'poolId');sum_minor:=0;participants:='{}';
  if key=any(pool_ids)or jsonb_typeof(p->'obligations')is distinct from'array'or jsonb_array_length(p->'obligations')=0
   or pot#>>'{review,source_digest}'is distinct from p->>'sourceDigest'or pot#>'{review,obligations}'is distinct from p->'obligations'
  then return jsonb_build_object('status','blocked','code','optional_awards_unresolved');end if;
  pool_ids:=array_append(pool_ids,key);
  for r in select value from jsonb_array_elements(p->'obligations')loop
   amount:=(r->>'amountMinor')::numeric;
   if r->>'status'is distinct from'unpaid'or amount<=0 or amount<>trunc(amount)or mod(amount,500)<>0 or amount>9007199254740991 or(r->>'participantId')::uuid=any(participants)
    or not exists(select 1 from app.event_participants ep where ep.id=(r->>'participantId')::uuid and ep.event_id=eid and ep.tournament_id=tid)
   then return jsonb_build_object('status','blocked','code','optional_awards_unresolved');end if;
   participants:=array_append(participants,(r->>'participantId')::uuid);sum_minor:=sum_minor+amount;
  end loop;
  if sum_minor is distinct from(p->>'fundMinor')::numeric then return jsonb_build_object('status','blocked','code','optional_fund_imbalance');end if;
  sminor:=sminor+sum_minor;
  annex:=annex||jsonb_build_array(jsonb_build_object('kind','side','poolId',p->'poolId','sourceDigest',p->'sourceDigest','reviewId',pot#>'{review,id}','fundMinor',sum_minor::bigint,'rows',p->'obligations','status','unpaid'));
 end loop;
 if qminor is distinct from(funds->>'qReceiptsMinor')::numeric or sminor is distinct from(funds->>'sideReceiptsMinor')::numeric
  or regular_minor+cost_minor+qminor+sminor is distinct from(funds->>'recordedReceiptsMinor')::numeric
 then return jsonb_build_object('status','blocked','code','optional_fund_imbalance');end if;
 sanction:=app.native_optional_sanctioning_coverage_v2(tid,eid,ownership_id,sanction_expense_id);
 if sanction->>'status'is distinct from'available'then return sanction;end if;
 regular:=app.native_optional_regular_awards_v2(recipient,editor,regular_minor);
 capture_value:=jsonb_build_object('kind','native-optional-recorded-fund-source-v2','actorId',actor,'tournamentId',tid,'eventId',eid,
  'recipientSource',recipient,'proposalRevisionId',proposal_id,'ownershipRevisionId',ownership_id,'sanctioning',sanction-'status',
  'incomeEvidence',jsonb_build_object('kind','explicit-zero-review-required-v2','journalHeadVersion',0,'records','[]'::jsonb,'proposalIncomeMinor',0),
  'funds',jsonb_build_object('regularReceiptsMinor',funds->'regularReceiptsMinor','regularCostMinor',cost_minor::bigint,'regularFundMinor',regular_minor::bigint,
   'qFundMinor',qminor::bigint,'sideFundMinor',sminor::bigint,'recordedReceiptsMinor',funds->'recordedReceiptsMinor'),
  'regularProjection',regular,'optionalPools',annex,'refundPolicy','no-pool-refunds-v1');
 digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-recorded-fund-source-v2',capture_value)::text,'utf8'),'sha256'),'hex');
 return capture_value||jsonb_build_object('status','source_available','sourceDigest',digest,'recordedFundComplete',false,'proposalOnly',true,'bankReceiptVerified',false,'moneyMoved',false,'payoutAuthorized',false,'disbursementAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range or division_by_zero then return jsonb_build_object('status','blocked','code','source_shape_invalid');
end$$;

create function app.review_native_optional_recorded_fund_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare source_value jsonb;previous app.native_optional_fund_reviews_v2%rowtype;prior app.native_optional_fund_operations_v2%rowtype;
 h text;result_value jsonb;rid uuid:=extensions.gen_random_uuid();requested_expense_id uuid;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null or op is null then return null;end if;
 if app.native_optional_recorded_fund_enabled_v2()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>9
  or not(request?&array['kind','expectedVersion','sourceDigest','proposalRevisionId','ownershipRevisionId','recipientSourceDigest','sanctioningExpenseEventId','status','reason'])
  or request->>'kind'is distinct from'native-optional-recorded-fund-review-v2'or request->>'status'is distinct from'reviewed_zero'
  or jsonb_typeof(request->'expectedVersion')is distinct from'number'or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,9})$'or(request->>'expectedVersion')::numeric>=2147483647
  or coalesce(request->>'sourceDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'recipientSourceDigest','')!~'^[a-f0-9]{64}$'
  or coalesce(request->>'proposalRevisionId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or coalesce(request->>'ownershipRevisionId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
  or(request->'sanctioningExpenseEventId'is distinct from'null'::jsonb and coalesce(request->>'sanctioningExpenseEventId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$')
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'is distinct from app.custom_payout_classification_text_v2(request->>'reason')or app.event_settings_js_text_length_v3(request->>'reason')not between 1 and 2000
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-fund-review-v2',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.native_optional_fund_operations_v2 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid or prior.request_payload is distinct from request or prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select result into result_value from app.native_optional_fund_outcomes_v2 where actor_id=actor and operation_id=op;
  return coalesce(result_value,jsonb_build_object('status','retry_exact','code','operation_incomplete'));
 end if;
 requested_expense_id:=case when request->'sanctioningExpenseEventId'='null'::jsonb then null else(request->>'sanctioningExpenseEventId')::uuid end;
 source_value:=app.native_optional_recorded_fund_source_v2(actor,tid,eid,requested_expense_id);
 if source_value->>'status'='retry_exact'then return source_value;end if;
 if source_value is null or source_value->>'status'is distinct from'source_available'then return jsonb_build_object('status','rejected','code',coalesce(source_value->>'code','source_unavailable'));end if;
 if source_value->>'sourceDigest'is distinct from request->>'sourceDigest'or source_value->>'proposalRevisionId'is distinct from request->>'proposalRevisionId'
  or source_value->>'ownershipRevisionId'is distinct from request->>'ownershipRevisionId'or source_value#>>'{recipientSource,sourceDigest}'is distinct from request->>'recipientSourceDigest'
 then return jsonb_build_object('status','rejected','code','source_changed');end if;
 select*into previous from app.native_optional_fund_reviews_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if coalesce(previous.version,0)<>(request->>'expectedVersion')::integer then return jsonb_build_object('status','rejected','code','stale_version');end if;
 insert into app.native_optional_fund_operations_v2(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)values(actor,op,tid,eid,request,h);
 insert into app.native_optional_fund_reviews_v2(id,tournament_id,event_id,version,prior_review_id,proposal_revision_id,ownership_revision_id,sanctioning_snapshot_id,sanctioning_expense_event_id,sanctioning_allocated_minor,review_status,source_digest,source_capture,reason,actor_id,operation_id)
 values(rid,tid,eid,coalesce(previous.version,0)+1,previous.id,(request->>'proposalRevisionId')::uuid,(request->>'ownershipRevisionId')::uuid,
  (source_value#>>'{sanctioning,snapshotId}')::uuid,requested_expense_id,(source_value#>>'{sanctioning,allocatedExpenseMinor}')::bigint,'reviewed_zero',source_value->>'sourceDigest',source_value,request->>'reason',actor,op);
 result_value:=jsonb_build_object('status','optional_recorded_fund_reviewed_v2','reviewId',rid,'version',coalesce(previous.version,0)+1,'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,
  'proposalRevisionId',request->'proposalRevisionId','ownershipRevisionId',request->'ownershipRevisionId','sourceDigest',source_value->>'sourceDigest','reviewStatus','reviewed_zero','bankReceiptVerified',false,'moneyMoved',false,'payoutAuthorized',false,'disbursementAuthorized',false,'finalizationAuthorized',false);
 insert into app.native_optional_fund_outcomes_v2(actor_id,operation_id,tournament_id,event_id,result)values(actor,op,tid,eid,result_value);return result_value;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');
end$$;

create function app.reconcile_native_optional_recorded_fund_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare prior app.native_optional_fund_operations_v2%rowtype;h text;r jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into prior from app.native_optional_fund_operations_v2 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','unknown','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op);end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-fund-review-v2',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid or prior.request_payload is distinct from request or prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select result into r from app.native_optional_fund_outcomes_v2 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
 return jsonb_build_object('status','historical_operation','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',prior.request_payload,'result',r,'currentFundAuthority',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

do $$declare signature text;begin foreach signature in array array[
 'app.native_optional_recorded_fund_enabled_v2()','app.native_optional_sanctioning_coverage_v2(uuid,uuid,uuid,uuid)',
 'app.native_optional_recorded_fund_source_v2(uuid,uuid,uuid,uuid)','app.review_native_optional_recorded_fund_v2(uuid,uuid,uuid,uuid,jsonb)',
 'app.reconcile_native_optional_recorded_fund_v2(uuid,uuid,uuid,uuid,jsonb)'
]loop execute format('alter function %s owner to postgres',signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);end loop;end$$;
commit;
