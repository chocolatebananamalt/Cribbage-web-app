-- UNEXECUTED PRIVATE OPERATIONAL FINANCE SOURCE-ADOPTION CANDIDATE.
-- This proposal does not record expenses, allocate ledger evidence, move money,
-- authorize payouts, or enable a provider route. It only appends a reviewed
-- proposal revision after independently re-reading immutable native sources.
begin;

create function app.operational_finance_source_adoption_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create table app.operational_event_finance_source_adoptions_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null,event_id uuid not null,
 actor_id uuid not null,operation_id uuid not null,
 prior_revision_id uuid not null,new_revision_id uuid not null,
 prior_allocation_revision_id uuid not null,current_allocation_revision_id uuid not null,
 prior_source_digest text not null check(prior_source_digest~'^[a-f0-9]{64}$'),
 prior_basis_digest text not null check(prior_basis_digest~'^[a-f0-9]{64}$'),
 current_source_digest text not null check(current_source_digest~'^[a-f0-9]{64}$'),
 current_basis_digest text not null check(current_basis_digest~'^[a-f0-9]{64}$'),
 unchanged_frame_digest text not null check(unchanged_frame_digest~'^[a-f0-9]{64}$'),
 mapping_digest text not null check(mapping_digest~'^[a-f0-9]{64}$'),
 dispositions jsonb not null,prior_cost_lineages jsonb not null,current_cost_rows jsonb not null,
 income_rebind_capture jsonb not null,reason text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(actor_id,operation_id),unique(new_revision_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.operational_event_finance_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(prior_revision_id,tournament_id,event_id)
  references app.operational_event_finance_revisions_v1(id,tournament_id,event_id),
 foreign key(new_revision_id,tournament_id,event_id)
  references app.operational_event_finance_revisions_v1(id,tournament_id,event_id),
 foreign key(prior_allocation_revision_id,tournament_id)
  references app.native_ledger_allocation_revisions_v1(id,tournament_id),
 foreign key(current_allocation_revision_id,tournament_id)
  references app.native_ledger_allocation_revisions_v1(id,tournament_id),
 check(jsonb_typeof(dispositions)='array'and jsonb_typeof(prior_cost_lineages)='array'
  and jsonb_typeof(current_cost_rows)='array'and jsonb_typeof(income_rebind_capture)='array'),
 check(reason=app.custom_payout_classification_text_v2(reason)
  and app.event_settings_js_text_length_v3(reason)between 1 and 2000)
);
alter table app.operational_event_finance_source_adoptions_v1 owner to postgres;
alter table app.operational_event_finance_source_adoptions_v1 enable row level security;
alter table app.operational_event_finance_source_adoptions_v1 force row level security;
revoke all on table app.operational_event_finance_source_adoptions_v1 from public,anon,authenticated,service_role;
create trigger operational_event_finance_source_adoptions_v1_immutable
before update or delete on app.operational_event_finance_source_adoptions_v1
for each row execute function app.reject_immutable_history();

create function app.operational_finance_basis_line_id_v1(
 tid uuid,eid uuid,allocation_id uuid,source_id uuid,bucket text
)returns uuid language sql immutable set search_path=''as $$
 select(
  substring(md,1,8)||'-'||substring(md,9,4)||'-'||substring(md,13,4)||'-'||
  substring(md,17,4)||'-'||substring(md,21,12)
 )::uuid from(select md5('operational-finance-basis-line-v1|'||tid::text||'|'||
  eid::text||'|'||allocation_id::text||'|'||source_id::text||'|'||bucket)md)x
$$;

-- Excludes only the native cost allocation revision and its derived IDs. Every
-- eligibility, settings, qualification, participant and regular-entry fact is
-- required to remain byte-equivalent in the bounded v1 adoption scope.
create function app.operational_finance_adoption_frame_v1(source_value jsonb)returns jsonb
language sql immutable set search_path=''as $$
 with raw as(select source_value->'raw'v),w as(select source_value#>'{basis,workspace}'v),
 regular as(select coalesce(jsonb_agg(s order by s->>'sourceId'),'[]'::jsonb)v
  from raw cross join lateral jsonb_array_elements(raw.v#>'{allocation,eventSources}')s
  where s->>'kind'='entry_receipt')
 select jsonb_build_object(
  'binding',raw.v->'binding','event',raw.v->'event','settings',raw.v->'settings',
  'counts',raw.v->'counts','qualification',raw.v->'qualification','coverage',raw.v->'coverage',
  'regularSources',regular.v,
  'workspace',jsonb_build_object(
   'complete',w.v->'complete','mode',w.v->'mode','tournamentName',w.v->'tournamentName',
   'eventName',w.v->'eventName','eventKind',w.v->'eventKind','startLabel',w.v->'startLabel',
   'entryCount',w.v->'entryCount','paidEntryCount',w.v->'paidEntryCount',
   'qualifierCount',w.v->'qualifierCount','grossEntryMinor',w.v->'grossEntryMinor',
   'settings',w.v->'settings','settingsSnapshotId',w.v#>'{payoutSource,settingsSnapshotId}'
  )
 )from raw,w,regular
$$;

create function app.operational_finance_adoption_frame_digest_v1(source_value jsonb)returns text
language sql immutable set search_path=''as $$
 select encode(extensions.digest(convert_to(jsonb_build_array(
  'operational-finance-source-adoption-frame-v1',
  app.operational_finance_adoption_frame_v1(source_value)
 )::text,'utf8'),'sha256'),'hex')
$$;

create function app.operational_finance_adoption_lineages_v1(revision_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare head app.operational_event_finance_revisions_v1%rowtype;
 base_row jsonb;line jsonb;records jsonb;latest jsonb;source_row jsonb;part jsonb;
 line_id uuid;source_event uuid;source_owner uuid;native_ids text[]:='{}';result jsonb:='[]';
 adoption_label text;
begin
 select*into head from app.operational_event_finance_revisions_v1 where id=revision_id;
 if not found then return null;end if;
 for base_row in select value from jsonb_array_elements(head.basis#>'{workspace,history}')loop
  line:=base_row->'line';line_id:=(line->>'lineId')::uuid;
  source_event:=null;source_owner:=null;
  for source_row in select value from jsonb_array_elements(head.source_capture#>'{allocation,eventSources}')loop
   if source_row->>'kind'<>'expense'then continue;end if;
   for part in select value from jsonb_array_elements(source_row->'allocations')loop
    if part->>'eventId'=head.event_id::text and part->>'bucket'=line->>'category'
     and app.operational_finance_basis_line_id_v1(
      head.tournament_id,head.event_id,head.native_allocation_revision_id,
      (source_row->>'sourceId')::uuid,part->>'bucket'
     )=line_id then source_event:=(source_row->>'sourceId')::uuid;exit;end if;
   end loop;
   if source_event is not null then exit;end if;
  end loop;
  select expense_id into source_owner from app.tournament_expense_events where id=source_event;
  select coalesce(jsonb_agg(x.value order by x.n),'[]'::jsonb)into records
   from jsonb_array_elements(head.editor->'history')with ordinality x(value,n)
   where x.value#>>'{line,lineId}'=line_id::text;
  latest:=records->(jsonb_array_length(records)-1);
  adoption_label:=null;
  if jsonb_array_length(records)=1 then
   select disposition->>'alias'into adoption_label
   from app.operational_event_finance_source_adoptions_v1 adoption
   join app.operational_event_finance_revisions_v1 adopted
    on adopted.id=adoption.new_revision_id and adopted.tournament_id=head.tournament_id
    and adopted.event_id=head.event_id and adopted.version<=head.version
   cross join lateral jsonb_array_elements(adoption.dispositions)disposition
   where adoption.tournament_id=head.tournament_id and adoption.event_id=head.event_id
    and adoption.current_source_digest=head.source_digest
    and adoption.current_allocation_revision_id=head.native_allocation_revision_id
    and disposition->>'currentBasisLineId'=line_id::text
   order by adopted.version desc limit 1;
  end if;
  result:=result||jsonb_build_array(jsonb_build_object(
   'lineId',line_id,'origin','native','nativeBasisLineId',line_id,
   'sourceExpenseId',source_owner,'sourceExpenseEventId',source_event,
   'bucket',line->>'category','capturedAmountMinor',line->'amountMinor',
   'snapshotLabel',coalesce(adoption_label,latest->>'label'),'records',records,
   'latest',jsonb_build_object('recordId',latest#>>'{line,recordId}',
    'amountMinor',latest#>'{line,amountMinor}','voided',latest#>'{line,voided}',
    'category',latest#>'{line,category}','label',latest->'label','reason',latest#>'{line,reason}')
  ));
  native_ids:=array_append(native_ids,line_id::text);
 end loop;
 for line_id in
  select(x.value#>>'{line,lineId}')::uuid from jsonb_array_elements(head.editor->'history')with ordinality x(value,n)
  where x.value#>>'{line,category}'in('player_benefit','operating_expense')
   and not((x.value#>>'{line,lineId}')=any(native_ids))
  group by x.value#>>'{line,lineId}'order by min(x.n)
 loop
  select coalesce(jsonb_agg(x.value order by x.n),'[]'::jsonb)into records
   from jsonb_array_elements(head.editor->'history')with ordinality x(value,n)
   where x.value#>>'{line,lineId}'=line_id::text;
  latest:=records->(jsonb_array_length(records)-1);line:=latest->'line';
  result:=result||jsonb_build_array(jsonb_build_object(
   'lineId',line_id,'origin','manual','nativeBasisLineId',null,
   'sourceExpenseId',null,'sourceExpenseEventId',null,
   'bucket',line->>'category','capturedAmountMinor',records#>'{0,line,amountMinor}',
   'snapshotLabel',latest->>'label','records',records,
   'latest',jsonb_build_object('recordId',line->>'recordId','amountMinor',line->'amountMinor',
    'voided',line->'voided','category',line->'category','label',latest->'label','reason',line->'reason')
  ));
 end loop;
 return result;
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end$$;

create function app.operational_finance_adoption_cost_rows_v1(
 tid uuid,eid uuid,source_value jsonb
)returns jsonb language plpgsql security definer set search_path=''as $$
declare source_row jsonb;part jsonb;expense app.tournament_expense_events%rowtype;
 allocation_id uuid;allocations jsonb;lines jsonb;line_id uuid;result jsonb:='[]';
 allocated numeric;seen_physical_buckets text[]:='{}';physical_bucket text;
begin
 allocation_id:=(source_value#>>'{raw,allocation,revisionId}')::uuid;
 for source_row in select value from jsonb_array_elements(source_value#>'{raw,allocation,eventSources}')
  where value->>'kind'='expense'order by value->>'sourceId'
 loop
  select*into expense from app.tournament_expense_events
   where id=(source_row->>'sourceId')::uuid and tournament_id=tid;
   if expense.id is null or expense.event_type<>'recorded'or exists(
    select 1 from app.tournament_expense_events newer
    where newer.expense_id=expense.expense_id and newer.version>expense.version
   )then return null;end if;
   allocations:='[]';lines:='[]';allocated:=0;
  for part in select value from jsonb_array_elements(source_row->'allocations')
   where value->>'eventId'=eid::text and value->>'bucket'in('player_benefit','operating_expense')
   order by value->>'bucket'
  loop
   line_id:=app.operational_finance_basis_line_id_v1(
    tid,eid,allocation_id,(source_row->>'sourceId')::uuid,part->>'bucket');
    physical_bucket:=expense.id::text||':'||(part->>'bucket');
    if physical_bucket=any(seen_physical_buckets)then return null;end if;
    seen_physical_buckets:=array_append(seen_physical_buckets,physical_bucket);
    allocated:=allocated+(part->>'amountMinor')::numeric;
   allocations:=allocations||jsonb_build_array(jsonb_build_object(
    'eventId',eid,'bucket',part->>'bucket','amountMinor',part->'amountMinor',
    'allocationRevisionId',allocation_id));
   lines:=lines||jsonb_build_array(jsonb_build_object(
    'lineId',line_id,'bucket',part->>'bucket','amountMinor',part->'amountMinor',
    'label',case part->>'bucket'when'player_benefit'then'Allocated Player Benefit'
      else'Allocated Operating Expense'end));
  end loop;
  if jsonb_array_length(lines)=0 then continue;end if;
   if allocated<=0 or allocated>expense.amount_minor then return null;end if;
  result:=result||jsonb_build_array(jsonb_build_object(
   'expenseId',expense.expense_id,'expenseEventId',expense.id,'expenseVersion',expense.version,
   'description',expense.description,'amountMinor',expense.amount_minor,
   'recordedAt',to_char(expense.recorded_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'allocations',allocations,'currentBasisLines',lines));
 end loop;
 return result;
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end$$;

create function app.operational_finance_adoption_sanctioning_v1(
 tid uuid,eid uuid,cost_rows jsonb,source_value jsonb
)returns jsonb language plpgsql security definer set search_path=''as $$
declare snapshot app.event_sanctioning_fee_snapshots%rowtype;row_value jsonb;allocated numeric;
 coverage jsonb;candidates jsonb:='[]';
begin
 select*into snapshot from app.event_sanctioning_fee_snapshots where tournament_id=tid and event_id=eid;
 if not found then return null;end if;
 for row_value in select value from jsonb_array_elements(cost_rows)order by value->>'expenseEventId'loop
  select coalesce(sum((p->>'amountMinor')::numeric),0)into allocated
   from jsonb_array_elements(row_value->'allocations')p;
   coverage:=app.native_sanctioning_coverage_v1(tid,eid,
    jsonb_build_object('nativeFinanceSource',source_value),(row_value->>'expenseEventId')::uuid);
  candidates:=candidates||jsonb_build_array(jsonb_build_object(
   'expenseId',row_value->'expenseId','expenseEventId',row_value->'expenseEventId',
   'allocatedMinor',allocated::bigint,
   'bucket',case when jsonb_array_length(row_value->'allocations')=1
    then row_value#>>'{allocations,0,bucket}'else null end,
    'covered',coverage->>'status'='available'and allocated>=snapshot.total_cents));
 end loop;
 return jsonb_build_object('snapshotId',snapshot.id,'eventPlayStartId',snapshot.event_play_start_id,
  'rateMinor',snapshot.rate_cents,'eligibleParticipantCount',snapshot.eligible_participant_count,
  'totalMinor',snapshot.total_cents,'candidates',candidates);
end$$;

create function app.operational_finance_source_adoption_workspace_v1(
 tid uuid,eid uuid,actor uuid
)returns jsonb language plpgsql security definer set search_path=''as $$
declare head app.operational_event_finance_revisions_v1%rowtype;current_source jsonb;prior_source jsonb;
 prior_frame text;current_frame text;lineages jsonb;cost_rows jsonb;sanctioning jsonb;
 workspace_status text:='available';workspace_code text:=null;
begin
 if actor is null or auth.uid()is distinct from actor then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then
  return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor
  and role in('director','co_director')order by role for key share nowait;
 if not found then return null;end if;
 lock table app.native_unrestricted_income_sources_v1,app.native_unrestricted_income_records_v1,
  app.native_recorded_fund_reviews_v1,app.native_playoff_final_award_sets_v1 in share mode nowait;
 select*into head from app.operational_event_finance_revisions_v1
  where tournament_id=tid and event_id=eid order by version desc limit 1;
 current_source:=app.operational_event_finance_source_v1(tid,eid,actor);
 if current_source->>'status'='retry_exact'then return current_source;end if;
 if current_source->>'status'is distinct from'source_available'then
  return jsonb_build_object('status','blocked','code',coalesce(current_source->>'code','source_unavailable'));
 end if;
 cost_rows:=app.operational_finance_adoption_cost_rows_v1(tid,eid,current_source);
  sanctioning:=app.operational_finance_adoption_sanctioning_v1(tid,eid,cost_rows,current_source);
 if head.id is null then workspace_status:='blocked';workspace_code:='proposal_head_required';lineages:='[]';
 else
  prior_source:=jsonb_build_object('raw',head.source_capture,'basis',head.basis);
  prior_frame:=app.operational_finance_adoption_frame_digest_v1(prior_source);
  current_frame:=app.operational_finance_adoption_frame_digest_v1(current_source);
  lineages:=app.operational_finance_adoption_lineages_v1(head.id);
   if head.editor->'lineForm'<>'null'::jsonb or head.editor->'bandForm'<>'null'::jsonb then
    workspace_status:='blocked';workspace_code:='unfinished_retained_form';
   elsif head.source_digest=current_source->>'sourceDigest'and head.basis_digest=current_source->>'basisDigest'then
   workspace_status:='blocked';workspace_code:='adoption_not_required';
  elsif prior_frame is distinct from current_frame then
   workspace_status:='blocked';workspace_code:='adoption_scope_changed';
  elsif lineages is null or cost_rows is null or exists(
   select 1 from jsonb_array_elements(lineages)x
    where x->>'origin'='native'and(x->'sourceExpenseId'='null'::jsonb or x->'sourceExpenseEventId'='null'::jsonb)
  )then workspace_status:='blocked';workspace_code:='adoption_lineage_unavailable';
  elsif exists(select 1 from app.native_playoff_final_award_sets_v1
    where tournament_id=tid and event_id=eid)
   or app.legacy_financial_liability_exists_v1(tid,eid)then
   workspace_status:='blocked';workspace_code:='source_already_finalized';
  elsif exists(
   select 1 from jsonb_array_elements(cost_rows)c
   join app.roster_payment_events p on p.tournament_id=tid and p.id=(c->>'expenseEventId')::uuid
  )or exists(
   select 1 from jsonb_array_elements(cost_rows)c
   join app.native_unrestricted_income_sources_v1 i
    on i.tournament_id=tid and i.physical_evidence_id=(c->>'expenseEventId')::uuid
  )then workspace_status:='blocked';workspace_code:='physical_evidence_conflict';
  end if;
 end if;
 return jsonb_build_object(
  'kind','operational-finance-source-adoption-workspace-v1','actorId',actor,
  'tournamentId',tid,'eventId',eid,'status',workspace_status,'code',workspace_code,
  'head',case when head.id is null then null else jsonb_build_object(
   'revisionId',head.id,'version',head.version,'sourceDigest',head.source_digest,
   'basisDigest',head.basis_digest,'nativeAllocationRevisionId',head.native_allocation_revision_id,
   'sourceCapture',head.source_capture,'basis',head.basis,'editor',head.editor)end,
  'currentSource',current_source,'unchangedFrameDigest',case when head.id is null then null else current_frame end,
  'costLineages',coalesce(lineages,'[]'::jsonb),'costRows',coalesce(cost_rows,'[]'::jsonb),
  'sanctioning',sanctioning,'proposalOnly',true,'moneyMoved',false,
  'payoutAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then
  return jsonb_build_object('status','blocked','code','source_shape_invalid');
end$$;

create function app.get_operational_finance_source_adoption_workspace_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();begin
 if actor is null or app.operational_finance_source_adoption_enabled_v1()is distinct from true then return null;end if;
 return app.operational_finance_source_adoption_workspace_v1(tid,eid,actor);
end$$;

create function app.save_operational_finance_source_adoption_v1(
 tid uuid,eid uuid,request_value jsonb
)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();op uuid;request_hash text;prior_operation app.operational_event_finance_operations_v1%rowtype;
 prior_result jsonb;head app.operational_event_finance_revisions_v1%rowtype;workspace jsonb;current_source jsonb;
 current_basis jsonb;editor jsonb;dispositions jsonb;d jsonb;lineage jsonb;target jsonb;
 prior_line uuid;current_line uuid;seen_prior text[]:='{}';seen_current text[]:='{}';
 lineage_count integer;current_count integer;target_count integer;records_count integer;
 expected_history jsonb;income_capture jsonb:='[]';history_row jsonb;rebound jsonb;
 old_override_count integer;reason_value text;new_revision uuid;adoption_id uuid;
 fresh_override_plan jsonb;current_fund numeric;current_gross numeric;
 current_benefit numeric;current_operating numeric;current_income numeric;
 mapping_capture jsonb;mapping_digest text;qualification_id uuid;
begin
 if actor is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then
  return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(request_value)is distinct from'object'
  or(select count(*)from jsonb_object_keys(request_value))<>12
  or not(request_value?&array['kind','operationId','expectedVersion','expectedPriorRevisionId',
   'expectedPriorSourceDigest','expectedPriorBasisDigest','expectedCurrentSourceDigest',
   'expectedCurrentBasisDigest','expectedUnchangedFrameDigest','dispositions','editor','reason'])
   or jsonb_typeof(request_value->'kind')is distinct from'string'
   or request_value->>'kind'is distinct from'operational-finance-source-adoption-v1'
  or jsonb_typeof(request_value->'operationId')is distinct from'string'
  or coalesce(request_value->>'operationId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or jsonb_typeof(request_value->'expectedVersion')is distinct from'number'
  or(request_value->>'expectedVersion')!~'^[1-9][0-9]*$'
  or(request_value->>'expectedVersion')::numeric>2147483646
  or jsonb_typeof(request_value->'expectedPriorRevisionId')is distinct from'string'
  or coalesce(request_value->>'expectedPriorRevisionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(request_value->>'expectedPriorSourceDigest','')!~'^[a-f0-9]{64}$'
  or coalesce(request_value->>'expectedPriorBasisDigest','')!~'^[a-f0-9]{64}$'
  or coalesce(request_value->>'expectedCurrentSourceDigest','')!~'^[a-f0-9]{64}$'
  or coalesce(request_value->>'expectedCurrentBasisDigest','')!~'^[a-f0-9]{64}$'
  or coalesce(request_value->>'expectedUnchangedFrameDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request_value->'dispositions')is distinct from'array'
  or jsonb_array_length(request_value->'dispositions')>20000
  or jsonb_typeof(request_value->'editor')is distinct from'object'
  or jsonb_typeof(request_value->'reason')is distinct from'string'
  or request_value->>'reason'is distinct from app.custom_payout_classification_text_v2(request_value->>'reason')
  or app.event_settings_js_text_length_v3(request_value->>'reason')not between 1 and 2000
  or octet_length(request_value::text)>4100000 then
  return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(request_value->>'operationId')::uuid;reason_value:=request_value->>'reason';
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then
  return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then
  return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor
  and role in('director','co_director')order by role for key share nowait;
 if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
  request_hash:=encode(extensions.digest(convert_to(jsonb_build_array(
   'operational-event-finance-proposal-v1',actor,tid,eid,op,request_value
 )::text,'utf8'),'sha256'),'hex');
 select*into prior_operation from app.operational_event_finance_operations_v1
  where actor_id=actor and operation_id=op;
 if found then
  if prior_operation.tournament_id is distinct from tid or prior_operation.event_id is distinct from eid
   or prior_operation.request_hash is distinct from request_hash
   or prior_operation.request_payload is distinct from request_value then
   return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select result into prior_result from app.operational_event_finance_outcomes_v1
   where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
  if prior_result is null then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
  return prior_result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if app.operational_finance_source_adoption_enabled_v1()is distinct from true then
  return jsonb_build_object('status','rejected','code','feature_unavailable','proposalOnly',true,
   'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);end if;
 workspace:=app.operational_finance_source_adoption_workspace_v1(tid,eid,actor);
 if workspace->>'status'='retry_exact'then return workspace;end if;
 insert into app.operational_event_finance_operations_v1(
  actor_id,operation_id,tournament_id,event_id,request_payload,request_hash
 )values(actor,op,tid,eid,request_value,request_hash);
 if workspace->>'status'is distinct from'available'then
  return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,
   jsonb_build_object('status','rejected','code',coalesce(workspace->>'code','source_unavailable')));
 end if;
 select*into head from app.operational_event_finance_revisions_v1
  where tournament_id=tid and event_id=eid order by version desc limit 1;
 current_source:=workspace->'currentSource';current_basis:=current_source->'basis';
 if head.id::text is distinct from request_value->>'expectedPriorRevisionId'
  or head.version is distinct from(request_value->>'expectedVersion')::integer
  or head.source_digest is distinct from request_value->>'expectedPriorSourceDigest'
  or head.basis_digest is distinct from request_value->>'expectedPriorBasisDigest'
  or current_source->>'sourceDigest'is distinct from request_value->>'expectedCurrentSourceDigest'
  or current_source->>'basisDigest'is distinct from request_value->>'expectedCurrentBasisDigest'
  or workspace->>'unchangedFrameDigest'is distinct from request_value->>'expectedUnchangedFrameDigest'then
  return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,
   jsonb_build_object('status','rejected','code','source_changed'));
 end if;
 dispositions:=request_value->'dispositions';editor:=request_value->'editor';
 lineage_count:=jsonb_array_length(workspace->'costLineages');
 select count(*)into current_count from jsonb_array_elements(workspace->'costRows')c
  cross join lateral jsonb_array_elements(c->'currentBasisLines')l;
 for d in select value from jsonb_array_elements(dispositions)loop
  if jsonb_typeof(d)is distinct from'object'or(select count(*)from jsonb_object_keys(d))<>8
   or not(d?&array['kind','priorLineId','currentBasisLineId','currentExpenseId',
    'currentExpenseEventId','bucket','alias','reason'])
   or jsonb_typeof(d->'kind')is distinct from'string'
   or d->>'kind'not in('carry_native','restore_native','replace_manual','introduce_recorded',
    'retire_voided_manual','retire_zero_manual')
   or jsonb_typeof(d->'bucket')is distinct from'string'
   or d->>'bucket'not in('player_benefit','operating_expense')
   or jsonb_typeof(d->'reason')is distinct from'string'
   or d->>'reason'is distinct from app.custom_payout_classification_text_v2(d->>'reason')
   or app.event_settings_js_text_length_v3(d->>'reason')not between 1 and 2000 then
   return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,
    jsonb_build_object('status','rejected','code','invalid_disposition'));
  end if;
  if d->>'kind'='introduce_recorded'then
   if d->'priorLineId'<>'null'::jsonb then
    return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,jsonb_build_object('status','rejected','code','invalid_disposition'));end if;
   lineage:=null;
  else
   if jsonb_typeof(d->'priorLineId')is distinct from'string'
    or coalesce(d->>'priorLineId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or(d->>'priorLineId')=any(seen_prior)then
    return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,jsonb_build_object('status','rejected','code','invalid_disposition'));end if;
   prior_line:=(d->>'priorLineId')::uuid;
   select value into lineage from jsonb_array_elements(workspace->'costLineages')
    where value->>'lineId'=prior_line::text;
   if lineage is null then
    return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,jsonb_build_object('status','rejected','code','lineage_mismatch'));end if;
   seen_prior:=array_append(seen_prior,prior_line::text);
  end if;
  if d->>'kind'in('retire_voided_manual','retire_zero_manual')then
   if d->'currentBasisLineId'<>'null'::jsonb or d->'currentExpenseId'<>'null'::jsonb
    or d->'currentExpenseEventId'<>'null'::jsonb or d->'alias'<>'null'::jsonb
    or lineage->>'origin'<>'manual'
    or lineage#>>'{latest,category}'is distinct from d->>'bucket'
    or(d->>'kind'='retire_voided_manual'and lineage#>>'{latest,voided}'<>'true')
     or(d->>'kind'='retire_zero_manual'and(
       lineage#>>'{latest,voided}'<>'false'or(lineage#>>'{latest,amountMinor}')::numeric<>0))then
    return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,jsonb_build_object('status','rejected','code','invalid_retirement'));end if;
   continue;
  end if;
  if jsonb_typeof(d->'currentBasisLineId')is distinct from'string'
   or jsonb_typeof(d->'currentExpenseId')is distinct from'string'
   or jsonb_typeof(d->'currentExpenseEventId')is distinct from'string'
   or coalesce(d->>'currentBasisLineId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or coalesce(d->>'currentExpenseId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or coalesce(d->>'currentExpenseEventId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or jsonb_typeof(d->'alias')is distinct from'string'
   or d->>'alias'is distinct from app.custom_payout_classification_text_v2(d->>'alias')
   or app.event_settings_js_text_length_v3(d->>'alias')not between 1 and 200 then
   return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,jsonb_build_object('status','rejected','code','invalid_target'));
  end if;
  current_line:=(d->>'currentBasisLineId')::uuid;
  if current_line::text=any(seen_current)then
   return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,jsonb_build_object('status','rejected','code','duplicate_target'));end if;
   select count(*)into target_count from jsonb_array_elements(workspace->'costRows')c
    cross join lateral jsonb_array_elements(c->'currentBasisLines')l
    where l->>'lineId'=current_line::text;
   if target_count<>1 then
    return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,
     jsonb_build_object('status','rejected','code','target_mismatch'));end if;
   select jsonb_build_object('expenseId',c->'expenseId','expenseEventId',c->'expenseEventId','line',l)
   into target from jsonb_array_elements(workspace->'costRows')c
   cross join lateral jsonb_array_elements(c->'currentBasisLines')l
   where l->>'lineId'=current_line::text;
  if target is null or target->>'expenseId'is distinct from d->>'currentExpenseId'
   or target->>'expenseEventId'is distinct from d->>'currentExpenseEventId'
   or target#>>'{line,bucket}'is distinct from d->>'bucket'then
   return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,jsonb_build_object('status','rejected','code','target_mismatch'));end if;
  seen_current:=array_append(seen_current,current_line::text);
  if d->>'kind'in('carry_native','restore_native')then
   records_count:=jsonb_array_length(lineage->'records');
   if lineage->>'origin'<>'native'
    or lineage->>'sourceExpenseId'is distinct from target->>'expenseId'
    or lineage->>'sourceExpenseEventId'is distinct from target->>'expenseEventId'
    or lineage->>'bucket'is distinct from target#>>'{line,bucket}'
    or(lineage->>'capturedAmountMinor')::numeric is distinct from(target#>>'{line,amountMinor}')::numeric
    or(d->>'kind'='carry_native'and records_count<>1)
    or(d->>'kind'='restore_native'and records_count<2)then
    return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,jsonb_build_object('status','rejected','code','native_lineage_changed'));end if;
  elsif d->>'kind'='replace_manual'then
   if lineage->>'origin'<>'manual'or lineage#>>'{latest,voided}'<>'false'
    or(lineage#>>'{latest,amountMinor}')::numeric<=0 then
    return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,jsonb_build_object('status','rejected','code','manual_lineage_mismatch'));end if;
  elsif d->>'kind'<>'introduce_recorded'then
   return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,jsonb_build_object('status','rejected','code','invalid_disposition'));
  end if;
 end loop;
 if coalesce(array_length(seen_prior,1),0)<>lineage_count
  or coalesce(array_length(seen_current,1),0)<>current_count then
  return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,
   jsonb_build_object('status','rejected','code','disposition_coverage_incomplete'));
 end if;
 -- Rebuild the exact income tail while changing only the source binding.
 expected_history:=current_basis#>'{workspace,history}';
 for history_row in select x.value from jsonb_array_elements(head.editor->'history')with ordinality x(value,n)
  where x.value#>>'{line,category}'='unrestricted_income'order by x.n
 loop
  rebound:=jsonb_set(history_row,'{line,source}',current_basis#>'{workspace,source}',true);
  expected_history:=expected_history||jsonb_build_array(rebound);
  income_capture:=income_capture||jsonb_build_array(jsonb_build_object('prior',history_row,'current',rebound));
 end loop;
 if jsonb_array_length(editor->'overrideHistory')>0 then
  select coalesce(sum(case when line->>'category'='player_benefit'and line->>'voided'='false'
     then(line->>'amountMinor')::numeric else 0 end),0),
   coalesce(sum(case when line->>'category'='operating_expense'and line->>'voided'='false'
     then(line->>'amountMinor')::numeric else 0 end),0),
   coalesce(sum(case when line->>'category'='unrestricted_income'and line->>'voided'='false'
     then(line->>'amountMinor')::numeric else 0 end),0)
  into current_benefit,current_operating,current_income
  from(select distinct on(value#>>'{line,lineId}')value->'line'as line
   from jsonb_array_elements(expected_history)with ordinality x(value,n)
   order by value#>>'{line,lineId}',n desc)s;
  current_gross:=(current_basis#>>'{workspace,grossEntryMinor}')::numeric;
  current_fund:=current_gross-current_benefit-current_operating+current_income;
  if jsonb_typeof(editor->'overrideInput')is distinct from'object'
   or(select count(*)from jsonb_object_keys(editor->'overrideInput'))<>3
   or editor#>'{overrideInput,fundMinor}'is distinct from to_jsonb(current_fund::bigint)
   or editor#>'{overrideInput,settings}'is distinct from current_basis#>'{workspace,settings}'
   or editor#>'{overrideInput,qualifierCount}'is distinct from current_basis#>'{workspace,qualifierCount}'
   or jsonb_typeof(editor->'overridePlan')is distinct from'string'then
   return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,
    jsonb_build_object('status','rejected','code','stale_override_plan'));
  end if;
  begin fresh_override_plan:=(editor->>'overridePlan')::jsonb;
  exception when invalid_text_representation then
   return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,
    jsonb_build_object('status','rejected','code','stale_override_plan'));
  end;
  if fresh_override_plan is distinct from jsonb_build_object(
   'basis',current_basis->'workspace','history',expected_history)then
   return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,
    jsonb_build_object('status','rejected','code','stale_override_plan'));
  end if;
 end if;
 if editor->'basis'is distinct from current_basis->'workspace'
  or editor->'history'is distinct from expected_history
  or editor->'lineForm'<>'null'::jsonb or editor->'bandForm'<>'null'::jsonb
  or jsonb_typeof(editor->'overrideHistory')is distinct from'array'
  or jsonb_array_length(editor->'overrideHistory')<jsonb_array_length(head.editor->'overrideHistory')
  or exists(select 1 from jsonb_array_elements(head.editor->'overrideHistory')with ordinality x(value,n)
   where value is distinct from editor->'overrideHistory'->((n-1)::integer))
  or not app.valid_operational_event_finance_editor_v1(editor,current_basis,null)then
  return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,
   jsonb_build_object('status','rejected','code','invalid_adopted_editor'));
 end if;
 qualification_id:=case when current_source#>'{raw,qualification}'='null'::jsonb then null
  else(current_source#>>'{raw,qualification,resultVersionId}')::uuid end;
 insert into app.operational_event_finance_revisions_v1(
  tournament_id,event_id,version,prior_revision_id,actor_id,operation_id,
  binding_id,activation_id,setup_event_version_id,settings_snapshot_id,
  context_review_id,native_allocation_revision_id,qualification_result_version_id,
  source_digest,basis_digest,source_capture,basis,editor,reason
 )values(tid,eid,head.version+1,head.id,actor,op,
  (current_source#>>'{raw,binding,bindingId}')::uuid,
  (current_source#>>'{raw,binding,activationId}')::uuid,
  (current_source#>>'{raw,binding,setupEventVersionId}')::uuid,
  (current_source#>>'{raw,binding,settingsSnapshotId}')::uuid,
  (current_source#>>'{raw,binding,reviewId}')::uuid,
  (current_source#>>'{raw,allocation,revisionId}')::uuid,qualification_id,
  current_source->>'sourceDigest',current_source->>'basisDigest',
  current_source->'raw',current_basis,editor,reason_value
 )returning id into new_revision;
 mapping_capture:=jsonb_build_object('dispositions',dispositions,
  'priorCostLineages',workspace->'costLineages','currentCostRows',workspace->'costRows');
 mapping_digest:=encode(extensions.digest(convert_to(jsonb_build_array(
  'operational-finance-source-adoption-v1',tid,eid,head.id,new_revision,
  workspace->>'unchangedFrameDigest',mapping_capture,income_capture
 )::text,'utf8'),'sha256'),'hex');
 insert into app.operational_event_finance_source_adoptions_v1(
  tournament_id,event_id,actor_id,operation_id,prior_revision_id,new_revision_id,
  prior_allocation_revision_id,current_allocation_revision_id,
  prior_source_digest,prior_basis_digest,current_source_digest,current_basis_digest,
  unchanged_frame_digest,mapping_digest,dispositions,prior_cost_lineages,
  current_cost_rows,income_rebind_capture,reason
 )values(tid,eid,actor,op,head.id,new_revision,head.native_allocation_revision_id,
  (current_source#>>'{raw,allocation,revisionId}')::uuid,head.source_digest,head.basis_digest,
  current_source->>'sourceDigest',current_source->>'basisDigest',workspace->>'unchangedFrameDigest',
  mapping_digest,dispositions,workspace->'costLineages',workspace->'costRows',income_capture,reason_value)
 returning id into adoption_id;
 return app.finish_operational_event_finance_operation_v1(actor,tid,eid,op,jsonb_build_object(
  'status','accepted','code','operational_finance_source_adopted','revisionId',new_revision,
  'version',head.version+1,'priorRevisionId',head.id,'sourceDigest',current_source->>'sourceDigest',
  'basisDigest',current_source->>'basisDigest','adoptionId',adoption_id,
  'mappingDigest',mapping_digest,'historicalReceipt',false,'currentSourceVerified',true,
  'disbursementAuthorized',false));
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then
  return jsonb_build_object('status','rejected','code','invalid_request');
end$$;

create function app.reconcile_operational_finance_source_adoption_v1(
 tid uuid,eid uuid,op uuid
)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();operation app.operational_event_finance_operations_v1%rowtype;result jsonb;begin
 if actor is null or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor
  and role in('director','co_director')order by role for key share nowait;
 if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then
  return jsonb_build_object('authorized',true,'request',null,
   'result',jsonb_build_object('status','retry_exact','code','operation_busy'));end if;
 select*into operation from app.operational_event_finance_operations_v1
  where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
 if not found then return jsonb_build_object('authorized',true,'request',null,'result',null);end if;
 if operation.request_payload->>'kind'is distinct from'operational-finance-source-adoption-v1'then return null;end if;
 select o.result into result from app.operational_event_finance_outcomes_v1 o
  where o.actor_id=actor and o.operation_id=op and o.tournament_id=tid and o.event_id=eid;
  if result is null then result:=jsonb_build_object('status','retry_exact','code','operation_incomplete');
  else result:=result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);end if;
 return jsonb_build_object('authorized',true,'request',operation.request_payload,'result',result);
exception when lock_not_available then return jsonb_build_object('authorized',true,'request',null,
 'result',jsonb_build_object('status','retry_exact','code','source_busy'));
end$$;

create function public.get_operational_finance_source_adoption_workspace_provider_v1(
 tid uuid,eid uuid
)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid;result jsonb;begin
 if app.operational_provider_transport_enabled_v1()is distinct from true
  or app.operational_finance_source_adoption_enabled_v1()is distinct from true then return null;end if;
 actor:=app.require_operational_provider_official_v1(tid);
 if actor is null then return null;end if;
 result:=app.operational_finance_source_adoption_workspace_v1(tid,eid,actor);
 if result is not null and result->>'actorId'is distinct from actor::text then return null;end if;
 return result;
end$$;

create function public.save_operational_finance_source_adoption_provider_v1(
 tid uuid,eid uuid,request_value jsonb
)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid;op uuid;outcome jsonb;begin
 if app.operational_provider_transport_enabled_v1()is distinct from true
  or app.operational_finance_source_adoption_enabled_v1()is distinct from true then
  return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 actor:=app.require_operational_provider_official_v1(tid);
 if actor is null or jsonb_typeof(request_value)is distinct from'object'
  or coalesce(request_value->>'operationId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then return null;end if;
 op:=(request_value->>'operationId')::uuid;
 outcome:=app.save_operational_finance_source_adoption_v1(tid,eid,request_value);
 return jsonb_build_object('kind','operational-finance-source-adoption-provider-write-v1',
  'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,
  'request',request_value,'outcome',outcome);
end$$;

create function public.get_operational_finance_source_adoption_operation_provider_v1(
 tid uuid,eid uuid,op uuid
)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid;recovery jsonb;begin
 if app.operational_provider_transport_enabled_v1()is distinct from true
  or app.operational_finance_source_adoption_enabled_v1()is distinct from true then return null;end if;
 actor:=app.require_operational_provider_official_v1(tid);if actor is null then return null;end if;
 recovery:=app.reconcile_operational_finance_source_adoption_v1(tid,eid,op);
 if recovery->'authorized'is distinct from'true'::jsonb then return null;end if;
 return jsonb_build_object('kind','operational-finance-source-adoption-provider-write-v1',
  'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,
  'request',recovery->'request','outcome',recovery->'result');
end$$;

create function public.get_native_ledger_allocation_provider_v1(tid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$declare actor uuid;sources jsonb;allocation jsonb;begin
 if app.operational_provider_transport_enabled_v1()is distinct from true
  or app.operational_finance_source_adoption_enabled_v1()is distinct from true then return null;end if;
 actor:=app.require_operational_provider_official_v1(tid);if actor is null then return null;end if;
 sources:=app.get_native_event_ledger_sources_v1(tid);
 if sources->>'actorId'is distinct from actor::text or sources->>'tournamentId'is distinct from tid::text then return null;end if;
 allocation:=app.get_native_ledger_allocation_v1(tid);
 return jsonb_build_object('kind','native-ledger-allocation-provider-workspace-v1',
  'actorId',actor,'tournamentId',tid,'sources',sources,'allocation',allocation,
  'proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
end$$;

create function public.save_native_ledger_allocation_provider_v1(tid uuid,request_value jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$declare actor uuid;op uuid;outcome jsonb;begin
 if app.operational_provider_transport_enabled_v1()is distinct from true
  or app.operational_finance_source_adoption_enabled_v1()is distinct from true then
  return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 actor:=app.require_operational_provider_official_v1(tid);
 if actor is null or jsonb_typeof(request_value)is distinct from'object'
  or coalesce(request_value->>'operationId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then return null;end if;
 op:=(request_value->>'operationId')::uuid;outcome:=app.save_native_ledger_allocation_v1(tid,request_value);
 return jsonb_build_object('kind','native-ledger-allocation-provider-write-v1','actorId',actor,
  'tournamentId',tid,'operationId',op,'request',request_value,'outcome',outcome);
end$$;

create function public.get_native_ledger_allocation_operation_provider_v1(tid uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$declare actor uuid;outcome jsonb;request_value jsonb;begin
 if app.operational_provider_transport_enabled_v1()is distinct from true
  or app.operational_finance_source_adoption_enabled_v1()is distinct from true then return null;end if;
 actor:=app.require_operational_provider_official_v1(tid);if actor is null then return null;end if;
 select request_payload into request_value from app.native_ledger_allocation_operations_v1
  where actor_id=actor and operation_id=op and tournament_id=tid;
 outcome:=app.get_native_ledger_allocation_operation_v1(tid,op);
 return jsonb_build_object('kind','native-ledger-allocation-provider-write-v1','actorId',actor,
  'tournamentId',tid,'operationId',op,'request',request_value,'outcome',outcome);
end$$;

do $$declare routine regprocedure;begin
 foreach routine in array array[
  'app.operational_finance_source_adoption_enabled_v1()'::regprocedure,
  'app.operational_finance_basis_line_id_v1(uuid,uuid,uuid,uuid,text)'::regprocedure,
  'app.operational_finance_adoption_frame_v1(jsonb)'::regprocedure,
  'app.operational_finance_adoption_frame_digest_v1(jsonb)'::regprocedure,
  'app.operational_finance_adoption_lineages_v1(uuid)'::regprocedure,
  'app.operational_finance_adoption_cost_rows_v1(uuid,uuid,jsonb)'::regprocedure,
  'app.operational_finance_adoption_sanctioning_v1(uuid,uuid,jsonb,jsonb)'::regprocedure,
  'app.operational_finance_source_adoption_workspace_v1(uuid,uuid,uuid)'::regprocedure,
  'app.get_operational_finance_source_adoption_workspace_v1(uuid,uuid)'::regprocedure,
  'app.save_operational_finance_source_adoption_v1(uuid,uuid,jsonb)'::regprocedure,
  'app.reconcile_operational_finance_source_adoption_v1(uuid,uuid,uuid)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',routine);execute format(
  'revoke all on function %s from public,anon,authenticated,service_role',routine);end loop;
 foreach routine in array array[
  'public.get_operational_finance_source_adoption_workspace_provider_v1(uuid,uuid)'::regprocedure,
  'public.save_operational_finance_source_adoption_provider_v1(uuid,uuid,jsonb)'::regprocedure,
  'public.get_operational_finance_source_adoption_operation_provider_v1(uuid,uuid,uuid)'::regprocedure,
  'public.get_native_ledger_allocation_provider_v1(uuid)'::regprocedure,
  'public.save_native_ledger_allocation_provider_v1(uuid,jsonb)'::regprocedure,
  'public.get_native_ledger_allocation_operation_provider_v1(uuid,uuid)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',routine);execute format(
  'revoke all on function %s from public,anon,authenticated,service_role',routine);execute format(
  'grant execute on function %s to authenticated',routine);end loop;
end$$;
commit;
