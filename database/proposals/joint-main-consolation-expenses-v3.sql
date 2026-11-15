-- PRIVATE / DEFAULT OFF. Saved explicit expense intent, never inferred shares.
-- AFTER pool-aware-consolation-receipts-v3 and selected-step-shared-sanctioning-v3.
-- Each event still needs a fresh actual V3 ownership review and fund review.
begin;
create function app.joint_event_expenses_enabled_v3()returns boolean language sql stable set search_path=''as $$select false$$;
create function app.current_joint_expense_intent_v3(actor uuid,tid uuid,main_id uuid,con_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare a app.native_ledger_allocation_revisions_v1%rowtype;o app.native_ledger_allocation_operations_v1%rowtype;r jsonb;s jsonb;p jsonb;x app.tournament_expense_events%rowtype;
 sources jsonb:='[]';main_costs jsonb:='[]';con_costs jsonb:='[]';ids text[]:='{}';seen text[];total numeric;mine numeric;con numeric;category text;main_category text;con_category text;k text;body jsonb;
begin
 if app.joint_event_expenses_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,main_id)is distinct from true or app.main_con_coexistence_context_v3(tid,main_id)is distinct from true or app.linked_consolation_main_event_v1(tid,con_id)is distinct from main_id then return null;end if;
 perform 1 from app.tournaments where id=tid for update nowait;
 lock table app.native_ledger_allocation_revisions_v1,app.native_ledger_allocation_operations_v1,app.native_ledger_allocation_outcomes_v1,app.tournament_expense_events in share mode nowait;
 select*into a from app.native_ledger_allocation_revisions_v1 where tournament_id=tid order by version desc limit 1;
 select*into o from app.native_ledger_allocation_operations_v1 where tournament_id=tid and actor_id=a.actor_id and operation_id=a.operation_id;
 select result into r from app.native_ledger_allocation_outcomes_v1 where actor_id=a.actor_id and operation_id=a.operation_id;
 if a.id is null or o.operation_id is null or o.request_payload is distinct from a.request_payload or o.request_hash is distinct from a.request_hash or r->>'status'is distinct from'accepted'or r->>'revisionId'is distinct from a.id::text or r->'snapshot'is distinct from a.snapshot then return jsonb_build_object('status','blocked','code','saved_joint_expense_journal_required');end if;
 -- Only expense partitions are consumed from this journal. Its older receipt
 -- allocation/source digest is NOT promoted to a current receipt ownership proof.
 for s in select value from jsonb_array_elements(a.snapshot->'sources')where value->>'kind'='expense'loop
  select*into x from app.tournament_expense_events where id=(s->>'sourceId')::uuid and tournament_id=tid;
  if x.id is null or x.event_type<>'recorded'or x.currency_code<>'USD'or exists(select 1 from app.tournament_expense_events n where n.expense_id=x.expense_id and n.version>x.version)
   or s->>'physicalEvidenceId'is distinct from x.id::text or s->>'state'is distinct from'active'or s->'amountMinor'is distinct from to_jsonb(x.amount_minor)or x.id::text=any(ids)then return jsonb_build_object('status','blocked','code','joint_expense_physical_source_changed');end if;
  ids:=array_append(ids,x.id::text);seen:='{}';total:=0;mine:=0;con:=0;main_category:=null;con_category:=null;
  for p in select value from jsonb_array_elements(s->'allocations')loop
   k:=p->>'eventId';category:=p->>'bucket';
   if app.event_prize_exact_keys_source_v1(p,array['eventId','bucket','poolId','amountMinor','classificationReviewed'])is distinct from true or coalesce(k,'') not in(main_id::text,con_id::text)or k=any(seen)or coalesce(category,'') not in('player_benefit','operating_expense')or p->'poolId'is distinct from'null'::jsonb or p->'classificationReviewed'is distinct from'true'::jsonb or jsonb_typeof(p->'amountMinor')is distinct from'number'or coalesce(p->>'amountMinor','')!~'^[1-9][0-9]{0,15}$'or(p->>'amountMinor')::numeric>9007199254740991 then return jsonb_build_object('status','blocked','code','exact_joint_expense_partitions_required');end if;
   seen:=array_append(seen,k);total:=total+(p->>'amountMinor')::numeric;
   if k=main_id::text then mine:=(p->>'amountMinor')::numeric;main_category:=category;else con:=(p->>'amountMinor')::numeric;con_category:=category;end if;
  end loop;
  if total is distinct from x.amount_minor::numeric then return jsonb_build_object('status','blocked','code','joint_expense_not_conserved');end if;
  sources:=sources||jsonb_build_array(s);
  if mine>0 then main_costs:=main_costs||jsonb_build_array(jsonb_build_object('expenseEventId',x.id,'description',x.description,'amountMinor',mine,'category',main_category));end if;
  if con>0 then con_costs:=con_costs||jsonb_build_array(jsonb_build_object('expenseEventId',x.id,'description',x.description,'amountMinor',con,'category',con_category));end if;
 end loop;
 if exists(select 1 from app.tournament_expense_events e where e.tournament_id=tid and e.event_type='recorded'and not exists(select 1 from app.tournament_expense_events n where n.expense_id=e.expense_id and n.version>e.version)and not(e.id::text=any(ids)))then return jsonb_build_object('status','blocked','code','joint_expense_coverage_incomplete');end if;
 body:=jsonb_build_object('kind','current-joint-expense-intent-v3','status','source_available','tournamentId',tid,'mainEventId',main_id,'consolationEventId',con_id,'allocationRevision',to_jsonb(a),'allocationOperation',to_jsonb(o),'allocationOutcome',r,'sources',sources,'mainExpenses',main_costs,'consolationExpenses',con_costs,'receiptOwnershipClaimed',false,'moneyMoved',false);
 return body||jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(body::text,'utf8'),'sha256'),'hex'));
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','blocked','code','joint_expense_shape_invalid');end$$;

-- Main's unchanged receipt/Q/Side derivation remains the original one. Only
-- explicitly saved expense shares change, requiring a NEW immutable V3 review.
do $basis$declare d text;begin
 d:=pg_get_functiondef('app.main_coexistence_financial_basis_v3(uuid,uuid)'::regprocedure);execute replace(d,'FUNCTION app.main_coexistence_financial_basis_v3(','FUNCTION app.main_coexistence_basis_before_joint_v3(');
end$basis$;
create or replace function app.main_coexistence_financial_basis_v3(p_tid uuid,p_eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare b jsonb;j jsonb;actor uuid;con_id uuid;begin
 b:=app.main_coexistence_basis_before_joint_v3(p_tid,p_eid);if app.joint_event_expenses_enabled_v3()is distinct from true or b->>'status'is distinct from'supported'then return b;end if;
 select profile_id into actor from app.tournament_roles where tournament_id=p_tid and role='director'order by profile_id limit 1;
 select id into con_id from app.events where tournament_id=p_tid and event_type='consolation';
 j:=app.current_joint_expense_intent_v3(actor,p_tid,p_eid,con_id);if j->>'status'is distinct from'source_available'then return j;end if;
 return b||jsonb_build_object('expenses',j->'mainExpenses','jointExpenseIntent',j);
end$$;

-- Reuse the actual Main V3 review transaction; category cannot contradict the
-- exact saved share. Old heads stay immutable and become stale until re-reviewed.
do $mainledger$declare d text;old text;replacement text;begin
 d:=pg_get_functiondef('app.selected_step_regular_ledger_v3_before_consolation(uuid,uuid,uuid)'::regprocedure);
 old:='or coalesce(cost->>''category'','''')not in(''player_benefit'',''operating_expense'')';
 if strpos(d,old)=0 then raise exception'joint_main_category_anchor_changed';end if;
 d:=replace(d,old,old||'or(owned#>''{capture,basis,jointExpenseIntent}''is not null and cost->''category''is distinct from expense->''category'')');
 old:='sources:=sources||jsonb_build_array(jsonb_build_object(''sourceId'',cost->''expenseEventId'',''physicalEvidenceId'',cost->''expenseEventId'',''kind'',''expense'',';
 if strpos(d,old)=0 then raise exception'joint_main_expense_anchor_changed';end if;
 d:=replace(d,old,'sources:=sources||jsonb_build_array(coalesce((select value from jsonb_array_elements(owned#>''{capture,basis,jointExpenseIntent,sources}'')where value->''sourceId''=cost->''expenseEventId''),jsonb_build_object(''sourceId'',cost->''expenseEventId'',''physicalEvidenceId'',cost->''expenseEventId'',''kind'',''expense'',');
 old:='''classificationReviewed'',true))));';
 -- Exactly the expense expression is closed; receipt expressions are untouched.
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'joint_main_expense_close_anchor_changed';end if;d:=replace(d,old,'''classificationReviewed'',true)))));');
 old:='if benefits+expenses>regular or regular+qfund+sidefund>9007199254740991 then';
 if strpos(d,old)=0 then raise exception'joint_main_full_physical_coverage_anchor_changed';end if;
 d:=replace(d,old,'if owned#>''{capture,basis,jointExpenseIntent}''is not null then for item in select value from jsonb_array_elements(owned#>''{capture,basis,jointExpenseIntent,sources}'')loop if not exists(select 1 from jsonb_array_elements(sources)s where s->''sourceId''=item->''sourceId'')then sources:=sources||jsonb_build_array(item);end if;end loop;end if; '||old);
 old:='''eventIds'',jsonb_build_array(eid),''pools'',pools';
 if strpos(d,old)=0 then raise exception'joint_main_eventids_anchor_changed';end if;
 d:=replace(d,old,'''eventIds'',case when owned#>''{capture,basis,jointExpenseIntent}''is not null then jsonb_build_array(eid,owned#>''{capture,basis,jointExpenseIntent,consolationEventId}'')else jsonb_build_array(eid)end,''pools'',pools');
 execute replace(d,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$mainledger$;

-- A genuine Con composition may now consume the SAME reviewed whole expense
-- rows. Main receipt partitions are still exclusive and unchanged. Con-only
-- expense rows are appended once; shared rows already in Main remain one row.
do $con$declare d text;old text;replacement text;begin
 d:=pg_get_functiondef('app.consolation_coexistent_ownership_source_v3(uuid,uuid,uuid)'::regprocedure);
 d:=replace(d,'scope_row app.consy_addon_payment_scopes_v1%rowtype;','scope_row app.consy_addon_payment_scopes_v1%rowtype;joint jsonb;expense_basis jsonb:=''[]'';item jsonb;');
 old:='if exists(select 1 from jsonb_array_elements(native_allocation.snapshot->''sources'')s cross join lateral jsonb_array_elements(s->''allocations'')p where s->>''kind''=''expense''and p->>''eventId''=eid::text)';
 if strpos(d,old)=0 then raise exception'joint_con_hold_anchor_changed';end if;
 replacement:='joint:=m#>''{capture,ownershipSource,capture,basis,jointExpenseIntent}''; if joint is not null and joint is distinct from app.current_joint_expense_intent_v3(actor,tid,main_id,eid)then return jsonb_build_object(''status'',''blocked'',''code'',''current_joint_expense_review_required'');end if; if joint is null and exists(select 1 from jsonb_array_elements(native_allocation.snapshot->''sources'')s cross join lateral jsonb_array_elements(s->''allocations'')p where s->>''kind''=''expense''and p->>''eventId''=eid::text)';d:=replace(d,old,replacement);
 old:='or exists(select 1 from jsonb_array_elements(x->''allocations'')p where p->>''eventId''<>main_id::text)';
 if strpos(d,old)=0 then raise exception'joint_con_main_preservation_anchor_changed';end if;
 d:=replace(d,old,'or(exists(select 1 from jsonb_array_elements(x->''allocations'')p where p->>''eventId''<>main_id::text)and(x->>''kind''<>''expense''or joint is null or not exists(select 1 from jsonb_array_elements(joint->''sources'')s where s=x)))');
 old:='if exists(select 1 from jsonb_array_elements(cur#>''{facts,receiptEvents}'')as fact(value) where not(fact.value->>''sourceId''=any(source_ids)))';
 if strpos(d,old)=0 then raise exception'joint_con_cost_consumption_anchor_changed';end if;
 replacement:=$consume$
 if joint is not null then
  expense_basis:=joint->'consolationExpenses';
  for item in select value from jsonb_array_elements(joint->'sources')loop
   if not(item->>'sourceId'=any(source_ids))then sources:=sources||jsonb_build_array(item);source_ids:=array_append(source_ids,item->>'sourceId');
   elsif not exists(select 1 from jsonb_array_elements(sources)s where s=item)then return jsonb_build_object('status','blocked','code','joint_expense_row_mismatch');end if;
  end loop;
 end if;
 $consume$||old;d:=replace(d,old,replacement);
 old:='''basis'',jsonb_build_object(''expenses'',''[]''::jsonb)';if strpos(d,old)=0 then raise exception'joint_con_basis_anchor_changed';end if;
 d:=replace(d,old,'''basis'',jsonb_build_object(''expenses'',expense_basis)');
 old:='return jsonb_build_object(''status'',''ownership_source_available''';if strpos(d,old)=0 then raise exception'joint_con_capture_anchor_changed';end if;
 d:=replace(d,old,'if joint is not null then c:=c||jsonb_build_object(''jointExpenseIntent'',joint);end if; '||old);execute replace(d,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$con$;

-- Saved shared-sanction evidence is the exact joint expense item, not a second
-- deduction. Reciprocal coverage and legacy rejection predicates remain intact.
do $sanction$declare d text;old text;begin
 d:=pg_get_functiondef('app.current_consolation_shared_expense_v3(uuid,uuid,jsonb,uuid)'::regprocedure);
 old:='owned#>''{capture,ownershipSource,capture,nativeAllocation,snapshot,sources}''';if strpos(d,old)=0 then raise exception'joint_shared_sanction_anchor_changed';end if;
 d:=replace(d,old,'coalesce(owned#>''{capture,ownershipSource,capture,jointExpenseIntent,sources}'',owned#>''{capture,ownershipSource,capture,nativeAllocation,snapshot,sources}'')');execute replace(d,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$sanction$;
-- Main's pure validator now understands the full conserved shared expense row,
-- but Q/Side metadata and allocations remain owned only by this Main event.
do $range$declare d text;begin
 d:=pg_get_functiondef('app.consolation_prize_range_safe_v3(jsonb,jsonb)'::regprocedure);
 d:=replace(d,'FUNCTION app.consolation_prize_range_safe_v3(','FUNCTION app.main_joint_prize_range_safe_v3(');
 d:=replace(d,'is distinct from''consolation''','is distinct from''main''');
 d:=replace(d,'if not(eid=any(event_ids))then','if cardinality(event_ids)<>2 or not(eid=any(event_ids))then');
 d:=replace(d,'if p->>''eventId''=eid or not(p->>''eventId''=any(event_ids))','if p->>''eventId''<>eid or not(p->>''eventId''=any(event_ids))');
 d:=replace(d,'(p->>''eventId''=eid or not exists','(p->>''eventId''<>eid or not exists');execute d;
 d:=pg_get_functiondef('app.selected_step_prize_range_safe_v3(jsonb,jsonb)'::regprocedure);execute replace(d,'FUNCTION app.selected_step_prize_range_safe_v3(','FUNCTION app.prize_range_before_joint_v3(');
end$range$;
create or replace function app.selected_step_prize_range_safe_v3(source_input jsonb,history jsonb)returns boolean language plpgsql immutable set search_path=''as $$begin
 if source_input#>>'{binding,eventKind}'='main'and jsonb_array_length(source_input#>'{ledger,current,eventIds}')=2 then return app.main_joint_prize_range_safe_v3(source_input,history);end if;
 return app.prize_range_before_joint_v3(source_input,history);end$$;
-- The whole-row exception must work in BOTH event directions. It requires
-- the reviewed current Con ledger and identical current physical partitions.
create function app.current_joint_sanction_expense_v3(tid uuid,eid uuid,owned jsonb,expense uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare con_id uuid;con_owned jsonb;p jsonb;item jsonb;begin
 if app.joint_event_expenses_enabled_v3()is distinct from true then return app.current_consolation_shared_expense_v3(tid,eid,owned,expense);end if;
 if exists(select 1 from app.events where id=eid and tournament_id=tid and event_type='consolation')then return app.current_consolation_shared_expense_v3(tid,eid,owned,expense);end if;
 if owned is distinct from app.selected_step_regular_ledger_v3((owned->>'actorId')::uuid,tid,eid)then return null;end if;
 select id into con_id from app.events where tournament_id=tid and event_type='consolation'and app.linked_consolation_main_event_v1(tid,id)=eid;
 con_owned:=app.consolation_regular_ledger_v3((owned->>'actorId')::uuid,tid,con_id);
 p:=app.current_consolation_shared_expense_v3(tid,con_id,con_owned,expense);if p->>'status'is distinct from'source_available'then return null;end if;
 select value into item from jsonb_array_elements(owned#>'{ledger,sources}')where value->>'sourceId'=expense::text;
 if item is distinct from p->'source'then return null;end if;
 return p||jsonb_build_object('eventId',eid,'allocatedMinor',p->'mainAllocatedMinor');
end$$;
do $coverage$declare d text;old text:='app.current_consolation_shared_expense_v3(tid,eid,owned,selected_step_sanctioning_coverage_v3.expense_id)';begin
 d:=pg_get_functiondef('app.selected_step_sanctioning_coverage_v3(uuid,uuid,jsonb,uuid)'::regprocedure);
 if strpos(d,old)=0 then raise exception'joint_sanction_coverage_anchor_changed';end if;
 d:=replace(d,old,'app.current_joint_sanction_expense_v3(tid,eid,owned,selected_step_sanctioning_coverage_v3.expense_id)');execute replace(d,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$coverage$;
do $secure$declare r record;begin for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app'and p.proname in('joint_event_expenses_enabled_v3','current_joint_expense_intent_v3','main_coexistence_basis_before_joint_v3','main_coexistence_financial_basis_v3','main_joint_prize_range_safe_v3','prize_range_before_joint_v3','current_joint_sanction_expense_v3')loop execute format('alter function %s owner to postgres',r.sig);execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);end loop;end$secure$;
commit;

