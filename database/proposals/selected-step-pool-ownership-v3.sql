-- UNEXECUTED, PRIVATE AND DEFAULT OFF. Versioned Main-only ownership for
-- current prize activations. Legacy readers and their pin rejection stay intact.
-- Same official start/qualification/ACC checks; no synthetic/generic Con bypass.
begin;
create function app.selected_step_pool_ownership_enabled_v3()returns boolean language sql stable set search_path=''set timezone='UTC'as $gate$select false$gate$;

create function app.selected_step_pool_activation_pin_v3(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $pin$
declare b app.event_settings_operational_bindings_v1%rowtype;a app.tournament_setup_activations%rowtype;
 e app.tournament_setup_event_versions%rowtype;s app.event_settings_snapshots_v3%rowtype;
 p app.event_prize_policy_activation_pins_v1%rowtype;prize app.event_prize_snapshots_v1%rowtype;settings_hash text;ctx jsonb;
begin
 if app.selected_step_pool_ownership_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 perform app.lock_operational_event_finance_sources_v1();
 lock table app.event_prize_policy_activation_pins_v1,app.event_prize_snapshots_v1,app.event_prize_heads_v1,
  app.event_prize_revision_bindings_v1,app.event_prize_reservations_v1,app.event_prize_outcomes_v1,app.event_settings_save_reservations_v3 in share mode nowait;
 select*into b from app.event_settings_operational_bindings_v1 where tournament_id=tid and event_id=eid;
 select*into a from app.tournament_setup_activations where id=b.activation_id and tournament_id=tid and event_id=eid and setup_event_version_id=b.setup_event_version_id;
 select*into e from app.tournament_setup_event_versions where id=b.setup_event_version_id and tournament_id=tid and event_kind='main'and style_code='Standard'and format_code='standard_singles';
 select*into s from app.event_settings_snapshots_v3 where id=b.settings_snapshot_id and tournament_id=tid and setup_revision_id=e.setup_revision_id;
 select*into p from app.event_prize_policy_activation_pins_v1 where actor_id=b.intent_actor_id and operation_id=b.intent_operation_id and tournament_id=tid and setup_revision_id=e.setup_revision_id and settings_snapshot_id=s.id;
 select ps.*into prize from app.event_prize_snapshots_v1 ps join app.event_prize_heads_v1 h on h.tournament_id=ps.tournament_id and h.snapshot_id=ps.id where ps.id=p.prize_snapshot_id and ps.tournament_id=tid and ps.setup_revision_id=e.setup_revision_id;
 select request_hash into settings_hash from app.event_settings_save_reservations_v3 where actor_id=s.actor_id and operation_id=s.operation_id and tournament_id=tid;
 ctx:=app.event_prize_activation_current_v1(tid,actor);
 if ctx is null or b.id is null or a.id is null or e.id is null or s.id is null or p.actor_id is null or prize.id is null or settings_hash is null
  or a.setup_revision_id is distinct from e.setup_revision_id
  or not exists(select 1 from app.events where id=eid and tournament_id=tid and event_type='main'and operational_state='active'and format='standard_singles'and ruleset_version_id=a.ruleset_version_id)
  or ctx->>'prizeSnapshotId'is distinct from prize.id::text or ctx->>'prizeDigest'is distinct from p.prize_digest
  or ctx->>'settingsSnapshotId'is distinct from s.id::text or ctx->>'setupRevisionId'is distinct from e.setup_revision_id::text
  or prize.document->>'prizeDigest'is distinct from p.prize_digest or prize.document->>'settingsSnapshotId'is distinct from s.id::text
  or prize.document->>'settingsDigest'is distinct from settings_hash or app.valid_event_prize_snapshot_source_v1(prize.document)is distinct from true
  or not exists(select 1 from jsonb_array_elements(prize.document->'plans')x where x->>'eventClientRowId'=e.client_row_id::text and x->>'eventKind'='main'and x->>'mode'='proposed_v2')
  or not exists(select 1 from jsonb_array_elements(s.effective_settings)x where x->>'eventClientRowId'=e.client_row_id::text and x->>'mode'='configured'and x->'draft'=b.draft)
  or not exists(select 1 from app.event_rule_context_reviews_v1 r where r.id=b.review_id and r.tournament_id=tid and r.settings_snapshot_id=s.id and r.setup_event_version_id=e.id and r.draft=b.draft and r.context=b.context)
 then return jsonb_build_object('status','blocked','code','current_prize_activation_required');end if;
 return jsonb_build_object('status','pin_available','settingsBinding',to_jsonb(b),'activation',to_jsonb(a),'eventVersion',to_jsonb(e),'settings',to_jsonb(s),'pin',to_jsonb(p),'prize',to_jsonb(prize));
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$pin$;
create function app.selected_step_pool_playoff_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare b app.event_settings_operational_bindings_v1%rowtype;a app.tournament_setup_activations%rowtype;
 p app.event_play_starts%rowtype;s app.event_schedule_publications%rowtype;q app.qualification_result_versions%rowtype;
 assessment jsonb;final_format jsonb;capture_value jsonb;h text;pin_value jsonb;
begin
 if app.selected_step_pool_ownership_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;
 perform app.lock_event_settings_playoff_sources_v1();
 select*into b from app.event_settings_operational_bindings_v1 where tournament_id=tid and event_id=eid;
 if not found then return jsonb_build_object('status','blocked','code','settings_binding_required');end if;
 pin_value:=app.selected_step_pool_activation_pin_v3(actor,tid,eid);
 if pin_value->>'status'is distinct from'pin_available'then return pin_value;end if;
 select*into a from app.tournament_setup_activations where id=b.activation_id and tournament_id=tid and event_id=eid and setup_event_version_id=b.setup_event_version_id;
 if not found or not exists(select 1 from app.events where id=eid and tournament_id=tid and operational_state='active'and format='standard_singles'and ruleset_version_id=a.ruleset_version_id)then return jsonb_build_object('status','blocked','code','operational_source_changed');end if;
 select*into p from app.event_play_starts where tournament_id=tid and event_id=eid;
 select*into s from app.event_schedule_publications where tournament_id=tid and event_id=eid;
 select*into q from app.qualification_result_versions where tournament_id=tid and event_id=eid order by version desc limit 1;
 if p.id is null or s.id is null or q.id is null or p.start_source<>'official'or p.operation_receipt_id is null
 or p.schedule_publication_id<>s.id or q.schedule_publication_id<>s.id or q.ruleset_version_id<>a.ruleset_version_id
 or p.participant_count<>s.participant_count or q.participant_count<>p.participant_count
 or q.qualifier_count<>(q.participant_count+3)/4
 or not exists(select 1 from app.operation_receipts where id=p.operation_receipt_id and tournament_id=tid and outcome='accepted')
 or not exists(select 1 from app.operation_receipts where id=q.operation_receipt_id and tournament_id=tid and outcome='accepted')
 then return jsonb_build_object('status','blocked','code','native_original_field_unavailable');end if;
 if not app.qualification_resolution_snapshot_current_v1(q.id)then return jsonb_build_object('status','blocked','code','qualification_source_changed');end if;
 assessment:=app.assess_event_prize_series_draft_v1(b.draft,b.context);
 if assessment->>'status'is distinct from'eligible'then return jsonb_build_object('status','blocked','code','series_rules_unresolved');end if;
 final_format:=app.resolve_event_series_format_v1(case b.draft->>'finalMode'when'same'then b.draft#>'{series,regular}'else b.draft#>'{series,final}'end);
 if b.context->'sanctioned'='true'::jsonb and b.context->>'eventKind'='main'and(b.context->>'durationDays')::integer=2 and p.participant_count>=257
 and final_format is distinct from jsonb_build_object('winsRequired',4,'maximumGames',7)
 then return jsonb_build_object('status','blocked','code','two_day_main_large_final');end if;
 capture_value:=jsonb_build_object('prizeActivation',pin_value,'settingsBinding',to_jsonb(b),'activation',to_jsonb(a),'playStart',to_jsonb(p),'schedule',to_jsonb(s),'qualification',to_jsonb(q),'qualificationFingerprint',app.qualification_tie_source_v1(tid,eid),'originalEntrants',p.participant_count);
 h:=encode(extensions.digest(convert_to(jsonb_build_array('selected-step-pool-playoff-source-v3',tid,eid,capture_value)::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('status','source_available','sourceDigest',h,'source',capture_value,'settingsBindingId',b.id,'reviewId',b.review_id,'playStartId',p.id,'schedulePublicationId',s.id,'qualificationId',q.id,'originalEntrants',p.participant_count,'playStartAllowed',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create table app.selected_step_pool_ownership_operations_v3(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,request_payload jsonb not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array(
 'selected-step-pool-ownership-v3',actor_id,operation_id,tournament_id,event_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.selected_step_pool_ownership_revisions_v3(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version between 1 and 2147483647),prior_revision_id uuid,
 actor_id uuid not null,operation_id uuid not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 source_capture jsonb not null,reason text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,version),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(prior_revision_id,tournament_id,event_id)references app.selected_step_pool_ownership_revisions_v3(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.selected_step_pool_ownership_operations_v3(actor_id,operation_id,tournament_id,event_id)
);
create table app.selected_step_pool_ownership_outcomes_v3(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.selected_step_pool_ownership_operations_v3(actor_id,operation_id,tournament_id,event_id)
);
do $$declare n text;begin foreach n in array array[
 'selected_step_pool_ownership_operations_v3','selected_step_pool_ownership_revisions_v3','selected_step_pool_ownership_outcomes_v3'
]loop execute format('alter table app.%I owner to postgres',n);
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;

-- Full physical roster receipts are retained. The Q shares partition those
-- receipts; Side election rows remain distinct recorded sources, not new cash.
create function app.selected_step_pool_ownership_source_v3(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare basis jsonb;m jsonb;q jsonb;side_basis jsonb;qr app.q_obligation_reviews_v2%rowtype;
 entry jsonb;part jsonb;parts jsonb;receipts jsonb:='[]';side_sources jsonb:='[]';capture jsonb;digest text;native_raw jsonb;playoff_source jsonb;
 allocation app.q_pool_allocation_versions_v1%rowtype;payment app.roster_payment_events%rowtype;
 election record;amount numeric;side_total numeric:=0;receipt_total numeric:=0;policy_id uuid;election_request jsonb;election_response jsonb;election_hash text;reason_prefix text;
begin
 if app.selected_step_pool_ownership_enabled_v3()is distinct from true then return null;end if;
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 perform app.lock_native_ledger_sources_v1();
 perform app.lock_event_settings_playoff_sources_v1();
 lock table app.q_operating_policies_v2,app.side_pool_graduated_policies_v2,app.side_pool_recipient_policies_v3,
  app.q_obligation_reviews_v2,app.side_pool_recipient_reviews_v3,app.qualification_result_versions,app.qualification_result_rows,
  app.tournament_setup_side_pool_materializations,app.setup_custom_payout_intents_v2,app.setup_custom_payout_batches_v2,
  app.operation_receipts,app.roster_payment_obligation_versions,app.roster_entry_lifecycle_events,
  app.event_side_pool_definition_versions,app.native_unrestricted_income_sources_v1,app.native_unrestricted_income_records_v1 in share mode nowait;
 if app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false
  or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)
 then return jsonb_build_object('status','blocked','code','existing_financial_liability');end if;
 native_raw:=app.native_optional_recorded_sources_v2(actor,tid);
 if native_raw->>'status'='retry_exact'then return native_raw;end if;
 if native_raw is null or native_raw->>'status'is distinct from'sources_available'
 then return jsonb_build_object('status','blocked','code','native_sources_unavailable');end if;
 if exists(select 1 from app.native_unrestricted_income_sources_v1 i
   join app.roster_payment_events p on p.tournament_id=i.tournament_id and p.id=i.physical_evidence_id where i.tournament_id=tid)
  or exists(select 1 from app.native_unrestricted_income_sources_v1 i
   join app.tournament_expense_events x on x.tournament_id=i.tournament_id and x.id=i.physical_evidence_id where i.tournament_id=tid)
 then return jsonb_build_object('status','blocked','code','physical_evidence_conflict');end if;
 playoff_source:=app.selected_step_pool_playoff_source_v3(actor,tid,eid);
 if playoff_source->>'status'='retry_exact'then return playoff_source;end if;
 if playoff_source is null or playoff_source->>'status'is distinct from'source_available'
 then return jsonb_build_object('status','blocked','code','native_binding_required');end if;
 basis:=app.q_base_financial_basis_v9(tid,eid);
 if basis->>'status'is distinct from'supported'then return jsonb_build_object('status','blocked','code','optional_ownership_scope_unsupported');end if;
 m:=public.get_q_pool_membership_workspace_v1(actor,tid);q:=app.q_obligation_sources_v2(actor,tid);
 if q is null or q->>'eventId'is distinct from eid::text or jsonb_typeof(q->'blockers')is distinct from'array'
  or jsonb_array_length(q->'blockers')<>0 or jsonb_typeof(q->'obligations')is distinct from'array'
  or exists(select 1 from jsonb_array_elements(q->'obligations')p where p->>'kind'is distinct from'award')
 then return jsonb_build_object('status','blocked','code','q_source_unresolved');end if;
 select*into qr from app.q_obligation_reviews_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if qr.id is null or qr.source_digest is distinct from q->>'sourceDigest'or qr.obligations is distinct from q->'obligations'
 then return jsonb_build_object('status','blocked','code','q_review_required');end if;
 side_basis:=app.combined_side_basis_v9(actor,tid,eid);
 if side_basis is null or jsonb_typeof(side_basis->'blockers')is distinct from'array'or jsonb_array_length(side_basis->'blockers')<>0
 then return jsonb_build_object('status','blocked','code','side_source_unresolved');end if;
 for entry in select value from jsonb_array_elements(m->'entries')loop
  select*into allocation from app.q_pool_allocation_versions_v1 where tournament_id=tid and event_id=eid and roster_entry_id=(entry->>'rosterEntryId')::uuid order by version desc limit 1;
  select*into payment from app.roster_payment_events where tournament_id=tid and id=(entry->>'receiptId')::uuid;
  if allocation.id is null or payment.id is null or allocation.receipt_id<>payment.id or allocation.membership_version_id is null
   or payment.event_type<>'received'or payment.amount_minor is distinct from(entry->>'receivedMinor')::integer
  then return jsonb_build_object('status','blocked','code','receipt_ownership_changed');end if;
  parts:=jsonb_build_array(jsonb_build_object('eventId',eid,'bucket','regular_entry','poolId',null,'amountMinor',(entry->>'baseAllocatedMinor')::bigint,'classificationReviewed',true));
  amount:=(entry->>'baseAllocatedMinor')::numeric;
  for part in select value from jsonb_array_elements(entry->'pools')loop
   if(part->>'amountAllocatedMinor')::numeric>0 then
    if part->>'paidEntryEligible'is distinct from'true'then return jsonb_build_object('status','blocked','code','q_paid_eligibility_changed');end if;
    amount:=amount+(part->>'amountAllocatedMinor')::numeric;
    parts:=parts||jsonb_build_array(jsonb_build_object('eventId',eid,'bucket','q','poolId',part->'poolVersionId','amountMinor',(part->>'amountAllocatedMinor')::bigint,'classificationReviewed',true));
   end if;
  end loop;
  if amount<>payment.amount_minor then return jsonb_build_object('status','blocked','code','nonconserving_receipt_partition');end if;
  receipt_total:=receipt_total+amount;
  receipts:=receipts||jsonb_build_array(jsonb_build_object('receipt',to_jsonb(payment),'allocation',to_jsonb(allocation),
   'source',jsonb_build_object('sourceId',payment.id,'physicalEvidenceId',payment.id,'kind','entry_receipt','amountMinor',payment.amount_minor,'state','active','allocations',parts)));
 end loop;
 for election in select distinct on(e.pool_id,e.participant_id)e.*,to_jsonb(o)as receipt_capture
  from app.event_side_pool_election_versions e join app.operation_receipts o on o.id=e.operation_receipt_id and o.tournament_id=e.tournament_id
  where e.tournament_id=tid and e.event_id=eid order by e.pool_id,e.participant_id,e.version desc loop
  if not election.elected then
   if election.amount_received_minor<>0 then return jsonb_build_object('status','blocked','code','side_funding_unresolved');end if;continue;
  end if;
  if election.amount_received_minor<=0 or election.amount_received_minor<>election.amount_due_minor
   or election.receipt_capture->>'operation_type'is distinct from'side_pool_graduated_v2_election'
   or election.receipt_capture->>'outcome'is distinct from'accepted'
   or election.receipt_capture->>'actor_profile_id'is distinct from election.actor_profile_id::text
   or election.receipt_capture->>'target_id'is distinct from election.pool_id::text
   or exists(select 1 from app.roster_payment_events where tournament_id=tid and id=election.id)
   or exists(select 1 from app.tournament_expense_events where tournament_id=tid and id=election.id)
   or exists(select 1 from app.native_unrestricted_income_sources_v1 where tournament_id=tid and physical_evidence_id=election.id)
  then return jsonb_build_object('status','blocked','code','side_receipt_ownership_unresolved');end if;
  select id into policy_id from app.side_pool_graduated_policies_v2 where tournament_id=tid and event_id=eid and pool_id=election.pool_id;
  reason_prefix:='Side policy '||policy_id::text||': ';
  if policy_id is null or not starts_with(election.reason,reason_prefix)then return jsonb_build_object('status','blocked','code','side_operation_binding_unresolved');end if;
  election_request:=jsonb_build_object('policyId',policy_id,'participantId',election.participant_id,'electionId',election.election_id,
   'expectedVersion',election.version-1,'elected',election.elected,'receivedMinor',election.amount_received_minor,
   'paymentMethod',election.payment_method,'paymentReference',election.payment_reference,'reason',substr(election.reason,length(reason_prefix)+1));
  election_hash:=encode(extensions.digest(convert_to(jsonb_build_array('side_pool_graduated_v2','election',election.actor_profile_id,tid,eid,election.pool_id,election_request)::text,'utf8'),'sha256'),'hex');
  election_response:=jsonb_build_object('status','side_pool_election_saved_v2','poolId',election.pool_id,'participantId',election.participant_id,
   'electionId',election.election_id,'version',election.version,'moneyMoved',false);
  if election.receipt_capture->>'request_hash'is distinct from election_hash or election.receipt_capture->'response_payload'is distinct from election_response
  then return jsonb_build_object('status','blocked','code','side_operation_binding_unresolved');end if;
  side_total:=side_total+election.amount_received_minor;
  side_sources:=side_sources||jsonb_build_array(jsonb_build_object('election',to_jsonb(election)-'receipt_capture','operationReceipt',election.receipt_capture,
   'source',jsonb_build_object('sourceId',election.id,'physicalEvidenceId',election.id,'kind','entry_receipt','amountMinor',election.amount_received_minor,
   'state','active','allocations',jsonb_build_array(jsonb_build_object('eventId',eid,'bucket','side','poolId',election.pool_id,'amountMinor',election.amount_received_minor,'classificationReviewed',true)))));
 end loop;
 if receipt_total<>(basis->>'receiptTotalMinor')::numeric or side_total<>(side_basis->>'sideIncomeMinor')::numeric
 then return jsonb_build_object('status','blocked','code','optional_receipt_coverage_incomplete');end if;
 capture:=jsonb_build_object('kind','selected-step-pool-ownership-source-v3','tournamentId',tid,'eventId',eid,
  'refundPolicy','no-pool-refunds-v1','nativeRawSource',native_raw,'nativePlayoffSource',playoff_source,'basis',basis,'membership',m,'qSource',q,'qReview',to_jsonb(qr),'sideBasis',side_basis,
  'rosterReceiptPartitions',receipts,'sideRecordedSources',side_sources,
  'evidenceMeaning','recorded bookkeeping only; not bank verification or disbursement');
 digest:=encode(extensions.digest(convert_to(capture::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('status','ownership_source_available','kind','selected-step-pool-ownership-source-v3','actorId',actor,
  'tournamentId',tid,'eventId',eid,'sourceDigest',digest,'capture',capture,'funds',jsonb_build_object(
  'regularReceiptsMinor',basis->'grossEntryIncomeMinor','qReceiptsMinor',basis->'qIncomeMinor','sideReceiptsMinor',side_total,
  'recordedReceiptsMinor',receipt_total+side_total),'moneyMoved',false,'bankReceiptVerified',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
alter function app.selected_step_pool_activation_pin_v3(uuid,uuid,uuid)owner to postgres;
alter function app.selected_step_pool_playoff_source_v3(uuid,uuid,uuid)owner to postgres;
revoke all on function app.selected_step_pool_activation_pin_v3(uuid,uuid,uuid),app.selected_step_pool_playoff_source_v3(uuid,uuid,uuid)from public,anon,authenticated,service_role;

create function app.save_selected_step_pool_ownership_v3(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare source_value jsonb;head app.selected_step_pool_ownership_revisions_v3%rowtype;cost jsonb;cost_ids text[]:='{}';cost_total numeric:=0;
 prior app.selected_step_pool_ownership_operations_v3%rowtype;h text;rid uuid:=extensions.gen_random_uuid();result jsonb;
begin
 if app.selected_step_pool_ownership_enabled_v3()is distinct from true then return null;end if;
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null or op is null then return null;end if;
 if app.selected_step_pool_ownership_enabled_v3()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for update nowait;if not found then return null;end if;
 if jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>6
  or not(request?&array['expectedVersion','sourceDigest','reason','reviewed','kind','costClassifications'])or request->>'kind'is distinct from'selected-step-pool-ownership-v3'
  or request->'reviewed'is distinct from'true'::jsonb or jsonb_typeof(request->'expectedVersion')is distinct from'number'
  or jsonb_typeof(request->'sourceDigest')is distinct from'string'or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,9})$'
  or(request->>'expectedVersion')::numeric>=2147483647 or coalesce(request->>'sourceDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'is distinct from app.custom_payout_classification_text_v2(request->>'reason')
  or app.event_settings_js_text_length_v3(request->>'reason')not between 1 and 2000
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('selected-step-pool-ownership-v3',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.selected_step_pool_ownership_operations_v3 where actor_id=actor and operation_id=op;
 if found then
  if prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select o.result into result from app.selected_step_pool_ownership_outcomes_v3 o where o.actor_id=actor and o.operation_id=op;
  return coalesce(result,jsonb_build_object('status','retry_exact','code','operation_incomplete'));
 end if;
 if to_regclass('app.selected_step_pool_finals_v3')is null then return jsonb_build_object('status','rejected','code','selected_pool_journal_required');end if;
 if exists(select 1 from app.selected_step_pool_finals_v3 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','pool_awards_already_recorded');end if;
 source_value:=app.selected_step_pool_ownership_source_v3(actor,tid,eid);
 if source_value->>'status'='retry_exact'then return source_value;end if;
 if source_value is null or source_value->>'status'is distinct from'ownership_source_available'then return jsonb_build_object('status','rejected','code','source_blocked');end if;
 if source_value->>'sourceDigest'is distinct from request->>'sourceDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 if jsonb_typeof(request->'costClassifications')is distinct from'array'
  or jsonb_array_length(request->'costClassifications')<>jsonb_array_length(source_value#>'{capture,basis,expenses}')
 then return jsonb_build_object('status','rejected','code','cost_coverage_incomplete');end if;
 for cost in select value from jsonb_array_elements(request->'costClassifications')loop
  if jsonb_typeof(cost)is distinct from'object'or(select count(*)from jsonb_object_keys(cost))<>2
   or not(cost?&array['expenseEventId','category'])or coalesce(cost->>'category','')not in('player_benefit','operating_expense')
   or coalesce(cost->>'expenseEventId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or cost->>'expenseEventId'=any(cost_ids)
   or not exists(select 1 from jsonb_array_elements(source_value#>'{capture,basis,expenses}')x where x->>'expenseEventId'=cost->>'expenseEventId')
  then return jsonb_build_object('status','rejected','code','invalid_cost_classification');end if;
  cost_ids:=array_append(cost_ids,cost->>'expenseEventId');
  cost_total:=cost_total+(select(x->>'amountMinor')::numeric from jsonb_array_elements(source_value#>'{capture,basis,expenses}')x where x->>'expenseEventId'=cost->>'expenseEventId');
 end loop;
 if cost_total>(source_value#>>'{funds,regularReceiptsMinor}')::numeric then return jsonb_build_object('status','rejected','code','negative_regular_fund');end if;
 select*into head from app.selected_step_pool_ownership_revisions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if coalesce(head.version,0)<>(request->>'expectedVersion')::integer then return jsonb_build_object('status','rejected','code','stale_version');end if;
 insert into app.selected_step_pool_ownership_operations_v3(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)values(actor,op,tid,eid,request,h);
 insert into app.selected_step_pool_ownership_revisions_v3(id,tournament_id,event_id,version,prior_revision_id,actor_id,operation_id,source_digest,source_capture,reason)
 values(rid,tid,eid,coalesce(head.version,0)+1,head.id,actor,op,source_value->>'sourceDigest',source_value,request->>'reason');
 result:=jsonb_build_object('status','selected_step_pool_ownership_reviewed_v3','revisionId',rid,'version',coalesce(head.version,0)+1,
  'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'sourceDigest',source_value->>'sourceDigest','moneyMoved',false,'finalizationAuthorized',false);
 insert into app.selected_step_pool_ownership_outcomes_v3(actor_id,operation_id,tournament_id,event_id,result)values(actor,op,tid,eid,result);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)
 values(tid,actor,'selected_step_pool_ownership_v3',rid,'ownership_reviewed',result);
 return result;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
create function app.reconcile_selected_step_pool_ownership_v3(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare prior app.selected_step_pool_ownership_operations_v3%rowtype;result_value jsonb;h text;
begin
 if app.selected_step_pool_ownership_enabled_v3()is distinct from true then return null;end if;
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into prior from app.selected_step_pool_ownership_operations_v3 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','unknown','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op);end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('selected-step-pool-ownership-v3',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 if prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select o.result into result_value from app.selected_step_pool_ownership_outcomes_v3 o where o.actor_id=actor and o.operation_id=op;
 return jsonb_build_object('status','historical_operation','result',result_value,'currentFundAuthority',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
revoke all on function app.selected_step_pool_ownership_enabled_v3(),app.selected_step_pool_ownership_source_v3(uuid,uuid,uuid),app.save_selected_step_pool_ownership_v3(uuid,uuid,uuid,uuid,jsonb),app.reconcile_selected_step_pool_ownership_v3(uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
do $$declare signature text;begin foreach signature in array array[
 'app.selected_step_pool_ownership_enabled_v3()',
 'app.selected_step_pool_ownership_source_v3(uuid,uuid,uuid)','app.save_selected_step_pool_ownership_v3(uuid,uuid,uuid,uuid,jsonb)',
 'app.reconcile_selected_step_pool_ownership_v3(uuid,uuid,uuid,uuid,jsonb)'
]loop execute format('alter function %s owner to postgres',signature);end loop;end$$;
commit;
