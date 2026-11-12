-- UNEXECUTED PRIVATE OPERATIONAL ACTIVATION CANDIDATE.
-- Requires event-settings-transaction/workspace v3, activation-source v4,
-- event-rule-context/assessment v1 and activation-guard v1. The native
-- playoff gate may be installed later; deferred settings stay blocked until
-- its complete trigger catalog reports available.
--
-- Initial technical scope is deliberately narrow: every setup row must be a
-- configured Standard / standard_singles Main or Consolation. Satellites and
-- mixed configured/legacy revisions fail closed. This is not an ACC rule.
-- There are no grants, routes or default enablement.
begin;
-- Hard disabled pending isolated runtime acceptance and a separately reviewed
-- enablement change. Private function/catalog presence is not enablement.
create function app.event_settings_operational_activation_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
alter function app.event_settings_operational_activation_enabled_v1()owner to postgres;
revoke all on function app.event_settings_operational_activation_enabled_v1()from public,anon,authenticated,service_role;

create table app.event_settings_operational_attempts_v1(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,
 request_payload jsonb not null,request_hash text not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id)
  references app.event_settings_activation_intents_v1(actor_id,operation_id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array(
  'event-settings-operational-activation-v1',actor_id,tournament_id,operation_id,request_payload
 )::text,'utf8'),'sha256'),'hex'))
);
create table app.event_settings_operational_outcomes_v1(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,
 request_payload jsonb not null,request_hash text not null,result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id)
  references app.event_settings_activation_intents_v1(actor_id,operation_id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array(
  'event-settings-operational-activation-v1',actor_id,tournament_id,operation_id,request_payload
 )::text,'utf8'),'sha256'),'hex'))
);
create table app.event_settings_operational_bindings_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null,event_id uuid not null,activation_id uuid not null,
 setup_event_version_id uuid not null,settings_snapshot_id uuid not null,
 review_id uuid not null,draft jsonb not null,context jsonb not null,
 deferred_original_field boolean not null,intent_actor_id uuid not null,
 intent_operation_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(event_id),unique(activation_id),unique(setup_event_version_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(activation_id)references app.tournament_setup_activations(id),
 foreign key(setup_event_version_id)references app.tournament_setup_event_versions(id),
 foreign key(settings_snapshot_id)references app.event_settings_snapshots_v3(id),
 foreign key(review_id)references app.event_rule_context_reviews_v1(id),
 foreign key(intent_actor_id,intent_operation_id,tournament_id)
  references app.event_settings_activation_intents_v1(actor_id,operation_id,tournament_id)
);
do $$declare n text;begin
 foreach n in array array['event_settings_operational_attempts_v1','event_settings_operational_outcomes_v1','event_settings_operational_bindings_v1']loop
  execute format('alter table app.%I owner to postgres',n);
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on table app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 end loop;
end$$;

create index event_settings_operational_bindings_tournament_v1 on app.event_settings_operational_bindings_v1(tournament_id,event_id);
create index event_settings_operational_bindings_intent_v1 on app.event_settings_operational_bindings_v1(intent_actor_id,intent_operation_id);

-- Recompute every source fact under the activation guard's shared NOWAIT
-- reservations. These source tables remain read-only in this operation. The
-- native core's existing blocking locks are preserved and are not relabeled.
create function app.event_settings_operational_proof_v1(tid uuid,actor uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare i app.event_settings_activation_intents_v1%rowtype;
 rev app.tournament_setup_revisions%rowtype;s app.event_settings_snapshots_v3%rowtype;
 links app.setup_event_link_versions_v1%rowtype;e app.tournament_setup_event_versions%rowtype;
 r app.event_rule_context_reviews_v1%rowtype;req jsonb;item jsonb;pin jsonb;
 assessment jsonb;configured_rows jsonb;settings_hash text;rid uuid;expected integer;
 event_count integer;pin_count integer;deferred boolean;finance_guard_available boolean:=false;
begin
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','blocked','code','isolation_not_supported');end if;
 if tid is null or actor is null or op is null then return jsonb_build_object('status','blocked','code','invalid_request');end if;
 perform 1 from app.tournaments where id=tid for update nowait;
 if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for share nowait;
 if not found then return jsonb_build_object('status','blocked','code','not_director');end if;
 perform app.lock_event_settings_activation_sources_v1();
 select*into i from app.event_settings_activation_intents_v1 where actor_id=actor and operation_id=op and tournament_id=tid;
 if not found or i.result->>'status'is distinct from'activation_intent_prepared' or i.request_payload->>'kind'is distinct from'event-settings-activation-intent-v1' or i.result->'request'is distinct from i.request_payload
 then return jsonb_build_object('status','blocked','code','prepared_intent_required');end if;
 req:=i.request_payload->'request';
 if jsonb_typeof(req)is distinct from'object'
  or coalesce(req->>'setupRevisionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(req->>'expectedVersion','')!~'^[1-9][0-9]*$'
  or coalesce(req->>'idempotencyKey','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or req->>'idempotencyKey'is distinct from op::text
 then return jsonb_build_object('status','blocked','code','prepared_intent_invalid');end if;
 rid:=(req->>'setupRevisionId')::uuid;expected:=(req->>'expectedVersion')::integer;
 select*into rev from app.tournament_setup_revisions where id=rid and tournament_id=tid;
 if not found or rev.version is distinct from expected or rev.id is distinct from(select id from app.tournament_setup_revisions where tournament_id=tid order by version desc limit 1)
 then return jsonb_build_object('status','blocked','code','settings_source_changed');end if;
 select*into s from app.event_settings_snapshots_v3 where tournament_id=tid and setup_revision_id=rid;
 select*into links from app.setup_event_link_versions_v1 where tournament_id=tid and setup_revision_id=rid;
 if s.id is null or links.id is null or not links.complete then return jsonb_build_object('status','blocked','code','association_or_settings_unavailable');end if;
 select count(*)into event_count from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rid;
 if event_count not between 1 and 32 or jsonb_typeof(s.effective_settings)is distinct from'array' or jsonb_array_length(s.effective_settings)<>event_count
  or exists(select 1 from app.tournament_setup_event_versions x where x.tournament_id=tid and x.setup_revision_id=rid and(x.event_kind not in('main','consolation')or x.style_code<>'Standard'or x.format_code<>'standard_singles'))
  or exists(select 1 from app.tournament_setup_event_versions x where x.tournament_id=tid and x.setup_revision_id=rid and(select count(*)from jsonb_array_elements(s.effective_settings)y where y->>'eventClientRowId'=x.client_row_id::text and y->>'mode'='configured'and app.valid_event_parameters_raw_v3(y->'draft'))<>1)
 then return jsonb_build_object('status','blocked','code','unsupported_operational_scope');end if;
 if coalesce(req->'declarationPins','[]'::jsonb)is distinct from'[]'::jsonb or i.source_capture->'legacyDeclarationRequiredRows'is distinct from'[]'::jsonb or i.source_capture->'legacyDeclarationPins'is distinct from'[]'::jsonb
 then return jsonb_build_object('status','blocked','code','mixed_legacy_scope_unsupported');end if;
 select coalesce(jsonb_agg(jsonb_build_object('eventClientRowId',x.client_row_id,'setupEventVersionId',x.id,'eventKind',x.event_kind,'draft',setting->'draft')order by x.client_row_id),'[]')into configured_rows
 from app.tournament_setup_event_versions x join lateral jsonb_array_elements(s.effective_settings)setting on setting->>'eventClientRowId'=x.client_row_id::text and setting->>'mode'='configured'
 where x.tournament_id=tid and x.setup_revision_id=rid;
 settings_hash:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-activation-source-v4',tid,rid,s.id,s.effective_settings,links.association_hash,'[]'::jsonb,'[]'::jsonb)::text,'utf8'),'sha256'),'hex');
 if i.request_payload->>'settingsSnapshotId'is distinct from s.id::text or i.request_payload->>'settingsDigest'is distinct from settings_hash or i.request_payload->>'associationHash'is distinct from links.association_hash
  or i.source_capture->>'status'is distinct from'source_available' or i.source_capture->>'actorId'is distinct from actor::text or i.source_capture->>'tournamentId'is distinct from tid::text
  or i.source_capture->>'setupRevisionId'is distinct from rid::text or i.source_capture->'setupVersion'is distinct from to_jsonb(expected) or i.source_capture->>'settingsSnapshotId'is distinct from s.id::text
  or i.source_capture->>'settingsDigest'is distinct from settings_hash or i.source_capture->>'associationHash'is distinct from links.association_hash or i.source_capture->'configuredRows'is distinct from configured_rows
  or i.source_capture#>>'{snapshot,setupRevisionId}'is distinct from rid::text or i.source_capture#>'{snapshot,settings}'is distinct from s.effective_settings
 then return jsonb_build_object('status','blocked','code','settings_source_changed');end if;
 if jsonb_typeof(i.request_payload->'settingsPins')is distinct from'array' or jsonb_array_length(i.request_payload->'settingsPins')<>event_count
 then return jsonb_build_object('status','blocked','code','context_review_coverage_required');end if;
 if to_regprocedure('app.event_settings_finance_guard_available_v1()')is null
 then return jsonb_build_object('status','blocked','code','finance_backstop_required');end if;
 begin
  execute'select app.event_settings_finance_guard_available_v1()'into finance_guard_available;
 exception when undefined_function or undefined_table then finance_guard_available:=false;end;
 if finance_guard_available is distinct from true
 then return jsonb_build_object('status','blocked','code','finance_backstop_required');end if;
 for e in select*from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rid order by client_row_id loop
  select value into item from jsonb_array_elements(s.effective_settings)where value->>'eventClientRowId'=e.client_row_id::text;
  select count(*)into pin_count from jsonb_array_elements(i.request_payload->'settingsPins')where value->>'eventClientRowId'=e.client_row_id::text;
  pin:=null;select value into pin from jsonb_array_elements(i.request_payload->'settingsPins')where value->>'eventClientRowId'=e.client_row_id::text limit 1;
  if pin_count<>1 then return jsonb_build_object('status','blocked','code','context_review_coverage_required');end if;
  select*into r from app.event_rule_context_reviews_v1 where tournament_id=tid and event_client_row_id=e.client_row_id order by version desc limit 1;
  if r.id is null or pin->>'reviewId'is distinct from r.id::text or pin->>'draftDigest'is distinct from r.draft_digest or r.setup_revision_id is distinct from rid or r.setup_event_version_id is distinct from e.id or r.settings_snapshot_id is distinct from s.id or r.draft is distinct from item->'draft'or r.context->>'eventKind'is distinct from e.event_kind
  then return jsonb_build_object('status','blocked','code','context_review_changed');end if;
  perform 1 from app.tournament_roles where tournament_id=tid and profile_id=r.actor_id and role in('director','co_director')order by role for share nowait;
  if not found then return jsonb_build_object('status','blocked','code','reviewer_role_changed');end if;
  assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);
  if assessment->>'status'is distinct from'eligible'or jsonb_typeof(assessment->'deferredOriginalField')is distinct from'boolean'
  then return jsonb_build_object('status','blocked','code','series_or_payout_review_required');end if;
  deferred:=(assessment->>'deferredOriginalField')::boolean;
  if deferred and app.event_settings_deferred_guard_available_v1()is distinct from true
  then return jsonb_build_object('status','blocked','code','deferred_playoff_gate_required');end if;
 end loop;
 return jsonb_build_object('status','guarded_shared','tournamentId',tid,'setupRevisionId',rid,'settingsSnapshotId',s.id,'associationHash',links.association_hash,'configuredCount',event_count,'officialApprovalClaimed',false);
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','blocked','code','prepared_intent_invalid');
end$$;

-- Trigger-only proof: the accepted native receipt must match the immutable
-- operational attempt and the still-current prepared intent.
create function app.event_settings_operational_guarded_shared_v1(tid uuid,rid uuid,actor uuid,receipt_id uuid)returns boolean
language plpgsql security definer set search_path=''as $$
declare receipt app.operation_receipts%rowtype;attempt app.event_settings_operational_attempts_v1%rowtype;
 proof jsonb;expected integer;core_hash text;
begin
 select*into receipt from app.operation_receipts where id=receipt_id and tournament_id=tid and actor_profile_id=actor and operation_type='activate_tournament_setup_v2'and outcome='accepted';
 if not found then return false;end if;
 select*into attempt from app.event_settings_operational_attempts_v1 where actor_id=actor and operation_id=receipt.client_operation_id and tournament_id=tid;
 if not found or attempt.request_payload is distinct from(select request_payload from app.event_settings_activation_intents_v1 where actor_id=actor and operation_id=receipt.client_operation_id and tournament_id=tid)
  or attempt.request_payload#>>'{request,setupRevisionId}'is distinct from rid::text then return false;end if;
 expected:=(attempt.request_payload#>>'{request,expectedVersion}')::integer;
 core_hash:=encode(extensions.digest(convert_to(jsonb_build_array('activate_tournament_setup_v2',actor::text,tid::text,rid::text,expected)::text,'utf8'),'sha256'),'hex');
 if receipt.request_hash is distinct from core_hash then return false;end if;
 proof:=app.event_settings_operational_proof_v1(tid,actor,receipt.client_operation_id);
 return proof->>'status'='guarded_shared';
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end$$;

-- A configured row cannot reach the native activation table merely because a
-- service caller knows a prepared operation id. The private writer's attempt
-- reservation is mandatory.
create function app.require_event_settings_operational_activation_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare s app.event_settings_snapshots_v3%rowtype;e app.tournament_setup_event_versions%rowtype;item jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'event_settings_isolation_not_supported';end if;
 select*into s from app.event_settings_snapshots_v3 where tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 if not found then return new;end if;
 select*into e from app.tournament_setup_event_versions where id=new.setup_event_version_id and tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 select value into item from jsonb_array_elements(s.effective_settings)where value->>'eventClientRowId'=e.client_row_id::text;
 if item->>'mode'is distinct from'configured'then return new;end if;
 if not app.event_settings_operational_guarded_shared_v1(new.tournament_id,new.setup_revision_id,new.actor_profile_id,new.operation_receipt_id)
 then raise exception'event_settings_operational_intent_required';end if;
 return new;
end$$;
create trigger aaa_event_settings_operational_activation_v1 before insert on app.tournament_setup_activations
 for each row execute function app.require_event_settings_operational_activation_v1();

-- Bind only real native activation rows. Never synthesize legacy prize weights
-- from the reviewed event parameter draft.
create function app.bind_event_settings_operational_activation_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare s app.event_settings_snapshots_v3%rowtype;e app.tournament_setup_event_versions%rowtype;item jsonb;
 r app.event_rule_context_reviews_v1%rowtype;receipt app.operation_receipts%rowtype;assessment jsonb;
begin
 select*into s from app.event_settings_snapshots_v3 where tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 if not found then return new;end if;
 select*into e from app.tournament_setup_event_versions where id=new.setup_event_version_id and tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 select value into item from jsonb_array_elements(s.effective_settings)where value->>'eventClientRowId'=e.client_row_id::text;
 if item->>'mode'is distinct from'configured'then return new;end if;
 if not app.event_settings_operational_guarded_shared_v1(new.tournament_id,new.setup_revision_id,new.actor_profile_id,new.operation_receipt_id)
 then raise exception'event_settings_operational_intent_required';end if;
 select*into receipt from app.operation_receipts where id=new.operation_receipt_id;
 select*into r from app.event_rule_context_reviews_v1 where tournament_id=new.tournament_id and event_client_row_id=e.client_row_id order by version desc limit 1;
 assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);
 insert into app.event_settings_operational_bindings_v1(tournament_id,event_id,activation_id,setup_event_version_id,settings_snapshot_id,review_id,draft,context,deferred_original_field,intent_actor_id,intent_operation_id)
 values(new.tournament_id,new.event_id,new.id,new.setup_event_version_id,s.id,r.id,r.draft,r.context,(assessment->>'deferredOriginalField')::boolean,new.actor_profile_id,receipt.client_operation_id);
 return new;
end$$;
create trigger aaa_event_settings_operational_binding_v1 after insert on app.tournament_setup_activations
 for each row execute function app.bind_event_settings_operational_activation_v1();

-- Clone the current linked finalizer. Both reviewed anchors must occur once;
-- only the private name and the paid-event legacy declaration count change.
do $clone$
declare definition text;header text:='FUNCTION public.finalize_linked_tournament_setup_v1(';
 needed_anchor text:='select count(*)into needed from app.tournament_setup_event_versions where tournament_id=p_tournament_id and setup_revision_id=rid and event_kind in(''main'',''consolation'')and entry_fee_cents>0;';
 needed_replacement text:='select count(*)into needed from app.tournament_setup_event_versions setup_event where setup_event.tournament_id=p_tournament_id and setup_event.setup_revision_id=rid and setup_event.event_kind in(''main'',''consolation'')and setup_event.entry_fee_cents>0 and not exists(select 1 from app.event_settings_snapshots_v3 settings_snapshot cross join lateral jsonb_array_elements(settings_snapshot.effective_settings) configured where settings_snapshot.tournament_id=p_tournament_id and settings_snapshot.setup_revision_id=rid and configured->>''eventClientRowId''=setup_event.client_row_id::text and configured->>''mode''=''configured'');';
begin
 definition:=pg_get_functiondef('public.finalize_linked_tournament_setup_v1(uuid,uuid,jsonb)'::regprocedure);
 if(length(definition)-length(replace(definition,header,'')))/length(header)<>1 then raise exception'Operational finalizer clone header changed';end if;
 if(length(definition)-length(replace(definition,needed_anchor,'')))/length(needed_anchor)<>1 then raise exception'Operational finalizer declaration-count anchor changed';end if;
 definition:=replace(definition,header,'FUNCTION app.finalize_event_settings_operational_core_v1(');
 definition:=replace(definition,needed_anchor,needed_replacement);
 execute definition;
end$clone$;

-- Preserve both current prize-trigger bodies byte-for-byte as fallbacks. Only
-- the exact operational proof adds an early return.
do $patch$
declare definition text;
 before_anchor text:='perform 1 from app.tournaments t where t.id=new.tournament_id for update;';
 after_anchor text:='perform 1 from app.tournaments where id=new.tournament_id for update;';
 branch text:=E'\n if app.event_settings_operational_guarded_shared_v1(new.tournament_id,new.setup_revision_id,new.actor_profile_id,new.operation_receipt_id)then return new;end if;';
begin
 definition:=pg_get_functiondef('app.require_event_prize_activation_pins_v1()'::regprocedure);
 if position('event_settings_operational_guarded_shared_v1'in definition)>0 or(length(definition)-length(replace(definition,before_anchor,'')))/length(before_anchor)<>1
 then raise exception'Prize activation BEFORE trigger anchor changed';end if;
 execute replace(definition,before_anchor,before_anchor||branch);
 definition:=pg_get_functiondef('app.bind_prize_schedule_on_activation_v1()'::regprocedure);
 if position('event_settings_operational_guarded_shared_v1'in definition)>0 or(length(definition)-length(replace(definition,after_anchor,'')))/length(after_anchor)<>1
 then raise exception'Prize activation AFTER trigger anchor changed';end if;
 execute replace(definition,after_anchor,after_anchor||branch);
end$patch$;

create function app.finish_event_settings_operational_activation_v1(actor uuid,tid uuid,op uuid,envelope jsonb,outcome jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare h text;response jsonb;
begin
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-operational-activation-v1',actor,tid,op,envelope)::text,'utf8'),'sha256'),'hex');
 response:=outcome||jsonb_build_object('actorId',actor,'tournamentId',tid,'operationId',op,'request',envelope,'officialApprovalClaimed',false,'moneyMoved',false);
 insert into app.event_settings_operational_outcomes_v1(actor_id,operation_id,tournament_id,request_payload,request_hash,result)
 values(actor,op,tid,envelope,h,response);
 return response;
end$$;

create function app.finalize_event_settings_operational_activation_v1(p_actor_id uuid,p_tournament_id uuid,p_envelope jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare op uuid;h text;prior app.event_settings_operational_outcomes_v1%rowtype;
 intent app.event_settings_activation_intents_v1%rowtype;proof jsonb;core_envelope jsonb;
 core_result jsonb;response jsonb;rid uuid;expected integer;native_count integer;binding_count integer;
begin
 if coalesce(auth.role(),'')<>'service_role'or p_actor_id is null or p_tournament_id is null or jsonb_typeof(p_envelope)is distinct from'object'
  or(select count(*)from jsonb_object_keys(p_envelope))<>7
  or not(p_envelope?&array['kind','request','associationHash','settingsSnapshotId','settingsDigest','settingsPins','confirmedContext'])
  or p_envelope->>'kind'is distinct from'event-settings-activation-intent-v1' or p_envelope->'confirmedContext'is distinct from'true'::jsonb
  or coalesce(p_envelope#>>'{request,idempotencyKey}','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 op:=(p_envelope#>>'{request,idempotencyKey}')::uuid;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||op::text,0));
 perform 1 from app.tournaments where id=p_tournament_id for update;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))
 then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-operational-activation-v1',p_actor_id,p_tournament_id,op,p_envelope)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.event_settings_operational_outcomes_v1 where actor_id=p_actor_id and operation_id=op;
 if found then
  if prior.tournament_id=p_tournament_id and prior.request_hash=h and prior.request_payload=p_envelope then return prior.result;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 if app.event_settings_operational_activation_enabled_v1()is distinct from true then return jsonb_build_object('status','unavailable','code','activation_runtime_acceptance_required','operationAttempted',false,'operationalActivationPerformed',false);end if;
 select*into intent from app.event_settings_activation_intents_v1 where actor_id=p_actor_id and operation_id=op and tournament_id=p_tournament_id;
 if not found or intent.request_payload is distinct from p_envelope or intent.result->>'status'is distinct from'activation_intent_prepared'
 then return jsonb_build_object('status','rejected','code','prepared_intent_required');end if;
 if exists(select 1 from app.event_settings_operational_attempts_v1 where actor_id=p_actor_id and operation_id=op)
  or exists(select 1 from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=op)
 then return app.finish_event_settings_operational_activation_v1(p_actor_id,p_tournament_id,op,p_envelope,jsonb_build_object('status','rejected','code','idempotency_conflict','operationalActivationPerformed',false));end if;
 proof:=app.event_settings_operational_proof_v1(p_tournament_id,p_actor_id,op);
 if proof->>'code'in('source_busy','isolation_not_supported')then return jsonb_build_object('status','retry_exact','code',proof->>'code');end if;
 if proof->>'status'is distinct from'guarded_shared'then
  return app.finish_event_settings_operational_activation_v1(p_actor_id,p_tournament_id,op,p_envelope,jsonb_build_object('status','rejected','code',coalesce(proof->>'code','settings_source_changed'),'operationalActivationPerformed',false));
 end if;
 insert into app.event_settings_operational_attempts_v1(actor_id,operation_id,tournament_id,request_payload,request_hash)
 values(p_actor_id,op,p_tournament_id,p_envelope,h);
 core_envelope:=jsonb_build_object('request',p_envelope->'request','associationHash',p_envelope->'associationHash');
 core_result:=app.finalize_event_settings_operational_core_v1(p_actor_id,p_tournament_id,core_envelope);
 if core_result->>'status'is distinct from'linked_setup_activated'then
  return app.finish_event_settings_operational_activation_v1(p_actor_id,p_tournament_id,op,p_envelope,core_result||jsonb_build_object('operationalActivationPerformed',false));
 end if;
 rid:=(p_envelope#>>'{request,setupRevisionId}')::uuid;expected:=(p_envelope#>>'{request,expectedVersion}')::integer;
 select count(*)into native_count from app.tournament_setup_activations where tournament_id=p_tournament_id and setup_revision_id=rid;
 select count(*)into binding_count
 from app.event_settings_operational_bindings_v1 binding
 join app.tournament_setup_activations activation on activation.id=binding.activation_id and activation.tournament_id=binding.tournament_id and activation.event_id=binding.event_id and activation.setup_event_version_id=binding.setup_event_version_id
 join app.event_rule_context_reviews_v1 review on review.id=binding.review_id
 where binding.tournament_id=p_tournament_id and binding.intent_actor_id=p_actor_id and binding.intent_operation_id=op
  and review.settings_snapshot_id=binding.settings_snapshot_id and review.setup_revision_id=rid and review.draft=binding.draft and review.context=binding.context;
 if native_count is distinct from(select count(*)from app.tournament_setup_event_versions where tournament_id=p_tournament_id and setup_revision_id=rid)
  or binding_count is distinct from native_count
  or exists(select 1 from app.tournament_setup_activations activation left join app.event_settings_operational_bindings_v1 binding on binding.activation_id=activation.id where activation.tournament_id=p_tournament_id and activation.setup_revision_id=rid and binding.id is null)
  or exists(select 1 from app.tournament_setup_activations activation join app.event_prize_schedule_bindings_v1 legacy on legacy.event_id=activation.event_id where activation.tournament_id=p_tournament_id and activation.setup_revision_id=rid)
  or exists(select 1 from app.tournament_setup_activations activation join app.event_prize_schedule_bindings_v2 legacy on legacy.event_id=activation.event_id where activation.tournament_id=p_tournament_id and activation.setup_revision_id=rid)
 then raise exception'event_settings_operational_postcondition_failed';end if;
 response:=jsonb_build_object('status','event_settings_operationally_activated','result',core_result,'setupRevisionId',rid,'setupVersion',expected,
  'settingsSnapshotId',proof->'settingsSnapshotId','associationHash',proof->'associationHash','activationCount',native_count,'bindingCount',binding_count,'operationalActivationPerformed',true);
 return app.finish_event_settings_operational_activation_v1(p_actor_id,p_tournament_id,op,p_envelope,response);
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');
end$$;

create function app.reconcile_event_settings_operational_activation_v1(p_actor_id uuid,p_tournament_id uuid,p_envelope jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare op uuid;h text;outcome app.event_settings_operational_outcomes_v1%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role'or p_actor_id is null or p_tournament_id is null or jsonb_typeof(p_envelope)is distinct from'object'
  or p_envelope->>'kind'is distinct from'event-settings-activation-intent-v1'
  or coalesce(p_envelope#>>'{request,idempotencyKey}','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then return null;end if;
 op:=(p_envelope#>>'{request,idempotencyKey}')::uuid;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||op::text,0));
 perform 1 from app.tournaments where id=p_tournament_id for share;
 if not found or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-operational-activation-v1',p_actor_id,p_tournament_id,op,p_envelope)::text,'utf8'),'sha256'),'hex');
 select*into outcome from app.event_settings_operational_outcomes_v1 where actor_id=p_actor_id and operation_id=op;
 if not found then return null;end if;
 if outcome.tournament_id is distinct from p_tournament_id or outcome.request_hash is distinct from h or outcome.request_payload is distinct from p_envelope
 then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 return outcome.result;
exception when invalid_text_representation then return null;
end$$;

alter function app.event_settings_operational_proof_v1(uuid,uuid,uuid)owner to postgres;
alter function app.event_settings_operational_guarded_shared_v1(uuid,uuid,uuid,uuid)owner to postgres;
alter function app.require_event_settings_operational_activation_v1()owner to postgres;
alter function app.bind_event_settings_operational_activation_v1()owner to postgres;
alter function app.finalize_event_settings_operational_core_v1(uuid,uuid,jsonb)owner to postgres;
alter function app.finish_event_settings_operational_activation_v1(uuid,uuid,uuid,jsonb,jsonb)owner to postgres;
alter function app.finalize_event_settings_operational_activation_v1(uuid,uuid,jsonb)owner to postgres;
alter function app.reconcile_event_settings_operational_activation_v1(uuid,uuid,jsonb)owner to postgres;
revoke all on function app.event_settings_operational_proof_v1(uuid,uuid,uuid),app.event_settings_operational_guarded_shared_v1(uuid,uuid,uuid,uuid),
 app.require_event_settings_operational_activation_v1(),app.bind_event_settings_operational_activation_v1(),app.finalize_event_settings_operational_core_v1(uuid,uuid,jsonb),
 app.finish_event_settings_operational_activation_v1(uuid,uuid,uuid,jsonb,jsonb),app.finalize_event_settings_operational_activation_v1(uuid,uuid,jsonb),
 app.reconcile_event_settings_operational_activation_v1(uuid,uuid,jsonb)from public,anon,authenticated,service_role;

-- No GRANT, route, schema reload, SQL execution or operational enablement.
commit;
