-- PRIVATE SOURCE CANDIDATE ONLY. No migration, grant, caller capability or payout.
-- Requires the complete latest event-prize save/context/registration closure,
-- native mixed funding/attendance/Start, and native-mixed-playoff-v1.sql.
-- Legacy original OIDs remain in place; their exact prior bodies are copied to
-- revoked functions before installing opt-in dispatchers. No historical rows,
-- saved policies, old output or old digest domains are rewritten.
begin;

do $dependencies$declare signature text;n text;begin
 foreach signature in array array[
  'app.save_event_settings_custom_pool_draft_v4(uuid,jsonb)',
  'app.save_event_prize_settings_source_v1(uuid,text)','app.get_event_prize_workspace_source_v1(uuid)',
  'app.get_event_prize_rule_context_source_v1(uuid)','app.save_event_prize_rule_context_v1(uuid,jsonb)',
  'app.event_prize_activation_current_v1(uuid,uuid,uuid)','app.assess_event_prize_series_draft_v1(jsonb,jsonb)',
  'app.valid_event_prize_snapshot_source_v1(jsonb)','app.event_prize_policy_ready_v1(jsonb)',
  'app.native_mixed_admission_base_source_v1(uuid,uuid)','app.native_mixed_playoff_source_v1(uuid,uuid)'
 ]loop if to_regprocedure(signature)is null then raise exception'native_latest_dependency_missing: %',signature;end if;end loop;
 foreach n in array array['event_prize_reservations_v1','event_prize_revision_bindings_v1',
  'event_prize_snapshots_v1','event_prize_heads_v1','event_prize_outcomes_v1','event_prize_policy_activation_pins_v1']loop
  if to_regclass('app.'||n)is null then raise exception'native_latest_dependency_missing: %',n;end if;
 end loop;
end$dependencies$;

create function app.native_mixed_latest_prize_admission_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

-- Any latest-prize history is a barrier, including a missing/stale head or an
-- incomplete adoption. Such a tournament must never fall back to dormant V1.
create function app.native_mixed_latest_prize_present_v1(tid uuid)returns boolean
language plpgsql volatile security definer set search_path=''as $$begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='55P03',message='native_latest_isolation_not_supported';end if;
 perform 1 from app.tournaments where id=tid for share nowait;
 perform app.lock_event_settings_activation_sources_v1();
 lock table app.event_prize_heads_v1,app.event_prize_snapshots_v1,
  app.event_prize_revision_bindings_v1,app.event_prize_reservations_v1,
  app.event_prize_outcomes_v1,app.event_prize_policy_activation_pins_v1 in share mode nowait;
 return exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=tid)
  or exists(select 1 from app.event_prize_heads_v1 where tournament_id=tid)
  or exists(select 1 from app.event_prize_revision_bindings_v1 where tournament_id=tid)
  or exists(select 1 from app.event_prize_policy_activation_pins_v1 where tournament_id=tid)
  or exists(select 1 from app.event_prize_reservations_v1 where tournament_id=tid)
  or exists(select 1 from app.event_prize_outcomes_v1 o join app.event_prize_reservations_v1 r
    on r.actor_id=o.actor_id and r.operation_id=o.operation_id where r.tournament_id=tid);
end$$;

-- Source binding only. The captured Graduated/all-qualifier plan is NOT executed
-- by this bridge. Manual simulated Finance remains a distinct disclosed path.
create function app.native_mixed_latest_prize_pin_v1(tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$
declare b app.event_settings_operational_bindings_v1%rowtype;a app.tournament_setup_activations%rowtype;
 e app.tournament_setup_event_versions%rowtype;s app.event_settings_snapshots_v3%rowtype;
 pin app.event_prize_policy_activation_pins_v1%rowtype;p app.event_prize_snapshots_v1%rowtype;
 rb app.event_prize_revision_bindings_v1%rowtype;r app.event_prize_reservations_v1%rowtype;
 saved jsonb;activated jsonb;current_pin jsonb;plan jsonb;body jsonb;
begin
 if app.native_mixed_latest_prize_admission_enabled_v1()is distinct from true
  or app.native_mixed_latest_prize_present_v1(tid)is distinct from true then return null;end if;
 lock table app.event_settings_operational_bindings_v1,app.tournament_setup_activations,
  app.event_settings_snapshots_v3,app.event_settings_operational_outcomes_v1 in share mode nowait;
 select*into b from app.event_settings_operational_bindings_v1 where tournament_id=tid and event_id=eid;
 select*into a from app.tournament_setup_activations where id=b.activation_id and tournament_id=tid and event_id=eid;
 select*into e from app.tournament_setup_event_versions where id=b.setup_event_version_id and tournament_id=tid;
 select*into s from app.event_settings_snapshots_v3 where id=b.settings_snapshot_id and tournament_id=tid;
 if b.id is null or a.id is null or e.id is null or s.id is null
  or a.setup_event_version_id is distinct from e.id or a.setup_revision_id is distinct from e.setup_revision_id
  or s.setup_revision_id is distinct from e.setup_revision_id
  or b.context->>'eventKind'is distinct from'main'or b.context->'sanctioned'is distinct from'false'::jsonb
  or e.event_kind<>'main'or e.style_code<>'Standard'or e.format_code<>'standard_singles'or e.game_count<>12
  or(select count(*)from app.events where tournament_id=tid)<>1
  or not exists(select 1 from app.events where id=eid and tournament_id=tid and event_type='main'
    and format='standard_singles'and operational_state='active'and ruleset_version_id=a.ruleset_version_id)
  or not exists(select 1 from jsonb_array_elements(s.effective_settings)x where x->>'eventClientRowId'=e.client_row_id::text
    and x->>'mode'='configured'and x->'draft'=b.draft)
  or not exists(select 1 from app.event_rule_context_reviews_v1 x where x.id=b.review_id and x.tournament_id=tid
    and x.settings_snapshot_id=s.id and x.setup_event_version_id=e.id and x.draft=b.draft and x.context=b.context)
 then return null;end if;
 -- Reuse the existing current head/save-hash/activation-pin/role proof, without
 -- importing its ordinary Finance reader or its native allocation requirements.
 current_pin:=app.event_prize_activation_current_v1(tid,b.intent_actor_id,b.intent_operation_id);
 if current_pin is null or current_pin->>'setupRevisionId'is distinct from e.setup_revision_id::text
  or current_pin->>'settingsSnapshotId'is distinct from s.id::text then return null;end if;
 select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=b.intent_actor_id
  and operation_id=b.intent_operation_id and tournament_id=tid;
 select ps.*into p from app.event_prize_heads_v1 h join app.event_prize_snapshots_v1 ps
  on ps.id=h.snapshot_id and ps.tournament_id=h.tournament_id where h.tournament_id=tid;
 select*into rb from app.event_prize_revision_bindings_v1 where tournament_id=tid and setup_revision_id=e.setup_revision_id;
 select*into r from app.event_prize_reservations_v1 where actor_id=p.actor_id and operation_id=p.operation_id and tournament_id=tid;
 select record_payload into saved from app.event_prize_outcomes_v1 where actor_id=r.actor_id and operation_id=r.operation_id;
 select result into activated from app.event_settings_operational_outcomes_v1 where actor_id=pin.actor_id
  and operation_id=pin.operation_id and tournament_id=tid and request_payload=pin.inner_intent;
 if pin.actor_id is null or p.id is null or rb.actor_id is null or r.actor_id is null
  or pin.prize_snapshot_id is distinct from p.id or pin.prize_digest is distinct from p.document->>'prizeDigest'
  or pin.settings_snapshot_id is distinct from s.id or pin.setup_revision_id is distinct from e.setup_revision_id
  or rb.settings_snapshot_id is distinct from s.id or rb.actor_id is distinct from p.actor_id or rb.operation_id is distinct from p.operation_id
  or p.setup_revision_id is distinct from e.setup_revision_id or s.actor_id is distinct from r.actor_id or s.operation_id is distinct from r.nested_operation_id
  or app.valid_event_prize_snapshot_source_v1(p.document)is distinct from true
  or saved->>'kind'is distinct from'event-prize-operation-record-v1'
  or saved->>'operationId'is distinct from r.operation_id::text
  or saved#>>'{scope,actorId}'is distinct from r.actor_id::text or saved#>>'{scope,tournamentId}'is distinct from tid::text
  or saved#>>'{result,status}'is distinct from'accepted'or saved->>'requestText'is distinct from r.request_text
  or saved->>'requestHash'is distinct from r.request_hash or saved#>'{result,ack,envelope}'is distinct from r.request_payload
  or saved#>>'{result,ack,fullRequestHash}'is distinct from r.request_hash or p.document->>'prizeDigest'is distinct from r.request_hash
  or saved#>'{result,ack,snapshot}'is distinct from p.document
  or activated->>'status'is distinct from'event_settings_operationally_activated'
  or activated->>'actorId'is distinct from pin.actor_id::text or activated->>'operationId'is distinct from pin.operation_id::text
  or activated->>'tournamentId'is distinct from tid::text or activated->'request'is distinct from pin.inner_intent
  or activated->>'setupRevisionId'is distinct from e.setup_revision_id::text
  or activated->>'settingsSnapshotId'is distinct from s.id::text
 then return null;end if;
 select value into plan from jsonb_array_elements(p.document->'plans')x
  where x->>'eventClientRowId'=e.client_row_id::text and x->>'eventKind'='main'and x->>'mode'='proposed_v2';
 if plan is null or app.event_prize_policy_ready_v1(plan->'draft')is distinct from true
  or plan#>>'{draft,method}'is distinct from'graduated'or plan#>>'{draft,recipients}'is distinct from'all'
  or(app.assess_event_prize_series_draft_v1(b.draft,b.context))->>'status'is distinct from'eligible'
 then return null;end if;
 body:=jsonb_build_object('kind','native-mixed-latest-prize-pin-v1','tournamentId',tid,'eventId',eid,
  'operationalBindingId',b.id,'activationId',a.id,'setupEventVersionId',e.id,'settingsSnapshot',to_jsonb(s),
  'revisionBinding',to_jsonb(rb),'prizeSnapshot',to_jsonb(p),'activationPin',to_jsonb(pin),
  'saveRequestHash',r.request_hash,'saveOutcome',saved,'operationalOutcome',activated,'plan',plan,
  'latestPolicyExecuted',false,'ordinaryFinanceSource',false,'simulationOnly',true,'moneyMoved',false);
 return body||jsonb_build_object('sourceDigest',app.native_mixed_simulation_hash_v1(body));
end$$;

-- The pins below hash normalized *recoverable source bodies*, not a guessed PG
-- pretty-printed definition. Catalog metadata is checked separately. Copies use
-- the actual installed definition, and a postcondition verifies their full body.
do $install$
declare item record;d text;body text;legacy text;candidate text;old text;replacement text;oid_before oid;
begin
 for item in select*from(values
  ('native_mixed_admission_base_source_v1','native_mixed_admission_base_legacy_latest_v1','native_mixed_admission_base_latest_v1','5c326a4e83f975c26b2ab267fdd92471fb30b65ed14d4c242c54e8ad301cf92f'),
  ('native_mixed_playoff_source_v1','native_mixed_playoff_source_legacy_latest_v1','native_mixed_playoff_source_latest_v1','ff3a30d7058be63b03e1105e7d4240e65ff60f55bb31a35f429c4580a1bfabbf')
 )as sources(name,legacy_name,latest_name,body_sha)loop
  oid_before:=to_regprocedure('app.'||item.name||'(uuid,uuid)');
  if oid_before is null or to_regprocedure('app.'||item.legacy_name||'(uuid,uuid)')is not null
   or to_regprocedure('app.'||item.latest_name||'(uuid,uuid)')is not null then raise exception'native_latest_install_reconcile_required';end if;
  select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=oid_before;
  if encode(extensions.digest(body,'sha256'),'hex')<>item.body_sha
   or not exists(select 1 from pg_proc x join pg_language l on l.oid=x.prolang where x.oid=oid_before
     and l.lanname='plpgsql'and x.prosecdef and not x.proisstrict and x.prorettype='jsonb'::regtype
     and x.proowner='postgres'::regrole and x.provolatile::text=case when item.name='native_mixed_admission_base_source_v1'then's'else'v'end
     and x.proconfig@>array['search_path=""']and exists(select 1 from unnest(x.proconfig)g where lower(g)='timezone=utc'))
  then raise exception'native_latest_dependency_definition_changed: %',item.name;end if;
  d:=replace(pg_get_functiondef(oid_before),E'\r\n',E'\n');
  old:='FUNCTION app.'||item.name||'(';
  if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'native_latest_name_anchor_changed';end if;
  legacy:=replace(d,old,'FUNCTION app.'||item.legacy_name||'(');execute legacy;
  if replace(pg_get_functiondef(to_regprocedure('app.'||item.legacy_name||'(uuid,uuid)')),E'\r\n',E'\n')<>legacy then raise exception'native_latest_legacy_copy_changed';end if;
  candidate:=replace(d,old,'FUNCTION app.'||item.latest_name||'(');
  old:='assessment:=app.assess_event_rule_draft_v1(b.draft,b.context);';
  replacement:='latest_pin:=app.native_mixed_latest_prize_pin_v1(tid,eid);if latest_pin is null then '
   ||case when item.name='native_mixed_admission_base_source_v1'then 'return jsonb_build_object(''status'',''blocked'',''code'',''native_latest_prize_binding_unavailable'');'
     else 'return null;'end||'end if;assessment:=app.assess_event_prize_series_draft_v1(b.draft,b.context);';
  if(length(candidate)-length(replace(candidate,old,'')))/length(old)<>1 then raise exception'native_latest_assessor_anchor_changed';end if;
  candidate:=replace(candidate,old,replacement);
  old:='assessment jsonb;';
  if(length(candidate)-length(replace(candidate,old,'')))/length(old)<>1 then raise exception'native_latest_declaration_anchor_changed';end if;
  candidate:=replace(candidate,old,'assessment jsonb;latest_pin jsonb;');
  if item.name='native_mixed_admission_base_source_v1'then old:='''syntheticAllFlags'',false';else old:='''series'',series,''roster'',roster';end if;
  replacement:=case when item.name='native_mixed_admission_base_source_v1'then'''latestPrize'',latest_pin,''syntheticAllFlags'',false'else'''latestPrize'',latest_pin,''series'',series,''roster'',roster'end;
  if(length(candidate)-length(replace(candidate,old,'')))/length(old)<>1 then raise exception'native_latest_capture_anchor_changed';end if;
  candidate:=replace(candidate,old,replacement);
  -- Latest source calls a locking helper; preserve legacy copy volatility, while
  -- the new variant and original-OID dispatcher use fresh READ COMMITTED reads.
  candidate:=replace(candidate,E' STABLE SECURITY DEFINER',E' VOLATILE SECURITY DEFINER');execute candidate;
  execute format($wrapper$create or replace function app.%I(tid uuid,eid uuid)returns jsonb
   language plpgsql volatile security definer set search_path=''set timezone='UTC'as $body$begin
    if app.native_mixed_latest_prize_present_v1(tid)then
     if app.native_mixed_latest_prize_admission_enabled_v1()is distinct from true then %s end if;
     return app.%I(tid,eid);
    end if;
    return app.%I(tid,eid);
   end$body$;$wrapper$,item.name,
    case when item.name='native_mixed_admission_base_source_v1'then'return jsonb_build_object(''status'',''blocked'',''code'',''native_latest_bridge_disabled'');'else'return null;'end,
    item.latest_name,item.legacy_name);
  if to_regprocedure('app.'||item.name||'(uuid,uuid)')<>oid_before then raise exception'native_latest_original_oid_changed';end if;
 end loop;
end$install$;

do $acl$declare n text;begin foreach n in array array[
 'native_mixed_latest_prize_admission_enabled_v1()','native_mixed_latest_prize_present_v1(uuid)',
 'native_mixed_latest_prize_pin_v1(uuid,uuid)','native_mixed_admission_base_legacy_latest_v1(uuid,uuid)',
 'native_mixed_admission_base_latest_v1(uuid,uuid)','native_mixed_playoff_source_legacy_latest_v1(uuid,uuid)',
 'native_mixed_playoff_source_latest_v1(uuid,uuid)','native_mixed_admission_base_source_v1(uuid,uuid)',
 'native_mixed_playoff_source_v1(uuid,uuid)']loop
 execute 'alter function app.'||n||' owner to postgres';execute 'revoke all on function app.'||n||' from public,anon,authenticated,service_role';
end loop;end$acl$;
commit;
