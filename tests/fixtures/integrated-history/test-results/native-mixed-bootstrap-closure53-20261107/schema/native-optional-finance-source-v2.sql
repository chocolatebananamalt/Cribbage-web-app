-- LOCAL PRIVATE CANDIDATE. Versioned Finance read model from reviewed ownership.
-- Retains complete receipt partitions; never turns optional funds into income.
-- No V1 source replacement, grants, proposal/final writer or capability enable.
begin;
create function app.native_optional_finance_source_enabled_v2()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.native_optional_finance_line_id_v2(revision uuid,key text)returns uuid
language sql immutable set search_path=''as $$select(substring(h,1,8)||'-'||substring(h,9,4)||'-'||substring(h,13,4)||'-'||substring(h,17,4)||'-'||substring(h,21,12))::uuid
from(select md5('native-optional-finance-line-v2|'||revision::text||'|'||key)h)x$$;
create function app.native_optional_finance_source_v2(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare current_source jsonb;head app.native_optional_pool_ownership_revisions_v2%rowtype;
 operation app.native_optional_pool_ownership_operations_v2%rowtype;t app.tournaments%rowtype;e app.events%rowtype;
 frame jsonb;raw jsonb;basis jsonb;workspace jsonb;source_ref jsonb;settings jsonb;draft jsonb;history jsonb:='[]';cost jsonb;expense jsonb;p jsonb;
 h text;bh text;line_id uuid;qualifiers integer;entry_count integer;paid_count integer;source_count integer:=0;
begin
 current_source:=app.native_optional_pool_ownership_source_v2(actor,tid,eid);
 if current_source is null then return null;end if;
 if current_source->>'status'is distinct from'ownership_source_available'then return current_source;end if;
 if app.native_optional_finance_source_enabled_v2()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 lock table app.native_optional_pool_ownership_operations_v2,app.native_optional_pool_ownership_revisions_v2,app.native_optional_pool_ownership_outcomes_v2 in share mode nowait;
 select*into head from app.native_optional_pool_ownership_revisions_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if head.id is null then return jsonb_build_object('status','blocked','code','optional_ownership_review_required');end if;
 if head.source_digest is distinct from current_source->>'sourceDigest'or head.source_capture is distinct from current_source
 then return jsonb_build_object('status','blocked','code','optional_ownership_review_stale');end if;
 select*into operation from app.native_optional_pool_ownership_operations_v2 where actor_id=head.actor_id and operation_id=head.operation_id and tournament_id=tid and event_id=eid;
 if operation.operation_id is null then return jsonb_build_object('status','blocked','code','ownership_journal_incomplete');end if;
 select*into t from app.tournaments where id=tid;select*into e from app.events where id=eid and tournament_id=tid;
 draft:=current_source#>'{capture,nativePlayoffSource,source,settingsBinding,draft}';
 qualifiers:=(current_source#>>'{capture,nativePlayoffSource,source,qualification,qualifier_count}')::integer;
 entry_count:=(current_source#>>'{capture,nativePlayoffSource,source,qualification,participant_count}')::integer;
 paid_count:=jsonb_array_length(current_source#>'{capture,rosterReceiptPartitions}');
 if qualifiers is null or entry_count is null or qualifiers<>(entry_count+3)/4 or paid_count<>entry_count
 then return jsonb_build_object('status','blocked','code','qualification_or_paid_count_unresolved');end if;
 settings:=case draft->>'payoutMode'
  when'graduated'then jsonb_build_object('method','graduated_all_qualifiers','factor',draft->>'incrementFactorText')
  when'top'then jsonb_build_object('method','custom_top_paid','paidPlaces',(draft->>'topText')::integer,'factor',draft->>'incrementFactorText')
  when'one-in'then jsonb_build_object('method','custom_paid_ratio','ratio',(draft->>'oneInText')::integer,'factor',draft->>'incrementFactorText')else null end;
 if settings is null then return jsonb_build_object('status','blocked','code','payout_settings_unavailable');end if;
 frame:=jsonb_build_object('kind','native-optional-finance-source-v2','ownershipRevisionId',head.id,'ownershipVersion',head.version,
  'ownershipSource',current_source,'costClassifications',operation.request_payload->'costClassifications','settings',settings);
 h:=encode(extensions.digest(convert_to(frame::text,'utf8'),'sha256'),'hex');
 source_ref:=jsonb_build_object('tournamentId',tid,'eventId',eid,'sourceVersion',head.version,'sourceDigest',h);
 for cost in select value from jsonb_array_elements(operation.request_payload->'costClassifications')loop
  select value into expense from jsonb_array_elements(current_source#>'{capture,basis,expenses}')x where x->>'expenseEventId'=cost->>'expenseEventId';
  if expense is null then return jsonb_build_object('status','blocked','code','cost_source_changed');end if;
  line_id:=app.native_optional_finance_line_id_v2(head.id,'cost|'||(cost->>'expenseEventId'));
  history:=history||jsonb_build_array(jsonb_build_object('label',expense->'description','line',jsonb_build_object(
   'recordId',line_id,'lineId',line_id,'priorRecordId',null,'source',source_ref,'mode','estimate','category',cost->>'category',
   'amountMinor',expense->'amountMinor','voided',false,'reason','Recorded ownership classification')));
 end loop;
 for p in select value from jsonb_array_elements(current_source#>'{capture,qSource,obligations}')loop
  line_id:=app.native_optional_finance_line_id_v2(head.id,'q|'||(p->>'poolVersionId'));
  history:=history||jsonb_build_array(jsonb_build_object('label','Q-Pool fund — excluded from regular awards','line',jsonb_build_object(
   'recordId',line_id,'lineId',line_id,'priorRecordId',null,'source',source_ref,'mode','estimate','category','q_pool_fund',
   'amountMinor',p->'fundMinor','voided',false,'reason','Separate paid Q-Pool receipts')));
 end loop;
 for p in select value from jsonb_array_elements(current_source#>'{capture,sideBasis,manifest}')loop
  line_id:=app.native_optional_finance_line_id_v2(head.id,'side|'||(p#>>'{source,poolId}'));
  history:=history||jsonb_build_array(jsonb_build_object('label','Side Pool fund — excluded from regular awards','line',jsonb_build_object(
   'recordId',line_id,'lineId',line_id,'priorRecordId',null,'source',source_ref,'mode','estimate','category','side_pool_fund',
   'amountMinor',p#>'{source,fundMinor}','voided',false,'reason','Separate recorded Side Pool receipts')));
  source_count:=source_count+1;
 end loop;
 if source_count=0 then return jsonb_build_object('status','blocked','code','side_pool_source_required');end if;
 workspace:=jsonb_build_object('complete',true,'source',source_ref,'mode','estimate','tournamentName',t.name,'eventName',e.name,
  'eventKind',e.event_type,'startLabel',coalesce(to_char(t.planned_start_date,'FMMonth FMDD, YYYY'),'Date unavailable'),
  'entryCount',entry_count,'paidEntryCount',paid_count,'qualifierCount',qualifiers,'grossEntryMinor',current_source#>'{funds,regularReceiptsMinor}',
  'history',history,'settings',settings,'payoutSource',jsonb_build_object('tournamentId',tid,'eventId',eid,
   'settingsSnapshotId',current_source#>'{capture,nativePlayoffSource,source,settingsBinding,settings_snapshot_id}','ledgerDigest',h,'resultsDigest',h),
  'savedAt',to_char(head.created_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'overrideHistory','[]'::jsonb);
 basis:=jsonb_build_object('kind','native-optional-finance-basis-v2','sourceDigest',h,'workspace',workspace,
  'coverage',jsonb_build_object('additionalIncome','unavailable','optionalPools','versioned_ownership_annex','recordedFundAvailable',false));
 bh:=encode(extensions.digest(convert_to(basis::text,'utf8'),'sha256'),'hex');raw:=frame;
 return jsonb_build_object('status','source_available','kind','native-optional-finance-source-v2','actorId',actor,'tournamentId',tid,'eventId',eid,
  'sourceDigest',h,'basisDigest',bh,'raw',raw,'basis',basis,'proposalOnly',true,'moneyMoved',false,'finalizationAuthorized',false,'payoutAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
alter function app.native_optional_finance_source_enabled_v2()owner to postgres;
alter function app.native_optional_finance_line_id_v2(uuid,text)owner to postgres;
alter function app.native_optional_finance_source_v2(uuid,uuid,uuid)owner to postgres;
revoke all on function app.native_optional_finance_source_enabled_v2(),app.native_optional_finance_line_id_v2(uuid,text),app.native_optional_finance_source_v2(uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
