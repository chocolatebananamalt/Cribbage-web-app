-- PRIVATE LOCAL CANDIDATE. Explicitly adopts a changed reviewed V2 ownership
-- cost source into a new proposal revision. It cannot finalize, pay, allocate,
-- alter ownership evidence, or enable a provider route.
begin;
create function app.native_optional_finance_source_adoption_enabled_v2()returns boolean
language sql immutable set search_path=''as $$select false$$;

create table app.native_optional_finance_adoption_operations_v2(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,request_payload jsonb not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array(
  'native-optional-finance-source-adoption-v2',actor_id,operation_id,tournament_id,event_id,request_payload
 )::text,'utf8'),'sha256'),'hex'))
);
create table app.native_optional_finance_adoption_outcomes_v2(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_optional_finance_adoption_operations_v2(actor_id,operation_id,tournament_id,event_id)
);
create table app.native_optional_finance_source_adoptions_v2(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 actor_id uuid not null,operation_id uuid not null,revision_operation_id uuid not null,
 prior_revision_id uuid not null,new_revision_id uuid not null,
 prior_ownership_revision_id uuid not null,current_ownership_revision_id uuid not null,
 prior_source_digest text not null check(prior_source_digest~'^[a-f0-9]{64}$'),
 prior_basis_digest text not null check(prior_basis_digest~'^[a-f0-9]{64}$'),
 current_source_digest text not null check(current_source_digest~'^[a-f0-9]{64}$'),
 current_basis_digest text not null check(current_basis_digest~'^[a-f0-9]{64}$'),
 unchanged_frame_digest text not null check(unchanged_frame_digest~'^[a-f0-9]{64}$'),
 mapping_digest text not null check(mapping_digest~'^[a-f0-9]{64}$'),
 prior_cost_rows jsonb not null,current_cost_rows jsonb not null,cost_mapping jsonb not null,
 manual_history_capture jsonb not null,reason text not null,created_at timestamptz not null default clock_timestamp(),
 unique(actor_id,operation_id),unique(revision_operation_id),unique(new_revision_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_optional_finance_adoption_operations_v2(actor_id,operation_id,tournament_id,event_id),
 foreign key(actor_id,revision_operation_id,tournament_id,event_id)references app.native_optional_finance_operations_v2(actor_id,operation_id,tournament_id,event_id),
 foreign key(prior_revision_id,tournament_id,event_id)references app.native_optional_finance_revisions_v2(id,tournament_id,event_id),
 foreign key(new_revision_id,tournament_id,event_id)references app.native_optional_finance_revisions_v2(id,tournament_id,event_id),
 foreign key(prior_ownership_revision_id,tournament_id,event_id)references app.native_optional_pool_ownership_revisions_v2(id,tournament_id,event_id),
 foreign key(current_ownership_revision_id,tournament_id,event_id)references app.native_optional_pool_ownership_revisions_v2(id,tournament_id,event_id),
 check(jsonb_typeof(prior_cost_rows)='array'and jsonb_typeof(current_cost_rows)='array'and jsonb_typeof(cost_mapping)='array'and jsonb_typeof(manual_history_capture)='array'),
 check(reason=app.custom_payout_classification_text_v2(reason)and app.event_settings_js_text_length_v3(reason)between 1 and 2000)
);
do $$declare n text;begin foreach n in array array['native_optional_finance_adoption_operations_v2','native_optional_finance_adoption_outcomes_v2','native_optional_finance_source_adoptions_v2']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;

-- Both new action directions reject actor/operation reuse. Existing accepted
-- proposal history is untouched; the guards apply only to future inserts.
create function app.reject_native_optional_finance_cross_action_operation_v2()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if tg_table_name='native_optional_finance_operations_v2'then
  if exists(select 1 from app.native_optional_finance_adoption_operations_v2 where actor_id=new.actor_id and operation_id=new.operation_id)then raise exception'native_optional_finance_operation_domain_conflict'using errcode='23505';end if;
 elsif tg_table_name='native_optional_finance_adoption_operations_v2'then
  if exists(select 1 from app.native_optional_finance_operations_v2 where actor_id=new.actor_id and operation_id=new.operation_id)then raise exception'native_optional_finance_operation_domain_conflict'using errcode='23505';end if;
 else raise exception'native_optional_finance_operation_guard_table';end if;return new;
end$$;
create trigger native_optional_finance_operations_v2_cross_action before insert on app.native_optional_finance_operations_v2 for each row execute function app.reject_native_optional_finance_cross_action_operation_v2();
create trigger native_optional_finance_adoption_operations_v2_cross_action before insert on app.native_optional_finance_adoption_operations_v2 for each row execute function app.reject_native_optional_finance_cross_action_operation_v2();

-- Only cost evidence/classification is excluded. Settings, qualification,
-- paid receipt ownership and every Q/Side source, review and no-refund pin stay exact.
create function app.native_optional_finance_adoption_frame_v2(source_value jsonb)returns jsonb
language sql immutable set search_path=''as $$
 with native_raw as(select source_value#>'{raw,ownershipSource,capture,nativeRawSource}'v),native_facts as(select v->'facts'v from native_raw),
 receipt_history as(select coalesce(jsonb_agg(x.value order by x.value->>'sourceId'),'[]'::jsonb)v from native_facts cross join lateral jsonb_array_elements(native_facts.v->'historyIds')x(value)where x.value->>'kind'='roster_receipt')
 select jsonb_build_object(
  'kind',source_value->'kind','settings',source_value#>'{raw,settings}',
  'nativePlayoffSource',source_value#>'{raw,ownershipSource,capture,nativePlayoffSource}',
  'membership',source_value#>'{raw,ownershipSource,capture,membership}',
  'qSource',source_value#>'{raw,ownershipSource,capture,qSource}',
  'qReview',source_value#>'{raw,ownershipSource,capture,qReview}',
  'sideBasis',source_value#>'{raw,ownershipSource,capture,sideBasis}',
  'rosterReceiptPartitions',source_value#>'{raw,ownershipSource,capture,rosterReceiptPartitions}',
  'sideRecordedSources',source_value#>'{raw,ownershipSource,capture,sideRecordedSources}',
  'refundPolicy',source_value#>'{raw,ownershipSource,capture,refundPolicy}',
  'ownershipAuthority',jsonb_build_object('status',source_value#>'{raw,ownershipSource,status}','kind',source_value#>'{raw,ownershipSource,kind}',
   'actorId',source_value#>'{raw,ownershipSource,actorId}','tournamentId',source_value#>'{raw,ownershipSource,tournamentId}','eventId',source_value#>'{raw,ownershipSource,eventId}',
   'evidenceMeaning',source_value#>'{raw,ownershipSource,capture,evidenceMeaning}','moneyMoved',source_value#>'{raw,ownershipSource,moneyMoved}',
   'bankReceiptVerified',source_value#>'{raw,ownershipSource,bankReceiptVerified}','finalizationAuthorized',source_value#>'{raw,ownershipSource,finalizationAuthorized}'),
  'nativeRecordedReceiptFrame',jsonb_build_object('status',native_raw.v->'status','kind',native_raw.v->'kind','actorId',native_raw.v->'actorId','tournamentId',native_raw.v->'tournamentId',
   'syntheticDomain',native_raw.v->'syntheticDomain','eventIds',native_facts.v->'eventIds','activationBindings',native_facts.v->'activationBindings','pools',native_facts.v->'pools','receiptEvents',native_facts.v->'receiptEvents',
   'receiptHistoryIds',receipt_history.v,'existingOptionalAllocationEvidence',native_facts.v->'existingOptionalAllocationEvidence','snapshotConsistency',native_raw.v->'snapshotConsistency',
   'allocationCapability',native_raw.v->'allocationCapability','additionalIncomeSourceAvailable',native_raw.v->'additionalIncomeSourceAvailable','bankReceiptVerified',native_raw.v->'bankReceiptVerified','moneyMoved',native_raw.v->'moneyMoved'),
  'receiptBasis',jsonb_build_object(
   'status',source_value#>'{raw,ownershipSource,capture,basis,status}',
   'grossEntryIncomeMinor',source_value#>'{raw,ownershipSource,capture,basis,grossEntryIncomeMinor}',
   'qIncomeMinor',source_value#>'{raw,ownershipSource,capture,basis,qIncomeMinor}',
   'receiptTotalMinor',source_value#>'{raw,ownershipSource,capture,basis,receiptTotalMinor}',
   'participantFacts',source_value#>'{raw,ownershipSource,capture,basis,participantFacts}'
  ),'funds',source_value#>'{raw,ownershipSource,funds}',
  'workspaceFrame',(source_value#>'{basis,workspace}')-array['source','history','savedAt','payoutSource','overrideHistory']
 )from native_raw,native_facts,receipt_history
$$;
create function app.native_optional_finance_adoption_frame_digest_v2(source_value jsonb)returns text
language sql immutable set search_path=''as $$select encode(extensions.digest(convert_to(jsonb_build_array(
 'native-optional-finance-adoption-frame-v2',app.native_optional_finance_adoption_frame_v2(source_value)
)::text,'utf8'),'sha256'),'hex')$$;

create function app.native_optional_finance_adoption_cost_rows_v2(source_value jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare c jsonb;e jsonb;x app.tournament_expense_events%rowtype;rid uuid;result jsonb:='[]';seen text[]:='{}';begin
 rid:=(source_value#>>'{raw,ownershipRevisionId}')::uuid;
 for c in select value from jsonb_array_elements(source_value#>'{raw,costClassifications}')order by value->>'expenseEventId'loop
  select value into e from jsonb_array_elements(source_value#>'{raw,ownershipSource,capture,basis,expenses}')where value->>'expenseEventId'=c->>'expenseEventId';
  select*into x from app.tournament_expense_events where id=(c->>'expenseEventId')::uuid and tournament_id=(source_value->>'tournamentId')::uuid;
  if e is null or x.id is null or x.event_type<>'recorded'or x.expense_id::text=any(seen)then return null;end if;seen:=array_append(seen,x.expense_id::text);
  result:=result||jsonb_build_array(jsonb_build_object('expenseId',x.expense_id,'expenseEventId',x.id,'expenseVersion',x.version,
   'lineId',app.native_optional_finance_line_id_v2(rid,'cost|'||x.id::text),'category',c->>'category','amountMinor',e->'amountMinor','description',e->'description'));
 end loop;return result;
exception when invalid_text_representation or numeric_value_out_of_range then return null;end$$;

create function app.native_optional_finance_source_adoption_workspace_v2(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare current_source jsonb;head app.native_optional_finance_revisions_v2%rowtype;prior_frame text;current_frame text;prior_costs jsonb;current_costs jsonb;begin
 if actor is null or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 current_source:=app.native_optional_finance_source_v2(actor,tid,eid);if current_source is null then return null;end if;
 if current_source->>'status'='retry_exact'then return current_source;end if;
 lock table app.native_optional_finance_revisions_v2 in share mode nowait;
 select*into head from app.native_optional_finance_revisions_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if head.id is null then return jsonb_build_object('status','blocked','code','prior_proposal_required');end if;
 if current_source->>'status'is distinct from'source_available'then return jsonb_build_object('status','blocked','code','current_source_unavailable');end if;
 if head.actor_id is distinct from actor or not exists(select 1 from app.native_optional_pool_ownership_revisions_v2 where id=(current_source#>>'{raw,ownershipRevisionId}')::uuid and tournament_id=tid and event_id=eid and actor_id=actor)then return jsonb_build_object('status','blocked','code','same_actor_review_required');end if;
 if head.source_digest= current_source->>'sourceDigest'and head.basis_digest=current_source->>'basisDigest'then return jsonb_build_object('status','blocked','code','source_already_current');end if;
 if head.source_digest is distinct from encode(extensions.digest(convert_to((head.source_capture->'raw')::text,'utf8'),'sha256'),'hex')
  or head.basis_digest is distinct from encode(extensions.digest(convert_to(head.basis::text,'utf8'),'sha256'),'hex')
  or current_source->>'sourceDigest'is distinct from encode(extensions.digest(convert_to((current_source->'raw')::text,'utf8'),'sha256'),'hex')
  or current_source->>'basisDigest'is distinct from encode(extensions.digest(convert_to((current_source->'basis')::text,'utf8'),'sha256'),'hex')then return jsonb_build_object('status','blocked','code','source_digest_invalid');end if;
 prior_frame:=app.native_optional_finance_adoption_frame_digest_v2(head.source_capture);current_frame:=app.native_optional_finance_adoption_frame_digest_v2(current_source);
 if prior_frame is null or prior_frame is distinct from current_frame then return jsonb_build_object('status','blocked','code','non_cost_source_changed');end if;
 prior_costs:=app.native_optional_finance_adoption_cost_rows_v2(head.source_capture);current_costs:=app.native_optional_finance_adoption_cost_rows_v2(current_source);
 if prior_costs is null or current_costs is null then return jsonb_build_object('status','blocked','code','cost_source_unresolved');end if;
 return jsonb_build_object('status','available','kind','native-optional-finance-source-adoption-workspace-v2','actorId',actor,'tournamentId',tid,'eventId',eid,
  'prior',jsonb_build_object('revisionId',head.id,'version',head.version,'ownershipRevisionId',head.ownership_revision_id,'sourceDigest',head.source_digest,'basisDigest',head.basis_digest,'basis',head.basis,'editor',head.editor),
  'current',jsonb_build_object('ownershipRevisionId',current_source#>'{raw,ownershipRevisionId}','sourceDigest',current_source->'sourceDigest','basisDigest',current_source->'basisDigest','basis',current_source->'basis'),
  'unchangedFrameDigest',current_frame,'priorCostRows',prior_costs,'currentCostRows',current_costs,
  'proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.save_native_optional_finance_source_adoption_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare h text;prior app.native_optional_finance_adoption_operations_v2%rowtype;prior_result jsonb;workspace jsonb;head app.native_optional_finance_revisions_v2%rowtype;
 current_source jsonb;current_basis jsonb;editor jsonb;expected_history jsonb;manual_capture jsonb:='[]';r jsonb;rebound jsonb;
 prior_base_count integer;old_override_count integer;prior_native_ids text[]:='{}';revision_op uuid:=extensions.gen_random_uuid();revision_request jsonb;revision_hash text;
 new_revision uuid:=extensions.gen_random_uuid();adoption_id uuid:=extensions.gen_random_uuid();result_value jsonb;prior_costs jsonb;current_costs jsonb;mapping jsonb:='[]';p jsonb;c jsonb;mapping_digest text;override_plan jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null or op is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>14
  or not(request?&array['kind','operationId','expectedVersion','expectedPriorRevisionId','expectedPriorOwnershipRevisionId','expectedPriorSourceDigest','expectedPriorBasisDigest','expectedCurrentOwnershipRevisionId','expectedCurrentSourceDigest','expectedCurrentBasisDigest','expectedUnchangedFrameDigest','editor','reason','reviewed'])
  or request->>'kind'is distinct from'native-optional-finance-source-adoption-v2'or request->>'operationId'is distinct from op::text or request->'reviewed'is distinct from'true'::jsonb
  or coalesce(request->>'operationId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' or jsonb_typeof(request->'expectedVersion')is distinct from'number'or coalesce(request->>'expectedVersion','')!~'^[1-9][0-9]{0,9}$'or(request->>'expectedVersion')::numeric>=2147483647
  or coalesce(request->>'expectedPriorRevisionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'or coalesce(request->>'expectedPriorOwnershipRevisionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(request->>'expectedCurrentOwnershipRevisionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'or coalesce(request->>'expectedPriorSourceDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'expectedPriorBasisDigest','')!~'^[a-f0-9]{64}$'
  or coalesce(request->>'expectedCurrentSourceDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'expectedCurrentBasisDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'expectedUnchangedFrameDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'editor')is distinct from'object'or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'is distinct from app.custom_payout_classification_text_v2(request->>'reason')
  or app.event_settings_js_text_length_v3(request->>'reason')not between 1 and 2000 or octet_length(request::text)>4100000 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-finance-source-adoption-v2',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 -- Re-read only after the actor/operation reservation and current role lock.
 -- Revoked actors cannot retrieve historical accepted work.
 select*into prior from app.native_optional_finance_adoption_operations_v2 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid or prior.request_hash is distinct from h or prior.request_payload is distinct from request then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select result into prior_result from app.native_optional_finance_adoption_outcomes_v2 where actor_id=actor and operation_id=op;return coalesce(prior_result,jsonb_build_object('status','retry_exact','code','operation_incomplete'));end if;
 if app.native_optional_finance_source_adoption_enabled_v2()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable','proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);end if;
 if exists(select 1 from app.native_optional_finance_operations_v2 where actor_id=actor and operation_id=op)then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 workspace:=app.native_optional_finance_source_adoption_workspace_v2(actor,tid,eid);if workspace->>'status'='retry_exact'then return workspace;end if;
 if workspace->>'status'is distinct from'available'then return jsonb_build_object('status','rejected','code',coalesce(workspace->>'code','source_unavailable'));end if;
 select*into head from app.native_optional_finance_revisions_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if head.id::text is distinct from request->>'expectedPriorRevisionId'or head.version is distinct from(request->>'expectedVersion')::integer or head.ownership_revision_id::text is distinct from request->>'expectedPriorOwnershipRevisionId'
  or head.source_digest is distinct from request->>'expectedPriorSourceDigest'or head.basis_digest is distinct from request->>'expectedPriorBasisDigest'
  or workspace#>>'{current,ownershipRevisionId}'is distinct from request->>'expectedCurrentOwnershipRevisionId'or workspace#>>'{current,sourceDigest}'is distinct from request->>'expectedCurrentSourceDigest'
  or workspace#>>'{current,basisDigest}'is distinct from request->>'expectedCurrentBasisDigest'or workspace->>'unchangedFrameDigest'is distinct from request->>'expectedUnchangedFrameDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 current_source:=app.native_optional_finance_source_v2(actor,tid,eid);current_basis:=current_source->'basis';editor:=request->'editor';
 if current_source->>'sourceDigest'is distinct from request->>'expectedCurrentSourceDigest'or current_source->>'basisDigest'is distinct from request->>'expectedCurrentBasisDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 prior_base_count:=jsonb_array_length(head.basis#>'{workspace,history}');expected_history:=current_basis#>'{workspace,history}';
 select coalesce(array_agg(x.value#>>'{line,lineId}'),'{}')into prior_native_ids from jsonb_array_elements(head.basis#>'{workspace,history}')x;
 for r in select value from jsonb_array_elements(head.editor->'history')with ordinality x(value,n)where n>prior_base_count order by n loop
  if r#>>'{line,lineId}'=any(prior_native_ids)then return jsonb_build_object('status','rejected','code','edited_native_cost_adoption_unsupported');end if;
  rebound:=jsonb_set(r,'{line,source}',current_basis#>'{workspace,source}');manual_capture:=manual_capture||jsonb_build_array(jsonb_build_object('prior',r,'rebound',rebound));expected_history:=expected_history||jsonb_build_array(rebound);
 end loop;
 old_override_count:=jsonb_array_length(head.editor->'overrideHistory');
 if editor->'basis'is distinct from current_basis->'workspace'or editor->'history'is distinct from expected_history or editor->'lineForm'<>'null'::jsonb or editor->'bandForm'<>'null'::jsonb
  or jsonb_array_length(editor->'overrideHistory')<old_override_count or exists(select 1 from jsonb_array_elements(head.editor->'overrideHistory')with ordinality x(value,n)where value is distinct from(editor->'overrideHistory')->((n-1)::integer))
  or app.valid_native_optional_finance_editor_v2(editor,current_basis,null)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_adopted_editor');end if;
 if old_override_count>0 and(jsonb_array_length(editor->'overrideHistory')<=old_override_count or editor->'overrideInput'='null'::jsonb or editor->'overridePlan'='null'::jsonb)then return jsonb_build_object('status','rejected','code','fresh_override_review_required');end if;
 if jsonb_array_length(editor->'overrideHistory')>0 then
  begin override_plan:=(editor->>'overridePlan')::jsonb;exception when others then return jsonb_build_object('status','rejected','code','fresh_override_review_required');end;
  if jsonb_typeof(override_plan)is distinct from'object'or(select count(*)from jsonb_object_keys(override_plan))<>2
   or override_plan->'basis'is distinct from current_basis->'workspace'or override_plan->'history'is distinct from editor->'history'
  then return jsonb_build_object('status','rejected','code','fresh_override_review_required');end if;
 end if;
 prior_costs:=workspace->'priorCostRows';current_costs:=workspace->'currentCostRows';
 for p in select value from jsonb_array_elements(prior_costs)loop select value into c from jsonb_array_elements(current_costs)where value->>'expenseId'=p->>'expenseId';mapping:=mapping||jsonb_build_array(jsonb_build_object('expenseId',p->'expenseId','prior',p,'current',coalesce(c,'null'::jsonb)));end loop;
 for c in select current_cost.value from jsonb_array_elements(current_costs)as current_cost(value)
  where not exists(select 1 from jsonb_array_elements(prior_costs)as prior_cost(value)
   where prior_cost.value->>'expenseId'=current_cost.value->>'expenseId')
  loop mapping:=mapping||jsonb_build_array(jsonb_build_object('expenseId',c->'expenseId','prior',null,'current',c));end loop;
 revision_request:=jsonb_build_object('kind','native-optional-finance-proposal-v2','expectedVersion',head.version,'sourceDigest',current_source->>'sourceDigest','basisDigest',current_source->>'basisDigest','editor',editor,'reason',request->>'reason','reviewed',true);
 revision_hash:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-finance-proposal-v2',actor,revision_op,tid,eid,revision_request)::text,'utf8'),'sha256'),'hex');
 insert into app.native_optional_finance_adoption_operations_v2(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)values(actor,op,tid,eid,request,h);
 insert into app.native_optional_finance_operations_v2(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)values(actor,revision_op,tid,eid,revision_request,revision_hash);
 insert into app.native_optional_finance_revisions_v2(id,tournament_id,event_id,version,prior_revision_id,ownership_revision_id,actor_id,operation_id,source_digest,basis_digest,source_capture,basis,editor,reason)
 values(new_revision,tid,eid,head.version+1,head.id,(current_source#>>'{raw,ownershipRevisionId}')::uuid,actor,revision_op,current_source->>'sourceDigest',current_source->>'basisDigest',current_source,current_basis,editor,request->>'reason');
 insert into app.native_optional_finance_outcomes_v2(actor_id,operation_id,tournament_id,event_id,result)values(actor,revision_op,tid,eid,jsonb_build_object('status','optional_finance_proposal_saved_v2','revisionId',new_revision,'version',head.version+1,'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',revision_op,'sourceDigest',current_source->>'sourceDigest','basisDigest',current_source->>'basisDigest','proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false));
 mapping_digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-finance-source-adoption-mapping-v2',tid,eid,head.id,new_revision,mapping,manual_capture)::text,'utf8'),'sha256'),'hex');
 insert into app.native_optional_finance_source_adoptions_v2(id,tournament_id,event_id,actor_id,operation_id,revision_operation_id,prior_revision_id,new_revision_id,prior_ownership_revision_id,current_ownership_revision_id,prior_source_digest,prior_basis_digest,current_source_digest,current_basis_digest,unchanged_frame_digest,mapping_digest,prior_cost_rows,current_cost_rows,cost_mapping,manual_history_capture,reason)
 values(adoption_id,tid,eid,actor,op,revision_op,head.id,new_revision,head.ownership_revision_id,(current_source#>>'{raw,ownershipRevisionId}')::uuid,head.source_digest,head.basis_digest,current_source->>'sourceDigest',current_source->>'basisDigest',workspace->>'unchangedFrameDigest',mapping_digest,prior_costs,current_costs,mapping,manual_capture,request->>'reason');
 result_value:=jsonb_build_object('status','optional_finance_source_adopted_v2','adoptionId',adoption_id,'revisionId',new_revision,'version',head.version+1,'priorRevisionId',head.id,'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'sourceDigest',current_source->>'sourceDigest','basisDigest',current_source->>'basisDigest','mappingDigest',mapping_digest,'currentFundAuthority',false,'proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 insert into app.native_optional_finance_adoption_outcomes_v2(actor_id,operation_id,tournament_id,event_id,result)values(actor,op,tid,eid,result_value);return result_value;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');when unique_violation then return jsonb_build_object('status','rejected','code','idempotency_conflict');when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');end$$;

create function app.reconcile_native_optional_finance_source_adoption_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$declare prior app.native_optional_finance_adoption_operations_v2%rowtype;result_value jsonb;h text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into prior from app.native_optional_finance_adoption_operations_v2 where actor_id=actor and operation_id=op;if not found then return jsonb_build_object('status','unknown','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op);end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-finance-source-adoption-v2',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid or prior.request_hash is distinct from h or prior.request_payload is distinct from request then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select result into result_value from app.native_optional_finance_adoption_outcomes_v2 where actor_id=actor and operation_id=op;if not found then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
 return jsonb_build_object('status','historical_operation','result',result_value,'currentFundAuthority',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

do $$declare routine regprocedure;begin foreach routine in array array[
 'app.native_optional_finance_source_adoption_enabled_v2()'::regprocedure,'app.reject_native_optional_finance_cross_action_operation_v2()'::regprocedure,
 'app.native_optional_finance_adoption_frame_v2(jsonb)'::regprocedure,'app.native_optional_finance_adoption_frame_digest_v2(jsonb)'::regprocedure,
 'app.native_optional_finance_adoption_cost_rows_v2(jsonb)'::regprocedure,'app.native_optional_finance_source_adoption_workspace_v2(uuid,uuid,uuid)'::regprocedure,
 'app.save_native_optional_finance_source_adoption_v2(uuid,uuid,uuid,uuid,jsonb)'::regprocedure,'app.reconcile_native_optional_finance_source_adoption_v2(uuid,uuid,uuid,uuid,jsonb)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role',routine);end loop;end$$;
commit;
