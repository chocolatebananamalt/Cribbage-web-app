-- UNEXECUTED PRIVATE PROPOSAL. Requires event-rule-context-v1,
-- event-rule-assessment-v1 and event-settings-activation-source-v4.
-- Prepares reviewed intent and adds a backstop; DOES NOT call activation cores,
-- replace legacy prize guards, grant access or open registration.
begin;
create table app.event_settings_activation_intents_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id),request_payload jsonb not null,
 request_hash text not null,source_capture jsonb,result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-activation-intent-v1',actor_id,tournament_id,operation_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
alter table app.event_settings_activation_intents_v1 owner to postgres;
alter table app.event_settings_activation_intents_v1 enable row level security;
alter table app.event_settings_activation_intents_v1 force row level security;
revoke all on table app.event_settings_activation_intents_v1 from public,anon,authenticated,service_role;
create trigger event_settings_activation_intents_immutable_v1 before update or delete on app.event_settings_activation_intents_v1
for each row execute function app.reject_immutable_history();
create function app.lock_event_settings_activation_sources_v1()returns void
language plpgsql security definer set search_path=''as $$begin
 lock table app.tournament_setup_revisions,app.tournament_setup_event_versions,
 app.tournament_setup_q_pool_versions,app.tournament_setup_side_pool_versions,
 app.event_settings_snapshots_v3,app.setup_event_link_versions_v1,app.setup_event_link_edges_v1,
 app.setup_prize_schedule_versions_v2,app.event_rule_context_reviews_v1 in share mode nowait;
end$$;
-- Installed backstop presence is NOT runtime acceptance or a public capability.
-- Missing/partial installations must keep deferred activation blocked.
create function app.event_settings_deferred_guard_available_v1()returns boolean
language plpgsql stable security definer set search_path=''as $$
declare ready boolean;
begin
 if to_regprocedure('app.event_settings_playoff_guard_available_v1()')is null then return false;end if;
 execute 'select app.event_settings_playoff_guard_available_v1()'into ready;return ready is true;
exception when undefined_function or undefined_table then return false;end$$;
create function app.get_event_settings_reviewed_source_v1(tid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();src jsonb;configured jsonb;r app.event_rule_context_reviews_v1%rowtype;reviews jsonb:='[]';
begin
 if a is null then return jsonb_build_object('status','blocked','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','blocked','code','not_director');end if;
 perform app.lock_event_settings_activation_sources_v1();src:=app.get_event_settings_activation_source_v4(tid);
 if src->>'status'='retry_exact'then return src;end if;
 if src->>'status'is distinct from'source_available'or src->>'actorId'is distinct from a::text or src->>'tournamentId'is distinct from tid::text then return jsonb_build_object('status','blocked','code','settings_source_unavailable');end if;
 for configured in select value from jsonb_array_elements(src->'configuredRows')loop
  select*into r from app.event_rule_context_reviews_v1 where tournament_id=tid and event_client_row_id=(configured->>'eventClientRowId')::uuid order by version desc limit 1;
  if r.id is null or r.setup_revision_id::text is distinct from src->>'setupRevisionId'or r.settings_snapshot_id::text is distinct from src->>'settingsSnapshotId'or r.setup_event_version_id::text is distinct from configured->>'setupEventVersionId'or r.draft is distinct from configured->'draft'or r.context->>'eventKind'is distinct from configured->>'eventKind' then return jsonb_build_object('status','blocked','code','current_context_review_required');end if;
  perform 1 from app.tournament_roles where tournament_id=tid and profile_id=r.actor_id and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','blocked','code','reviewer_role_changed');end if;
  reviews:=reviews||jsonb_build_array(jsonb_build_object('eventClientRowId',r.event_client_row_id,'reviewId',r.id,'draftDigest',r.draft_digest,'reviewedDraft',r.draft,'current',true,'context',r.context));
 end loop;
 return jsonb_build_object('status','reviewed_source_available','actorId',a,'tournamentId',tid,'facts',jsonb_build_object('tournamentId',tid,'settingsSnapshotId',src->'settingsSnapshotId','settingsDigest',src->'settingsDigest','associationHash',src->'associationHash','snapshot',src->'snapshot','configuredReviews',reviews,'legacyDeclarationRequiredRows',src->'legacyDeclarationRequiredRows','legacyDeclarationPins',src->'legacyDeclarationPins'),'activationAllowed',false,'operationalWriterRequired',true,'officialApprovalClaimed',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function app.finish_event_settings_activation_intent_v1(tid uuid,op uuid,v jsonb,capture_value jsonb,outcome jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();h text;response jsonb;
begin
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-activation-intent-v1',a,tid,op,v)::text,'utf8'),'sha256'),'hex');
 response:=outcome||jsonb_build_object('actorId',a,'tournamentId',tid,'operationId',op,'request',v,'activationAllowed',false,'operationalActivationPerformed',false,'officialApprovalClaimed',false,'moneyMoved',false);
 insert into app.event_settings_activation_intents_v1(actor_id,operation_id,tournament_id,request_payload,request_hash,source_capture,result)values(a,op,tid,v,h,capture_value,response);
 return response;
end$$;
create function app.prepare_event_settings_activation_v1(tid uuid,v jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;h text;old app.event_settings_activation_intents_v1%rowtype;
 src jsonb;req jsonb;pin jsonb;configured jsonb;r app.event_rule_context_reviews_v1%rowtype;assessment jsonb;seen text[]:='{}';deferred jsonb:='[]';
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(v)is distinct from'object'or(select count(*)from jsonb_object_keys(v))<>7 or not(v?&array['kind','request','associationHash','settingsSnapshotId','settingsDigest','settingsPins','confirmedContext'])
 or v->>'kind'is distinct from'event-settings-activation-intent-v1'or v->'confirmedContext'is distinct from'true'::jsonb
 or jsonb_typeof(v->'request')is distinct from'object'or jsonb_typeof(v->'settingsPins')is distinct from'array'
 or jsonb_typeof(v->'associationHash')is distinct from'string'or(v->>'associationHash')!~'^[a-f0-9]{64}$'
 or jsonb_typeof(v->'settingsDigest')is distinct from'string'or(v->>'settingsDigest')!~'^[a-f0-9]{64}$'
 or jsonb_typeof(v->'settingsSnapshotId')is distinct from'string'or(v->>'settingsSnapshotId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 req:=v->'request';
 if not(req?&array['setupRevisionId','expectedVersion','confirmed','idempotencyKey'])or exists(select 1 from jsonb_object_keys(req)k where k<>all(array['setupRevisionId','expectedVersion','confirmed','idempotencyKey','declarationPins']))
 or req->'confirmed'is distinct from'true'::jsonb or jsonb_typeof(req->'expectedVersion')is distinct from'number'or(req->>'expectedVersion')!~'^[1-9][0-9]*$'or(req->>'expectedVersion')::numeric>2147483647
 or jsonb_typeof(req->'setupRevisionId')is distinct from'string'or(req->>'setupRevisionId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or jsonb_typeof(req->'idempotencyKey')is distinct from'string'or(req->>'idempotencyKey')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or jsonb_array_length(v->'settingsPins')>32 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(req->>'idempotencyKey')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-activation-intent-v1',a,tid,op,v)::text,'utf8'),'sha256'),'hex');
 select*into old from app.event_settings_activation_intents_v1 where actor_id=a and operation_id=op;
 if found then
  if old.tournament_id<>tid or old.request_hash<>h or old.request_payload<>v then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  return old.result||jsonb_build_object('historicalReceipt',true);
 end if;
 perform app.lock_event_settings_activation_sources_v1();src:=app.get_event_settings_activation_source_v4(tid);
 if src->>'status'='retry_exact'then raise lock_not_available;end if;
 if src->>'status'is distinct from'source_available'or src->>'actorId'is distinct from a::text or src->>'tournamentId'is distinct from tid::text
 then return app.finish_event_settings_activation_intent_v1(tid,op,v,src,jsonb_build_object('status','rejected','code','settings_source_unavailable'));end if;
 if src->>'setupRevisionId'is distinct from req->>'setupRevisionId'or src->'setupVersion'is distinct from req->'expectedVersion'or src->>'settingsSnapshotId'is distinct from v->>'settingsSnapshotId'or src->>'settingsDigest'is distinct from v->>'settingsDigest'or src->>'associationHash'is distinct from v->>'associationHash'
 then return app.finish_event_settings_activation_intent_v1(tid,op,v,src,jsonb_build_object('status','rejected','code','settings_source_changed'));end if;
 if src->'legacyDeclarationsCurrent'is distinct from'true'::jsonb or coalesce(req->'declarationPins','[]'::jsonb)is distinct from src->'legacyDeclarationPins'
 then return app.finish_event_settings_activation_intent_v1(tid,op,v,src,jsonb_build_object('status','rejected','code','legacy_declaration_checks_required'));end if;
 if jsonb_array_length(v->'settingsPins')<>jsonb_array_length(src->'configuredRows')then return app.finish_event_settings_activation_intent_v1(tid,op,v,src,jsonb_build_object('status','rejected','code','context_review_coverage_required'));end if;
 for pin in select value from jsonb_array_elements(v->'settingsPins')loop
  if jsonb_typeof(pin)is distinct from'object'or(select count(*)from jsonb_object_keys(pin))<>3 or not(pin?&array['eventClientRowId','reviewId','draftDigest'])
   or jsonb_typeof(pin->'eventClientRowId')is distinct from'string'or(pin->>'eventClientRowId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or jsonb_typeof(pin->'reviewId')is distinct from'string'or(pin->>'reviewId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or jsonb_typeof(pin->'draftDigest')is distinct from'string'or(pin->>'draftDigest')!~'^[a-f0-9]{64}$'or(pin->>'eventClientRowId')=any(seen)
   then return app.finish_event_settings_activation_intent_v1(tid,op,v,src,jsonb_build_object('status','rejected','code','invalid_context_pin'));end if;
  seen:=array_append(seen,pin->>'eventClientRowId');
  select value into configured from jsonb_array_elements(src->'configuredRows')where value->>'eventClientRowId'=pin->>'eventClientRowId';
  select*into r from app.event_rule_context_reviews_v1 where tournament_id=tid and event_client_row_id=(pin->>'eventClientRowId')::uuid order by version desc limit 1;
  if configured is null or r.id is null or r.id::text is distinct from pin->>'reviewId'or r.draft_digest is distinct from pin->>'draftDigest'or r.setup_revision_id::text is distinct from req->>'setupRevisionId'or r.settings_snapshot_id::text is distinct from v->>'settingsSnapshotId'or r.setup_event_version_id::text is distinct from configured->>'setupEventVersionId'or r.draft is distinct from configured->'draft'or r.context->>'eventKind'is distinct from configured->>'eventKind'
   then return app.finish_event_settings_activation_intent_v1(tid,op,v,src,jsonb_build_object('status','rejected','code','context_review_changed'));end if;
  perform 1 from app.tournament_roles where tournament_id=tid and profile_id=r.actor_id and role in('director','co_director')order by role for share nowait;
  if not found then return app.finish_event_settings_activation_intent_v1(tid,op,v,src,jsonb_build_object('status','rejected','code','reviewer_role_changed'));end if;
  assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);
  if assessment->>'status'is distinct from'eligible'then return app.finish_event_settings_activation_intent_v1(tid,op,v,src,jsonb_build_object('status','rejected','code','series_or_payout_review_required'));end if;
  if assessment->'deferredOriginalField'is distinct from'false'::jsonb then
   if assessment->'deferredOriginalField'is distinct from'true'::jsonb or not app.event_settings_deferred_guard_available_v1()then return app.finish_event_settings_activation_intent_v1(tid,op,v,src,jsonb_build_object('status','rejected','code','deferred_playoff_gate_required','deferredRequirements',jsonb_build_array(jsonb_build_object('reviewId',r.id,'code','original_field_required','deadline','before_playoffs'))));end if;
   deferred:=deferred||jsonb_build_array(jsonb_build_object('reviewId',r.id,'eventClientRowId',r.event_client_row_id,'settingsSnapshotId',r.settings_snapshot_id,'draftDigest',r.draft_digest,'code','original_field_required','deadline','before_playoffs'));
  end if;
 end loop;
 return app.finish_event_settings_activation_intent_v1(tid,op,v,src,jsonb_build_object('status','activation_intent_prepared','legacyGuardsRetained',true,'operationalWriterRequired',true,'deferredRequirements',deferred));
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Reconcile only this actor's immutable intent. A found preparation receipt is
-- never a claim of operational activation or current-source readiness.
create function app.get_event_settings_activation_intent_v1(tid uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();r app.event_settings_activation_intents_v1%rowtype;
begin
 if a is null then return jsonb_build_object('status','blocked','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','blocked','code','not_director');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into r from app.event_settings_activation_intents_v1 where actor_id=a and operation_id=op and tournament_id=tid;
 if not found then return jsonb_build_object('status','unknown','actorId',a,'tournamentId',tid,'operationId',op);end if;
 return r.result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Backstop only newly configured settings. Historical legacy paths remain
-- unchanged; this does NOT remove their declaration and association triggers.
create function app.require_event_settings_context_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare s app.event_settings_snapshots_v3%rowtype;e app.tournament_setup_event_versions%rowtype;
 links app.setup_event_link_versions_v1%rowtype;o app.operation_receipts%rowtype;i app.event_settings_activation_intents_v1%rowtype;
 r app.event_rule_context_reviews_v1%rowtype;item jsonb;pin jsonb;assessment jsonb;settings_hash text;legacy_rows jsonb;legacy_pins jsonb;
begin
 -- A retained RR/SERIALIZABLE snapshot could hide a newly configured source
 -- or newer context even after locks. Reject before any legacy early return.
 if current_setting('transaction_isolation')<>'read committed'then raise exception'event_settings_isolation_not_supported';end if;
 select*into s from app.event_settings_snapshots_v3 where tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 if not found then return new;end if;
 select*into e from app.tournament_setup_event_versions where id=new.setup_event_version_id and tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 select value into item from jsonb_array_elements(s.effective_settings)where value->>'eventClientRowId'=e.client_row_id::text;
 if item->>'mode'is distinct from'configured'then return new;end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 perform app.lock_event_settings_activation_sources_v1();
 perform 1 from app.tournament_roles where tournament_id=new.tournament_id and profile_id=new.actor_profile_id and role in('director','co_director')order by role for share nowait;if not found then raise exception'event_settings_actor_required';end if;
 if new.setup_revision_id is distinct from(select id from app.tournament_setup_revisions where tournament_id=new.tournament_id order by version desc limit 1)then raise exception'event_settings_source_changed';end if;
 select*into o from app.operation_receipts where id=new.operation_receipt_id and tournament_id=new.tournament_id and actor_profile_id=new.actor_profile_id and operation_type='activate_tournament_setup_v2'and outcome='accepted';
 if not found then raise exception'event_settings_intent_required';end if;
 select*into i from app.event_settings_activation_intents_v1 where actor_id=new.actor_profile_id and operation_id=o.client_operation_id and tournament_id=new.tournament_id;
 if not found or i.result->>'status'is distinct from'activation_intent_prepared'then raise exception'event_settings_intent_required';end if;
 select*into links from app.setup_event_link_versions_v1 where tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 -- Exact V4 domain includes BOTH legacy arrays, even when empty. Recompute
 -- them under the same reservations; do not trust the prepared capture.
 select coalesce(jsonb_agg(se.client_row_id order by se.client_row_id),'[]')into legacy_rows
 from app.tournament_setup_event_versions se join lateral jsonb_array_elements(s.effective_settings)x on x->>'eventClientRowId'=se.client_row_id::text
 where se.tournament_id=new.tournament_id and se.setup_revision_id=new.setup_revision_id and se.event_kind in('main','consolation')and se.entry_fee_cents>0 and x->>'mode'='legacy_checks_required';
 select coalesce(jsonb_agg(jsonb_build_object('clientRowId',se.client_row_id,'declarationId',d.id,'settingsFingerprint',d.settings_fingerprint)order by se.client_row_id),'[]')into legacy_pins
 from app.tournament_setup_event_versions se join lateral jsonb_array_elements(legacy_rows)x on x#>>'{}'=se.client_row_id::text
 join lateral(select*from app.setup_prize_schedule_versions_v2 pv where pv.tournament_id=se.tournament_id and pv.client_row_id=se.client_row_id order by pv.version desc limit 1)d on true
 where se.tournament_id=new.tournament_id and se.setup_revision_id=new.setup_revision_id and app.event_prize_settings_supported_v2(app.event_prize_settings_v2(new.tournament_id,se.client_row_id))
 and d.settings_fingerprint=app.event_prize_settings_digest_v2(app.event_prize_settings_v2(new.tournament_id,se.client_row_id));
 if jsonb_array_length(legacy_rows)<>jsonb_array_length(legacy_pins)or coalesce(i.request_payload#>'{request,declarationPins}','[]'::jsonb)is distinct from legacy_pins then raise exception'event_settings_legacy_pins_changed';end if;
 settings_hash:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-activation-source-v4',new.tournament_id,new.setup_revision_id,s.id,s.effective_settings,links.association_hash,legacy_rows,legacy_pins)::text,'utf8'),'sha256'),'hex');
 if links.id is null or not links.complete or i.request_payload->>'settingsSnapshotId'is distinct from s.id::text or i.request_payload->>'settingsDigest'is distinct from settings_hash or i.request_payload->>'associationHash'is distinct from links.association_hash or i.request_payload#>>'{request,setupRevisionId}'is distinct from new.setup_revision_id::text then raise exception'event_settings_source_changed';end if;
 select value into pin from jsonb_array_elements(i.request_payload->'settingsPins')where value->>'eventClientRowId'=e.client_row_id::text;
 select*into r from app.event_rule_context_reviews_v1 where tournament_id=new.tournament_id and event_client_row_id=e.client_row_id order by version desc limit 1;
 if pin is null or r.id is null or pin->>'reviewId'is distinct from r.id::text or pin->>'draftDigest'is distinct from r.draft_digest or r.settings_snapshot_id<>s.id or r.setup_revision_id<>new.setup_revision_id or r.setup_event_version_id<>e.id or r.draft is distinct from item->'draft'or r.context->>'eventKind'is distinct from e.event_kind then raise exception'event_settings_review_changed';end if;
 perform 1 from app.tournament_roles where tournament_id=new.tournament_id and profile_id=r.actor_id and role in('director','co_director')order by role for share nowait;if not found then raise exception'event_settings_reviewer_changed';end if;
 assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);
 if assessment->>'status'is distinct from'eligible'or(assessment->'deferredOriginalField'is distinct from'false'::jsonb and(assessment->'deferredOriginalField'is distinct from'true'::jsonb or not app.event_settings_deferred_guard_available_v1()))then raise exception'event_settings_rules_unresolved';end if;
 return new;
end$$;
create trigger aaa_event_settings_context_v1 before insert on app.tournament_setup_activations for each row execute function app.require_event_settings_context_v1();
alter function app.lock_event_settings_activation_sources_v1()owner to postgres;
alter function app.event_settings_deferred_guard_available_v1()owner to postgres;
alter function app.get_event_settings_reviewed_source_v1(uuid)owner to postgres;
alter function app.finish_event_settings_activation_intent_v1(uuid,uuid,jsonb,jsonb,jsonb)owner to postgres;
alter function app.prepare_event_settings_activation_v1(uuid,jsonb)owner to postgres;
alter function app.get_event_settings_activation_intent_v1(uuid,uuid)owner to postgres;
alter function app.require_event_settings_context_v1()owner to postgres;
revoke all on function app.lock_event_settings_activation_sources_v1(),app.event_settings_deferred_guard_available_v1(),app.get_event_settings_reviewed_source_v1(uuid),app.finish_event_settings_activation_intent_v1(uuid,uuid,jsonb,jsonb,jsonb),app.prepare_event_settings_activation_v1(uuid,jsonb),app.get_event_settings_activation_intent_v1(uuid,uuid),app.require_event_settings_context_v1()from public,anon,authenticated,service_role;
commit;
