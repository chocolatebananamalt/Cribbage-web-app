-- PRIVATE / DEFAULT OFF. UNCHANGED current Main V3 regular/Q/Side partitions
-- plus DISJOINT full-fee Con add-on receipts. No Con/shared cost reassignment.
-- Requires selected-step-consolation-v3 + consolation-addon-payments-v1.
begin;
create function app.selected_step_coexistence_enabled_v3()returns boolean language sql stable set search_path=''as $$select false$$;
create function app.consolation_coexistent_ownership_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare gate jsonb;cur jsonb;m jsonb;main_id uuid;fee integer;scope_row app.consy_addon_payment_scopes_v1%rowtype;r app.consy_addon_receipts_v1%rowtype;op app.operation_receipts%rowtype;
 receipts jsonb:='[]';sources jsonb;ledger jsonb;c jsonb;gross numeric:=0;count_paid integer:=0;ids text[]:='{}';source_ids text[]:='{}';x jsonb;native_allocation app.native_ledger_allocation_revisions_v1%rowtype;begin
 if app.selected_step_coexistence_enabled_v3()is distinct from true or app.selected_step_consolation_enabled_v3()is distinct from true or app.selected_step_pool_ownership_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for update nowait;perform app.lock_native_ledger_sources_v1();
 lock table app.consy_addon_payment_scopes_v1,app.consy_addon_receipts_v1,app.native_ledger_allocation_revisions_v1,app.selected_step_pool_ownership_revisions_v3 in share mode nowait;
 gate:=app.consolation_playoff_source_v3(actor,tid,eid);if gate->>'status'is distinct from'source_available'then return gate;end if;
 main_id:=app.linked_consolation_main_event_v1(tid,eid);fee:=(gate#>>'{source,prizeActivation,eventVersion,entry_fee_cents}')::integer;
 m:=app.selected_step_regular_ledger_v3(actor,tid,main_id);
 if m->>'status'is distinct from'source_available'or m->>'kind'is distinct from'selected-step-regular-ledger-v3'or m->>'actorId'is distinct from actor::text or m->>'eventId'is distinct from main_id::text or m->>'tournamentId'is distinct from tid::text
  or m#>>'{capture,ownershipSource,capture,nativePlayoffSource,source,prizeActivation,eventVersion,event_kind}'is distinct from'main'
 then return jsonb_build_object('status','blocked','code','current_reviewed_main_ownership_required');end if;
 if app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','blocked','code','existing_financial_liability');end if;
 cur:=app.native_optional_recorded_sources_v2(actor,tid);if cur->>'status'is distinct from'sources_available'or cur->>'tournamentId'is distinct from tid::text then return jsonb_build_object('status','blocked','code','current_native_sources_required');end if;
 if exists(select 1 from jsonb_array_elements(cur#>'{facts,pools}')as fact(value) where fact.value->>'eventId'=eid::text)
  or exists(select 1 from app.q_pool_allocation_versions_v1 where tournament_id=tid and event_id<>main_id)
  or exists(select 1 from app.event_side_pool_election_versions where tournament_id=tid and event_id<>main_id)
  or exists(select 1 from app.event_side_pool_team_election_versions where tournament_id=tid)
 then return jsonb_build_object('status','blocked','code','other_event_optional_ownership_not_supported');end if;
 -- A saved cost split is intent/evidence, not permission to throw away Con's
 -- share. Main's immutable partitions cannot be revised by this narrow writer.
 select*into native_allocation from app.native_ledger_allocation_revisions_v1 where tournament_id=tid order by version desc limit 1;
 if exists(select 1 from jsonb_array_elements(native_allocation.snapshot->'sources')s cross join lateral jsonb_array_elements(s->'allocations')p where s->>'kind'='expense'and p->>'eventId'=eid::text)
 then return jsonb_build_object('status','blocked','code','saved_consolation_cost_partition_requires_joint_review');end if;
 select*into scope_row from app.consy_addon_payment_scopes_v1 where tournament_id=tid and event_id=eid and main_event_id=main_id;
 if scope_row.id is null or fee is null or fee<=0 or scope_row.fee_minor<>fee or scope_row.activation_id::text is distinct from gate#>>'{source,activation,id}'or scope_row.setup_event_version_id::text is distinct from gate#>>'{source,prizeActivation,eventVersion,id}'then return jsonb_build_object('status','blocked','code','separate_consolation_receipts_required');end if;
 sources:=m#>'{ledger,sources}';
 for x in select value from jsonb_array_elements(sources)loop
  if x->>'sourceId'=any(source_ids)or x->>'sourceId'is distinct from x->>'physicalEvidenceId'or exists(select 1 from jsonb_array_elements(x->'allocations')p where p->>'eventId'<>main_id::text)then return jsonb_build_object('status','blocked','code','main_partition_not_exclusive');end if;
  source_ids:=array_append(source_ids,x->>'sourceId');
 end loop;
 for r in select a.*from app.consy_addon_receipts_v1 a where a.tournament_id=tid and a.event_id=eid order by a.id loop
  select*into op from app.operation_receipts where id=r.operation_receipt_id and tournament_id=tid;
  if r.scope_id<>scope_row.id or r.amount_minor<>fee or r.id::text=any(source_ids)or r.roster_entry_id::text=any(ids)or app.consy_addon_receipt_valid_v1(r.id)is distinct from true or op.outcome is distinct from'accepted'
   or not exists(select 1 from app.event_participants p where p.tournament_id=tid and p.event_id=eid and p.roster_entry_id=r.roster_entry_id and p.status='checked_in')
   or not exists(select 1 from jsonb_array_elements(cur#>'{facts,receiptEvents}')as fact(value) where fact.value->>'sourceId'=r.id::text and fact.value->>'rosterEntryId'=r.roster_entry_id::text and(fact.value->>'amountMinor')::numeric=r.amount_minor and fact.value->'eligibleEventIds'?eid::text)
  then return jsonb_build_object('status','blocked','code','consolation_receipt_or_roster_changed');end if;
  x:=jsonb_build_object('sourceId',r.id,'physicalEvidenceId',r.id,'kind','entry_receipt','amountMinor',r.amount_minor,'state','active','allocations',jsonb_build_array(jsonb_build_object('eventId',eid,'bucket','regular_entry','poolId',null,'amountMinor',r.amount_minor,'classificationReviewed',true)));
  sources:=sources||jsonb_build_array(x);receipts:=receipts||jsonb_build_array(jsonb_build_object('receipt',to_jsonb(r),'operation',to_jsonb(op),'source',x));source_ids:=array_append(source_ids,r.id::text);ids:=array_append(ids,r.roster_entry_id::text);gross:=gross+r.amount_minor;count_paid:=count_paid+1;
 end loop;
 if count_paid<>(gate#>>'{source,qualification,participant_count}')::integer or count_paid<>(select count(*)from app.event_participants where tournament_id=tid and event_id=eid and status='checked_in')or gross>9007199254740991 then return jsonb_build_object('status','blocked','code','separate_consolation_receipts_incomplete');end if;
 if exists(select 1 from jsonb_array_elements(cur#>'{facts,receiptEvents}')as fact(value) where not(fact.value->>'sourceId'=any(source_ids)))or exists(select 1 from jsonb_array_elements(cur#>'{facts,expenseEvents}')as fact(value) where not(fact.value->>'sourceId'=any(source_ids)))then return jsonb_build_object('status','blocked','code','unclaimed_physical_source');end if;
 ledger:=(m->'ledger')||jsonb_build_object('eventIds',jsonb_build_array(main_id,eid),'sources',sources);
 c:=jsonb_build_object('kind','selected-step-consolation-ownership-source-v3','compositionKind','unchanged-main-v3-and-consolation-addons-v1','tournamentId',tid,'eventId',eid,'regularOnly',true,'refundPolicy','no-pool-refunds-v1','nativePlayoffSource',gate,'nativeRawSource',cur,'mainOwnershipLedger',m,'addonScope',to_jsonb(scope_row),'addonReceipts',receipts,'combinedLedger',ledger,'basis',jsonb_build_object('expenses','[]'::jsonb),'evidenceMeaning','explicit unchanged Main partitions and separately recorded Con receipts; no disbursement');
 return jsonb_build_object('status','ownership_source_available','kind','selected-step-pool-ownership-source-v3','actorId',actor,'tournamentId',tid,'eventId',eid,'sourceDigest',encode(extensions.digest(convert_to(c::text,'utf8'),'sha256'),'hex'),'capture',c,'funds',jsonb_build_object('regularReceiptsMinor',gross,'qReceiptsMinor',0,'sideReceiptsMinor',0,'recordedReceiptsMinor',gross),'moneyMoved',false,'bankReceiptVerified',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
-- Dispatch only the known old optional-bridge hold. Missing eligibility,
-- stale records, incorrect fees and unrelated failures never fall through.
do $source$declare d text;begin
 d:=pg_get_functiondef('app.consolation_ownership_source_v3(uuid,uuid,uuid)'::regprocedure);execute replace(d,'FUNCTION app.consolation_ownership_source_v3(','FUNCTION app.consolation_ownership_source_v3_before_coexistence(');
end$source$;
create or replace function app.consolation_ownership_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$declare r jsonb;begin
 r:=app.consolation_ownership_source_v3_before_coexistence(actor,tid,eid);
 if r->>'status'='blocked'and r->>'code'='consolation_optional_ownership_not_supported'and app.selected_step_coexistence_enabled_v3()then return app.consolation_coexistent_ownership_source_v3(actor,tid,eid);end if;return r;end$$;
-- Reuse the real V3 ownership transaction, revision IDs, audit and exact retry.
-- No native allocation revision, receipt or Main journal is manufactured.
create function app.save_consolation_coexistent_ownership_v3(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
declare s jsonb;r jsonb;head app.selected_step_pool_ownership_revisions_v3%rowtype;begin
 if app.selected_step_coexistence_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 perform 1 from app.tournaments where id=tid for update nowait;
 if exists(select 1 from app.selected_step_pool_ownership_operations_v3 where actor_id=actor and operation_id=op)then return app.save_selected_step_pool_ownership_v3(actor,tid,eid,op,request);end if;
 s:=app.consolation_coexistent_ownership_source_v3(actor,tid,eid);
 if s->>'status'is distinct from'ownership_source_available'or s->>'sourceDigest'is distinct from request->>'sourceDigest'then return jsonb_build_object('status','rejected','code','current_coexistence_review_required');end if;
 r:=app.save_selected_step_pool_ownership_v3(actor,tid,eid,op,request);
 if r->>'status'='selected_step_pool_ownership_reviewed_v3'then
  select*into head from app.selected_step_pool_ownership_revisions_v3 where id=(r->>'revisionId')::uuid and actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
  if head.source_capture is distinct from s or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception'coexistence_commit_postcondition_failed';end if;
 end if;return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function public.save_consolation_coexistent_ownership_provider_v3(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language sql security definer set search_path=''as $$select app.save_consolation_coexistent_ownership_v3(actor,sid,tid,eid,op,request)$$;
-- Existing Con ledger construction already validates the actual owned review.
-- The sole replacement chooses the genuine composition snapshot as its source.
do $ledger$declare d text;old text:='owned#>''{capture,nativeAllocation,snapshot}''';replacement text:='coalesce(owned#>''{capture,combinedLedger}'',owned#>''{capture,nativeAllocation,snapshot}'')';begin
 select pg_get_functiondef('app.consolation_regular_ledger_v3(uuid,uuid,uuid)'::regprocedure)into d;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'coexistent_ledger_snapshot_anchor_changed';end if;d:=replace(d,old,replacement);
 d:=replace(d,'owned#>''{capture,nativeAllocation,snapshot,sources}''','coalesce(owned#>''{capture,combinedLedger,sources}'',owned#>''{capture,nativeAllocation,snapshot,sources}'')');
 d:=replace(d,'owned#>''{capture,nativeAllocation,snapshot,pools}''','coalesce(owned#>''{capture,combinedLedger,pools}'',owned#>''{capture,nativeAllocation,snapshot,pools}'')');execute replace(d,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$ledger$;
-- The existing selected-step inner validator conserves all q/side partitions
-- and sums only the bound event. Pure validation still requires matching pool
-- metadata; this does not authorize a posted ledger over the real current source.
do $range$declare d text;old text;begin
 select pg_get_functiondef('app.consolation_prize_range_safe_v3(jsonb,jsonb)'::regprocedure)into d;
 old:='return app.playoff_prize_proposal_range_safe_v2(source_input,history);';if strpos(d,old)=0 then raise exception'coexistent_range_arithmetic_anchor_changed';end if;d:=replace(d,old,'return app.selected_step_prize_range_inner_v3(source_input,history);');
 old:='if not(p->>''eventId''=any(event_ids))then return false;end if;';
 if strpos(d,old)=0 then raise exception'coexistent_range_parts_anchor_changed';end if;
 d:=replace(d,old,'if not(p->>''eventId''=any(event_ids))then return false;end if; if p->>''bucket''in(''q'',''side'')and(p->>''eventId''=eid or not exists(select 1 from jsonb_array_elements(l->''pools'')x where x->''poolId''=p->''poolId''and x->''eventId''=p->''eventId''and x->''kind''=p->''bucket''))then return false;end if;');execute replace(d,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$range$;
-- Main Q contexts were historically single-event. Only this exact linked pair
-- can opt into the existing Main receipt/obligation calculations. Main's full
-- roster, whole base receipts, Q amounts and settlement reconciliation remain.
create function app.main_con_coexistence_context_v3(tid uuid,main_id uuid)returns boolean language sql stable security definer set search_path=''as $$select
 app.selected_step_coexistence_enabled_v3()and(select count(*)from app.events where tournament_id=tid)=2
 and(select count(*)from app.tournament_setup_activations where tournament_id=tid)=2
 and(select count(*)from app.events where tournament_id=tid and event_type='main'and operational_state='active')=1
 and exists(select 1 from app.events m join app.events c on c.tournament_id=m.tournament_id and c.event_type='consolation'and c.operational_state='active'and c.format='standard_singles'
  where m.id=main_id and m.tournament_id=tid and m.event_type='main'and m.operational_state='active'and m.format='standard_singles'and app.linked_consolation_main_event_v1(tid,c.id)=main_id
   and exists(select 1 from app.tournament_setup_activations where tournament_id=tid and event_id=m.id)
   and exists(select 1 from app.tournament_setup_activations where tournament_id=tid and event_id=c.id))
 -- A Con-only roster/base payment is not a Main/Q receipt. Hold instead of
 -- changing the legacy workspace's tournament-wide roster meaning.
 and not exists(select 1 from app.tournament_roster_entries r left join lateral(select event_type from app.roster_entry_lifecycle_events x where x.roster_entry_id=r.id order by version desc limit 1)life on true
  where r.tournament_id=tid and coalesce(life.event_type,'active')<>'withdrawn'and not exists(select 1 from app.event_participants p where p.tournament_id=tid and p.event_id=main_id and p.roster_entry_id=r.id))
$$;
do $qcontext$declare d text;body text;old text;begin
 d:=pg_get_functiondef('app.q_pool_context_v1(uuid)'::regprocedure);execute replace(d,'FUNCTION app.q_pool_context_v1(','FUNCTION app.q_pool_context_v1_before_coexistence(');
 select prosrc into body from pg_proc where oid='app.q_pool_context_v1(uuid)'::regprocedure;
 old:='where a.tournament_id=p_tournament_id order by';if strpos(body,old)=0 then raise exception'coexistent_q_main_selection_anchor_changed';end if;body:=replace(body,old,'where a.tournament_id=p_tournament_id and s.event_kind=''main'' order by');
 old:='(select count(*) from app.events where tournament_id=p_tournament_id)=1';if strpos(body,old)=0 then raise exception'coexistent_q_event_context_anchor_changed';end if;
 body:=replace(body,old,'app.main_con_coexistence_context_v3(p_tournament_id,a.event_id)');
 old:='and (select count(*) from app.tournament_setup_activations where tournament_id=p_tournament_id)=1';if strpos(body,old)=0 then raise exception'coexistent_q_activation_context_anchor_changed';end if;body:=replace(body,old,'');
 execute format('create function app.q_pool_context_coexistence_v3(p_tournament_id uuid)returns jsonb language sql stable security definer set search_path=''''as %L',body);
end$qcontext$;
create or replace function app.q_pool_context_v1(p_tournament_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$declare main_id uuid;begin
 select id into main_id from app.events where tournament_id=p_tournament_id and event_type='main'and operational_state='active';
 if app.main_con_coexistence_context_v3(p_tournament_id,main_id)then return app.q_pool_context_coexistence_v3(p_tournament_id);end if;return app.q_pool_context_v1_before_coexistence(p_tournament_id);end$$;
do $mainbasis$declare body text;old text;d text;begin
 select prosrc into body from pg_proc where oid='app.q_base_financial_basis_v9(uuid,uuid)'::regprocedure;
 old:='or (select count(*)from app.tournament_setup_activations where tournament_id=p_tid)<>1';if strpos(body,old)=0 then raise exception'coexistent_main_basis_activation_anchor_changed';end if;
 body:=replace(body,old,'or app.main_con_coexistence_context_v3(p_tid,p_eid)is distinct from true');
 old:='or (select count(*)from app.events where tournament_id=p_tid and operational_state=''active'')<>1';if strpos(body,old)=0 then raise exception'coexistent_main_basis_event_anchor_changed';end if;body:=replace(body,old,'');
 -- No replacement of paymentCount/paymentTotal/receipt conservation or roster
 -- reconciliation. Con add-ons are a separate table, not Main base receipts.
 execute format('create function app.main_coexistence_financial_basis_v3(p_tid uuid,p_eid uuid)returns jsonb language plpgsql stable security definer set search_path=''''as %L',body);
 select prosrc into body from pg_proc where oid='app.selected_step_pool_ownership_source_v3_before_consolation(uuid,uuid,uuid)'::regprocedure;
 old:='app.q_base_financial_basis_v9(tid,eid)';if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception'coexistent_main_ownership_basis_anchor_changed';end if;
 body:=replace(body,old,'app.main_coexistence_financial_basis_v3(tid,eid)');
 execute format('create function app.main_coexistence_ownership_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''''set timezone=''UTC''as %L',body);
end$mainbasis$;
create or replace function app.selected_step_pool_ownership_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from app.events where id=eid and tournament_id=tid and event_type='consolation')then return app.consolation_ownership_source_v3(actor,tid,eid);end if;
 if app.main_con_coexistence_context_v3(tid,eid)then return app.main_coexistence_ownership_source_v3(actor,tid,eid);end if;return app.selected_step_pool_ownership_source_v3_before_consolation(actor,tid,eid);end$$;
do $secure$declare r record;begin for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='app'and p.proname in('selected_step_coexistence_enabled_v3','consolation_coexistent_ownership_source_v3','consolation_ownership_source_v3_before_coexistence','consolation_ownership_source_v3','save_consolation_coexistent_ownership_v3','main_con_coexistence_context_v3','q_pool_context_v1_before_coexistence','q_pool_context_coexistence_v3','q_pool_context_v1','main_coexistence_financial_basis_v3','main_coexistence_ownership_source_v3','selected_step_pool_ownership_source_v3'))or(n.nspname='public'and p.proname='save_consolation_coexistent_ownership_provider_v3')loop execute format('alter function %s owner to postgres',r.sig);execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);end loop;end$secure$;
commit;
