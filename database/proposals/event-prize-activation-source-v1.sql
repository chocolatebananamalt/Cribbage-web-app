-- PRIVATE LOCAL CANDIDATE, NOT A MIGRATION OR RELEASE. Requires the complete
-- prize save/workspace, context/assessment, guarded operational activation,
-- finance source/backstop and playoff gate proposals. All grants remain revoked.
-- Registration only: new prize mathematics and playoff execution stay blocked.
begin;
create function app.event_prize_activation_write_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.event_prize_activation_read_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.event_prize_activation_recovery_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create table app.event_prize_policy_activation_pins_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id),setup_revision_id uuid not null,
 settings_snapshot_id uuid not null references app.event_settings_snapshots_v3(id),
 prize_snapshot_id uuid not null,prize_digest text not null check(prize_digest~'^[0-9a-f]{64}$'),
 request_text text not null check(octet_length(request_text)<=1000000),
 request_payload jsonb not null,request_hash text not null,inner_intent jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id),
 foreign key(prize_snapshot_id,tournament_id)references app.event_prize_snapshots_v1(id,tournament_id),
 foreign key(setup_revision_id,tournament_id)references app.tournament_setup_revisions(id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id)references app.event_settings_activation_intents_v1(actor_id,operation_id,tournament_id)deferrable initially deferred,
 check(request_payload=request_text::jsonb),
 check(request_hash=encode(extensions.digest(convert_to(request_text,'utf8'),'sha256'),'hex')),
 check((request_payload#>>'{activation,request,idempotencyKey}'=operation_id::text)is true),
 check((request_payload#>>'{activation,request,setupRevisionId}'=setup_revision_id::text)is true),
 check((request_payload#>>'{activation,settingsSnapshotId}'=settings_snapshot_id::text)is true),
 check((request_payload->>'prizeSnapshotId'=prize_snapshot_id::text)is true),
 check((request_payload->>'prizeDigest'=prize_digest)is true)
);
alter table app.event_prize_policy_activation_pins_v1 owner to postgres;
alter table app.event_prize_policy_activation_pins_v1 enable row level security;
alter table app.event_prize_policy_activation_pins_v1 force row level security;
revoke all on table app.event_prize_policy_activation_pins_v1 from public,anon,authenticated,service_role;
create trigger event_prize_policy_activation_pins_immutable_v1 before update or delete on app.event_prize_policy_activation_pins_v1
 for each row execute function app.reject_immutable_history();

-- Existing operational rows already reference this exact immutable intent
-- actor/operation/tournament tuple. Join that identity to the outer pin table;
-- do not add columns to those rows: historical to_jsonb(binding) fingerprints
-- must retain their original shape, including historical Finance sources.

create function app.valid_event_prize_activation_outer_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$
 select coalesce(app.event_prize_exact_keys_source_v1(v,array['kind','activation','prizeSnapshotId','prizeDigest','confirmedContext'])
 and v->>'kind'='event-prize-activation-v1'and v->'confirmedContext'='true'::jsonb
 and jsonb_typeof(v->'prizeSnapshotId')='string'and v->>'prizeSnapshotId'~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 and jsonb_typeof(v->'prizeDigest')='string'and v->>'prizeDigest'~'^[0-9a-f]{64}$'
 and app.event_prize_exact_keys_source_v1(v->'activation',array['kind','request','associationHash','settingsSnapshotId','settingsDigest','settingsPins'])
 and v#>>'{activation,kind}'='event-settings-activation-v4'
 and app.event_prize_exact_keys_source_v1(v#>'{activation,request}',array['setupRevisionId','expectedVersion','confirmed','idempotencyKey'])
 and v#>'{activation,request,confirmed}'='true'::jsonb,false);
$$;
create function app.event_prize_activation_inner_v1(v jsonb)returns jsonb
language sql immutable set search_path=''as $$select((v->'activation')-'kind')||jsonb_build_object('kind','event-settings-activation-intent-v1','confirmedContext',true)$$;
create function app.event_prize_policy_ready_v1(v jsonb)returns boolean
language plpgsql immutable set search_path=''as $$
declare factor_text text;
begin
 if not app.valid_event_prize_draft_source_v1(v)then return false;end if;
 if v->>'method'not in('graduated','winner-multiplier')then return true;end if;
 factor_text:=case v->>'method'when'graduated'then v->>'incrementFactorText'else v->>'winnerMultiplierText'end;
 if length(factor_text)>16 or factor_text!~'^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$'then return false;end if;
 return factor_text::numeric between 1 and 1000;
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$$;

-- Private locked source, usable by authenticated preparation and the existing
-- service-only finalizer. Explicit actor is never accepted from a browser RPC.
-- This compares the prize's SAVE hash with its actual save reservation; the V4
-- activation settingsDigest has a different domain and is checked by old proof.
create function app.event_prize_activation_current_v1(tid uuid,actor uuid,op uuid default null)returns jsonb
language plpgsql security definer set search_path=''as $$
declare rev app.tournament_setup_revisions%rowtype;s app.event_settings_snapshots_v3%rowtype;
 pin app.event_prize_policy_activation_pins_v1%rowtype;p jsonb;save_hash text;n integer;
begin
 if current_setting('transaction_isolation')<>'read committed'or actor is null then return null;end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 perform app.lock_event_settings_activation_sources_v1();
 lock table app.event_prize_heads_v1,app.event_prize_snapshots_v1 in share mode nowait;
 select*into rev from app.tournament_setup_revisions where tournament_id=tid order by version desc limit 1;
 select*into s from app.event_settings_snapshots_v3 where tournament_id=tid and setup_revision_id=rev.id;
 if rev.id is null or s.id is null then return null;end if;
 select ps.document into p from app.event_prize_heads_v1 hd join app.event_prize_snapshots_v1 ps on ps.id=hd.snapshot_id and ps.tournament_id=hd.tournament_id where hd.tournament_id=tid;
 select sr.request_hash into save_hash from app.event_settings_save_reservations_v3 sr where sr.actor_id=s.actor_id and sr.operation_id=s.operation_id and sr.tournament_id=tid;
 if not coalesce(app.valid_event_prize_snapshot_source_v1(p),false)or save_hash is null
 or p->>'tournamentId'is distinct from tid::text or p->>'setupRevisionId'is distinct from rev.id::text or p->'setupVersion'is distinct from to_jsonb(rev.version)
 or p->>'settingsSnapshotId'is distinct from s.id::text or p->>'settingsDigest'is distinct from save_hash then return null;end if;
 select count(*)into n from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rev.id and event_kind in('main','consolation');
 if n<1 or n>32 or jsonb_typeof(s.effective_settings)is distinct from'array'or jsonb_array_length(s.effective_settings)<>n or jsonb_array_length(p->'plans')<>n
 or exists(select 1 from app.tournament_setup_event_versions e where e.tournament_id=tid and e.setup_revision_id=rev.id and(e.event_kind not in('main','consolation','satellite')or e.style_code<>'Standard'or e.format_code<>'standard_singles'))
 or exists(select 1 from app.tournament_setup_event_versions e where e.tournament_id=tid and e.setup_revision_id=rev.id and e.event_kind in('main','consolation')and(
  (select count(*)from jsonb_array_elements(s.effective_settings)x where x->>'eventClientRowId'=e.client_row_id::text and x->>'mode'='configured'and app.valid_event_parameters_raw_v3(x->'draft'))<>1
  or(select count(*)from jsonb_array_elements(p->'plans')x where x->>'eventClientRowId'=e.client_row_id::text and x->>'eventKind'=e.event_kind and x->>'mode'='proposed_v2'and app.event_prize_policy_ready_v1(x->'draft'))<>1))then return null;end if;
 if op is not null then
  select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=actor and operation_id=op and tournament_id=tid;
  if pin.actor_id is null or pin.setup_revision_id is distinct from rev.id or pin.settings_snapshot_id is distinct from s.id or pin.prize_snapshot_id::text is distinct from p->>'prizeSnapshotId'or pin.prize_digest is distinct from p->>'prizeDigest'then return null;end if;
 end if;
 return jsonb_build_object('setupRevisionId',rev.id,'setupVersion',rev.version,'settingsSnapshotId',s.id,'prizeSnapshotId',p->'prizeSnapshotId','prizeDigest',p->'prizeDigest');
-- Contention is NOT missing/malformed policy. Let callers classify 55P03 as
-- retryable; swallowing it here could journal a permanent pin rejection.
end$$;

-- Create a real series-only assessment by extracting the existing series and
-- context logic. No synthetic/neutral V1 payout is manufactured. Unique anchors
-- fail installation if the reviewed prerequisite definitions have changed.
do $series$declare d text;start_at integer;end_at integer;begin
 d:=pg_get_functiondef('app.assess_event_rule_draft_v1(jsonb,jsonb)'::regprocedure);
 if(length(d)-length(replace(d,'factor_text:=draft->>','')))/length('factor_text:=draft->>')<>1
 or(length(d)-length(replace(d,'regular_format:=app.resolve_event_series_format_v1','')))/length('regular_format:=app.resolve_event_series_format_v1')<>1 then raise exception'Prize series assessment anchors changed';end if;
 start_at:=position('factor_text:=draft->>'in d);end_at:=position('regular_format:=app.resolve_event_series_format_v1'in d);
 if end_at<=start_at then raise exception'Prize series assessment order changed';end if;
 d:=left(d,start_at-1)||substring(d from end_at);
 d:=replace(d,'FUNCTION app.assess_event_rule_draft_v1(','FUNCTION app.assess_event_prize_series_draft_v1(');execute d;
end$series$;
create function app.assess_event_prize_activation_rules_v1(tid uuid,rid uuid,actor uuid,op uuid,draft jsonb,context jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare current_pin jsonb;
begin
 if not exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=tid)then return app.assess_event_rule_draft_v1(draft,context);end if;
 current_pin:=app.event_prize_activation_current_v1(tid,actor,op);
 if current_pin is null or current_pin->>'setupRevisionId'is distinct from rid::text then return jsonb_build_object('status','blocked','code','prize_activation_pin_required','deferredOriginalField',false,'officialApprovalClaimed',false);end if;
 return app.assess_event_prize_series_draft_v1(draft,context);
end$$;

-- Install-time helper, removed below. Every replacement has a unique literal
-- anchor; existing legacy bodies are preserved or retain identical dispatch.
create function app.install_event_prize_patch_v1(fn regprocedure,old_text text,new_text text,new_name text default null)returns void
language plpgsql set search_path=''as $$declare d text;old_name text;begin
 d:=pg_get_functiondef(fn);
 if old_text=''or(length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception'Prize patch anchor changed: %',fn;end if;
 d:=replace(d,old_text,new_text);
 if new_name is not null then old_name:=split_part(fn::text,'(',1);d:=replace(d,'FUNCTION '||old_name||'(','FUNCTION '||new_name||'(');end if;
 execute d;
end$$;

select app.install_event_prize_patch_v1('app.prepare_event_settings_activation_v1(uuid,jsonb)',
 'assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);',
 'assessment:=app.assess_event_prize_activation_rules_v1(tid,(req->>''setupRevisionId'')::uuid,a,op,r.draft,r.context);');
select app.install_event_prize_patch_v1('app.require_event_settings_context_v1()',
 'assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);',
 'assessment:=app.assess_event_prize_activation_rules_v1(new.tournament_id,new.setup_revision_id,new.actor_profile_id,o.client_operation_id,r.draft,r.context);');
select app.install_event_prize_patch_v1('app.bind_event_settings_operational_activation_v1()',
 'assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);',
 'assessment:=app.assess_event_prize_activation_rules_v1(new.tournament_id,new.setup_revision_id,new.actor_profile_id,receipt.client_operation_id,r.draft,r.context);');

-- Preserve the exact old proof; the latest clone changes only scope counting,
-- Main/Con context iteration, and the explicit series-only assessment dispatch.
select app.install_event_prize_patch_v1('app.event_settings_operational_proof_v1(uuid,uuid,uuid)',
 'assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);',
 'assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);','app.event_settings_operational_proof_prize_legacy_v1');
select app.install_event_prize_patch_v1('app.event_settings_operational_proof_v1(uuid,uuid,uuid)',
 'assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);',
 'assessment:=app.assess_event_prize_activation_rules_v1(tid,rid,actor,op,r.draft,r.context);','app.event_settings_operational_proof_prize_latest_v1');
select app.install_event_prize_patch_v1('app.event_settings_operational_proof_prize_latest_v1(uuid,uuid,uuid)',
 'select count(*)into event_count from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rid;',
 'select count(*)into event_count from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rid and event_kind in(''main'',''consolation'');');
select app.install_event_prize_patch_v1('app.event_settings_operational_proof_prize_latest_v1(uuid,uuid,uuid)',
 'x.event_kind not in(''main'',''consolation'')or x.style_code',
 'x.event_kind not in(''main'',''consolation'',''satellite'')or x.style_code');
select app.install_event_prize_patch_v1('app.event_settings_operational_proof_prize_latest_v1(uuid,uuid,uuid)',
 'where x.tournament_id=tid and x.setup_revision_id=rid and(select count(*)from jsonb_array_elements(s.effective_settings)',
 'where x.tournament_id=tid and x.setup_revision_id=rid and x.event_kind in(''main'',''consolation'')and(select count(*)from jsonb_array_elements(s.effective_settings)');
select app.install_event_prize_patch_v1('app.event_settings_operational_proof_prize_latest_v1(uuid,uuid,uuid)',
 'for e in select*from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rid order by client_row_id loop',
 'for e in select*from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rid and event_kind in(''main'',''consolation'')order by client_row_id loop');
create or replace function app.event_settings_operational_proof_v1(tid uuid,actor uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
begin
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','blocked','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for update nowait;
 if exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=tid)then
  if app.event_prize_activation_current_v1(tid,actor,op)is null then return jsonb_build_object('status','blocked','code','prize_activation_pin_required');end if;
  return app.event_settings_operational_proof_prize_latest_v1(tid,actor,op);
 end if;
 return app.event_settings_operational_proof_prize_legacy_v1(tid,actor,op);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Bind each Main/Con operational row to the exact outer policy request. Native
-- Satellite activation rows intentionally acquire no series/prize binding.
create function app.bind_event_prize_operational_policy_v1()returns trigger
language plpgsql security definer set search_path=''as $$
begin
 if exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=new.tournament_id)then
  if app.event_prize_activation_current_v1(new.tournament_id,new.intent_actor_id,new.intent_operation_id)is null
   or not exists(select 1 from app.tournament_setup_event_versions where id=new.setup_event_version_id and tournament_id=new.tournament_id and event_kind in('main','consolation'))then raise exception'event_prize_operational_policy_required';end if;
 end if;
 return new;
end$$;
create trigger event_prize_operational_policy_v1 before insert on app.event_settings_operational_bindings_v1
 for each row execute function app.bind_event_prize_operational_policy_v1();

-- A proposed V2 prize plan controls the native insertion boundary even when an
-- older device preserves legacy SERIES settings. Those old context/operational
-- triggers intentionally return early for nonconfigured series; do not let that
-- early return bypass V2 policy protection. Historical rows/replays insert none.
create function app.require_event_prize_native_activation_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare e app.tournament_setup_event_versions%rowtype;p jsonb;receipt app.operation_receipts%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'event_prize_activation_isolation_not_supported';end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 select*into e from app.tournament_setup_event_versions where id=new.setup_event_version_id and tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 if not found then raise exception'event_prize_activation_source_changed';end if;
 if e.event_kind not in('main','consolation')then return new;end if;
 select ps.document into p from app.event_prize_heads_v1 h join app.event_prize_snapshots_v1 ps on ps.id=h.snapshot_id and ps.tournament_id=h.tournament_id where h.tournament_id=new.tournament_id;
 if p is null then
  if exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=new.tournament_id)then raise exception'event_prize_activation_source_changed';end if;
  return new;
 end if;
 if p->>'setupRevisionId'is distinct from new.setup_revision_id::text or not app.valid_event_prize_snapshot_source_v1(p)then raise exception'event_prize_activation_source_changed';end if;
 if(select count(*)from jsonb_array_elements(p->'plans')x where x->>'eventClientRowId'=e.client_row_id::text and x->>'eventKind'=e.event_kind)<>1 then raise exception'event_prize_activation_source_changed';end if;
 if not exists(select 1 from jsonb_array_elements(p->'plans')x where x->>'eventClientRowId'=e.client_row_id::text and x->>'eventKind'=e.event_kind and x->>'mode'='proposed_v2')then return new;end if;
 select*into receipt from app.operation_receipts where id=new.operation_receipt_id and tournament_id=new.tournament_id and actor_profile_id=new.actor_profile_id and operation_type='activate_tournament_setup_v2'and outcome='accepted';
 if receipt.id is null or not app.event_settings_operational_guarded_shared_v1(new.tournament_id,new.setup_revision_id,new.actor_profile_id,new.operation_receipt_id)then raise exception'event_prize_activation_pin_required';end if;
 return new;
end$$;
create trigger aaa_event_prize_native_activation_v1 before insert on app.tournament_setup_activations
 for each row execute function app.require_event_prize_native_activation_v1();

-- Existing writer remains the writer. Only latest-path postconditions count
-- configured Main/Con bindings separately from all native activation rows.
select app.install_event_prize_patch_v1('app.finalize_event_settings_operational_activation_v1(uuid,uuid,jsonb)',
 'or binding_count is distinct from native_count',
 'or binding_count is distinct from native_count','app.finalize_event_settings_operational_prize_legacy_v1');
select app.install_event_prize_patch_v1('app.finalize_event_settings_operational_activation_v1(uuid,uuid,jsonb)',
 'or binding_count is distinct from native_count',
 'or binding_count is distinct from(select count(*)from app.tournament_setup_event_versions where tournament_id=p_tournament_id and setup_revision_id=rid and event_kind in(''main'',''consolation''))','app.finalize_event_settings_operational_prize_latest_v1');
select app.install_event_prize_patch_v1('app.finalize_event_settings_operational_prize_latest_v1(uuid,uuid,jsonb)',
 'and activation.setup_revision_id=rid and binding.id is null)',
 'and activation.setup_revision_id=rid and exists(select 1 from app.tournament_setup_event_versions se where se.id=activation.setup_event_version_id and se.event_kind in(''main'',''consolation''))and binding.id is null)');
create or replace function app.finalize_event_settings_operational_activation_v1(p_actor_id uuid,p_tournament_id uuid,p_envelope jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare op uuid;
begin
 if coalesce(auth.role(),'')<>'service_role'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(p_envelope#>>'{request,idempotencyKey}')::uuid;
 perform 1 from app.tournaments where id=p_tournament_id for update nowait;
 if exists(select 1 from app.event_prize_policy_activation_pins_v1 where actor_id=p_actor_id and operation_id=op and tournament_id=p_tournament_id and inner_intent=p_envelope)then
  return app.finalize_event_settings_operational_prize_latest_v1(p_actor_id,p_tournament_id,p_envelope);
 end if;
 -- Exact pre-V2 historical outcomes stay readable. No fresh unpinned attempt
 -- can use the old path after any new prize history exists.
 if exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=p_tournament_id)
 and not exists(select 1 from app.event_settings_operational_outcomes_v1 where actor_id=p_actor_id and operation_id=op and tournament_id=p_tournament_id and request_payload=p_envelope)then return jsonb_build_object('status','rejected','code','prize_activation_pin_required');end if;
 return app.finalize_event_settings_operational_prize_legacy_v1(p_actor_id,p_tournament_id,p_envelope);
exception when invalid_text_representation then return jsonb_build_object('status','rejected','code','invalid_request');
 when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- The common newer Finance source must not interpret dormant V1 payout fields.
-- Legacy accounting insert guards remain installed independently.
select app.install_event_prize_patch_v1('app.operational_event_finance_source_v1(uuid,uuid,uuid)',
 'if b.id is null then return jsonb_build_object(''status'',''blocked'',''code'',''operational_binding_required'');end if;',
 'if b.id is null then return jsonb_build_object(''status'',''blocked'',''code'',''operational_binding_required'');end if; if exists(select 1 from app.event_prize_policy_activation_pins_v1 pp where pp.actor_id=b.intent_actor_id and pp.operation_id=b.intent_operation_id and pp.tournament_id=b.tournament_id)then return jsonb_build_object(''status'',''blocked'',''code'',''new_prize_accounting_required'');end if;');
select app.install_event_prize_patch_v1('app.event_settings_playoff_source_v1(uuid,uuid)',
 'if not found then return jsonb_build_object(''status'',''blocked'',''code'',''settings_binding_required'');end if;',
 'if not found then return jsonb_build_object(''status'',''blocked'',''code'',''settings_binding_required'');end if; if exists(select 1 from app.event_prize_policy_activation_pins_v1 pp where pp.actor_id=b.intent_actor_id and pp.operation_id=b.intent_operation_id and pp.tournament_id=b.tournament_id)then return jsonb_build_object(''status'',''blocked'',''code'',''new_prize_playoff_integration_required'');end if;');

create function app.get_event_prize_activation_source_v1(tid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();w jsonb;src jsonb;reviewed jsonb;
begin
 if app.event_prize_activation_read_enabled_v1()is distinct from true or a is null then return null;end if;
 if app.event_prize_activation_current_v1(tid,a)is null then return jsonb_build_object('status','blocked','code','all_maincon_prize_adoption_required');end if;
 w:=app.get_event_prize_workspace_source_v1(tid);src:=app.get_event_settings_activation_source_v4(tid);reviewed:=app.get_event_settings_reviewed_source_v1(tid);
 if w->>'status'='retry_exact'then return w;end if;if src->>'status'='retry_exact'then return src;end if;if reviewed->>'status'='retry_exact'then return reviewed;end if;
 if w->>'actorId'is distinct from a::text or src->>'status'is distinct from'source_available'or reviewed->>'status'is distinct from'reviewed_source_available'then return jsonb_build_object('status','blocked','code','current_context_review_required');end if;
 return jsonb_build_object('kind','event-prize-activation-source-v1','actorId',a,'tournamentId',tid,'workspace',w,'activationSource',src,'reviews',reviewed#>'{facts,configuredReviews}','registrationOnly',true,'accountingAllowed',false,'playoffStartAllowed',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.event_prize_activation_record_v1(a uuid,tid uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare pin app.event_prize_policy_activation_pins_v1%rowtype;prepared jsonb;activated jsonb;
begin
 select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=a and operation_id=op and tournament_id=tid;
 if not found then return null;end if;
 select result into prepared from app.event_settings_activation_intents_v1 where actor_id=a and operation_id=op and tournament_id=tid and request_payload=pin.inner_intent;
 if prepared is null then return null;end if;
 select result into activated from app.event_settings_operational_outcomes_v1 where actor_id=a and operation_id=op and tournament_id=tid and request_payload=pin.inner_intent;
 return jsonb_build_object('kind','event-prize-activation-record-v1','actorId',a,'tournamentId',tid,'operationId',op,'requestText',pin.request_text,'requestHash',pin.request_hash,'envelope',pin.request_payload,'preparation',prepared,'activation',activated,'registrationOnly',true,'accountingAllowed',false,'playoffStartAllowed',false,'moneyMoved',false);
end$$;
create function app.prepare_event_prize_activation_v1(tid uuid,request_text text)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();v jsonb;inner_value jsonb;op uuid;pin app.event_prize_policy_activation_pins_v1%rowtype;current_pin jsonb;outcome jsonb;
begin
 if a is null or request_text is null or octet_length(request_text)>1000000 then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 v:=request_text::jsonb;if not app.valid_event_prize_activation_outer_v1(v)then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(v#>>'{activation,request,idempotencyKey}')::uuid;inner_value:=app.event_prize_activation_inner_v1(v);
 if op is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=a and operation_id=op;
 if found then
  if pin.tournament_id is distinct from tid or pin.request_text is distinct from request_text then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  return app.event_prize_activation_record_v1(a,tid,op);
 end if;
 if app.event_prize_activation_write_enabled_v1()is distinct from true then return jsonb_build_object('status','unavailable','code','feature_disabled');end if;
 if exists(select 1 from app.event_settings_activation_intents_v1 where actor_id=a and operation_id=op)
 or exists(select 1 from app.operation_receipts where actor_profile_id=a and client_operation_id=op)
 or exists(select 1 from app.event_prize_reservations_v1 where actor_id=a and(operation_id=op or nested_operation_id=op))then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 current_pin:=app.event_prize_activation_current_v1(tid,a);
 if current_pin is null or current_pin->>'setupRevisionId'is distinct from v#>>'{activation,request,setupRevisionId}'or current_pin->'setupVersion'is distinct from v#>'{activation,request,expectedVersion}'or current_pin->>'settingsSnapshotId'is distinct from v#>>'{activation,settingsSnapshotId}'or current_pin->>'prizeSnapshotId'is distinct from v->>'prizeSnapshotId'or current_pin->>'prizeDigest'is distinct from v->>'prizeDigest'then return jsonb_build_object('status','rejected','code','prize_source_changed');end if;
 begin
  insert into app.event_prize_policy_activation_pins_v1(actor_id,operation_id,tournament_id,setup_revision_id,settings_snapshot_id,prize_snapshot_id,prize_digest,request_text,request_payload,request_hash,inner_intent)
  values(a,op,tid,(current_pin->>'setupRevisionId')::uuid,(current_pin->>'settingsSnapshotId')::uuid,(current_pin->>'prizeSnapshotId')::uuid,current_pin->>'prizeDigest',request_text,v,encode(extensions.digest(convert_to(request_text,'utf8'),'sha256'),'hex'),inner_value);
  outcome:=app.prepare_event_settings_activation_v1(tid,inner_value);
  if not exists(select 1 from app.event_settings_activation_intents_v1 where actor_id=a and operation_id=op and tournament_id=tid and request_payload=inner_value)then
   if outcome->>'status'='retry_exact'then raise lock_not_available;end if;
   raise exception'event_prize_prepare_not_journaled';
  end if;
  return app.event_prize_activation_record_v1(a,tid,op);
 exception when raise_exception then
  if sqlerrm<>'event_prize_prepare_not_journaled'then raise;end if;
  return coalesce(outcome,jsonb_build_object('status','rejected','code','invalid_request'));
 end;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');
 when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.finalize_event_prize_activation_v1(actor uuid,tid uuid,request_text text)returns jsonb
language plpgsql security definer set search_path=''as $$
declare v jsonb;op uuid;pin app.event_prize_policy_activation_pins_v1%rowtype;outcome jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role'or actor is null or request_text is null or octet_length(request_text)>1000000 then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 v:=request_text::jsonb;if not app.valid_event_prize_activation_outer_v1(v)then return null;end if;op:=(v#>>'{activation,request,idempotencyKey}')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=actor and operation_id=op and tournament_id=tid;
 if pin.actor_id is null or pin.request_text is distinct from request_text then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 if exists(select 1 from app.event_settings_operational_outcomes_v1 where actor_id=actor and operation_id=op and tournament_id=tid and request_payload=pin.inner_intent)then return app.event_prize_activation_record_v1(actor,tid,op);end if;
 if app.event_prize_activation_write_enabled_v1()is distinct from true then return jsonb_build_object('status','unavailable','code','feature_disabled');end if;
 outcome:=app.finalize_event_settings_operational_activation_v1(actor,tid,pin.inner_intent);
 if not exists(select 1 from app.event_settings_operational_outcomes_v1 where actor_id=actor and operation_id=op and tournament_id=tid and request_payload=pin.inner_intent)then return outcome;end if;
 return app.event_prize_activation_record_v1(actor,tid,op);
exception when invalid_text_representation then return null;
 when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function app.get_event_prize_activation_operation_v1(tid uuid,request_text text)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();v jsonb;op uuid;pin app.event_prize_policy_activation_pins_v1%rowtype;
begin
 if app.event_prize_activation_recovery_enabled_v1()is distinct from true or a is null or request_text is null or octet_length(request_text)>1000000 then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 v:=request_text::jsonb;if not app.valid_event_prize_activation_outer_v1(v)then return null;end if;op:=(v#>>'{activation,request,idempotencyKey}')::uuid;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=a and operation_id=op;
 if pin.actor_id is null then return jsonb_build_object('status','unknown','code','operation_not_found');end if;
 if pin.tournament_id is distinct from tid or pin.request_text is distinct from request_text then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 return app.event_prize_activation_record_v1(a,tid,op);
exception when invalid_text_representation or lock_not_available then return null;end$$;

create function public.get_event_prize_activation_source_provider_v1(tid uuid)returns jsonb
language sql security definer set search_path=''as $$select app.get_event_prize_activation_source_v1(tid)$$;
create function public.prepare_event_prize_activation_provider_v1(tid uuid,request_text text)returns jsonb
language sql security definer set search_path=''as $$select app.prepare_event_prize_activation_v1(tid,request_text)$$;
create function public.finalize_event_prize_activation_provider_v1(actor uuid,tid uuid,request_text text)returns jsonb
language sql security definer set search_path=''as $$select app.finalize_event_prize_activation_v1(actor,tid,request_text)$$;
create function public.get_event_prize_activation_operation_provider_v1(tid uuid,request_text text)returns jsonb
language sql security definer set search_path=''as $$select app.get_event_prize_activation_operation_v1(tid,request_text)$$;

drop function app.install_event_prize_patch_v1(regprocedure,text,text,text);
do $acl$declare f regprocedure;begin
 foreach f in array array[
 'app.event_prize_activation_write_enabled_v1()'::regprocedure,'app.event_prize_activation_read_enabled_v1()'::regprocedure,'app.event_prize_activation_recovery_enabled_v1()'::regprocedure,
 'app.valid_event_prize_activation_outer_v1(jsonb)'::regprocedure,'app.event_prize_activation_inner_v1(jsonb)'::regprocedure,'app.event_prize_policy_ready_v1(jsonb)'::regprocedure,
 'app.event_prize_activation_current_v1(uuid,uuid,uuid)'::regprocedure,'app.assess_event_prize_series_draft_v1(jsonb,jsonb)'::regprocedure,'app.assess_event_prize_activation_rules_v1(uuid,uuid,uuid,uuid,jsonb,jsonb)'::regprocedure,
 'app.event_settings_operational_proof_prize_legacy_v1(uuid,uuid,uuid)'::regprocedure,'app.event_settings_operational_proof_prize_latest_v1(uuid,uuid,uuid)'::regprocedure,'app.bind_event_prize_operational_policy_v1()'::regprocedure,'app.require_event_prize_native_activation_v1()'::regprocedure,
 'app.finalize_event_settings_operational_prize_legacy_v1(uuid,uuid,jsonb)'::regprocedure,'app.finalize_event_settings_operational_prize_latest_v1(uuid,uuid,jsonb)'::regprocedure,
 'app.get_event_prize_activation_source_v1(uuid)'::regprocedure,'app.event_prize_activation_record_v1(uuid,uuid,uuid)'::regprocedure,'app.prepare_event_prize_activation_v1(uuid,text)'::regprocedure,
 'app.finalize_event_prize_activation_v1(uuid,uuid,text)'::regprocedure,'app.get_event_prize_activation_operation_v1(uuid,text)'::regprocedure,
 'public.get_event_prize_activation_source_provider_v1(uuid)'::regprocedure,'public.prepare_event_prize_activation_provider_v1(uuid,text)'::regprocedure,
 'public.finalize_event_prize_activation_provider_v1(uuid,uuid,text)'::regprocedure,'public.get_event_prize_activation_operation_provider_v1(uuid,text)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;
end$acl$;
commit;
