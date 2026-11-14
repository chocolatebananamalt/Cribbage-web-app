-- PRIVATE / DEFAULT OFF. Linked regular Consolation4, full recorded fees,
-- current native allocation journal, no tournament-wide optional allocation
-- evidence and no Consolation optional pools/income. Main optional funding is
-- held until its real separate source can coexist with this native allocation.
-- AFTER manual-linked-consolation-loss-v1 and modern-manual-final-awards-v1.
begin;
create function app.selected_step_consolation_enabled_v3()returns boolean language sql stable set search_path=''as $$select false$$;
-- Preserve Main implementations and their source domains byte-for-byte.
do $clones$declare n text;sig text;d text;c text;begin
 foreach n in array array['selected_step_pool_activation_pin_v3','selected_step_pool_playoff_source_v3','selected_step_pool_ownership_source_v3','selected_step_regular_ledger_v3','get_selected_step_pool_source_v3']loop
  sig:='uuid,uuid,uuid';
  if not exists(select 1 from pg_proc where oid=to_regprocedure('app.'||n||'('||sig||')')and proowner='postgres'::regrole and prosecdef)then raise exception'consolation_v3_trusted_prerequisite_missing';end if;
  d:=pg_get_functiondef(to_regprocedure('app.'||n||'('||sig||')'));c:=replace(d,'FUNCTION app.'||n||'(','FUNCTION app.'||n||'_before_consolation(');
  if c=d then raise exception'consolation_v3_clone_anchor_changed';end if;execute c;
  execute format('revoke all on function app.%I(uuid,uuid,uuid)from public,anon,authenticated,service_role',n||'_before_consolation');
 end loop;
end$clones$;
do $pin$declare body text;begin
 select prosrc into body from pg_proc where oid='app.selected_step_pool_activation_pin_v3_before_consolation(uuid,uuid,uuid)'::regprocedure;
 if strpos(body,'event_kind=''main''')=0 or strpos(body,'event_type=''main''')=0 then raise exception'consolation_pin_anchor_changed';end if;
 body:=replace(replace(replace(body,'event_kind=''main''','event_kind=''consolation'''),'event_type=''main''','event_type=''consolation'''),'x->>''eventKind''=''main''','x->>''eventKind''=''consolation''');
 body:=replace(body,'begin','begin'||E'\n if app.selected_step_consolation_enabled_v3()is distinct from true then return null;end if;');
 execute format('create function app.consolation_activation_pin_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''''set timezone=''UTC''as %L',body);
end$pin$;
do $sport$declare body text;old text;begin
 select prosrc into body from pg_proc where oid='app.selected_step_pool_playoff_source_v3_before_consolation(uuid,uuid,uuid)'::regprocedure;
 old:='assessment jsonb;';if strpos(body,old)=0 then raise exception'consolation_sport_declaration_changed';end if;body:=replace(body,old,'linked_digest text;manual_proof jsonb;digital_proof jsonb;main_id uuid;'||old);
 old:=' assessment:=app.assess_event_prize_series_draft_v1';if strpos(body,old)=0 then raise exception'consolation_sport_gate_changed';end if;
 body:=replace(body,old,E' if app.selected_step_consolation_enabled_v3()is distinct from true or q.qualifier_count<>4 then return jsonb_build_object(''status'',''blocked'',''code'',''consolation_four_field_required'');end if;\n main_id:=app.linked_consolation_main_event_v1(tid,eid);linked_digest:=app.linked_consolation_four_qualifier_source_v2(tid,eid,q.id);manual_proof:=app.linked_consy_manual_admission_proof_v1(tid,eid);digital_proof:=app.linked_consy_native_admission_proof_v1(tid,eid);\n if main_id is null or linked_digest is null or manual_proof is null or digital_proof is null then return jsonb_build_object(''status'',''blocked'',''code'',''current_linked_consolation_admission_required'');end if;\n'||old);
 old:='capture_value:=jsonb_build_object(''prizeActivation'',pin_value,';if strpos(body,old)=0 then raise exception'consolation_sport_capture_changed';end if;
 body:=replace(body,old,'capture_value:=jsonb_build_object(''linkedConsolationEligibility'',jsonb_build_object(''mainEventId'',main_id,''sourceDigest'',linked_digest,''manualAdmissionProof'',manual_proof,''digitalAdmissionProof'',digital_proof),''prizeActivation'',pin_value,');
 body:=replace(body,'selected-step-pool-playoff-source-v3','selected-step-consolation-playoff-source-v3');
 execute format('create function app.consolation_playoff_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''''set timezone=''UTC''as %L',body);
end$sport$;
create or replace function app.selected_step_pool_activation_pin_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from app.events where id=eid and tournament_id=tid and event_type='consolation')then return app.consolation_activation_pin_v3(actor,tid,eid);end if;return app.selected_step_pool_activation_pin_v3_before_consolation(actor,tid,eid);end$$;
create or replace function app.selected_step_pool_playoff_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from app.events where id=eid and tournament_id=tid and event_type='consolation')then return app.consolation_playoff_source_v3(actor,tid,eid);end if;return app.selected_step_pool_playoff_source_v3_before_consolation(actor,tid,eid);end$$;

-- Actual current journal, not Q membership and not a fabricated receipt. Keep
-- the FULL physical allocations; only event-owned parts contribute to totals.
create function app.consolation_ownership_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare cur jsonb;gate jsonb;pin jsonb;a app.native_ledger_allocation_revisions_v1%rowtype;op app.native_ledger_allocation_operations_v1%rowtype;outcome jsonb;
 s jsonb;p jsonb;receipt jsonb;costs jsonb:='[]';capture jsonb;total numeric;gross numeric:=0;benefits numeric:=0;expenses numeric:=0;amount numeric;fee integer;rosters uuid[]:='{}';roster uuid;category text;costamount numeric;seen text[]:='{}';begin
 if app.selected_step_consolation_enabled_v3()is distinct from true or app.selected_step_pool_ownership_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for update nowait;perform app.lock_native_ledger_sources_v1();
 lock table app.native_ledger_allocation_revisions_v1,app.native_ledger_allocation_operations_v1,app.native_ledger_allocation_outcomes_v1 in share mode nowait;
 gate:=app.consolation_playoff_source_v3(actor,tid,eid);if gate->>'status'is distinct from'source_available'then return gate;end if;
 pin:=gate#>'{source,prizeActivation}';fee:=(pin#>>'{eventVersion,entry_fee_cents}')::integer;if fee is null or fee<=0 then return jsonb_build_object('status','blocked','code','consolation_full_fee_required');end if;
 if app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','blocked','code','existing_financial_liability');end if;
 cur:=app.native_optional_recorded_sources_v2(actor,tid);if cur->>'status'is distinct from'sources_available'or cur->>'tournamentId'is distinct from tid::text then return jsonb_build_object('status','blocked','code','current_native_sources_required');end if;
 if cur#>'{facts,existingOptionalAllocationEvidence}'is distinct from'false'::jsonb or exists(select 1 from jsonb_array_elements(cur#>'{facts,pools}')x where x->>'eventId'=eid::text)then return jsonb_build_object('status','blocked','code','consolation_optional_ownership_not_supported');end if;
 select*into a from app.native_ledger_allocation_revisions_v1 where tournament_id=tid order by version desc limit 1;
 select*into op from app.native_ledger_allocation_operations_v1 where actor_id=a.actor_id and operation_id=a.operation_id and tournament_id=tid;
 select result into outcome from app.native_ledger_allocation_outcomes_v1 where actor_id=a.actor_id and operation_id=a.operation_id and tournament_id=tid;
 if a.id is null or op.operation_id is null or op.request_payload is distinct from a.request_payload or op.request_hash is distinct from a.request_hash or a.source_digest is distinct from cur->>'sourceDigest'
  or outcome->>'status'is distinct from'accepted'or outcome->>'revisionId'is distinct from a.id::text or outcome->'snapshot'is distinct from a.snapshot
  or a.snapshot->>'kind'is distinct from'event-ledger-snapshot-v1'or a.snapshot->>'tournamentId'is distinct from tid::text or a.snapshot->>'sourceDigest'is distinct from a.source_digest or a.snapshot->'complete'is distinct from'true'::jsonb or a.snapshot->>'mode'is distinct from'documented_actual'or not(a.snapshot->'eventIds'?eid::text)
 then return jsonb_build_object('status','blocked','code','current_consolation_allocation_required');end if;
 for s in select value from jsonb_array_elements(a.snapshot->'sources')loop
  if s->>'sourceId'=any(seen)or s->>'sourceId'is distinct from s->>'physicalEvidenceId'or s->>'state'is distinct from'active'or s->>'kind'not in('entry_receipt','expense')then return jsonb_build_object('status','blocked','code','consolation_allocation_shape_invalid');end if;
  seen:=array_append(seen,s->>'sourceId');total:=0;category:=null;costamount:=0;
  for p in select value from jsonb_array_elements(s->'allocations')loop
   amount:=(p->>'amountMinor')::numeric;if amount<=0 or amount>9007199254740991 or amount<>trunc(amount)or p->'classificationReviewed'is distinct from'true'::jsonb or p->'poolId'is distinct from'null'::jsonb then return jsonb_build_object('status','blocked','code','consolation_allocation_shape_invalid');end if;total:=total+amount;
   if p->>'eventId'<>eid::text then continue;end if;
   if s->>'kind'='entry_receipt'then
    if p->>'bucket'<>'regular_entry'or amount<>fee then return jsonb_build_object('status','blocked','code','consolation_full_fee_required');end if;
    select x into receipt from jsonb_array_elements(cur#>'{facts,receiptEvents}')x where x->>'sourceId'=s->>'sourceId'and x->'eligibleEventIds'?eid::text;
    roster:=(receipt->>'rosterEntryId')::uuid;
    if roster is null or roster=any(rosters)or not exists(select 1 from app.event_participants ep where ep.tournament_id=tid and ep.event_id=eid and ep.roster_entry_id=roster and ep.status='checked_in')then return jsonb_build_object('status','blocked','code','consolation_paid_roster_changed');end if;
    rosters:=array_append(rosters,roster);gross:=gross+amount;
   else
    if p->>'bucket'not in('player_benefit','operating_expense')or category is not null then return jsonb_build_object('status','blocked','code','consolation_cost_classification_ambiguous');end if;
    category:=p->>'bucket';costamount:=amount;if category='player_benefit'then benefits:=benefits+amount;else expenses:=expenses+amount;end if;
   end if;
  end loop;
  if total is distinct from(s->>'amountMinor')::numeric or total>9007199254740991 then return jsonb_build_object('status','blocked','code','receipt_not_conserved');end if;
  if category is not null then costs:=costs||jsonb_build_array(jsonb_build_object('expenseEventId',s->'sourceId','description','Recorded Consolation allocation','amountMinor',costamount,'category',category));end if;
 end loop;
 if cardinality(rosters)<>(gate#>>'{source,qualification,participant_count}')::integer or cardinality(rosters)<>(select count(*)from app.event_participants where tournament_id=tid and event_id=eid and status='checked_in')or benefits+expenses>gross or gross>9007199254740991 then return jsonb_build_object('status','blocked','code','consolation_fund_or_roster_incomplete');end if;
 capture:=jsonb_build_object('kind','selected-step-consolation-ownership-source-v3','tournamentId',tid,'eventId',eid,'nativePlayoffSource',gate,'nativeRawSource',cur,'nativeAllocation',to_jsonb(a),'nativeAllocationOperation',to_jsonb(op),'nativeAllocationOutcome',outcome,
  'basis',jsonb_build_object('expenses',costs),'regularOnly',true,'refundPolicy','no-pool-refunds-v1','evidenceMeaning','current recorded allocations; no payment or bank verification');
 return jsonb_build_object('status','ownership_source_available','kind','selected-step-pool-ownership-source-v3','actorId',actor,'tournamentId',tid,'eventId',eid,'sourceDigest',encode(extensions.digest(convert_to(capture::text,'utf8'),'sha256'),'hex'),'capture',capture,
  'funds',jsonb_build_object('regularReceiptsMinor',gross,'qReceiptsMinor',0,'sideReceiptsMinor',0,'recordedReceiptsMinor',gross),'moneyMoved',false,'bankReceiptVerified',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','blocked','code','consolation_allocation_shape_invalid');end$$;
create or replace function app.selected_step_pool_ownership_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from app.events where id=eid and tournament_id=tid and event_type='consolation')then return app.consolation_ownership_source_v3(actor,tid,eid);end if;return app.selected_step_pool_ownership_source_v3_before_consolation(actor,tid,eid);end$$;

-- Use the SAME actual V3 ownership review writer, audit and exact retry. Its
-- cost choices must agree with already-reviewed event allocation categories.
create function app.consolation_regular_ledger_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare owned jsonb;head app.selected_step_pool_ownership_revisions_v3%rowtype;op app.selected_step_pool_ownership_operations_v3%rowtype;outcome jsonb;c jsonb;x jsonb;frame jsonb;ledger jsonb;h text;benefits numeric:=0;expenses numeric:=0;begin
 if app.selected_step_consolation_enabled_v3()is distinct from true or app.selected_step_regular_ledger_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 perform 1 from app.tournaments where id=tid for update nowait;lock table app.selected_step_pool_ownership_revisions_v3,app.selected_step_pool_ownership_operations_v3,app.selected_step_pool_ownership_outcomes_v3 in share mode nowait;
 owned:=app.consolation_ownership_source_v3(actor,tid,eid);if owned->>'status'is distinct from'ownership_source_available'then return owned;end if;
 select*into head from app.selected_step_pool_ownership_revisions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 select*into op from app.selected_step_pool_ownership_operations_v3 where actor_id=head.actor_id and operation_id=head.operation_id and tournament_id=tid and event_id=eid;
 select result into outcome from app.selected_step_pool_ownership_outcomes_v3 where actor_id=head.actor_id and operation_id=head.operation_id and tournament_id=tid and event_id=eid;
 if head.id is null or head.source_capture is distinct from owned or head.source_digest is distinct from owned->>'sourceDigest'or op.operation_id is null or op.request_payload->'reviewed'is distinct from'true'::jsonb or op.request_payload->>'sourceDigest'is distinct from head.source_digest or outcome->>'status'is distinct from'selected_step_pool_ownership_reviewed_v3'or outcome->>'revisionId'is distinct from head.id::text then return jsonb_build_object('status','blocked','code','reviewed_consolation_ownership_required');end if;
 if jsonb_array_length(op.request_payload->'costClassifications')<>jsonb_array_length(owned#>'{capture,basis,expenses}')then return jsonb_build_object('status','blocked','code','cost_coverage_incomplete');end if;
 for c in select value from jsonb_array_elements(owned#>'{capture,basis,expenses}')loop
  select value into x from jsonb_array_elements(op.request_payload->'costClassifications')where value->'expenseEventId'=c->'expenseEventId';
  if x->'category'is distinct from c->'category'then return jsonb_build_object('status','blocked','code','consolation_allocation_category_changed');end if;
  if c->>'category'='player_benefit'then benefits:=benefits+(c->>'amountMinor')::numeric;else expenses:=expenses+(c->>'amountMinor')::numeric;end if;
 end loop;
 frame:=jsonb_build_object('kind','selected-step-regular-ledger-v3','ownershipRevisionId',head.id,'ownershipVersion',head.version,'ownershipSource',owned,'ownershipOperation',op.request_payload,'ownershipOutcome',outcome,'sources',owned#>'{capture,nativeAllocation,snapshot,sources}','pools',owned#>'{capture,nativeAllocation,snapshot,pools}');
 h:=encode(extensions.digest(convert_to(frame::text,'utf8'),'sha256'),'hex');ledger:=(owned#>'{capture,nativeAllocation,snapshot}')||jsonb_build_object('sourceDigest',h,'sourceVersion',head.version);
 return jsonb_build_object('status','source_available','kind','selected-step-regular-ledger-v3','actorId',actor,'tournamentId',tid,'eventId',eid,'sourceDigest',h,'ownershipRevisionId',head.id,'ownershipVersion',head.version,'capture',frame,'ledger',ledger,
  'funds',jsonb_build_object('regularReceiptsMinor',owned#>'{funds,regularReceiptsMinor}','qReceiptsMinor',0,'sideReceiptsMinor',0,'benefitsMinor',benefits,'expensesMinor',expenses,'regularAllocationFundMinor',(owned#>>'{funds,regularReceiptsMinor}')::numeric-benefits-expenses),
  'coverage',jsonb_build_object('additionalIncome','not_included','sanctioning','review_required','fundCompleteness','review_required'),'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create or replace function app.selected_step_regular_ledger_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from app.events where id=eid and tournament_id=tid and event_type='consolation')then return app.consolation_regular_ledger_v3(actor,tid,eid);end if;return app.selected_step_regular_ledger_v3_before_consolation(actor,tid,eid);end$$;

-- Explicit current absence proof, never an optional-pool final or liability.
create or replace function app.get_selected_step_pool_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare o jsonb;l jsonb;p jsonb;plan jsonb;body jsonb;begin
 if not exists(select 1 from app.events where id=eid and tournament_id=tid and event_type='consolation')then return app.get_selected_step_pool_source_v3_before_consolation(actor,tid,eid);end if;
 if app.selected_step_consolation_enabled_v3()is distinct from true or app.selected_step_pool_journal_enabled_v3()is distinct from true then return null;end if;
 l:=app.consolation_regular_ledger_v3(actor,tid,eid);if l->>'status'is distinct from'source_available'then return l;end if;o:=l#>'{capture,ownershipSource}';p:=o#>'{capture,nativePlayoffSource,source,prizeActivation}';
 select x->'draft'into plan from jsonb_array_elements(p#>'{prize,document,plans}')x where x->>'eventClientRowId'=p#>>'{eventVersion,client_row_id}'and x->>'eventKind'='consolation'and x->>'mode'='proposed_v2';if plan is null then return jsonb_build_object('status','blocked','code','current_consolation_plan_required');end if;
 body:=jsonb_build_object('kind','current-selected-step-pool-source-v3','status','source_available','actorId',actor,'tournamentId',tid,'eventId',eid,'ownershipRevisionId',l->'ownershipRevisionId','qualificationResultVersionId',o#>'{capture,nativePlayoffSource,qualificationId}','prizeSnapshotId',p#>'{prize,id}','prizeDigest',p#>'{pin,prize_digest}',
 'ownershipSource',o,'prizePolicyPin',p->'pin','prizePlan',plan,'pools','[]'::jsonb,'qMinor',0,'sideMinor',0,'totalMinor',0,'absenceEvidence','current_consolation_regular_only_allocation_v3','liabilityScope','optional_pools_only','refundPolicy','no-pool-refunds-v1','directorReviewRequired',true,'bankReceiptVerified',false,'moneyMoved',false,'payoutAuthorized',false);
 return body||jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(jsonb_build_array('selected-step-consolation-no-pools-v3',body)::text,'utf8'),'sha256'),'hex'));
end$$;
-- Existing manual award writer already replays detailed Consolation4 evidence;
-- admit it only through the genuine event-specific owned source above.
do $manual$declare d text;old text:='n->>''eventKind''is distinct from''main''';begin
 select pg_get_functiondef('app.current_manual_final_source_v1(uuid,uuid,uuid,uuid)'::regprocedure)into d;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'consolation_manual_award_anchor_changed';end if;
 d:=replace(d,old,'(n->>''eventKind''is distinct from''main''and(n->>''eventKind''is distinct from''consolation''or app.selected_step_consolation_enabled_v3()is distinct from true or c#>>''{ownershipLedger,capture,ownershipSource,capture,kind}''is distinct from''selected-step-consolation-ownership-source-v3''))');execute replace(d,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$manual$;
-- Original V2 arithmetic conserves full multi-event regular receipts and
-- sums only the bound event. Main's V3 optional validator stays unchanged.
do $range$declare d text;begin
 d:=pg_get_functiondef('app.selected_step_prize_range_safe_v3(jsonb,jsonb)'::regprocedure);execute replace(d,'FUNCTION app.selected_step_prize_range_safe_v3(','FUNCTION app.selected_step_prize_range_safe_v3_before_consolation(');
end$range$;
create function app.consolation_prize_range_safe_v3(source_input jsonb,history jsonb)returns boolean language plpgsql immutable set search_path=''as $$
declare l jsonb:=source_input#>'{ledger,current}';eid text:=source_input#>>'{binding,eventId}';s jsonb;p jsonb;seen text[]:='{}';event_ids text[]:='{}';pool_ids text[]:='{}';v text;total numeric:=0;begin
 if source_input#>>'{binding,eventKind}'is distinct from'consolation'or l is distinct from source_input#>'{ledger,retained}'or l->>'kind'is distinct from'event-ledger-snapshot-v1'or l->>'tournamentId'is distinct from source_input#>>'{binding,tournamentId}'or jsonb_typeof(l->'pools')is distinct from'array'or jsonb_typeof(l->'eventIds')is distinct from'array'or jsonb_typeof(l->'sources')is distinct from'array'then return false;end if;
 for v in select jsonb_array_elements_text(l->'eventIds')loop
  if v!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or v=any(event_ids)then return false;end if;event_ids:=array_append(event_ids,v);
 end loop;if not(eid=any(event_ids))then return false;end if;
 for p in select value from jsonb_array_elements(l->'pools')loop
  if p->>'eventId'=eid or not(p->>'eventId'=any(event_ids))or coalesce(p->>'kind','')not in('q','side')or coalesce(p->>'poolId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or p->>'poolId'=any(pool_ids)then return false;end if;
  pool_ids:=array_append(pool_ids,p->>'poolId');
 end loop;
 for s in select value from jsonb_array_elements(l->'sources')loop
  if coalesce(s->>'sourceId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or s->>'physicalEvidenceId'is distinct from s->>'sourceId'or s->>'sourceId'=any(seen)then return false;end if;
  seen:=array_append(seen,s->>'sourceId');total:=total+(s->>'amountMinor')::numeric;if total>9007199254740991 then return false;end if;
  for p in select value from jsonb_array_elements(s->'allocations')loop if not(p->>'eventId'=any(event_ids))then return false;end if;end loop;
 end loop;
 return app.playoff_prize_proposal_range_safe_v2(source_input,history);
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$$;
create or replace function app.selected_step_prize_range_safe_v3(source_input jsonb,history jsonb)returns boolean language plpgsql immutable set search_path=''as $$begin
 if source_input#>>'{binding,eventKind}'='consolation'then return app.consolation_prize_range_safe_v3(source_input,history);end if;return app.selected_step_prize_range_safe_v3_before_consolation(source_input,history);end$$;
do $secure$declare r record;begin for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app'and(p.proname in('selected_step_consolation_enabled_v3','consolation_activation_pin_v3','consolation_playoff_source_v3','consolation_ownership_source_v3','consolation_regular_ledger_v3','selected_step_pool_activation_pin_v3','selected_step_pool_playoff_source_v3','selected_step_pool_ownership_source_v3','selected_step_regular_ledger_v3','get_selected_step_pool_source_v3','consolation_prize_range_safe_v3','selected_step_prize_range_safe_v3')or p.proname like '%_v3_before_consolation')loop execute format('alter function %s owner to postgres',r.sig);execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);end loop;end$secure$;
commit;
