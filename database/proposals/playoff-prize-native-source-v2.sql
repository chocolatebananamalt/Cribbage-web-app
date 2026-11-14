-- Private read-only comparison source. Not a migration, grant or award writer.
-- Requires the closed native-ledger/operational source prerequisites plus the
-- V2 prize activation candidate. Existing legacy/finalization guards unchanged.
begin;
create function app.playoff_prize_native_source_enabled_v2()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.get_playoff_prize_native_source_v2(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();b app.event_settings_operational_bindings_v1%rowtype;native_event app.events%rowtype;
 a app.tournament_setup_activations%rowtype;e app.tournament_setup_event_versions%rowtype;
 s app.event_settings_snapshots_v3%rowtype;p app.event_prize_policy_activation_pins_v1%rowtype;
 prize app.event_prize_snapshots_v1%rowtype;allocation app.native_ledger_allocation_revisions_v1%rowtype;
 q app.qualification_result_versions%rowtype;native jsonb;result_value jsonb;input_value jsonb;capture jsonb;coverage jsonb;h text;settings_hash text;
begin
 if app.playoff_prize_native_source_enabled_v2()is distinct from true then return jsonb_build_object('status','blocked','code','feature_disabled');end if;
 if actor is null or tid is null or eid is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 perform app.lock_operational_event_finance_sources_v1();
 lock table app.event_prize_policy_activation_pins_v1,app.event_prize_snapshots_v1,
  app.event_prize_heads_v1,app.event_prize_revision_bindings_v1,app.event_prize_reservations_v1,
  app.event_prize_outcomes_v1,app.event_settings_save_reservations_v3 in share mode nowait;
 select*into native_event from app.events where id=eid and tournament_id=tid and operational_state='active'and event_type in('main','consolation')and format='standard_singles';
 if native_event.id is null then return jsonb_build_object('status','blocked','code','unsupported_event_scope');end if;
 select*into b from app.event_settings_operational_bindings_v1 where tournament_id=tid and event_id=eid;
 select*into a from app.tournament_setup_activations where id=b.activation_id and tournament_id=tid and event_id=eid and setup_event_version_id=b.setup_event_version_id;
 select*into e from app.tournament_setup_event_versions where id=b.setup_event_version_id and tournament_id=tid and event_kind in('main','consolation')and style_code='Standard'and format_code='standard_singles';
 select*into s from app.event_settings_snapshots_v3 where id=b.settings_snapshot_id and tournament_id=tid and setup_revision_id=e.setup_revision_id;
 select*into p from app.event_prize_policy_activation_pins_v1 where actor_id=b.intent_actor_id and operation_id=b.intent_operation_id and tournament_id=tid and setup_revision_id=e.setup_revision_id and settings_snapshot_id=s.id;
 select ps.*into prize from app.event_prize_snapshots_v1 ps join app.event_prize_heads_v1 head on head.tournament_id=ps.tournament_id and head.snapshot_id=ps.id where ps.id=p.prize_snapshot_id and ps.tournament_id=tid and ps.setup_revision_id=e.setup_revision_id;
 select request_hash into settings_hash from app.event_settings_save_reservations_v3 where actor_id=s.actor_id and operation_id=s.operation_id and tournament_id=tid;
 if settings_hash is null or b.id is null or a.id is null or e.id is null or s.id is null or p.actor_id is null or prize.id is null
  or native_event.event_type is distinct from e.event_kind
  or native_event.ruleset_version_id is distinct from a.ruleset_version_id
  or a.setup_revision_id is distinct from e.setup_revision_id
  or prize.document->>'prizeDigest'is distinct from p.prize_digest
  or prize.document->>'settingsSnapshotId'is distinct from s.id::text
  or prize.document->>'settingsDigest'is distinct from settings_hash
  or not app.valid_event_prize_snapshot_source_v1(prize.document)
  or not exists(select 1 from jsonb_array_elements(prize.document->'plans')x where x->>'eventClientRowId'=e.client_row_id::text and x->>'eventKind'=e.event_kind and x->>'mode'='proposed_v2')
  or not exists(select 1 from jsonb_array_elements(s.effective_settings)x where x->>'eventClientRowId'=e.client_row_id::text and x->>'mode'='configured'and x->'draft'=b.draft)
  or not exists(select 1 from app.event_rule_context_reviews_v1 r where r.id=b.review_id and r.tournament_id=tid and r.settings_snapshot_id=s.id and r.setup_event_version_id=e.id and r.draft=b.draft and r.context=b.context)
 then return jsonb_build_object('status','blocked','code','native_prize_binding_changed');end if;
 native:=app.get_native_event_ledger_sources_v1(tid);
 if native->>'status'='retry_exact'then return native;end if;
 if native->>'status'is distinct from'sources_available'or native->>'tournamentId'is distinct from tid::text then return jsonb_build_object('status','blocked','code','native_ledger_source_unavailable');end if;
 if native#>'{facts,existingOptionalAllocationEvidence}'is distinct from'false'::jsonb then return jsonb_build_object('status','blocked','code','optional_pool_bridge_required');end if;
 select*into allocation from app.native_ledger_allocation_revisions_v1 where tournament_id=tid order by version desc limit 1;
 if allocation.id is null or allocation.source_digest is distinct from native->>'sourceDigest'
  or allocation.snapshot->>'kind'is distinct from'event-ledger-snapshot-v1'
  or allocation.snapshot->>'tournamentId'is distinct from tid::text
  or allocation.snapshot->>'sourceDigest'is distinct from allocation.source_digest
  or allocation.snapshot->>'mode'is distinct from'documented_actual'
  or allocation.snapshot->'complete'is distinct from'true'::jsonb
  or not(allocation.snapshot->'eventIds'?eid::text)
 then return jsonb_build_object('status','blocked','code','current_native_allocation_required');end if;
 select*into q from app.qualification_result_versions where tournament_id=tid and event_id=eid order by version desc limit 1;
 if q.id is null then return jsonb_build_object('status','blocked','code','current_qualification_required');end if;
 if app.qualification_resolution_snapshot_current_v1(q.id)is distinct from true then return jsonb_build_object('status','blocked','code','qualification_source_changed');end if;
 result_value:=public.get_standard_singles_qualification_result_v1(actor,tid,eid);
 if result_value->>'resultVersionId'is distinct from q.id::text then return jsonb_build_object('status','blocked','code','qualification_source_changed');end if;
 input_value:=jsonb_build_object('binding',jsonb_build_object('tournamentId',tid,'eventId',eid,'eventClientRowId',e.client_row_id,'eventKind',e.event_kind,'setupRevisionId',e.setup_revision_id,'settingsSnapshotId',s.id,'settingsDigest',settings_hash,'prizeSnapshotId',prize.id,'prizeDigest',p.prize_digest),
  'prizeSource',jsonb_build_object('snapshot',prize.document,'currentPrizeSnapshotId',prize.id,'currentPrizeDigest',p.prize_digest),
  'ledger',jsonb_build_object('allocationRevisionId',allocation.id,'currentAllocationRevisionId',allocation.id,'current',allocation.snapshot,'retained',allocation.snapshot),
  'qualification',jsonb_build_object('currentResultVersionId',q.id,'result',result_value));
 -- Preserve the whole physical receipt and all allocation partitions. The TS
 -- projector selects this event; filtering first would break conservation.
 capture:=jsonb_build_object('bindingId',b.id,'activationId',a.id,'setupEventVersionId',e.id,'contextReviewId',b.review_id,'intentActorId',p.actor_id,'intentOperationId',p.operation_id,'input',input_value);
 coverage:=jsonb_build_object('additionalIncome','not_supported','optionalPools','blocked','feeCoverage','unverified','fundReview','unverified');
 h:=encode(extensions.digest(convert_to(jsonb_build_array('playoff-prize-native-source-v2',actor,tid,eid,capture,coverage)::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('status','source_available','kind','playoff-prize-native-source-v2','actorId',actor,'tournamentId',tid,'eventId',eid,'sourceDigest',h,'capture',capture,'coverage',coverage,'proposalOnly',true,'finalizationAllowed',false,'payoutAuthorized',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
alter function app.playoff_prize_native_source_enabled_v2()owner to postgres;
alter function app.get_playoff_prize_native_source_v2(uuid,uuid)owner to postgres;
revoke all on function app.playoff_prize_native_source_enabled_v2(),app.get_playoff_prize_native_source_v2(uuid,uuid)from public,anon,authenticated,service_role;
commit;
