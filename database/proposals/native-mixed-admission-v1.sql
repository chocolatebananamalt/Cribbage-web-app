-- LOCAL, UNEXECUTED CANDIDATE ONLY.
--
-- This is admission evidence for one TEST ONLY 6 Digital / 12 fictional Paper
-- Standard Singles event. It does not make that event a native Finance source,
-- authorize synthetic results, create a payment/refund/final award, or replace
-- any current ledger/writer. There are deliberately no public wrappers/grants.
--
-- Phase 1 records an immutable intent before seating, schedule, Start, scoring,
-- qualification, or financial evidence exists. Phase 2 derives (never accepts
-- from the caller) the reviewed draw/publication, 108 canonical games, official
-- Start, fixed IDs, and unchanged native settings/roster, while those games are
-- still unscored. A future scoring/Finance integration must separately consume
-- this seal under its own reviewed source contract.
begin;

create function app.native_mixed_admission_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create table app.native_mixed_admission_operations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,
 phase text not null check(phase in('intent','seal')),
 request_payload jsonb not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array(
  'native-mixed-admission-v1',phase,actor_id,operation_id,tournament_id,event_id,request_payload
 )::text,'utf8'),'sha256'),'hex'))
);

create table app.native_mixed_admission_intents_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version between 1 and 2147483647),
 prior_intent_id uuid,actor_id uuid not null,operation_id uuid not null,nonce uuid not null,
 operational_binding_id uuid not null,binding_capture jsonb not null,
 activation_capture jsonb not null,event_capture jsonb not null,setup_event_capture jsonb not null,
 roster_capture jsonb not null,scope_capture jsonb not null,base_source_capture jsonb not null,
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 reason text not null check(reason=trim(reason)and length(reason)between 1 and 500 and reason!~'[[:cntrl:]]'),
 created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,version),unique(id,tournament_id,event_id),
 unique(tournament_id,event_id,nonce),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(prior_intent_id,tournament_id,event_id)references app.native_mixed_admission_intents_v1(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_admission_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(operational_binding_id)references app.event_settings_operational_bindings_v1(id),
 check((version=1 and prior_intent_id is null)or(version>1 and prior_intent_id is not null))
);

create table app.native_mixed_admission_seals_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null,event_id uuid not null,intent_id uuid not null,intent_version integer not null,
 actor_id uuid not null,operation_id uuid not null,operational_binding_id uuid not null,
 reviewed_draw_actor_id uuid not null,reviewed_draw_operation_id uuid not null,
 seating_publication_id uuid not null,schedule_publication_id uuid not null,event_play_start_id uuid not null,
 source_capture jsonb not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 synthetic_all_flags boolean not null default false check(not synthetic_all_flags),
 source_available_v2 boolean not null default false check(not source_available_v2),
 money_moved boolean not null default false check(not money_moved),
 bank_receipt_verified boolean not null default false check(not bank_receipt_verified),
 payout_authorized boolean not null default false check(not payout_authorized),
 finalization_authorized boolean not null default false check(not finalization_authorized),
 created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(intent_id,tournament_id,event_id)references app.native_mixed_admission_intents_v1(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_admission_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(operational_binding_id)references app.event_settings_operational_bindings_v1(id),
 foreign key(reviewed_draw_actor_id,reviewed_draw_operation_id)
  references app.random_seating_operations_v1(actor_id,operation_id),
 foreign key(seating_publication_id)references app.initial_seating_publications(id),
 foreign key(schedule_publication_id,tournament_id,event_id)
  references app.event_schedule_publications(id,tournament_id,event_id),
 foreign key(event_play_start_id,tournament_id,event_id)
  references app.event_play_starts(id,tournament_id,event_id)
);

create table app.native_mixed_admission_outcomes_v1(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 result jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_admission_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

do $$declare n text;begin foreach n in array array[
 'native_mixed_admission_operations_v1','native_mixed_admission_intents_v1',
 'native_mixed_admission_seals_v1','native_mixed_admission_outcomes_v1'
]loop
 execute format('alter table app.%I owner to postgres',n);
 execute format('alter table app.%I enable row level security',n);
 execute format('alter table app.%I force row level security',n);
 execute format('revoke all on table app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;
create index native_mixed_admission_intents_head_v1 on app.native_mixed_admission_intents_v1(tournament_id,event_id,version desc);
create index native_mixed_admission_seals_intent_v1 on app.native_mixed_admission_seals_v1(intent_id,tournament_id,event_id);

create function app.native_mixed_admission_scope_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$
 select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array[
  'digitalCount','environment','financialEvidence','matchCount','paperCount',
  'participantCount','protocol','roundCount','scoringEvidence']
 and v->>'environment'='test-only-local-candidate'
 and v->>'protocol'='native-mixed-6d12p-v1'
 and v->'participantCount'='18'::jsonb and v->'digitalCount'='6'::jsonb and v->'paperCount'='12'::jsonb
 and v->'roundCount'='12'::jsonb and v->'matchCount'='108'::jsonb
 and v->>'scoringEvidence'='not-yet-recorded-synthetic-scope'
 and v->>'financialEvidence'='not-yet-recorded-no-authority'
$$;

create function app.native_mixed_admission_intent_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$
 select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array[
  'expectedOperationalBindingId','expectedPriorIntentId','expectedVersion','kind','nonce','operationId','reason','scope']
 and v->>'kind'='native-mixed-admission-intent-v1'
 and coalesce(v->>'operationId','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and coalesce(v->>'nonce','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and coalesce(v->>'expectedOperationalBindingId','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and jsonb_typeof(v->'expectedVersion')='number'and coalesce(v->>'expectedVersion','')~'^(0|[1-9][0-9]{0,9})$'
 and(v->>'expectedVersion')::bigint<=2147483647
 and((v->'expectedPriorIntentId'='null'::jsonb and(v->>'expectedVersion')::integer=0)
  or(coalesce(v->>'expectedPriorIntentId','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'and(v->>'expectedVersion')::integer>0))
 and jsonb_typeof(v->'reason')='string'and v->>'reason'=trim(v->>'reason')
 and length(v->>'reason')between 1 and 500 and(v->>'reason')!~'[[:cntrl:]]'
 and app.native_mixed_admission_scope_valid_v1(v->'scope')
$$;

create function app.native_mixed_admission_seal_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$
 select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array[
  'expectedIntentId','expectedIntentNonce','expectedIntentVersion','kind','operationId','reason']
 and v->>'kind'='native-mixed-admission-seal-v1'
 and coalesce(v->>'operationId','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and coalesce(v->>'expectedIntentId','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and coalesce(v->>'expectedIntentNonce','')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and jsonb_typeof(v->'expectedIntentVersion')='number'and coalesce(v->>'expectedIntentVersion','')~'^[1-9][0-9]{0,9}$'
 and(v->>'expectedIntentVersion')::bigint<=2147483647
 and jsonb_typeof(v->'reason')='string'and v->>'reason'=trim(v->>'reason')
 and length(v->>'reason')between 1 and 500 and(v->>'reason')!~'[[:cntrl:]]'
$$;

create function app.native_mixed_admission_roster_v1(tid uuid,eid uuid,include_fixed_ids boolean)returns jsonb
language sql stable security definer set search_path=''as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'rosterEntryId',r.id,'participantId',p.id,'mode',r.scorecard_type,
  'preferenceVersion',r.scorecard_preference_version,'profileId',p.profile_id,
  'participantStatus',case when include_fixed_ids then p.status else null end,
  'accountLinkId',l.id,'accountProfileId',l.profile_id,
  'fixedId',case when include_fixed_ids then s.verification_id else null end
 )order by r.id),'[]'::jsonb)
 from app.event_participants p
 join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
 left join app.roster_account_links l on l.tournament_id=r.tournament_id and l.roster_entry_id=r.id
 left join app.initial_seating_assignments s on include_fixed_ids and s.tournament_id=r.tournament_id and s.roster_entry_id=r.id
 where p.tournament_id=tid and p.event_id=eid
$$;

create function app.native_mixed_admission_finance_idle_v1(tid uuid,eid uuid)returns boolean
language sql stable security definer set search_path=''as $$
 select app.legacy_financial_liability_exists_v1(tid,eid)=false
 and not exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.roster_payment_events where tournament_id=tid)
 and not exists(select 1 from app.roster_payment_obligation_versions where tournament_id=tid)
 and not exists(select 1 from app.tournament_expense_events where tournament_id=tid)
 and not exists(select 1 from app.late_player_refund_decisions where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.q_pool_membership_versions_v1 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.q_pool_allocation_versions_v1 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_side_pool_election_versions where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_side_pool_team_election_versions where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_side_pool_payout_versions where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_side_pool_team_payout_versions where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_side_pool_payout_reviews where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.native_optional_income_records_v2 where tournament_id=tid and event_id=eid)
$$;

create function app.native_mixed_admission_score_history_empty_v1(tid uuid,eid uuid)returns boolean
language sql stable security definer set search_path=''as $$
 select not exists(select 1 from app.score_submissions where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.score_confirmations where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.card_scorelines where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.paper_game_completions where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.hybrid_game_cases where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.device_failure_recoveries where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.game_corrections where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.independent_card_corrections where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.operational_game_forfeits where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_disputes where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_game_standings_eligibility_versions where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_excluded_extra_game_records where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_schedule_amendment_versions where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.odd_field_makeup_games_v1 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.qualification_result_versions where tournament_id=tid and event_id=eid)
$$;

create function app.native_mixed_admission_financial_row_provenanced_v1(
 tid uuid,eid uuid,table_name text,row_id uuid,row_value jsonb,action_value text
)returns boolean language sql stable security definer set search_path=''as $$
 select exists(select 1 from app.synthetic_mixed_main_provenance_v1 p
 join app.synthetic_mixed_main_contexts_v1 c on c.id=p.context_id and c.tournament_id=p.tournament_id and c.event_id=p.event_id
 join app.synthetic_mixed_main_requests_v1 q on q.context_id=c.id and q.actor_id=c.actor_id and q.operation_id=c.operation_id
 join app.operation_receipts r on r.id=p.operation_receipt_id and r.tournament_id=p.tournament_id
 where p.tournament_id=tid and p.event_id=eid and p.entity_table=table_name and p.entity_id=row_id
  and p.action=action_value and c.action=action_value and q.action=action_value
  and q.tournament_id=tid and q.event_id=eid and q.native_receipt_id=r.id and q.response=r.response_payload
  and r.actor_profile_id=c.actor_id and r.client_operation_id=c.operation_id and r.outcome='accepted'
  and p.record_sha256=encode(extensions.digest(row_value::text,'sha256'),'hex')
  and p.actual_money_received=false and p.money_moved=false
  and p.fictional_paper_play_claimed=false and p.independent_human_play_certified=false)
$$;

-- Seal-time financial evidence is not "idle": it is a fully bounded local
-- simulation. Every allowed current row must have the existing immutable
-- synthetic context/request/native-receipt/provenance chain. No legacy final,
-- refund, unrestricted-income collision, or native V2 write may already exist.
-- KNOWN FAIL-CLOSED PRODUCER GAP: enroll_synthetic_mixed_finance_v1 currently
-- requires a legacy event_prize_schedule_bindings_v1 schedule. A native-
-- configured event intentionally has no such legacy declaration. This file
-- neither creates that declaration nor loosens the enrollment guard; therefore
-- a positive native-configured seal remains unavailable until a separately
-- reviewed native-compatible synthetic finance-scope/provenance writer exists.
create function app.native_mixed_admission_finance_seal_source_v1(tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare scope_row app.synthetic_mixed_finance_scopes_v1%rowtype;
 binding_row app.synthetic_mixed_finance_bindings_v1%rowtype;
 receipts jsonb;obligations jsonb;expenses jsonb;q_memberships jsonb;q_allocations jsonb;side_elections jsonb;
begin
 begin perform app.assert_synthetic_mixed_finance_current_v1(tid,eid);perform app.assert_synthetic_mixed_current_v1(tid,eid);
 exception when others then return jsonb_build_object('status','blocked','code','synthetic_finance_scope_changed');end;
 select*into scope_row from app.synthetic_mixed_finance_scopes_v1 where tournament_id=tid and event_id=eid;
 select*into binding_row from app.synthetic_mixed_finance_bindings_v1 where tournament_id=tid and event_id=eid;
 if scope_row.tournament_id is null or binding_row.event_id is null
  or binding_row.scoring_source_sha256 is distinct from(select source_sha256 from app.synthetic_mixed_fixtures_v1 where tournament_id=tid and event_id=eid)
  or binding_row.binding_sha256 is distinct from encode(extensions.digest(jsonb_build_array(binding_row.scoring_source_sha256,scope_row.source_sha256)::text,'sha256'),'hex')
 then return jsonb_build_object('status','blocked','code','synthetic_finance_binding_required');end if;
 if app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false
  or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.late_player_refund_decisions where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_optional_pool_ownership_revisions_v2 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_optional_finance_revisions_v2 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_optional_income_records_v2 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_optional_fund_reviews_v2 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.event_side_pool_team_election_versions where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.event_side_pool_payout_versions where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.event_side_pool_team_payout_versions where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.event_side_pool_payout_reviews where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_unrestricted_income_sources_v1 i where i.tournament_id=tid and(
    exists(select 1 from app.roster_payment_events p where p.tournament_id=tid and p.id=i.physical_evidence_id)
    or exists(select 1 from app.tournament_expense_events x where x.tournament_id=tid and x.id=i.physical_evidence_id)))
 then return jsonb_build_object('status','blocked','code','financial_liability_refund_or_collision');end if;
 if(select count(*)from app.roster_payment_events where tournament_id=tid)<>18
  or(select count(distinct roster_entry_id)from app.roster_payment_events where tournament_id=tid and event_type='received')<>18
  or exists(select 1 from app.roster_payment_events where tournament_id=tid and(event_type<>'received'or payment_method<>'cash'or currency_code<>'USD'))
  or(select count(*)from app.roster_payment_obligation_versions where tournament_id=tid)<>18
  or(select count(distinct roster_entry_id)from app.roster_payment_obligation_versions where tournament_id=tid)<>18
  or exists(select 1 from app.tournament_roster_entries r where r.tournament_id=tid and not exists(
    select 1 from app.roster_payment_events p join app.roster_payment_obligation_versions o
      on o.tournament_id=p.tournament_id and o.roster_entry_id=p.roster_entry_id
    where p.tournament_id=tid and p.roster_entry_id=r.id and p.event_type='received'
      and p.amount_minor=o.amount_owed_minor and p.version=1 and o.version=1))
 then return jsonb_build_object('status','blocked','code','exact_simulated_paid_roster_required');end if;
 if exists(select 1 from app.roster_payment_events x where x.tournament_id=tid
    and not app.native_mixed_admission_financial_row_provenanced_v1(tid,eid,'roster_payment_events',x.id,to_jsonb(x),'receipt'))
  or exists(select 1 from app.roster_payment_obligation_versions x where x.tournament_id=tid
    and not app.native_mixed_admission_financial_row_provenanced_v1(tid,eid,'roster_payment_obligation_versions',x.id,to_jsonb(x),'obligation'))
  or exists(select 1 from app.tournament_expense_events x where x.tournament_id=tid
    and not app.native_mixed_admission_financial_row_provenanced_v1(tid,eid,'tournament_expense_events',x.id,to_jsonb(x),'expense'))
  or exists(select 1 from app.q_pool_membership_versions_v1 x where x.tournament_id=tid and x.event_id=eid
    and not app.native_mixed_admission_financial_row_provenanced_v1(tid,eid,'q_pool_membership_versions_v1',x.id,to_jsonb(x),'q_membership'))
  or exists(select 1 from app.q_pool_allocation_versions_v1 x where x.tournament_id=tid and x.event_id=eid
    and not app.native_mixed_admission_financial_row_provenanced_v1(tid,eid,'q_pool_allocation_versions_v1',x.id,to_jsonb(x),'q_membership'))
  or exists(select 1 from app.event_side_pool_election_versions x where x.tournament_id=tid and x.event_id=eid
    and not app.native_mixed_admission_financial_row_provenanced_v1(tid,eid,'event_side_pool_election_versions',x.id,to_jsonb(x),'side_election'))
  or exists(select 1 from app.synthetic_mixed_main_provenance_v1 p where p.tournament_id=tid and p.event_id=eid
    and p.entity_table not in('roster_payment_events','roster_payment_obligation_versions','tournament_expense_events',
      'q_pool_membership_versions_v1','q_pool_allocation_versions_v1','event_side_pool_election_versions'))
 then return jsonb_build_object('status','blocked','code','untagged_or_out_of_phase_financial_record');end if;
 select coalesce(jsonb_agg(to_jsonb(x)order by x.roster_entry_id,x.version),'[]')into receipts from app.roster_payment_events x where x.tournament_id=tid;
 select coalesce(jsonb_agg(to_jsonb(x)order by x.roster_entry_id,x.version),'[]')into obligations from app.roster_payment_obligation_versions x where x.tournament_id=tid;
 select coalesce(jsonb_agg(to_jsonb(x)order by x.recorded_at,x.id),'[]')into expenses from app.tournament_expense_events x where x.tournament_id=tid;
 select coalesce(jsonb_agg(to_jsonb(x)order by x.roster_entry_id,x.version,x.id),'[]')into q_memberships from app.q_pool_membership_versions_v1 x where x.tournament_id=tid and x.event_id=eid;
 select coalesce(jsonb_agg(to_jsonb(x)order by x.roster_entry_id,x.version,x.id),'[]')into q_allocations from app.q_pool_allocation_versions_v1 x where x.tournament_id=tid and x.event_id=eid;
 select coalesce(jsonb_agg(to_jsonb(x)order by x.pool_id,x.participant_id,x.version),'[]')into side_elections from app.event_side_pool_election_versions x where x.tournament_id=tid and x.event_id=eid;
 return jsonb_build_object('status','source_available','scope',to_jsonb(scope_row),'binding',to_jsonb(binding_row),
  'receipts',receipts,'obligations',obligations,'expenses',expenses,'qMemberships',q_memberships,
  'qAllocations',q_allocations,'sideElections',side_elections,'actualMoneyReceived',false,'moneyMoved',false,
  'bankReceiptVerified',false,'payoutAuthorized',false,'finalizationAuthorized',false);
end$$;

create function app.lock_native_mixed_admission_sources_v1()returns void
language plpgsql security definer set search_path=''as $$begin
 perform app.lock_native_ledger_sources_v1();
 perform app.lock_event_settings_playoff_sources_v1();
 lock table app.event_settings_operational_bindings_v1,app.event_participants,app.tournament_roster_entries,
  app.roster_account_links,app.initial_seating_publications,app.initial_seating_assignments,
  app.random_seating_plans_v1,app.random_seating_operations_v1,app.random_seating_outcomes_v1,app.random_seating_draws_v1,
  app.reviewed_initial_seating_publications_v1,app.event_schedule_publications,app.event_schedule_games,
  app.rounds,app.canonical_games,app.event_play_starts,app.score_submissions,app.score_confirmations,
  app.card_scorelines,app.paper_game_completions,app.hybrid_game_cases,app.device_failure_recoveries,
  app.game_corrections,app.independent_card_corrections,app.operational_game_forfeits,app.event_disputes,
  app.event_game_standings_eligibility_versions,app.event_excluded_extra_game_records,app.event_schedule_amendment_versions,
  app.odd_field_makeup_games_v1,app.qualification_result_versions,app.roster_payment_events,app.roster_payment_obligation_versions,
  app.tournament_expense_events,app.late_player_refund_decisions,app.q_pool_membership_versions_v1,
  app.q_pool_allocation_versions_v1,app.event_side_pool_election_versions,app.event_side_pool_team_election_versions,
  app.event_side_pool_payout_versions,app.event_side_pool_team_payout_versions,app.event_side_pool_payout_reviews,
  app.operation_receipts,app.native_unrestricted_income_sources_v1,app.native_unrestricted_income_records_v1,
  app.native_optional_pool_ownership_operations_v2,app.native_optional_pool_ownership_revisions_v2,app.native_optional_pool_ownership_outcomes_v2,
  app.native_optional_finance_operations_v2,app.native_optional_finance_revisions_v2,app.native_optional_finance_outcomes_v2,
  app.native_optional_finance_adoption_operations_v2,app.native_optional_finance_adoption_outcomes_v2,app.native_optional_finance_source_adoptions_v2,
  app.native_optional_income_operations_v2,app.native_optional_income_records_v2,app.native_optional_income_outcomes_v2,
  app.native_optional_fund_operations_v2,app.native_optional_fund_reviews_v2,app.native_optional_fund_outcomes_v2,
  app.native_optional_final_operations_v2,app.native_optional_final_outcomes_v2,
  app.synthetic_mixed_fixtures_v1,app.synthetic_mixed_enrollment_kinds_v2,
  app.synthetic_mixed_finance_scopes_v1,app.synthetic_mixed_finance_bindings_v1,
  app.synthetic_mixed_main_contexts_v1,app.synthetic_mixed_main_provenance_v1,app.synthetic_mixed_main_requests_v1,
  app.native_playoff_final_award_sets_v1,app.native_optional_final_award_sets_v2
 in share mode nowait;
end$$;

create function app.native_mixed_admission_operation_reserved_v1(actor uuid,op uuid)returns boolean
language sql stable security definer set search_path=''as $$
 select exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)
 or exists(select 1 from app.random_seating_operations_v1 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.reviewed_initial_seating_publications_v1 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_optional_pool_ownership_operations_v2 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_optional_finance_operations_v2 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_optional_finance_adoption_operations_v2 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_optional_income_operations_v2 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_optional_fund_operations_v2 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_optional_final_operations_v2 where actor_id=actor and operation_id=op)
$$;

create function app.native_mixed_admission_base_source_v1(tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare b app.event_settings_operational_bindings_v1%rowtype;e app.events%rowtype;s app.tournament_setup_event_versions%rowtype;
 a app.tournament_setup_activations%rowtype;assessment jsonb;roster jsonb;begin
 select*into e from app.events where id=eid and tournament_id=tid;
 select*into b from app.event_settings_operational_bindings_v1 where event_id=eid and tournament_id=tid;
 select*into a from app.tournament_setup_activations where id=b.activation_id and tournament_id=tid and event_id=eid and setup_event_version_id=b.setup_event_version_id;
 select*into s from app.tournament_setup_event_versions where id=b.setup_event_version_id and tournament_id=tid;
 assessment:=app.assess_event_rule_draft_v1(b.draft,b.context);
 roster:=app.native_mixed_admission_roster_v1(tid,eid,false);
 if e.id is null or b.id is null or a.id is null or s.id is null or e.operational_state<>'active'or e.event_type<>'main'
  or e.format<>'standard_singles'or e.scoring_method<>'digital'or s.event_kind<>'main'
  or s.format_code<>'standard_singles'or s.style_code<>'Standard'or s.game_count<>12
  or e.ruleset_version_id is distinct from a.ruleset_version_id
  or a.setup_event_version_id is distinct from s.id or a.event_id is distinct from e.id
  or assessment->>'status'is distinct from'eligible'
  or b.context->'sanctioned'is distinct from'false'::jsonb
  or(select count(*)from app.events where tournament_id=tid)<>1
  or jsonb_array_length(roster)<>18
  or exists(select 1 from app.event_participants p where p.tournament_id=tid and p.event_id=eid and p.status not in('registered','checked_in'))
  or(select count(*)from jsonb_array_elements(roster)x where x->>'mode'='digital'
      and x->>'profileId'is not null and x->>'accountLinkId'is not null and x->>'accountProfileId'=x->>'profileId')<>6
  or(select count(*)from jsonb_array_elements(roster)x where x->>'mode'='paper'
      and x->>'profileId'is null and x->>'accountLinkId'is null and x->>'accountProfileId'is null)<>12
  or(select count(distinct x->>'profileId')from jsonb_array_elements(roster)x where x->>'mode'='digital')<>6
 then return jsonb_build_object('status','blocked','code','native_mixed_scope_unavailable');end if;
 return jsonb_build_object('status','source_available','binding',to_jsonb(b),'activation',to_jsonb(a),'event',to_jsonb(e),
  'setupEvent',to_jsonb(s),'ruleAssessment',assessment,'roster',roster,'participantCount',18,'digitalCount',6,'paperCount',12,
  'syntheticAllFlags',false,'sourceAvailableV2',false,'moneyMoved',false,'bankReceiptVerified',false,
  'payoutAuthorized',false,'finalizationAuthorized',false);
end$$;

create function app.save_native_mixed_admission_intent_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare op uuid;rh text;oldop app.native_mixed_admission_operations_v1%rowtype;outcome jsonb;
 head app.native_mixed_admission_intents_v1%rowtype;prior app.native_mixed_admission_intents_v1%rowtype;
 source jsonb;binding_id uuid;new_id uuid:=extensions.gen_random_uuid();next_version integer;digest text;response jsonb;code text;
begin
 if app.native_mixed_admission_enabled_v1()is distinct from true then
  return jsonb_build_object('kind','native-mixed-admission-receipt-v1','phase','intent','status','rejected','code','feature_unavailable','sourceAvailableV2',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 end if;
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 begin
  if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='P0001',message='unsupported_isolation';end if;
  if app.native_mixed_admission_intent_request_valid_v1(request)is distinct from true then raise exception using errcode='P0001',message='invalid_request';end if;
  op:=(request->>'operationId')::uuid;
  rh:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-admission-v1','intent',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
  if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
   or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-admission-v1:'||tid::text||':'||eid::text,0))
  then raise exception using errcode='55P03',message='busy';end if;
  perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'for update nowait;
  if not found then raise exception using errcode='P0001',message='test_scope_required';end if;
  perform 1 from app.profiles where id=actor for key share nowait;if not found then return null;end if;
  perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
  perform app.lock_native_mixed_admission_sources_v1();
  select*into oldop from app.native_mixed_admission_operations_v1 where actor_id=actor and operation_id=op;
  if found then
   if oldop.tournament_id<>tid or oldop.event_id<>eid or oldop.phase<>'intent'or oldop.request_hash<>rh or oldop.request_payload is distinct from request
   then raise exception using errcode='P0001',message='operation_conflict';end if;
   select result into outcome from app.native_mixed_admission_outcomes_v1 where actor_id=actor and operation_id=op;
   if outcome is null then raise exception using errcode='55P03',message='busy';end if;return outcome;
  end if;
  if app.native_mixed_admission_operation_reserved_v1(actor,op)then raise exception using errcode='P0001',message='operation_conflict';end if;
  if exists(select 1 from app.initial_seating_publications where tournament_id=tid)
   or exists(select 1 from app.event_schedule_publications where tournament_id=tid)
   or exists(select 1 from app.event_play_starts where tournament_id=tid)
   or app.native_mixed_admission_score_history_empty_v1(tid,eid)is distinct from true
   or exists(select 1 from app.synthetic_mixed_fixtures_v1 where tournament_id=tid)
   or exists(select 1 from app.synthetic_mixed_finance_scopes_v1 where tournament_id=tid)
  then raise exception using errcode='P0001',message='preactivity_intent_required';end if;
  if app.native_mixed_admission_finance_idle_v1(tid,eid)is distinct from true then raise exception using errcode='P0001',message='financial_history_exists';end if;
  source:=app.native_mixed_admission_base_source_v1(tid,eid);
  if source->>'status'<>'source_available'then raise exception using errcode='P0001',message='native_mixed_scope_unavailable';end if;
  binding_id:=(source#>>'{binding,id}')::uuid;
  if binding_id<>(request->>'expectedOperationalBindingId')::uuid then raise exception using errcode='P0001',message='source_changed';end if;
  select*into head from app.native_mixed_admission_intents_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
  if(request->>'expectedVersion')::integer=0 then
   if head.id is not null or request->'expectedPriorIntentId'<>'null'::jsonb then raise exception using errcode='P0001',message='intent_changed';end if;
   next_version:=1;
  else
   if head.id is null or head.id<>(request->>'expectedPriorIntentId')::uuid or head.version<>(request->>'expectedVersion')::integer
    or exists(select 1 from app.native_mixed_admission_seals_v1 where tournament_id=tid and event_id=eid)
    or head.operational_binding_id<>binding_id or head.base_source_capture is distinct from source
    or head.binding_capture is distinct from source->'binding'or head.activation_capture is distinct from source->'activation'
    or head.event_capture is distinct from source->'event'or head.setup_event_capture is distinct from source->'setupEvent'
    or head.roster_capture is distinct from source->'roster'or head.scope_capture is distinct from request->'scope'
   then raise exception using errcode='P0001',message='intent_changed';end if;
   prior:=head;next_version:=head.version+1;
  end if;
  digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-admission-intent-source-v1',tid,eid,binding_id,source,request->'scope')::text,'utf8'),'sha256'),'hex');
  response:=jsonb_build_object('kind','native-mixed-admission-receipt-v1','phase','intent','status','accepted','code','native_mixed_intent_recorded',
   'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'intentId',new_id,'version',next_version,'priorIntentId',prior.id,
   'nonce',request->'nonce','sourceDigest',digest,'request',request,'syntheticAllFlags',false,'sourceAvailableV2',false,'moneyMoved',false,
   'bankReceiptVerified',false,'payoutAuthorized',false,'finalizationAuthorized',false);
  insert into app.native_mixed_admission_operations_v1(actor_id,operation_id,tournament_id,event_id,phase,request_payload,request_hash)
   values(actor,op,tid,eid,'intent',request,rh);
  insert into app.native_mixed_admission_intents_v1(id,tournament_id,event_id,version,prior_intent_id,actor_id,operation_id,nonce,
   operational_binding_id,binding_capture,activation_capture,event_capture,setup_event_capture,roster_capture,scope_capture,base_source_capture,source_digest,reason)
   values(new_id,tid,eid,next_version,prior.id,actor,op,(request->>'nonce')::uuid,binding_id,source->'binding',source->'activation',source->'event',source->'setupEvent',source->'roster',request->'scope',source,digest,request->>'reason');
  insert into app.native_mixed_admission_outcomes_v1 values(actor,op,tid,eid,response,clock_timestamp());
  return response;
 exception when lock_not_available or sqlstate'55P03' then
  return jsonb_build_object('kind','native-mixed-admission-receipt-v1','phase','intent','status','retry_exact','code','source_busy','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'sourceAvailableV2',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 when sqlstate'P0001' then get stacked diagnostics code=message_text;
  if code not in('unsupported_isolation','invalid_request','test_scope_required','operation_conflict','preactivity_intent_required','financial_history_exists','native_mixed_scope_unavailable','source_changed','intent_changed')then raise;end if;
  return jsonb_build_object('kind','native-mixed-admission-receipt-v1','phase','intent','status','rejected','code',code,'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'sourceAvailableV2',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 end;
end$$;

create function app.seal_native_mixed_admission_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare op uuid;rh text;oldop app.native_mixed_admission_operations_v1%rowtype;outcome jsonb;
 intent app.native_mixed_admission_intents_v1%rowtype;source jsonb;reviewed app.reviewed_initial_seating_publications_v1%rowtype;
 publication app.initial_seating_publications%rowtype;schedule app.event_schedule_publications%rowtype;play app.event_play_starts%rowtype;
 roster jsonb;fixed_roster jsonb;games jsonb;finance jsonb;capture jsonb;digest text;seal_id uuid:=extensions.gen_random_uuid();response jsonb;code text;
begin
 if app.native_mixed_admission_enabled_v1()is distinct from true then
  return jsonb_build_object('kind','native-mixed-admission-receipt-v1','phase','seal','status','rejected','code','feature_unavailable','sourceAvailableV2',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 end if;
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 begin
  if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='P0001',message='unsupported_isolation';end if;
  if app.native_mixed_admission_seal_request_valid_v1(request)is distinct from true then raise exception using errcode='P0001',message='invalid_request';end if;
  op:=(request->>'operationId')::uuid;
  rh:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-admission-v1','seal',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
  if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
   or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-admission-v1:'||tid::text||':'||eid::text,0))
  then raise exception using errcode='55P03',message='busy';end if;
  perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'for update nowait;if not found then raise exception using errcode='P0001',message='test_scope_required';end if;
  perform 1 from app.profiles where id=actor for key share nowait;if not found then return null;end if;
  perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
  perform app.lock_native_mixed_admission_sources_v1();
  select*into oldop from app.native_mixed_admission_operations_v1 where actor_id=actor and operation_id=op;
  if found then
   if oldop.tournament_id<>tid or oldop.event_id<>eid or oldop.phase<>'seal'or oldop.request_hash<>rh or oldop.request_payload is distinct from request
   then raise exception using errcode='P0001',message='operation_conflict';end if;
   select result into outcome from app.native_mixed_admission_outcomes_v1 where actor_id=actor and operation_id=op;
   if outcome is null then raise exception using errcode='55P03',message='busy';end if;return outcome;
  end if;
  if app.native_mixed_admission_operation_reserved_v1(actor,op)then raise exception using errcode='P0001',message='operation_conflict';end if;
  if exists(select 1 from app.native_mixed_admission_seals_v1 where tournament_id=tid and event_id=eid)then raise exception using errcode='P0001',message='already_sealed';end if;
  select*into intent from app.native_mixed_admission_intents_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
  if intent.id is null or intent.id<>(request->>'expectedIntentId')::uuid or intent.version<>(request->>'expectedIntentVersion')::integer
   or intent.nonce<>(request->>'expectedIntentNonce')::uuid then raise exception using errcode='P0001',message='intent_changed';end if;
  source:=app.native_mixed_admission_base_source_v1(tid,eid);roster:=source->'roster';
  if source->>'status'<>'source_available'or(source#>>'{binding,id}')::uuid<>intent.operational_binding_id
   or source is distinct from intent.base_source_capture or source->'binding'is distinct from intent.binding_capture
   or source->'activation'is distinct from intent.activation_capture or source->'event'is distinct from intent.event_capture
   or source->'setupEvent'is distinct from intent.setup_event_capture or roster is distinct from intent.roster_capture
  then raise exception using errcode='P0001',message='source_changed';end if;
  finance:=app.native_mixed_admission_finance_seal_source_v1(tid,eid);
  if finance->>'status'<>'source_available'then raise exception using errcode='P0001',message=coalesce(finance->>'code','synthetic_finance_scope_changed');end if;
  if app.native_mixed_admission_score_history_empty_v1(tid,eid)is distinct from true
  then raise exception using errcode='P0001',message='prescoring_seal_required';end if;
  select*into reviewed from app.reviewed_initial_seating_publications_v1 where tournament_id=tid;
  if not found or app.reviewed_initial_seating_bound_v1(reviewed.actor_id,reviewed.operation_id)is distinct from true
   or reviewed.request#>>'{reviewedCandidate,algorithmVersion}'<>'local-circle-18-v1'
   or reviewed.request#>'{reviewedCandidate,physicalReviewRequired}'is distinct from'true'::jsonb
   or jsonb_array_length(reviewed.request#>'{reviewedCandidate,assignments}')<>18
   or jsonb_array_length(reviewed.request#>'{reviewedCandidate,matches}')<>108
  then raise exception using errcode='P0001',message='reviewed_draw_required';end if;
  select*into publication from app.initial_seating_publications where id=reviewed.publication_id and tournament_id=tid;
  select*into schedule from app.event_schedule_publications where tournament_id=tid and event_id=eid;
  select*into play from app.event_play_starts where tournament_id=tid and event_id=eid;
  if publication.id is null or publication.table_count<>1 or publication.seats_per_table<>18
   or(select count(*)from app.initial_seating_assignments where publication_id=publication.id and tournament_id=tid)<>18
   or schedule.id is null or schedule.game_count<>12 or schedule.participant_count<>18 or schedule.match_count<>108
   or play.id is null or play.start_source<>'official'or play.schedule_publication_id<>schedule.id
   or play.participant_count<>18 or play.game_count<>12 or play.schedule_match_count<>108
   or play.participant_snapshot_digest<>app.event_participant_snapshot_digest_v1(eid)
  then raise exception using errcode='P0001',message='native_publication_or_start_required';end if;
  fixed_roster:=app.native_mixed_admission_roster_v1(tid,eid,true);
  if jsonb_array_length(fixed_roster)<>18
   or exists(select 1 from jsonb_array_elements(fixed_roster)x where x->>'fixedId'is null or x->>'participantStatus'is distinct from'checked_in')
   or(select count(distinct x->>'fixedId')from jsonb_array_elements(fixed_roster)x)<>18
  then raise exception using errcode='P0001',message='fixed_ids_unavailable';end if;
  if(select count(*)from app.event_schedule_games where publication_id=schedule.id and tournament_id=tid and event_id=eid)<>108
   or(select count(*)from app.rounds where tournament_id=tid and event_id=eid)<>12
   or(select count(*)from app.canonical_games where tournament_id=tid and event_id=eid)<>108
   or exists(select 1 from app.canonical_games g join app.rounds r on r.id=g.round_id where g.event_id=eid
      group by r.round_number having count(*)<>9)
   or exists(select 1 from app.event_participants p cross join app.rounds r
      left join app.canonical_games g on g.round_id=r.id and p.id in(g.side_a_participant_id,g.side_b_participant_id)
      where p.event_id=eid and r.event_id=eid group by p.id,r.id having count(g.id)<>1)
   or exists(select 1 from app.canonical_games where event_id=eid group by least(side_a_participant_id,side_b_participant_id),greatest(side_a_participant_id,side_b_participant_id)having count(*)>1)
   or exists(select 1 from app.canonical_games where event_id=eid and(state<>'pending'or version<>1 or winner_side is not null or margin is not null))
   or exists(select 1 from jsonb_array_elements(reviewed.request#>'{reviewedCandidate,matches}')m
      where not exists(select 1 from app.canonical_games g join app.rounds r on r.id=g.round_id
       join app.event_participants a on a.id=g.side_a_participant_id join app.event_participants b on b.id=g.side_b_participant_id
       where g.event_id=eid and r.round_number=(m->>'round')::integer
        and a.roster_entry_id=(m#>>'{sides,0,participantId}')::uuid and b.roster_entry_id=(m#>>'{sides,1,participantId}')::uuid
        and g.side_a_table_seat_snapshot=m#>>'{sides,0,seatId}'and g.side_b_table_seat_snapshot=m#>>'{sides,1,seatId}'))
  then raise exception using errcode='P0001',message='reviewed_schedule_changed';end if;
  select jsonb_agg(jsonb_build_object('gameId',g.id,'round',r.round_number,'sideAParticipantId',g.side_a_participant_id,
   'sideBParticipantId',g.side_b_participant_id,'sideASeat',g.side_a_table_seat_snapshot,'sideBSeat',g.side_b_table_seat_snapshot,
   'version',g.version,'state',g.state)order by r.round_number,g.side_a_table_seat_snapshot,g.side_b_table_seat_snapshot,g.id)
  into games from app.canonical_games g join app.rounds r on r.id=g.round_id where g.tournament_id=tid and g.event_id=eid;
  capture:=jsonb_build_object('kind','native-mixed-admission-seal-source-v1','intent',to_jsonb(intent),'binding',source->'binding',
   'roster',fixed_roster,'reviewedPublication',to_jsonb(reviewed),'initialSeating',to_jsonb(publication),
   'schedulePublication',to_jsonb(schedule),'eventPlayStart',to_jsonb(play),'games',games,'financialScope',finance,
   'participantCount',18,'digitalCount',6,'paperCount',12,'roundCount',12,'matchCount',108,
   'syntheticAllFlags',false,'sourceAvailableV2',false,'moneyMoved',false,'bankReceiptVerified',false,
   'payoutAuthorized',false,'finalizationAuthorized',false);
  digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-admission-seal-source-v1',tid,eid,capture)::text,'utf8'),'sha256'),'hex');
  response:=jsonb_build_object('kind','native-mixed-admission-receipt-v1','phase','seal','status','accepted','code','native_mixed_admission_sealed',
   'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'sealId',seal_id,'intentId',intent.id,'intentVersion',intent.version,
   'sourceDigest',digest,'request',request,'syntheticAllFlags',false,'sourceAvailableV2',false,'moneyMoved',false,
   'bankReceiptVerified',false,'payoutAuthorized',false,'finalizationAuthorized',false);
  insert into app.native_mixed_admission_operations_v1(actor_id,operation_id,tournament_id,event_id,phase,request_payload,request_hash)
   values(actor,op,tid,eid,'seal',request,rh);
  insert into app.native_mixed_admission_seals_v1(id,tournament_id,event_id,intent_id,intent_version,actor_id,operation_id,operational_binding_id,
   reviewed_draw_actor_id,reviewed_draw_operation_id,seating_publication_id,schedule_publication_id,event_play_start_id,source_capture,source_digest)
   values(seal_id,tid,eid,intent.id,intent.version,actor,op,intent.operational_binding_id,reviewed.draw_actor_id,reviewed.draw_operation_id,
    publication.id,schedule.id,play.id,capture,digest);
  insert into app.native_mixed_admission_outcomes_v1 values(actor,op,tid,eid,response,clock_timestamp());
  return response;
 exception when lock_not_available or sqlstate'55P03' then
  return jsonb_build_object('kind','native-mixed-admission-receipt-v1','phase','seal','status','retry_exact','code','source_busy','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'sourceAvailableV2',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 when sqlstate'P0001' then get stacked diagnostics code=message_text;
  if code not in('unsupported_isolation','invalid_request','test_scope_required','operation_conflict','already_sealed','intent_changed','source_changed','synthetic_finance_scope_changed','synthetic_finance_binding_required','financial_liability_refund_or_collision','exact_simulated_paid_roster_required','untagged_or_out_of_phase_financial_record','prescoring_seal_required','reviewed_draw_required','native_publication_or_start_required','fixed_ids_unavailable','reviewed_schedule_changed')then raise;end if;
  return jsonb_build_object('kind','native-mixed-admission-receipt-v1','phase','seal','status','rejected','code',code,'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'sourceAvailableV2',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 end;
end$$;

create function app.get_native_mixed_admission_operation_v1(actor uuid,tid uuid,eid uuid,op uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare o app.native_mixed_admission_operations_v1%rowtype;r jsonb;begin
 if app.native_mixed_admission_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'
  or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'
  or actor is null then return null;end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 select*into o from app.native_mixed_admission_operations_v1 where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
 if not found then return null;end if;
 select result into r from app.native_mixed_admission_outcomes_v1 where actor_id=actor and operation_id=op;
 return case when r is null then null else jsonb_build_object('kind','native-mixed-admission-operation-v1','actorId',actor,'tournamentId',tid,'eventId',eid,
  'operationId',op,'phase',o.phase,'request',o.request_payload,'receipt',r,'historicalReceipt',true,'currentSourceVerified',false)end;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

do $$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_admission_enabled_v1()'::regprocedure,
 'app.native_mixed_admission_scope_valid_v1(jsonb)'::regprocedure,
 'app.native_mixed_admission_intent_request_valid_v1(jsonb)'::regprocedure,
 'app.native_mixed_admission_seal_request_valid_v1(jsonb)'::regprocedure,
 'app.native_mixed_admission_roster_v1(uuid,uuid,boolean)'::regprocedure,
 'app.native_mixed_admission_finance_idle_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_admission_score_history_empty_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_admission_financial_row_provenanced_v1(uuid,uuid,text,uuid,jsonb,text)'::regprocedure,
 'app.native_mixed_admission_finance_seal_source_v1(uuid,uuid)'::regprocedure,
 'app.lock_native_mixed_admission_sources_v1()'::regprocedure,
 'app.native_mixed_admission_operation_reserved_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_admission_base_source_v1(uuid,uuid)'::regprocedure,
 'app.save_native_mixed_admission_intent_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.seal_native_mixed_admission_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.get_native_mixed_admission_operation_v1(uuid,uuid,uuid,uuid)'::regprocedure
]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$$;

commit;
