-- PRIVATE / DEFAULT OFF. Read-only projection of CURRENT reviewed V3 ownership.
-- Not a native allocation revision, Finance completeness review or award.
-- Requires selected-step-pool-ownership-v3. No old reader/guard is replaced.
begin;
create function app.selected_step_regular_ledger_enabled_v3()returns boolean
language sql stable set search_path=''as $gate$select false$gate$;
create function app.selected_step_regular_ledger_v3(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare owned jsonb;head app.selected_step_pool_ownership_revisions_v3%rowtype;
 operation app.selected_step_pool_ownership_operations_v3%rowtype;
 outcome jsonb;sources jsonb:='[]';pools jsonb;part jsonb;cost jsonb;expense jsonb;item jsonb;
 ledger jsonb;frame jsonb;h text;total numeric;regular numeric:=0;qfund numeric:=0;sidefund numeric:=0;
 benefits numeric:=0;expenses numeric:=0;seen text[]:='{}';cost_ids text[]:='{}';
begin
 if app.selected_step_regular_ledger_enabled_v3()is distinct from true then return jsonb_build_object('status','blocked','code','feature_disabled');end if;
 -- Reuse the existing SERVICE-only primary-director authorization. An actor
 -- UUID supplied by a caller is not authentication. Never impersonate auth.uid.
 if app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 lock table app.selected_step_pool_ownership_operations_v3,app.selected_step_pool_ownership_revisions_v3,app.selected_step_pool_ownership_outcomes_v3 in share mode nowait;
 owned:=app.selected_step_pool_ownership_source_v3(actor,tid,eid);
 if owned->>'status'='retry_exact'then return owned;end if;
 if owned is null or owned->>'status'is distinct from'ownership_source_available'
  or owned->>'actorId'is distinct from actor::text or owned->>'tournamentId'is distinct from tid::text or owned->>'eventId'is distinct from eid::text
 then return jsonb_build_object('status','blocked','code','current_pool_ownership_required');end if;
 select*into head from app.selected_step_pool_ownership_revisions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if head.id is null or head.source_digest is distinct from owned->>'sourceDigest'or head.source_capture is distinct from owned
 then return jsonb_build_object('status','blocked','code','reviewed_pool_ownership_required');end if;
 select*into operation from app.selected_step_pool_ownership_operations_v3 where actor_id=head.actor_id and operation_id=head.operation_id and tournament_id=tid and event_id=eid;
 select o.result into outcome from app.selected_step_pool_ownership_outcomes_v3 o where o.actor_id=head.actor_id and o.operation_id=head.operation_id and o.tournament_id=tid and o.event_id=eid;
 if operation.operation_id is null or operation.request_payload->>'kind'is distinct from'selected-step-pool-ownership-v3'
  or operation.request_payload->'reviewed'is distinct from'true'::jsonb
  or operation.request_payload->>'sourceDigest'is distinct from head.source_digest
  or outcome->>'status'is distinct from'selected_step_pool_ownership_reviewed_v3'
  or outcome->>'revisionId'is distinct from head.id::text or outcome->>'version'is distinct from head.version::text
  or outcome->>'sourceDigest'is distinct from head.source_digest
 then return jsonb_build_object('status','blocked','code','ownership_journal_incomplete');end if;
 for item in select value->'source'from jsonb_array_elements(owned#>'{capture,rosterReceiptPartitions}')
  union all select value->'source'from jsonb_array_elements(owned#>'{capture,sideRecordedSources}')loop
  if item->>'sourceId'=any(seen)or item->>'sourceId'is distinct from item->>'physicalEvidenceId'
   or item->>'kind'is distinct from'entry_receipt'or item->>'state'is distinct from'active'
   or coalesce(item->>'amountMinor','')!~'^[1-9][0-9]*$'or(item->>'amountMinor')::numeric>9007199254740991
  then return jsonb_build_object('status','blocked','code','receipt_partition_invalid');end if;
  seen:=array_append(seen,item->>'sourceId');total:=0;
  for part in select value from jsonb_array_elements(item->'allocations')loop
   if part->>'eventId'is distinct from eid::text or part->>'bucket'not in('regular_entry','q','side')
    or part->'classificationReviewed'is distinct from'true'::jsonb
    or coalesce(part->>'amountMinor','')!~'^[1-9][0-9]*$'
   then return jsonb_build_object('status','blocked','code','receipt_partition_invalid');end if;
   total:=total+(part->>'amountMinor')::numeric;
   case part->>'bucket'when'regular_entry'then regular:=regular+(part->>'amountMinor')::numeric;
    when'q'then qfund:=qfund+(part->>'amountMinor')::numeric;when'side'then sidefund:=sidefund+(part->>'amountMinor')::numeric;end case;
  end loop;
  if total<>(item->>'amountMinor')::numeric then return jsonb_build_object('status','blocked','code','receipt_not_conserved');end if;
  sources:=sources||jsonb_build_array(item);
 end loop;
 if regular is distinct from(owned#>>'{funds,regularReceiptsMinor}')::numeric
  or qfund is distinct from(owned#>>'{funds,qReceiptsMinor}')::numeric
  or sidefund is distinct from(owned#>>'{funds,sideReceiptsMinor}')::numeric
  or regular+qfund+sidefund is distinct from(owned#>>'{funds,recordedReceiptsMinor}')::numeric
 then return jsonb_build_object('status','blocked','code','ownership_fund_mismatch');end if;
 if jsonb_typeof(operation.request_payload->'costClassifications')is distinct from'array'
  or jsonb_array_length(operation.request_payload->'costClassifications')<>jsonb_array_length(owned#>'{capture,basis,expenses}')
 then return jsonb_build_object('status','blocked','code','cost_coverage_incomplete');end if;
 for cost in select value from jsonb_array_elements(operation.request_payload->'costClassifications')loop
  select value into expense from jsonb_array_elements(owned#>'{capture,basis,expenses}')where value->>'expenseEventId'=cost->>'expenseEventId';
  if expense is null or cost->>'expenseEventId'=any(cost_ids)or cost->>'expenseEventId'=any(seen)
   or coalesce(cost->>'category','')not in('player_benefit','operating_expense')
   or coalesce(expense->>'amountMinor','')!~'^[1-9][0-9]*$'or(expense->>'amountMinor')::numeric>9007199254740991
  then return jsonb_build_object('status','blocked','code','cost_source_changed');end if;
  cost_ids:=array_append(cost_ids,cost->>'expenseEventId');
  if cost->>'category'='player_benefit'then benefits:=benefits+(expense->>'amountMinor')::numeric;
  else expenses:=expenses+(expense->>'amountMinor')::numeric;end if;
  sources:=sources||jsonb_build_array(jsonb_build_object('sourceId',cost->'expenseEventId','physicalEvidenceId',cost->'expenseEventId','kind','expense',
   'amountMinor',expense->'amountMinor','state','active','allocations',jsonb_build_array(jsonb_build_object('eventId',eid,'bucket',cost->'category','poolId',null,'amountMinor',expense->'amountMinor','classificationReviewed',true))));
 end loop;
 if benefits+expenses>regular or regular+qfund+sidefund>9007199254740991 then return jsonb_build_object('status','blocked','code','insufficient_or_unsafe_regular_fund');end if;
 -- All optional partitions stay visible in the ledger and OUT of regular fund.
 select coalesce(jsonb_agg(x order by x->>'poolId'),'[]'::jsonb)into pools from(
  select distinct jsonb_build_object('poolId',p->'poolId','eventId',eid,'kind',p->'bucket')x
  from jsonb_array_elements(sources)s cross join lateral jsonb_array_elements(s->'allocations')p where p->>'bucket'in('q','side'))v;
 frame:=jsonb_build_object('kind','selected-step-regular-ledger-v3','ownershipRevisionId',head.id,'ownershipVersion',head.version,
  'ownershipSource',owned,'ownershipOperation',operation.request_payload,'ownershipOutcome',outcome,'sources',sources,'pools',pools);
 h:=encode(extensions.digest(convert_to(frame::text,'utf8'),'sha256'),'hex');
 select coalesce(jsonb_agg(value order by value->>'sourceId'),'[]'::jsonb)into sources from jsonb_array_elements(sources);
 ledger:=jsonb_build_object('kind','event-ledger-snapshot-v1','tournamentId',tid,'sourceDigest',h,'sourceVersion',head.version,'complete',true,
  'mode','documented_actual','eventIds',jsonb_build_array(eid),'pools',pools,'sources',sources);
 return jsonb_build_object('status','source_available','kind','selected-step-regular-ledger-v3','actorId',actor,'tournamentId',tid,'eventId',eid,
  'sourceDigest',h,'ownershipRevisionId',head.id,'ownershipVersion',head.version,'capture',frame,'ledger',ledger,
  'funds',jsonb_build_object('regularReceiptsMinor',regular,'qReceiptsMinor',qfund,'sideReceiptsMinor',sidefund,'benefitsMinor',benefits,'expensesMinor',expenses,'regularAllocationFundMinor',regular-benefits-expenses),
  'coverage',jsonb_build_object('additionalIncome','not_included','sanctioning','review_required','fundCompleteness','review_required'),
  'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','blocked','code','ownership_shape_invalid');end$body$;
alter function app.selected_step_regular_ledger_enabled_v3()owner to postgres;
alter function app.selected_step_regular_ledger_v3(uuid,uuid,uuid)owner to postgres;
revoke all on function app.selected_step_regular_ledger_enabled_v3(),app.selected_step_regular_ledger_v3(uuid,uuid,uuid)from public,anon,authenticated,service_role;
-- Actual modern policy + qualification consumer of the ownership projection.
-- The revision is explicitly an OWNERSHIP revision; no native allocation row
-- or V1 proposal is fabricated. Keep this version separate from the old V2 DTO.
create function app.get_selected_step_prize_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare owned jsonb;pin jsonb;binding jsonb;event_version jsonb;prize jsonb;qualification jsonb;input jsonb;capture jsonb;h text;
begin
 owned:=app.selected_step_regular_ledger_v3(actor,tid,eid);
 if owned is null or owned->>'status'is distinct from'source_available'then return owned;end if;
 pin:=app.selected_step_pool_activation_pin_v3(actor,tid,eid);
 if pin->>'status'='retry_exact'then return pin;end if;
 if pin is null or pin->>'status'is distinct from'pin_available'
  or pin is distinct from owned#>'{capture,ownershipSource,capture,nativePlayoffSource,source,prizeActivation}'
 then return jsonb_build_object('status','blocked','code','prize_activation_changed');end if;
 binding:=pin->'settingsBinding';event_version:=pin->'eventVersion';prize:=pin#>'{prize,document}';
 qualification:=public.get_standard_singles_qualification_result_v1(actor,tid,eid);
 if qualification->>'resultVersionId'is distinct from owned#>>'{capture,ownershipSource,capture,nativePlayoffSource,qualificationId}'
 then return jsonb_build_object('status','blocked','code','qualification_source_changed');end if;
 input:=jsonb_build_object('binding',jsonb_build_object('tournamentId',tid,'eventId',eid,'eventClientRowId',event_version->'client_row_id',
   'eventKind',event_version->'event_kind','setupRevisionId',event_version->'setup_revision_id','settingsSnapshotId',binding->'settings_snapshot_id',
   'settingsDigest',prize->'settingsDigest','prizeSnapshotId',prize->'prizeSnapshotId','prizeDigest',prize->'prizeDigest'),
  'prizeSource',jsonb_build_object('snapshot',prize,'currentPrizeSnapshotId',prize->'prizeSnapshotId','currentPrizeDigest',prize->'prizeDigest'),
  'ledger',jsonb_build_object('allocationRevisionId',owned->'ownershipRevisionId','currentAllocationRevisionId',owned->'ownershipRevisionId','current',owned->'ledger','retained',owned->'ledger'),
  'qualification',jsonb_build_object('currentResultVersionId',qualification->'resultVersionId','result',qualification));
 capture:=jsonb_build_object('ownershipLedger',owned,'prizeActivation',pin,'input',input);
 h:=encode(extensions.digest(convert_to(capture::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('status','source_available','kind','selected-step-prize-source-v3','actorId',actor,'tournamentId',tid,'eventId',eid,
  'sourceDigest',h,'capture',capture,'revisionDomain','selected-step-pool-ownership-v3',
  'coverage',owned->'coverage','proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$body$;
alter function app.get_selected_step_prize_source_v3(uuid,uuid,uuid)owner to postgres;
revoke all on function app.get_selected_step_prize_source_v3(uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
