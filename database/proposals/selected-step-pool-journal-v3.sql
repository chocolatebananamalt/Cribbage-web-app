-- UNEXECUTED PRIVATE SOURCE. Q/Side only; no regular-prize liability, refunds,
-- payments, grants, simulation relabeling or historical journal changes.
-- Requires the separately reviewed selected-step-pool-ownership-v3.sql candidate.
begin;
create function app.selected_step_pool_journal_enabled_v3()returns boolean language sql stable set search_path=''as $gate$select false$gate$;
-- Reuse the reviewed arithmetic in a distinct ordinary proposal domain. This
-- pure function reads no simulation/attendance/payment records.
do $math$declare d text;p text;old text;change jsonb;begin
 d:=pg_get_functiondef('app.native_mixed_pool_amounts_v1(jsonb,integer,integer)'::regprocedure);p:=d;
 for change in select value from jsonb_array_elements(jsonb_build_array(
  jsonb_build_array('FUNCTION app.native_mixed_pool_amounts_v1(','FUNCTION app.selected_step_pool_amounts_v3('),
  jsonb_build_array('native-mixed-pool-policy-v1','selected-step-pool-policy-v3'),
  jsonb_build_array('native-mixed-pool-amounts-v1','selected-step-pool-amounts-v3'),
  jsonb_build_array('q-equal-exact-selected-step-v1','q-equal'),jsonb_build_array('q-v3-raw-selected-step-v1','q-graduated'),jsonb_build_array('side-sheet20-40-selected-step-v1','side-sheet')
 ))loop old:=change->>0;if position(old in p)=0 then raise exception'selected_step_math_anchor_changed: %',old;end if;p:=replace(p,old,change->>1);end loop;
 if p=d then raise exception'selected_step_math_copy_failed';end if;execute p;
 alter function app.selected_step_pool_amounts_v3(jsonb,integer,integer)owner to postgres;
 revoke all on function app.selected_step_pool_amounts_v3(jsonb,integer,integer)from public,anon,authenticated,service_role;
end$math$;
create function app.selected_step_pool_disclosure_v3(snapshot_id uuid,prize_digest text,pool_id uuid,method text,unit integer)returns text
language sql immutable set search_path=''as $disclosure$
 select 'Selected pool v3 '||snapshot_id::text||':'||prize_digest||':'||pool_id::text||':'||method||':'||unit::text||
  '; exact selected-increment conservation; no pool refunds; '||case method when'q-equal'then'all paid playoff qualifiers equally'
   when'q-graduated'then'current reviewed paid-card order, Q raw weights and entry-fee floor'
   when'side-sheet'then'current reviewed paid-card order, Sheet $20 floor/$40 threshold'else'UNSUPPORTED'end||'; Acknowledged: '
$disclosure$;
create function app.selected_step_pool_fixed_id_v3(tid uuid,eid uuid,pid uuid)returns text
language sql stable security definer set search_path=''as $identity$
 select a.verification_id from app.event_participants p join app.initial_seating_assignments a on a.tournament_id=p.tournament_id and a.roster_entry_id=p.roster_entry_id and a.verification_id=p.table_seat
 join app.initial_seating_publications s on s.id=a.publication_id and s.tournament_id=a.tournament_id
 join app.operation_receipts o on o.id=s.operation_receipt_id and o.tournament_id=s.tournament_id and o.actor_profile_id=s.actor_profile_id
 where p.id=pid and p.event_id=eid and p.tournament_id=tid and o.outcome='accepted'and o.operation_type='publish_initial_seating'and o.target_id=tid
  and o.response_payload->>'status'='initial_seating_published'and o.response_payload->>'publicationId'=s.id::text
$identity$;
create function app.get_selected_step_pool_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $source$
declare owned jsonb;head app.selected_step_pool_ownership_revisions_v3%rowtype;ctx jsonb;b app.event_settings_operational_bindings_v1%rowtype;
 activation app.tournament_setup_activations%rowtype;event_version app.tournament_setup_event_versions%rowtype;prize app.event_prize_snapshots_v1%rowtype;pin app.event_prize_policy_activation_pins_v1%rowtype;
 plan jsonb;pool jsonb;operating jsonb;choice jsonb;entry jsonb;row_value jsonb;policy jsonb;calculation jsonb;body jsonb;paid jsonb;recipients jsonb;pools jsonb:='[]';source_rows jsonb;
 qminor numeric:=0;sminor numeric:=0;fund numeric;fee integer;ratio integer;unit integer;k integer;i integer;method text;prefix text;fixed_id text;pool_id uuid;review_id uuid;kind text;source_hash text;policy_id uuid;label text;
begin
 if app.selected_step_pool_journal_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 perform app.lock_operational_event_finance_sources_v1();
 lock table app.selected_step_pool_ownership_revisions_v3,app.event_prize_policy_activation_pins_v1,app.event_prize_heads_v1,app.event_prize_snapshots_v1,
  app.event_prize_revision_bindings_v1,app.event_prize_reservations_v1,app.event_prize_outcomes_v1,app.event_settings_save_reservations_v3,
  app.initial_seating_publications,app.initial_seating_assignments,app.operation_receipts in share mode nowait;
 owned:=app.selected_step_pool_ownership_source_v3(actor,tid,eid);
 if owned->>'status'='retry_exact'then return owned;end if;
 if owned->>'status'is distinct from'ownership_source_available'then return jsonb_build_object('status','blocked','code','current_pool_ownership_required');end if;
 select*into head from app.selected_step_pool_ownership_revisions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if head.id is null or head.source_digest is distinct from owned->>'sourceDigest'or head.source_capture is distinct from owned then return jsonb_build_object('status','blocked','code','reviewed_pool_ownership_required');end if;
 ctx:=app.event_prize_activation_current_v1(tid,actor);
 select*into b from app.event_settings_operational_bindings_v1 where tournament_id=tid and event_id=eid;
 select*into activation from app.tournament_setup_activations where id=b.activation_id and tournament_id=tid and event_id=eid;
 select*into event_version from app.tournament_setup_event_versions where id=b.setup_event_version_id and tournament_id=tid and event_kind='main'and format_code='standard_singles';
 select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=b.intent_actor_id and operation_id=b.intent_operation_id and tournament_id=tid;
 select*into prize from app.event_prize_snapshots_v1 where id=pin.prize_snapshot_id and tournament_id=tid;
 if ctx is null or b.id is null or activation.id is null or event_version.id is null or prize.id is null
  or ctx->>'prizeSnapshotId'is distinct from prize.id::text or ctx->>'prizeDigest'is distinct from pin.prize_digest
  or ctx->>'setupRevisionId'is distinct from event_version.setup_revision_id::text or activation.setup_revision_id<>event_version.setup_revision_id
  or activation.setup_event_version_id<>event_version.id or ctx->>'settingsSnapshotId'is distinct from b.settings_snapshot_id::text
  or pin.settings_snapshot_id<>b.settings_snapshot_id or pin.setup_revision_id<>event_version.setup_revision_id then return jsonb_build_object('status','blocked','code','activated_rounding_policy_required');end if;
 select x->'draft'into plan from jsonb_array_elements(prize.document->'plans')x where x->>'eventClientRowId'=event_version.client_row_id::text and x->>'eventKind'='main'and x->>'mode'='proposed_v2';
 if plan is null then return jsonb_build_object('status','blocked','code','saved_rounding_required');end if;
 -- Source review determines paid eligibility and recipient order; no ID/name
 -- sort, new tie-break or amount-calculation result may select a recipient.
 for pool in select x||jsonb_build_object('kind','q')from jsonb_array_elements(owned#>'{capture,qSource,obligations}')x
  union all select (x->'source')||jsonb_build_object('kind','side','reviewId',x#>'{review,id}')from jsonb_array_elements(owned#>'{capture,sideBasis,manifest}')x loop
  kind:=pool->>'kind';pool_id:=(case when kind='q'then pool->>'poolVersionId'else pool->>'poolId'end)::uuid;
  paid:='[]';recipients:='[]';fee:=null;ratio:=null;method:=null;
  unit:=case plan#>>array['rounding',case when kind='q'then'qPool'else'sidePool'end]when'1'then 100 when'5'then 500 when'10'then 1000 else null end;
  if unit is null then return jsonb_build_object('status','blocked','code','saved_rounding_required');end if;
  if kind='q'then
   select x into operating from jsonb_array_elements(owned#>'{capture,qSource,manifest,operatingWorkspace,policies}')x where x->>'id'=pool->>'policyId'and x->>'poolVersionId'=pool_id::text;
   select (x->>'feeMinor')::integer into fee from jsonb_array_elements(owned#>'{capture,membership,pools}')x where x->>'poolVersionId'=pool_id::text;
   policy_id:=(operating->>'id')::uuid;ratio:=(operating->>'ratio')::integer;
   method:=case operating->>'method'when'equal-paid-playoff-qualifiers-v2'then'q-equal'when'graduated-acc-weighted-largest-remainder-5usd-v2'then'q-graduated'when'q-custom-graduated-policy-v5'then'q-graduated'else null end;
   if operating->>'method'='q-custom-graduated-policy-v5'and(
    app.custom_q_policy_bindings_v5(tid,eid)is distinct from owned#>'{capture,qSource,manifest,customPolicyBindings}'
    or not exists(select 1 from jsonb_array_elements(owned#>'{capture,qSource,manifest,customPolicyBindings}')x where x->>'policyId'=policy_id::text and x->>'poolVersionId'=pool_id::text and x->'ratio'=operating->'ratio'and x->>'amountMethod'='graduated-custom-ratio-largest-remainder-5usd-v3'))
   then return jsonb_build_object('status','blocked','code','current_custom_pool_binding_required');end if;
   review_id:=(owned#>>'{capture,qReview,id}')::uuid;source_hash:=owned#>>'{capture,qSource,sourceDigest}';
  else
   select to_jsonb(p)into operating from app.side_pool_graduated_policies_v2 p where p.pool_id=(pool->>'poolId')::uuid and p.tournament_id=tid and p.event_id=eid;
   policy_id:=(operating->>'id')::uuid;fee:=(pool->>'feeMinor')::integer;ratio:=(pool->>'ratio')::integer;
   method:=case when operating->>'method'in('graduated-acc-weighted-largest-remainder-5usd-v2','side-custom-graduated-policy-v4')then'side-sheet'else null end;
   if operating->>'method'='side-custom-graduated-policy-v4'and(
    app.custom_side_policy_binding_v4(tid,eid,pool_id)is distinct from pool#>'{manifest,amountSource,manifest,customPolicyBinding}'
    or pool#>>'{manifest,amountSource,manifest,customPolicyBinding,policyId}'is distinct from policy_id::text
    or pool#>'{manifest,amountSource,manifest,customPolicyBinding,ratio}'is distinct from operating->'ratio'
    or pool#>>'{manifest,amountSource,manifest,customPolicyBinding,amountMethod}'is distinct from'graduated-custom-ratio-largest-remainder-5usd-v3')
   then return jsonb_build_object('status','blocked','code','current_custom_pool_binding_required');end if;
   review_id:=(pool->>'reviewId')::uuid;source_hash:=pool->>'sourceDigest';
  end if;
  if kind='q'then select 'Q-Pool '||slot::text||' - '||pool_type_code into label from app.tournament_setup_q_pool_versions where id=pool_id and tournament_id=tid;
  else select display_name into label from app.event_side_pool_definition_versions where event_side_pool_definition_versions.pool_id=(pool->>'poolId')::uuid and tournament_id=tid and event_id=eid order by version desc limit 1;end if;
  if label is null then return jsonb_build_object('status','blocked','code','pool_label_required');end if;
  if method is null or fee is null or policy_id is null or review_id is null or source_hash is null then return jsonb_build_object('status','blocked','code','unsupported_pool_method_source');end if;
  prefix:=app.selected_step_pool_disclosure_v3(prize.id,pin.prize_digest,pool_id,method,unit);
  if kind='q'then
   for entry in select value from jsonb_array_elements(owned#>'{capture,membership,entries}')loop
    select x into choice from jsonb_array_elements(entry->'pools')x where x->>'poolVersionId'=pool_id::text;
    if(choice->>'amountAllocatedMinor')::numeric>0 then
     if choice->'paidEntryEligible'is distinct from'true'::jsonb or(choice->>'amountAllocatedMinor')::numeric<>fee
      or not coalesce(starts_with(choice->>'consentReference','Q policy '||policy_id::text||': '||prefix),false)
      or length(trim(substr(choice->>'consentReference',length('Q policy '||policy_id::text||': '||prefix)+1)))=0 then
      return jsonb_build_object('status','blocked','code','selected_policy_acknowledgement_required','requiredDisclosurePrefix',prefix);end if;
     paid:=paid||jsonb_build_array(entry->'participantId');
    end if;
   end loop;
   select coalesce(jsonb_agg(x order by(x->>'qRank')::integer),'[]')into source_rows from jsonb_array_elements(pool->'rows')x;
  else
   for entry in select x->'election'from jsonb_array_elements(owned#>'{capture,sideRecordedSources}')x where x#>>'{election,pool_id}'=pool_id::text loop
    if(entry->>'amount_received_minor')::numeric<>fee or not coalesce(starts_with(entry->>'reason','Side policy '||policy_id::text||': '||prefix),false)
     or length(trim(substr(entry->>'reason',length('Side policy '||policy_id::text||': '||prefix)+1)))=0 then
     return jsonb_build_object('status','blocked','code','selected_policy_acknowledgement_required','requiredDisclosurePrefix',prefix);end if;
    paid:=paid||jsonb_build_array(entry->'participant_id');
   end loop;
   select coalesce(jsonb_agg(x order by(x->>'poolRank')::integer),'[]')into source_rows from jsonb_array_elements(pool->'obligations')x;
  end if;
  if jsonb_array_length(paid)=0 or(select count(distinct x)from jsonb_array_elements(paid)x)<>jsonb_array_length(paid)or jsonb_array_length(source_rows)=0 then return jsonb_build_object('status','blocked','code','eligible_paid_recipients_required');end if;
  policy:=jsonb_build_object('version','selected-step-pool-policy-v3','kind',kind,'method',method,'feeMinor',fee,'ratio',ratio,'roundingUnitMinor',unit);
  calculation:=app.selected_step_pool_amounts_v3(policy,jsonb_array_length(paid),jsonb_array_length(source_rows));
  if calculation->>'status'is distinct from'calculated'then return jsonb_build_object('status','blocked','code',coalesce(calculation->>'code','pool_calculation_unavailable'));end if;
  if calculation->'fundMinor'is distinct from pool->'fundMinor'then return jsonb_build_object('status','blocked','code','pool_receipt_fund_mismatch');end if;
  i:=0;for row_value in select value from jsonb_array_elements(source_rows)loop
   i:=i+1;if not(paid? (row_value->>'participantId'))or(case when kind='q'then row_value->>'qRank'else row_value->>'poolRank'end)::integer<>i then return jsonb_build_object('status','blocked','code','reviewed_recipient_order_required');end if;
   fixed_id:=app.selected_step_pool_fixed_id_v3(tid,eid,(row_value->>'participantId')::uuid);
   if fixed_id is null then return jsonb_build_object('status','blocked','code','fixed_tournament_identity_required');end if;
   recipients:=recipients||jsonb_build_array(jsonb_build_object('participantId',row_value->'participantId','name',row_value->'displayName','tournamentPlayerId',fixed_id,'amountMinor',calculation->'awardsMinor'->(i-1)));
  end loop;
  fund:=(calculation->>'fundMinor')::numeric;if kind='q'then qminor:=qminor+fund;else sminor:=sminor+fund;end if;
  pools:=pools||jsonb_build_array(jsonb_build_object('poolId',pool_id,'label',label,'kind',kind,'operatingPolicyId',policy_id,'recipientReviewId',review_id,'recipientSourceDigest',source_hash,
   'policy',policy,'paidParticipantIds',paid,'calculation',calculation,'recipients',recipients));
 end loop;
 if jsonb_array_length(pools)=0 or qminor<>(owned#>>'{funds,qReceiptsMinor}')::numeric or sminor<>(owned#>>'{funds,sideReceiptsMinor}')::numeric then return jsonb_build_object('status','blocked','code','complete_separate_pool_funds_required');end if;
 body:=jsonb_build_object('kind','current-selected-step-pool-source-v3','status','source_available','actorId',actor,'tournamentId',tid,'eventId',eid,
  'ownershipRevisionId',head.id,'qualificationResultVersionId',owned#>'{capture,nativePlayoffSource,qualificationId}','prizeSnapshotId',prize.id,'prizeDigest',pin.prize_digest,
  'ownershipSource',owned,'prizePolicyPin',to_jsonb(pin),'prizePlan',plan,'pools',pools,'qMinor',qminor,'sideMinor',sminor,'totalMinor',qminor+sminor,
  'liabilityScope','optional_pools_only','refundPolicy','no-pool-refunds-v1','directorReviewRequired',true,'bankReceiptVerified',false,'moneyMoved',false,'payoutAuthorized',false);
 return body||jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(jsonb_build_array('selected-step-pool-source-v3',body)::text,'utf8'),'sha256'),'hex'));
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range or division_by_zero then return jsonb_build_object('status','blocked','code','pool_source_invalid');end$source$;
-- Durable proposals and optional-only unpaid liabilities live in a new domain.
create table app.selected_step_pool_operations_v3(actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,request jsonb not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('selected-step-pool-operation-v3',actor_id,tournament_id,event_id,operation_id,request)::text,'utf8'),'sha256'),'hex')));
create table app.selected_step_pool_revisions_v3(id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,version integer not null check(version>0),prior_revision_id uuid,
 actor_id uuid not null,operation_id uuid not null,ownership_revision_id uuid not null,prize_snapshot_id uuid not null,qualification_id uuid not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),source_capture jsonb not null,reason text not null,created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,version),unique(id,tournament_id,event_id),foreign key(event_id,tournament_id)references app.events(id,tournament_id),foreign key(prior_revision_id,tournament_id,event_id)references app.selected_step_pool_revisions_v3(id,tournament_id,event_id),foreign key(actor_id,operation_id,tournament_id,event_id)references app.selected_step_pool_operations_v3(actor_id,operation_id,tournament_id,event_id),
 foreign key(ownership_revision_id,tournament_id,event_id)references app.selected_step_pool_ownership_revisions_v3(id,tournament_id,event_id),foreign key(prize_snapshot_id,tournament_id)references app.event_prize_snapshots_v1(id,tournament_id),foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id),
 check((source_capture->>'sourceDigest'=source_digest and source_capture->>'tournamentId'=tournament_id::text and source_capture->>'eventId'=event_id::text and source_capture->>'ownershipRevisionId'=ownership_revision_id::text and source_capture->>'prizeSnapshotId'=prize_snapshot_id::text and source_capture->>'qualificationResultVersionId'=qualification_id::text)is true));
create table app.selected_step_pool_finals_v3(id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,proposal_revision_id uuid not null,actor_id uuid not null,operation_id uuid not null,
 source_digest text not null,source_capture jsonb not null,q_minor bigint not null check(q_minor>=0),side_minor bigint not null check(side_minor>=0),total_minor bigint not null check(total_minor=q_minor+side_minor and total_minor between 1 and 9007199254740991),reason text not null,recorded_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id),unique(id,tournament_id,event_id),foreign key(proposal_revision_id,tournament_id,event_id)references app.selected_step_pool_revisions_v3(id,tournament_id,event_id),foreign key(actor_id,operation_id,tournament_id,event_id)references app.selected_step_pool_operations_v3(actor_id,operation_id,tournament_id,event_id));
create table app.selected_step_pool_recipients_v3(final_id uuid not null,tournament_id uuid not null,event_id uuid not null,pool_id uuid not null,pool_kind text not null check(pool_kind in('q','side')),participant_id uuid not null,
 display_name text not null,tournament_player_id text not null check(tournament_player_id~'^[A-Z]-[1-9][0-9]{0,3}$'),rounding_unit_minor integer not null check(rounding_unit_minor in(100,500,1000)),amount_minor bigint not null check(amount_minor>0 and amount_minor<=9007199254740991 and amount_minor%rounding_unit_minor=0),
 primary key(final_id,pool_id,participant_id),foreign key(final_id,tournament_id,event_id)references app.selected_step_pool_finals_v3(id,tournament_id,event_id),foreign key(participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id));
create table app.selected_step_pool_outcomes_v3(actor_id uuid not null,operation_id uuid not null,result jsonb not null,primary key(actor_id,operation_id),foreign key(actor_id,operation_id)references app.selected_step_pool_operations_v3(actor_id,operation_id));
do $tables$declare n text;begin foreach n in array array['selected_step_pool_operations_v3','selected_step_pool_revisions_v3','selected_step_pool_finals_v3','selected_step_pool_recipients_v3','selected_step_pool_outcomes_v3']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',n);execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',n);end loop;end$tables$;
-- Reciprocal guards share the tournament lock with all final writers. Regular-only
-- modern awards are deliberately excluded: these liabilities consume pool funds only.
create function app.guard_selected_step_pool_liability_v3()returns trigger
language plpgsql security definer set search_path=''as $guard$
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'selected_pool_isolation_unsupported';end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if not found then raise exception'selected_pool_tournament_missing';end if;
 if tg_table_name='selected_step_pool_finals_v3'then
  if app.legacy_financial_liability_exists_v1(new.tournament_id,new.event_id)is distinct from false
   or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=new.tournament_id and event_id=new.event_id)
   or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=new.tournament_id and event_id=new.event_id)
   then raise exception'selected_pool_existing_liability';end if;
 elsif tg_table_name='multi_event_joint_finals_v1'then
  if exists(select 1 from app.selected_step_pool_finals_v3 where tournament_id=new.tournament_id)then raise exception'selected_pool_existing_liability';end if;
 elsif exists(select 1 from app.selected_step_pool_finals_v3 where tournament_id=new.tournament_id and event_id=new.event_id)then raise exception'selected_pool_existing_liability';end if;
 return new;
end$guard$;
do $guards$declare t text;begin foreach t in array array['selected_step_pool_finals_v3','native_playoff_final_award_sets_v1','native_optional_final_award_sets_v2','standard_singles_settlement_final_versions','event_settlement_finals_v2','q_accounting_finals_v6','no_q_accounting_finals_v7','prize_accounting_finals_v8','prize_accounting_finals_v9','multi_event_unpaid_finals_v1','multi_event_joint_finals_v1']loop
 execute format('create trigger zz_selected_step_pool_guard_v3 before insert on app.%I for each row execute function app.guard_selected_step_pool_liability_v3()',t);
end loop;end$guards$;
alter function app.guard_selected_step_pool_liability_v3()owner to postgres;
revoke all on function app.guard_selected_step_pool_liability_v3()from public,anon,authenticated,service_role;
create function app.record_selected_step_pool_v3(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $record$
declare prior app.selected_step_pool_operations_v3%rowtype;head app.selected_step_pool_revisions_v3%rowtype;s jsonb;h text;result jsonb;revision_id uuid;v_final_id uuid;pool jsonb;r jsonb;action text;ver integer;
begin
 if app.selected_step_pool_journal_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if op is null or jsonb_typeof(request)is distinct from'object'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 action:=request->>'kind';
 if action='selected-step-pool-save-v3'and(jsonb_typeof(request->'expectedVersion')is distinct from'number'or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,9})$')then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if op is null or jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>5 or request->'reviewed'is distinct from'true'::jsonb
  or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'or jsonb_typeof(request->'reason')is distinct from'string'
  or request->>'reason'is distinct from app.custom_payout_classification_text_v2(request->>'reason')or app.event_settings_js_text_length_v3(request->>'reason')not between 1 and 2000
  or action not in('selected-step-pool-save-v3','selected-step-pool-finalize-v3')or action is null
  or(action='selected-step-pool-save-v3'and(not(request?&array['kind','expectedVersion','expectedSourceDigest','reason','reviewed'])or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,9})$'or(request->>'expectedVersion')::numeric>=2147483647))
  or(action='selected-step-pool-finalize-v3'and(not(request?&array['kind','proposalRevisionId','expectedSourceDigest','reason','reviewed'])or coalesce(request->>'proposalRevisionId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'))then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('selected-step-pool-op-v3:'||actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('selected-step-pool-operation-v3',actor,tid,eid,op,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.selected_step_pool_operations_v3 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id<>tid or prior.event_id<>eid or prior.request_hash<>h or prior.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  select x.result into result from app.selected_step_pool_outcomes_v3 x where x.actor_id=actor and x.operation_id=op;
  if result is null then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;return result;end if;
 if exists(select 1 from app.selected_step_pool_finals_v3 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','pool_awards_already_recorded');end if;
 if app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','competing_financial_liability');end if;
 s:=app.get_selected_step_pool_source_v3(actor,tid,eid);
 if s->>'status'='retry_exact'then return s;end if;
 if s->>'status'is distinct from'source_available'then return jsonb_build_object('status','rejected','code',coalesce(s->>'code','current_source_required'));end if;
 if s->'sourceDigest'is distinct from request->'expectedSourceDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 select*into head from app.selected_step_pool_revisions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if action='selected-step-pool-save-v3'and coalesce(head.version,0)<>(request->>'expectedVersion')::integer then return jsonb_build_object('status','rejected','code','stale_version');end if;
 if action='selected-step-pool-finalize-v3'and(head.id is null or head.id::text is distinct from request->>'proposalRevisionId'or head.source_digest is distinct from s->>'sourceDigest'or head.source_capture is distinct from s)then return jsonb_build_object('status','rejected','code','proposal_or_source_changed');end if;
 insert into app.selected_step_pool_operations_v3 values(actor,op,tid,eid,request,h);
 if action='selected-step-pool-save-v3'then
  revision_id:=extensions.gen_random_uuid();ver:=coalesce(head.version,0)+1;
  insert into app.selected_step_pool_revisions_v3(id,tournament_id,event_id,version,prior_revision_id,actor_id,operation_id,ownership_revision_id,prize_snapshot_id,qualification_id,source_digest,source_capture,reason)
   values(revision_id,tid,eid,ver,head.id,actor,op,(s->>'ownershipRevisionId')::uuid,(s->>'prizeSnapshotId')::uuid,(s->>'qualificationResultVersionId')::uuid,s->>'sourceDigest',s,request->>'reason');
 else
  revision_id:=head.id;ver:=head.version;v_final_id:=extensions.gen_random_uuid();
  insert into app.selected_step_pool_finals_v3(id,tournament_id,event_id,proposal_revision_id,actor_id,operation_id,source_digest,source_capture,q_minor,side_minor,total_minor,reason)
   values(v_final_id,tid,eid,head.id,actor,op,s->>'sourceDigest',s,(s->>'qMinor')::bigint,(s->>'sideMinor')::bigint,(s->>'totalMinor')::bigint,request->>'reason');
  for pool in select value from jsonb_array_elements(s->'pools')loop
   for r in select value from jsonb_array_elements(pool->'recipients')loop
    insert into app.selected_step_pool_recipients_v3 values(v_final_id,tid,eid,(pool->>'poolId')::uuid,pool->>'kind',(r->>'participantId')::uuid,r->>'name',r->>'tournamentPlayerId',(pool#>>'{policy,roundingUnitMinor}')::integer,(r->>'amountMinor')::bigint);
   end loop;
   if(select sum(amount_minor)from app.selected_step_pool_recipients_v3 where final_id=v_final_id and pool_id=(pool->>'poolId')::uuid)<>(pool#>>'{calculation,fundMinor}')::bigint then raise exception'selected_pool_fund_postcondition_failed';end if;
  end loop;
  if(select sum(amount_minor)from app.selected_step_pool_recipients_v3 where final_id=v_final_id)<>(s->>'totalMinor')::bigint then raise exception'selected_pool_total_postcondition_failed';end if;
 end if;
 result:=jsonb_build_object('kind','selected-step-pool-receipt-v3','status',case when action='selected-step-pool-save-v3'then'proposal_saved'else'awards_recorded_unpaid'end,
  'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'requestHash',h,'revisionId',revision_id,'version',ver,'finalId',v_final_id,'sourceDigest',s->>'sourceDigest',
  'qMinor',s->'qMinor','sideMinor',s->'sideMinor','totalMinor',s->'totalMinor','liabilityScope','optional_pools_only','historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false,'payoutAuthorized',false);
 insert into app.selected_step_pool_outcomes_v3 values(actor,op,result);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'selected_step_pool_v3',coalesce(v_final_id,revision_id),case when v_final_id is null then'proposal_saved'else'awards_recorded_unpaid'end,result);
 return result;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$record$;
create function app.get_selected_step_pool_operation_v3(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $recovery$
declare p app.selected_step_pool_operations_v3%rowtype;r jsonb;h text;begin
 if app.selected_step_pool_journal_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;
 if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 select*into p from app.selected_step_pool_operations_v3 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','unknown','currentSourceVerified',false);end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('selected-step-pool-operation-v3',actor,tid,eid,op,request)::text,'utf8'),'sha256'),'hex');
 if p.tournament_id<>tid or p.event_id<>eid or p.request_hash<>h or p.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 select result into r from app.selected_step_pool_outcomes_v3 where actor_id=actor and operation_id=op;return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$recovery$;
create function app.get_selected_step_pool_record_v3(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $history$
declare h app.selected_step_pool_revisions_v3%rowtype;f app.selected_step_pool_finals_v3%rowtype;rows jsonb;
begin
 if app.selected_step_pool_journal_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 select*into h from app.selected_step_pool_revisions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 select*into f from app.selected_step_pool_finals_v3 where tournament_id=tid and event_id=eid;
 select coalesce(jsonb_agg(to_jsonb(r)order by r.pool_id,r.participant_id),'[]')into rows from app.selected_step_pool_recipients_v3 r where r.final_id=f.id and r.tournament_id=tid and r.event_id=eid;
 return jsonb_build_object('kind','selected-step-pool-history-v3','actorId',actor,'tournamentId',tid,'eventId',eid,
  'head',case when h.id is null then null else to_jsonb(h)end,'final',case when f.id is null then null else to_jsonb(f)end,'recipients',rows,
  'historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false,'payoutAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$history$;
alter function app.get_selected_step_pool_record_v3(uuid,uuid,uuid)owner to postgres;
revoke all on function app.get_selected_step_pool_record_v3(uuid,uuid,uuid)from public,anon,authenticated,service_role;
-- All entry points remain private and revoked, including service callers.
-- Exact immutable operation evidence for browser pending cleanup; never current
-- fund authority. The original reviewed capture is returned only to the server.
create function public.get_selected_step_pool_operation_proof_provider_v3(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $proof$
declare r jsonb;c jsonb;begin
 r:=app.get_selected_step_pool_operation_v3(actor,tid,eid,op,request);
 if r->>'kind'is distinct from'selected-step-pool-receipt-v3'then return r;end if;
 select source_capture into c from app.selected_step_pool_revisions_v3 where id=(r->>'revisionId')::uuid and tournament_id=tid and event_id=eid and source_digest=r->>'sourceDigest';
 if c is null then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
 return jsonb_build_object('receipt',r,'sourceCapture',c);
end$proof$;
alter function public.get_selected_step_pool_operation_proof_provider_v3(uuid,uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function public.get_selected_step_pool_operation_proof_provider_v3(uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
create function public.get_selected_step_pool_source_provider_v3(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $rpc$begin
 if app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 return app.get_selected_step_pool_source_v3(actor,tid,eid);
end$rpc$;
create function public.record_selected_step_pool_provider_v3(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $rpc$begin
 if app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 return app.record_selected_step_pool_v3(actor,tid,eid,op,request);
end$rpc$;
create function public.get_selected_step_pool_record_provider_v3(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $rpc$begin
 if app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 return app.get_selected_step_pool_record_v3(actor,tid,eid);
end$rpc$;
alter function public.get_selected_step_pool_record_provider_v3(uuid,uuid,uuid)owner to postgres;
revoke all on function public.get_selected_step_pool_record_provider_v3(uuid,uuid,uuid)from public,anon,authenticated,service_role;
create function public.get_selected_step_pool_operation_provider_v3(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $rpc$begin
 if app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 return app.get_selected_step_pool_operation_v3(actor,tid,eid,op,request);
end$rpc$;
alter function public.record_selected_step_pool_provider_v3(uuid,uuid,uuid,uuid,jsonb)owner to postgres;
alter function public.get_selected_step_pool_operation_provider_v3(uuid,uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function public.record_selected_step_pool_provider_v3(uuid,uuid,uuid,uuid,jsonb),public.get_selected_step_pool_operation_provider_v3(uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function public.get_selected_step_pool_source_provider_v3(uuid,uuid,uuid)owner to postgres;
revoke all on function public.get_selected_step_pool_source_provider_v3(uuid,uuid,uuid)from public,anon,authenticated,service_role;
do $functions$declare f text;begin foreach f in array array['app.selected_step_pool_journal_enabled_v3()','app.selected_step_pool_disclosure_v3(uuid,text,uuid,text,integer)','app.selected_step_pool_fixed_id_v3(uuid,uuid,uuid)',
 'app.get_selected_step_pool_source_v3(uuid,uuid,uuid)','app.record_selected_step_pool_v3(uuid,uuid,uuid,uuid,jsonb)','app.get_selected_step_pool_operation_v3(uuid,uuid,uuid,uuid,jsonb)']loop
 execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;end$functions$;
commit;
