-- PRIVATE / DEFAULT OFF. Separate full Con fees; unchanged whole Main/Q cash.
-- Requires selected-step-consolation-coexistence-v3 + addon provider V1.
begin;
create function app.pool_aware_consy_receipts_enabled_v3()returns boolean language sql stable set search_path=''as $$select false$$;
-- Current Main material must still equal a real reviewed ownership revision.
-- Only the global native-source envelope may gain independently validated Con
-- receipt rows. Main receipt/Q/cost/policy/qualification parts are NOT ignored.
create function app.current_main_pool_material_v3(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare mid uuid;s jsonb;h app.selected_step_pool_ownership_revisions_v3%rowtype;o jsonb;begin
 if app.pool_aware_consy_receipts_enabled_v3()is distinct from true or app.selected_step_coexistence_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 mid:=app.linked_consolation_main_event_v1(tid,eid);if app.main_con_coexistence_context_v3(tid,mid)is distinct from true then return null;end if;
 perform 1 from app.tournaments where id=tid for update nowait;
 s:=app.main_coexistence_ownership_source_v3(actor,tid,mid);if s->>'status'is distinct from'ownership_source_available'then return s;end if;
 select*into h from app.selected_step_pool_ownership_revisions_v3 where tournament_id=tid and event_id=mid order by version desc limit 1;
 select result into o from app.selected_step_pool_ownership_outcomes_v3 where actor_id=h.actor_id and operation_id=h.operation_id and tournament_id=tid and event_id=mid;
 if h.id is null or o->>'status'is distinct from'selected_step_pool_ownership_reviewed_v3'or o->>'revisionId'is distinct from h.id::text
  or((h.source_capture-'sourceDigest')#-'{capture,nativeRawSource}')is distinct from((s-'sourceDigest')#-'{capture,nativeRawSource}')
 then return jsonb_build_object('status','blocked','code','reviewed_main_partition_changed');end if;
 return jsonb_build_object('status','source_available','mainEventId',mid,'ownershipRevisionId',h.id,'ownershipSourceDigest',h.source_digest,'reviewedSource',h.source_capture);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- A frozen per-receipt check: NO native-ledger/source-reader invocation here.
-- This prevents receipt validation -> whole source -> receipt validation cycles.
create function app.pool_aware_consy_base_binding_valid_v3(c jsonb,tid uuid,eid uuid,roster uuid,base uuid)returns boolean language plpgsql stable security definer set search_path=''as $$
declare b app.roster_payment_events%rowtype;h app.selected_step_pool_ownership_revisions_v3%rowtype;ownership_op app.selected_step_pool_ownership_operations_v3%rowtype;a app.q_pool_allocation_versions_v1%rowtype;membership uuid;o jsonb;entry jsonb;part jsonb;pin jsonb;total numeric:=0;regular numeric:=0;qminor numeric:=0;regular_count integer:=0;seen text[]:='{}';mid uuid;fee integer;begin
 if app.pool_aware_consy_receipts_enabled_v3()is distinct from true or c->>'kind'is distinct from'consy-addon-main-pools-source-v3'then return false;end if;
 pin:=c->'mainPoolBinding';mid:=app.linked_consolation_main_event_v1(tid,eid);if pin->>'kind'is distinct from'main-receipt-partitions-v3'or pin->>'mainEventId'is distinct from mid::text then return false;end if;
 select*into h from app.selected_step_pool_ownership_revisions_v3 where id=(pin->>'ownershipRevisionId')::uuid and tournament_id=tid and event_id=mid;
 select result into o from app.selected_step_pool_ownership_outcomes_v3 where actor_id=h.actor_id and operation_id=h.operation_id and tournament_id=tid and event_id=mid;
 select*into ownership_op from app.selected_step_pool_ownership_operations_v3 where actor_id=h.actor_id and operation_id=h.operation_id and tournament_id=tid and event_id=mid;
 select*into b from app.roster_payment_events where id=base and tournament_id=tid and roster_entry_id=roster;
 select*into a from app.q_pool_allocation_versions_v1 where tournament_id=tid and event_id=mid and roster_entry_id=roster order by version desc limit 1;
 select id into membership from app.q_pool_membership_versions_v1 where tournament_id=tid and event_id=mid and roster_entry_id=roster order by version desc limit 1;
 select x into entry from jsonb_array_elements(h.source_capture#>'{capture,rosterReceiptPartitions}')x where x#>>'{receipt,id}'=base::text and x#>>'{receipt,roster_entry_id}'=roster::text;
 select v.entry_fee_cents into fee from app.tournament_setup_activations act join app.tournament_setup_event_versions v on v.id=act.setup_event_version_id where act.tournament_id=tid and act.event_id=mid and v.event_kind='main';
 if h.id is null or ownership_op.operation_id is null or ownership_op.request_payload->'reviewed'is distinct from'true'::jsonb or ownership_op.request_payload->>'sourceDigest'is distinct from h.source_digest or h.source_capture->>'sourceDigest'is distinct from h.source_digest or h.source_digest is distinct from pin->>'ownershipSourceDigest'or o->>'status'is distinct from'selected_step_pool_ownership_reviewed_v3'or o->>'revisionId'is distinct from h.id::text
  or b.id is null or b.event_type<>'received'or b.version<>(select max(version)from app.roster_payment_events where tournament_id=tid and roster_entry_id=roster)
  or entry->'receipt'is distinct from to_jsonb(b)or entry->'allocation'is distinct from to_jsonb(a)or a.id::text is distinct from pin->>'allocationId'or a.receipt_id is distinct from b.id or a.membership_version_id is distinct from membership or membership::text is distinct from pin->>'membershipVersionId'
  or encode(extensions.digest(convert_to(entry::text,'utf8'),'sha256'),'hex')is distinct from pin->>'entryDigest'or entry#>'{source,allocations}'is distinct from c->'baseAllocation'
  or fee is null or fee<=0 or pin->'mainBaseFeeMinor'is distinct from to_jsonb(fee)
 then return false;end if;
 for part in select value from jsonb_array_elements(c->'baseAllocation')loop
  if part->>'eventId'is distinct from mid::text or part->'classificationReviewed'is distinct from'true'::jsonb or(part->>'amountMinor')::numeric<=0 then return false;end if;
  total:=total+(part->>'amountMinor')::numeric;
  if part->>'bucket'='regular_entry'then if part->'poolId'is distinct from'null'::jsonb then return false;end if;regular:=regular+(part->>'amountMinor')::numeric;regular_count:=regular_count+1;
  elsif part->>'bucket'='q'then if coalesce(part->>'poolId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or part->>'poolId'=any(seen)then return false;end if;seen:=array_append(seen,part->>'poolId');qminor:=qminor+(part->>'amountMinor')::numeric;
  else return false;end if;
 end loop;
 return regular_count=1 and regular=fee and total=b.amount_minor and qminor is not distinct from(pin->>'qAllocatedMinor')::numeric and total<=9007199254740991;
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$$;
create function app.current_main_pool_receipt_binding_v3(actor uuid,sid uuid,tid uuid,eid uuid,roster uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare s jsonb;e jsonb;c jsonb;fee integer;qminor numeric;begin
 s:=app.current_main_pool_material_v3(actor,sid,tid,eid);if s->>'status'is distinct from'source_available'then return s;end if;
 select x into e from jsonb_array_elements(s#>'{reviewedSource,capture,rosterReceiptPartitions}')x where x#>>'{receipt,roster_entry_id}'=roster::text;
 fee:=(s#>>'{reviewedSource,capture,nativePlayoffSource,source,prizeActivation,eventVersion,entry_fee_cents}')::integer;
 select coalesce(sum((x->>'amountMinor')::numeric),0)into qminor from jsonb_array_elements(e#>'{source,allocations}')x where x->>'bucket'='q';
 c:=jsonb_build_object('kind','consy-addon-main-pools-source-v3','baseAllocation',e#>'{source,allocations}','mainPoolBinding',jsonb_build_object('kind','main-receipt-partitions-v3','mainEventId',s->'mainEventId','ownershipRevisionId',s->'ownershipRevisionId','ownershipSourceDigest',s->'ownershipSourceDigest','allocationId',e#>'{allocation,id}','membershipVersionId',e#>'{allocation,membership_version_id}','entryDigest',encode(extensions.digest(convert_to(e::text,'utf8'),'sha256'),'hex'),'mainBaseFeeMinor',fee,'qAllocatedMinor',qminor));
 if app.pool_aware_consy_base_binding_valid_v3(c,tid,eid,roster,(e#>>'{receipt,id}')::uuid)is distinct from true then return jsonb_build_object('status','blocked','code','current_main_receipt_partition_required');end if;
 return jsonb_build_object('status','source_available','source',e->'source','binding',c->'mainPoolBinding');end$$;

-- Clone actual transaction bodies with explicit actor/session parameters;
-- never impersonate auth.uid() or change request JWT settings.
do $actor$declare n text;sig text;args text;body text;begin
 foreach n in array array['lock_consy_addon_context_v1','finish_consy_addon_operation_v1','open_consy_addon_scope_v1','get_consy_addon_receipt_source_v1','record_consy_addon_receipt_v1','get_consy_addon_operation_v1','consy_addon_command_reply_v1']loop
  sig:=case n when'lock_consy_addon_context_v1'then'uuid,uuid'when'finish_consy_addon_operation_v1'then'uuid,uuid,uuid,text,jsonb,jsonb'when'open_consy_addon_scope_v1'then'uuid,uuid,jsonb'when'get_consy_addon_receipt_source_v1'then'uuid,uuid,uuid'when'record_consy_addon_receipt_v1'then'uuid,uuid,uuid,jsonb'when'get_consy_addon_operation_v1'then'uuid,uuid,uuid'else'uuid,uuid,uuid,jsonb,boolean'end;
  args:=case n when'lock_consy_addon_context_v1'then'tid uuid,eid uuid'when'finish_consy_addon_operation_v1'then'tid uuid,eid uuid,op uuid,typ text,req jsonb,outcome jsonb'when'open_consy_addon_scope_v1'then'tid uuid,eid uuid,req jsonb'when'get_consy_addon_receipt_source_v1'then'tid uuid,eid uuid,roster uuid'when'record_consy_addon_receipt_v1'then'tid uuid,eid uuid,roster uuid,req jsonb'when'get_consy_addon_operation_v1'then'tid uuid,eid uuid,op uuid'else'tid uuid,eid uuid,op uuid,req jsonb,recovery boolean'end;
  if not exists(select 1 from pg_proc where oid=to_regprocedure('app.'||n||'('||sig||')')and proowner='postgres'::regrole and prosecdef)then raise exception'pool_aware_consy_trusted_prerequisite_missing';end if;
  select prosrc into body from pg_proc where oid=to_regprocedure('app.'||n||'('||sig||')');
  -- Original open-scope sid means a NEW scope ID, not the authenticated SID.
  -- Rename its original local tokens BEFORE injecting real session arguments.
  if n='open_consy_addon_scope_v1'then body:=regexp_replace(body,'\msid\M','new_scope_id','g');end if;
  body:=replace(body,'auth.uid()','(actor)');
  body:=replace(body,'app.lock_consy_addon_context_v1(tid,eid)','app.pool_aware_lock_consy_addon_context_v1(actor,sid,tid,eid)');
  body:=replace(body,'app.finish_consy_addon_operation_v1(tid,eid,','app.pool_aware_finish_consy_addon_operation_v1(actor,sid,tid,eid,');
  body:=replace(body,'app.get_consy_addon_receipt_source_v1(tid,eid,roster)','app.pool_aware_get_consy_addon_receipt_source_v1(actor,sid,tid,eid,roster)');
  body:=replace(body,'app.open_consy_addon_scope_v1(tid,eid,req)','app.pool_aware_open_consy_addon_scope_v1(actor,sid,tid,eid,req)');
  body:=replace(body,'app.record_consy_addon_receipt_v1(tid,eid,','app.pool_aware_record_consy_addon_receipt_v1(actor,sid,tid,eid,');
  body:=replace(body,'app.get_consy_addon_operation_v1(tid,eid,op)','app.pool_aware_get_consy_addon_operation_v1(actor,sid,tid,eid,op)');
  if n<>'get_consy_addon_operation_v1'then
   body:=overlay(body placing 'begin if app.pool_aware_consy_receipts_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return '||case when n='lock_consy_addon_context_v1'then'null'else'null'end||';end if;'from strpos(body,'begin')for 5);
  end if;
  execute format('create function app.%I(actor uuid,sid uuid,%s)returns %s language %s %s security definer set search_path=''''set timezone=''UTC''as %L','pool_aware_'||n,args,case when n='lock_consy_addon_context_v1'then'uuid'else'jsonb'end,case when n='get_consy_addon_operation_v1'then'sql'else'plpgsql'end,case when n='get_consy_addon_operation_v1'then'stable'else'volatile'end,body);
 end loop;
end$actor$;
do $legacy_source$declare d text;begin
 d:=pg_get_functiondef('app.pool_aware_get_consy_addon_receipt_source_v1(uuid,uuid,uuid,uuid,uuid)'::regprocedure);execute replace(d,'FUNCTION app.pool_aware_get_consy_addon_receipt_source_v1(','FUNCTION app.pool_aware_legacy_receipt_source_v3(');
end$legacy_source$;
-- Only the known unsupported optional/base-classification seams change.
do $patch$declare d text;old text;replacement text;start_at integer;end_at integer;body text;begin
 select pg_get_functiondef('app.pool_aware_lock_consy_addon_context_v1(uuid,uuid,uuid,uuid)'::regprocedure)into d;
 old:='return m;';replacement:='if(app.native_optional_recorded_sources_v2(actor,tid))#>''{facts,existingOptionalAllocationEvidence}''=''true''::jsonb and(app.modern_manual_playoff_financial_hold_v1(tid,m)or app.modern_manual_playoff_financial_hold_v1(tid,eid))then raise exception''pool_aware_addon_after_awards_requires_review'';end if;return m;';if strpos(d,old)=0 then raise exception'pool_aware_consy_lock_anchor_changed';end if;execute replace(replace(d,old,replacement),'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
 select pg_get_functiondef('app.pool_aware_open_consy_addon_scope_v1(uuid,uuid,uuid,uuid,jsonb)'::regprocedure)into d;
 old:='if(app.get_native_event_ledger_sources_v1(tid))#>''{facts,existingOptionalAllocationEvidence}''is distinct from''false''::jsonb then raise exception''consy_addon_optional_domain_unsupported'';end if;';
 replacement:='if(app.native_optional_recorded_sources_v2(actor,tid))#>''{facts,existingOptionalAllocationEvidence}''=''true''::jsonb then if app.current_main_pool_material_v3(actor,sid,tid,eid)->>''status''is distinct from''source_available''then raise exception''pool_aware_main_ownership_required'';end if;elsif(app.native_optional_recorded_sources_v2(actor,tid))#>''{facts,existingOptionalAllocationEvidence}''is distinct from''false''::jsonb then raise exception''consy_addon_optional_domain_unsupported'';end if;';if strpos(d,old)=0 then raise exception'pool_aware_consy_scope_anchor_changed';end if;execute replace(replace(d,old,replacement),'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
 select prosrc into body from pg_proc where oid='app.pool_aware_get_consy_addon_receipt_source_v1(uuid,uuid,uuid,uuid,uuid)'::regprocedure;
 body:=replace(body,'decision jsonb;','main_binding jsonb;decision jsonb;');start_at:=strpos(body,' if b.id is null or b.event_type<>''received''');end_at:=strpos(body,' select jsonb_build_object(''version'',version,');if start_at=0 or end_at<=start_at then raise exception'pool_aware_consy_receipt_anchor_changed';end if;
 body:=overlay(body placing ' main_binding:=app.current_main_pool_receipt_binding_v3(actor,sid,tid,eid,roster);if main_binding->>''status''is distinct from''source_available''then return coalesce(main_binding,jsonb_build_object(''status'',''blocked'',''code'',''current_main_receipt_partition_required''));end if;part:=main_binding->''source'';'||E'\n'from start_at for end_at-start_at);
 body:=replace(body,'''kind'',''consy-addon-receipt-source-v1'',''tournamentId''','''kind'',''consy-addon-main-pools-source-v3'',''mainPoolBinding'',main_binding->''binding'',''tournamentId''');
 execute format('create or replace function app.pool_aware_get_consy_addon_receipt_source_v1(actor uuid,sid uuid,tid uuid,eid uuid,roster uuid)returns jsonb language plpgsql security definer set search_path=''''set timezone=''UTC''as %L',body);
 select pg_get_functiondef('app.pool_aware_consy_addon_command_reply_v1(uuid,uuid,uuid,uuid,uuid,jsonb,boolean)'::regprocedure)into d;
 old:='''consy_addon_optional_domain_unsupported'',';if strpos(d,old)=0 then raise exception'pool_aware_consy_reply_anchor_changed';end if;d:=replace(d,old,old||'''pool_aware_main_ownership_required'',''pool_aware_addon_after_awards_requires_review'',');execute replace(d,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$patch$;
do $partition_source$declare d text;begin
 d:=pg_get_functiondef('app.pool_aware_get_consy_addon_receipt_source_v1(uuid,uuid,uuid,uuid,uuid)'::regprocedure);execute replace(d,'FUNCTION app.pool_aware_get_consy_addon_receipt_source_v1(','FUNCTION app.pool_aware_partition_receipt_source_v3(');
end$partition_source$;
create or replace function app.pool_aware_get_consy_addon_receipt_source_v1(actor uuid,sid uuid,tid uuid,eid uuid,roster uuid)returns jsonb language plpgsql security definer set search_path=''as $$declare old jsonb;begin
 old:=app.pool_aware_legacy_receipt_source_v3(actor,sid,tid,eid,roster);
 if old->>'status'='blocked'and old->>'code'in('full_main_base_receipt_required','main_only_classification_required')then return app.pool_aware_partition_receipt_source_v3(actor,sid,tid,eid,roster);end if;return old;end$$;
-- Immutable receipt validation extends only the new capture kind and its
-- actual Main partition witness. Original method, nonce, duplicate, currency,
-- full fee, latest base, operation, timestamp and physical-ID guards remain.
do $valid$declare d text;body text;old text;begin
 d:=pg_get_functiondef('app.consy_addon_receipt_valid_v1(uuid)'::regprocedure);execute replace(d,'FUNCTION app.consy_addon_receipt_valid_v1(','FUNCTION app.consy_addon_receipt_valid_v1_before_pool_aware(');
 select prosrc into body from pg_proc where oid='app.consy_addon_receipt_valid_v1(uuid)'::regprocedure;
 body:=replace(body,'c->>''kind''is distinct from''consy-addon-receipt-source-v1''','c->>''kind''is distinct from''consy-addon-main-pools-source-v3''');
 old:='c->''baseAllocation''is distinct from jsonb_build_array(jsonb_build_object(''eventId'',s.main_event_id,''bucket'',''regular_entry'',''poolId'',null,''amountMinor'',b.amount_minor,''classificationReviewed'',true))';
 if strpos(body,old)=0 then raise exception'pool_aware_consy_validity_anchor_changed';end if;body:=replace(body,old,'app.pool_aware_consy_base_binding_valid_v3(c,r.tournament_id,r.event_id,r.roster_entry_id,b.id)is distinct from true');
 execute format('create function app.pool_aware_consy_addon_receipt_valid_v3(rid uuid)returns boolean language plpgsql stable security definer set search_path=''''set timezone=''UTC''as %L',body);
end$valid$;
create or replace function app.consy_addon_receipt_valid_v1(rid uuid)returns boolean language plpgsql stable security definer set search_path=''as $$begin
 if exists(select 1 from app.consy_addon_receipts_v1 where id=rid and eligibility_capture->>'kind'='consy-addon-main-pools-source-v3')then return app.pool_aware_consy_addon_receipt_valid_v3(rid);end if;return app.consy_addon_receipt_valid_v1_before_pool_aware(rid);end$$;
-- Add a sanitized, versioned binding to actual native facts. No payer details
-- beyond the existing event/roster/source contract are added to this projection.
do $native$declare d text;begin d:=pg_get_functiondef('app.get_native_event_ledger_sources_v1(uuid)'::regprocedure);execute replace(d,'FUNCTION app.get_native_event_ledger_sources_v1(','FUNCTION app.get_native_event_ledger_sources_v1_before_pool_aware(');end$native$;
create or replace function app.get_native_event_ledger_sources_v1(p_tournament_id uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare old jsonb;facts jsonb;bindings jsonb;h text;begin
 old:=app.get_native_event_ledger_sources_v1_before_pool_aware(p_tournament_id);
 if old->>'status'is distinct from'sources_available'or not exists(select 1 from app.consy_addon_receipts_v1 where tournament_id=p_tournament_id and eligibility_capture->>'kind'='consy-addon-main-pools-source-v3')then return old;end if;
 if app.pool_aware_consy_receipts_enabled_v3()is distinct from true then return jsonb_build_object('status','blocked','code','pool_aware_consy_source_disabled');end if;
 select jsonb_agg(case when r.eligibility_capture->>'kind'='consy-addon-main-pools-source-v3'then b||jsonb_build_object('mainPoolBinding',r.eligibility_capture->'mainPoolBinding')else b end order by b->>'sourceId')into bindings from jsonb_array_elements(old#>'{facts,addonBindings}')b join app.consy_addon_receipts_v1 r on r.id::text=b->>'sourceId'and r.tournament_id=p_tournament_id;
 facts:=(old->'facts')||jsonb_build_object('addonBindings',bindings);h:=encode(extensions.digest(convert_to(jsonb_build_array('native-event-ledger-pool-aware-consy-v3',facts)::text,'utf8'),'sha256'),'hex');
 return old||jsonb_build_object('kind','native-event-ledger-sources-pool-aware-consolation-addons-v3','facts',facts,'sourceDigest',h);
end$$;
-- The service reader was cloned before add-on support. Adapt the ACTUAL add-on
-- wrapper around its actor-bound base rather than calling auth.uid() as service
-- or omitting new receipts. Both transports expose the same versioned facts.
do $servicefacts$declare d text;body text;old text;begin
 d:=pg_get_functiondef('app.native_optional_recorded_sources_v2(uuid,uuid)'::regprocedure);execute replace(d,'FUNCTION app.native_optional_recorded_sources_v2(','FUNCTION app.native_optional_recorded_sources_v2_before_pool_aware(');
 select prosrc into body from pg_proc where oid='app.get_native_event_ledger_sources_v1_before_pool_aware(uuid)'::regprocedure;
 old:='app.get_native_event_ledger_sources_v1_before_consy_addon(p_tournament_id)';if(length(body)-length(replace(body,old,'')))/length(old)<>2 then raise exception'pool_aware_service_addon_delegate_changed';end if;
 body:=replace(body,old,'app.native_optional_recorded_sources_v2_before_pool_aware(actor,p_tournament_id)');
 execute format('create function app.pool_aware_service_addon_sources_v3(actor uuid,p_tournament_id uuid)returns jsonb language plpgsql security definer set search_path=''''set timezone=''UTC''as %L',body);
end$servicefacts$;
create or replace function app.native_optional_recorded_sources_v2(actor uuid,p_tournament_id uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare old jsonb;facts jsonb;bindings jsonb;begin
 old:=app.pool_aware_service_addon_sources_v3(actor,p_tournament_id);
 if old->>'status'is distinct from'sources_available'or not exists(select 1 from app.consy_addon_receipts_v1 where tournament_id=p_tournament_id and eligibility_capture->>'kind'='consy-addon-main-pools-source-v3')then return old;end if;
 if app.pool_aware_consy_receipts_enabled_v3()is distinct from true then return jsonb_build_object('status','blocked','code','pool_aware_consy_source_disabled');end if;
 select jsonb_agg(case when r.eligibility_capture->>'kind'='consy-addon-main-pools-source-v3'then b||jsonb_build_object('mainPoolBinding',r.eligibility_capture->'mainPoolBinding')else b end order by b->>'sourceId')into bindings from jsonb_array_elements(old#>'{facts,addonBindings}')b join app.consy_addon_receipts_v1 r on r.id::text=b->>'sourceId'and r.tournament_id=p_tournament_id;
 facts:=(old->'facts')||jsonb_build_object('addonBindings',bindings);
 return old||jsonb_build_object('kind','native-event-ledger-sources-pool-aware-consolation-addons-v3','facts',facts,'sourceDigest',encode(extensions.digest(convert_to(jsonb_build_array('native-event-ledger-pool-aware-consy-v3',facts)::text,'utf8'),'sha256'),'hex'));
end$$;
create function public.get_pool_aware_consy_source_v3(actor uuid,sid uuid,tid uuid,eid uuid,roster uuid)returns jsonb language plpgsql security definer set search_path=''as $$declare r jsonb;begin
 if app.pool_aware_consy_receipts_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;r:=app.pool_aware_get_consy_addon_receipt_source_v1(actor,sid,tid,eid,roster);if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;return r;end$$;
create function public.pool_aware_consy_command_v3(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb,recovery boolean)returns jsonb language plpgsql security definer set search_path=''as $$declare r jsonb;begin
 if app.pool_aware_consy_receipts_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;r:=app.pool_aware_consy_addon_command_reply_v1(actor,sid,tid,eid,op,request,recovery);if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception'pool_aware_receipt_identity_changed';end if;return r;end$$;
do $secure$declare r record;begin for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='app'and(p.proname like 'pool_aware_%'or p.proname in('current_main_pool_material_v3','current_main_pool_receipt_binding_v3','consy_addon_receipt_valid_v1_before_pool_aware','consy_addon_receipt_valid_v1','get_native_event_ledger_sources_v1_before_pool_aware','get_native_event_ledger_sources_v1','native_optional_recorded_sources_v2_before_pool_aware','native_optional_recorded_sources_v2')))or(n.nspname='public'and p.proname in('get_pool_aware_consy_source_v3','pool_aware_consy_command_v3'))loop execute format('alter function %s owner to postgres',r.sig);execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);end loop;end$secure$;
commit;

