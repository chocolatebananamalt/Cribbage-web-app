-- UNEXECUTED PRIVATE NATIVE PLAYOFF FINAL-AWARD CANDIDATE.
-- LOCAL REVIEW ONLY. This records bookkeeping evidence and unpaid award
-- liabilities. It does not verify cash, move money, authorize payout, or
-- expose a public route. Runtime enablement requires a separate review.
begin;

create function app.native_playoff_final_awards_enabled_v1() returns boolean
language sql immutable set search_path='' as $$select false$$;

create table app.native_playoff_finance_write_operations_v1(
 actor_id uuid not null references app.profiles(id),
 operation_id uuid not null,
 tournament_id uuid not null,
 event_id uuid not null,
 request_payload jsonb not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),
 unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array(
  'native-playoff-finance-write-v1',actor_id,tournament_id,event_id,
  operation_id,request_payload
 )::text,'utf8'),'sha256'),'hex'))
);

create table app.native_playoff_finance_write_outcomes_v1(
 actor_id uuid not null,operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,
 result jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_playoff_finance_write_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

create table app.native_unrestricted_income_sources_v1(
 tournament_id uuid not null,event_id uuid not null,income_id uuid not null,
 physical_evidence_id uuid not null,evidence_reference text not null,
 created_by uuid not null,created_at timestamptz not null default clock_timestamp(),
 primary key(tournament_id,income_id),
 unique(tournament_id,physical_evidence_id),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(created_by) references app.profiles(id),
 check(evidence_reference=app.custom_payout_classification_text_v2(evidence_reference)
  and app.event_settings_js_text_length_v3(evidence_reference) between 1 and 2000)
);
create unique index native_unrestricted_income_evidence_owner_v1
 on app.native_unrestricted_income_sources_v1(tournament_id,lower(evidence_reference));

create table app.native_unrestricted_income_records_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version between 1 and 2147483647),
 income_id uuid not null,record_id uuid not null,prior_record_id uuid,
 physical_evidence_id uuid not null,evidence_reference text not null,
 proposal_revision_id uuid not null,
 amount_minor bigint not null check(amount_minor between 0 and 9007199254740991),
 voided boolean not null,label text not null,reason text not null,
 recorded_by uuid not null,actor_id uuid not null,operation_id uuid not null,
 source_capture jsonb not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,version),
 unique(tournament_id,income_id,record_id),
 unique(id,tournament_id,event_id),
 unique(actor_id,operation_id),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(proposal_revision_id,tournament_id,event_id)
  references app.operational_event_finance_revisions_v1(id,tournament_id,event_id),
 foreign key(tournament_id,income_id)
  references app.native_unrestricted_income_sources_v1(tournament_id,income_id),
 foreign key(tournament_id,income_id,prior_record_id)
  references app.native_unrestricted_income_records_v1(tournament_id,income_id,record_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_playoff_finance_write_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(recorded_by) references app.profiles(id),
 check(evidence_reference=app.custom_payout_classification_text_v2(evidence_reference)
  and app.event_settings_js_text_length_v3(evidence_reference) between 1 and 2000),
 check(label=app.custom_payout_classification_text_v2(label)
  and app.event_settings_js_text_length_v3(label) between 1 and 200),
 check(reason=app.custom_payout_classification_text_v2(reason)
  and app.event_settings_js_text_length_v3(reason) between 1 and 2000)
);

create index native_unrestricted_income_head_v1
 on app.native_unrestricted_income_records_v1(tournament_id,event_id,version desc);

create table app.native_recorded_fund_reviews_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version between 1 and 2147483647),
 prior_review_id uuid,proposal_revision_id uuid not null,
 native_allocation_revision_id uuid not null,
 sanctioning_fee_snapshot_id uuid not null,
 sanctioning_expense_event_id uuid,
 sanctioning_allocated_minor bigint not null check(sanctioning_allocated_minor between 0 and 9007199254740991),
 income_head_version integer not null check(income_head_version between 0 and 2147483647),
 income_head_digest text not null check(income_head_digest~'^[a-f0-9]{64}$'),
 review_status text not null check(review_status in('reviewed_zero','recorded_complete')),
 source_capture jsonb not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 reason text not null,reviewed_by uuid not null,actor_id uuid not null,operation_id uuid not null,
 reviewed_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,version),
 unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(prior_review_id,tournament_id,event_id)
  references app.native_recorded_fund_reviews_v1(id,tournament_id,event_id),
 foreign key(proposal_revision_id,tournament_id,event_id)
  references app.operational_event_finance_revisions_v1(id,tournament_id,event_id),
 foreign key(native_allocation_revision_id,tournament_id)
  references app.native_ledger_allocation_revisions_v1(id,tournament_id),
 foreign key(sanctioning_fee_snapshot_id,tournament_id,event_id)
  references app.event_sanctioning_fee_snapshots(id,tournament_id,event_id),
 foreign key(sanctioning_expense_event_id)
  references app.tournament_expense_events(id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_playoff_finance_write_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(reviewed_by) references app.profiles(id),
 check(reason=app.custom_payout_classification_text_v2(reason)
  and app.event_settings_js_text_length_v3(reason) between 1 and 2000),
 check((sanctioning_expense_event_id is null and sanctioning_allocated_minor=0)
  or(sanctioning_expense_event_id is not null and sanctioning_allocated_minor>0))
);

create table app.native_playoff_final_award_sets_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null,event_id uuid not null,version integer not null check(version=1),
 proposal_revision_id uuid not null,fund_review_id uuid not null,
 qualification_result_version_id uuid not null,
 recipient_source_digest text not null check(recipient_source_digest~'^[a-f0-9]{64}$'),
 fund_source_digest text not null check(fund_source_digest~'^[a-f0-9]{64}$'),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),source_capture jsonb not null,
 total_minor bigint not null check(total_minor between 0 and 9007199254740991),
 recipient_count integer not null check(recipient_count between 1 and 256),
 reason text not null,recorded_by uuid not null,actor_id uuid not null,operation_id uuid not null,
 award_status text not null default'recorded_unpaid' check(award_status='recorded_unpaid'),
 money_moved boolean not null default false check(not money_moved),
 payout_authorized boolean not null default false check(not payout_authorized),
 disbursement_authorized boolean not null default false check(not disbursement_authorized),
 finalization_authorized boolean not null default false check(not finalization_authorized),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(proposal_revision_id,tournament_id,event_id)
  references app.operational_event_finance_revisions_v1(id,tournament_id,event_id),
 foreign key(fund_review_id,tournament_id,event_id)
  references app.native_recorded_fund_reviews_v1(id,tournament_id,event_id),
 foreign key(qualification_result_version_id,tournament_id,event_id)
  references app.qualification_result_versions(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_playoff_finance_write_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(recorded_by) references app.profiles(id),
 check(reason=app.custom_payout_classification_text_v2(reason)
  and app.event_settings_js_text_length_v3(reason) between 1 and 2000)
);

create table app.native_playoff_final_award_groups_v1(
 award_set_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 first_place integer not null,last_place integer not null,people integer not null,
 included boolean not null,per_person_minor bigint not null,group_total_minor bigint not null,
 primary key(award_set_id,first_place,last_place),
 foreign key(award_set_id,tournament_id,event_id)
  references app.native_playoff_final_award_sets_v1(id,tournament_id,event_id),
 check(first_place>=1 and last_place>=first_place and people=last_place-first_place+1),
 check((included and per_person_minor>0 and per_person_minor%500=0
   and group_total_minor=people::bigint*per_person_minor)
  or(not included and per_person_minor=0 and group_total_minor=0))
);

create table app.native_playoff_final_award_recipients_v1(
 award_set_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 participant_id uuid not null,profile_id uuid not null,tournament_player_id text not null,
 display_name text not null,first_place integer not null,last_place integer not null,
 included boolean not null,amount_minor bigint not null,
 primary key(award_set_id,participant_id),
 foreign key(award_set_id,tournament_id,event_id)
  references app.native_playoff_final_award_sets_v1(id,tournament_id,event_id),
 foreign key(participant_id,profile_id,event_id,tournament_id)
  references app.event_participants(id,profile_id,event_id,tournament_id),
 check(first_place>=1 and last_place>=first_place),
 check((included and amount_minor>0 and amount_minor%500=0)or(not included and amount_minor=0))
);

do $$declare n text;begin foreach n in array array[
 'native_playoff_finance_write_operations_v1','native_playoff_finance_write_outcomes_v1',
 'native_unrestricted_income_sources_v1',
 'native_unrestricted_income_records_v1','native_recorded_fund_reviews_v1',
 'native_playoff_final_award_sets_v1','native_playoff_final_award_groups_v1',
 'native_playoff_final_award_recipients_v1'
]loop
 execute format('alter table app.%I owner to postgres',n);
 execute format('alter table app.%I enable row level security',n);
 execute format('alter table app.%I force row level security',n);
 execute format('revoke all on table app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;

create function app.finish_native_playoff_finance_write_v1(
 actor uuid,tid uuid,eid uuid,op uuid,result_value jsonb
)returns jsonb
language plpgsql security definer set search_path=''as $$
declare operation app.native_playoff_finance_write_operations_v1%rowtype;result jsonb;begin
 select*into strict operation from app.native_playoff_finance_write_operations_v1
  where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
 if result_value->>'status'not in('accepted','rejected')then raise exception'invalid_native_playoff_finance_outcome';end if;
 result:=result_value||jsonb_build_object(
  'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,
  'request',operation.request_payload,'fullRequestHash',operation.request_hash,
  'historicalReceipt',false,'currentSourceVerified',result_value->>'status'='accepted',
  'moneyMoved',false,'payoutAuthorized',false,'disbursementAuthorized',false,
  'finalizationAuthorized',false
 );
 insert into app.native_playoff_finance_write_outcomes_v1(
  actor_id,operation_id,tournament_id,event_id,result
 )values(actor,op,tid,eid,result);
 return result;
end$$;

create function app.legacy_financial_liability_exists_v1(tid uuid,eid uuid)returns boolean
language plpgsql security definer set search_path=''as $$
declare n text;r regclass;hit boolean;begin
 foreach n in array array['standard_singles_settlement_final_versions','event_settlement_finals_v2',
  'q_accounting_finals_v6','no_q_accounting_finals_v7','prize_accounting_finals_v8','prize_accounting_finals_v9',
  'multi_event_unpaid_finals_v1']loop
  r:=to_regclass('app.'||n);if r is null then return null;end if;
  execute format('select exists(select 1 from %s where tournament_id=$1 and event_id=$2)',r)into hit using tid,eid;
  if hit then return true;end if;
 end loop;
 r:=to_regclass('app.multi_event_joint_finals_v1');if r is null then return null;end if;
 execute format('select exists(select 1 from %s where tournament_id=$1)',r)into hit using tid;
 return hit;
end$$;

create function app.require_no_native_final_award_liability_v1()returns trigger
language plpgsql security definer set search_path=''as $$
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'native_final_award_isolation_not_supported';end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if tg_table_name='multi_event_joint_finals_v1'then
  if exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=new.tournament_id)then
   raise exception'native_final_award_liability_exists';end if;
 elsif exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=new.tournament_id and event_id=new.event_id)then
  raise exception'native_final_award_liability_exists';
 end if;
 return new;
end$$;

do $$declare n text;begin foreach n in array array['standard_singles_settlement_final_versions','event_settlement_finals_v2',
 'q_accounting_finals_v6','no_q_accounting_finals_v7','prize_accounting_finals_v8','prize_accounting_finals_v9',
 'multi_event_unpaid_finals_v1','multi_event_joint_finals_v1']loop
 execute format('create trigger aa_native_final_award_liability_v1 before insert on app.%I for each row execute function app.require_no_native_final_award_liability_v1()',n);
end loop;end$$;

create function app.record_native_playoff_final_awards_v1(
 tid uuid,eid uuid,request_value jsonb
)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;request_hash text;prior_op app.native_playoff_finance_write_operations_v1%rowtype;
 prior_result jsonb;source_value jsonb;award_id uuid;group_value jsonb;recipient_value jsonb;reason_value text;
 response jsonb;legacy_exists boolean;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(request_value)is distinct from'object'or(select count(*)from jsonb_object_keys(request_value))<>9
  or not(request_value?&array['kind','operationId','expectedVersion','expectedSourceDigest','expectedRecipientSourceDigest',
   'expectedFundSourceDigest','expectedProposalRevisionId','expectedFundReviewId','reason'])
  or request_value->>'kind'is distinct from'native-playoff-final-awards-v1'
  or coalesce(request_value->>'operationId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or request_value->'expectedVersion'is distinct from'0'::jsonb
  or coalesce(request_value->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'
  or coalesce(request_value->>'expectedRecipientSourceDigest','')!~'^[a-f0-9]{64}$'
  or coalesce(request_value->>'expectedFundSourceDigest','')!~'^[a-f0-9]{64}$'
  or coalesce(request_value->>'expectedProposalRevisionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(request_value->>'expectedFundReviewId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or jsonb_typeof(request_value->'reason')is distinct from'string'
  or request_value->>'reason'<>app.custom_payout_classification_text_v2(request_value->>'reason')
  or app.event_settings_js_text_length_v3(request_value->>'reason')not between 1 and 2000 then
  return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(request_value->>'operationId')::uuid;reason_value:=request_value->>'reason';
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 request_hash:=encode(extensions.digest(convert_to(jsonb_build_array('native-playoff-finance-write-v1',a,tid,eid,op,request_value)::text,'utf8'),'sha256'),'hex');
 select*into prior_op from app.native_playoff_finance_write_operations_v1 where actor_id=a and operation_id=op;
 if found then
  if prior_op.tournament_id<>tid or prior_op.event_id<>eid or prior_op.request_hash<>request_hash or prior_op.request_payload<>request_value then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select result into prior_result from app.native_playoff_finance_write_outcomes_v1 where actor_id=a and operation_id=op;
  if prior_result is null then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
  return prior_result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if app.native_playoff_final_awards_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)then
  return jsonb_build_object('status','rejected','code','final_awards_already_recorded');end if;
 legacy_exists:=app.legacy_financial_liability_exists_v1(tid,eid);
 if legacy_exists is distinct from false then return jsonb_build_object('status','rejected','code','legacy_financial_liability_exists');end if;
 source_value:=app.native_playoff_final_award_source_v1(tid,eid,a);
 if source_value->>'status'='retry_exact'then return source_value;end if;
 if source_value->>'status'<>'source_available'then return jsonb_build_object('status','rejected','code',coalesce(source_value->>'code','source_unavailable'));end if;
 if request_value->>'expectedSourceDigest'is distinct from source_value->>'sourceDigest'
  or request_value->>'expectedRecipientSourceDigest'is distinct from source_value->>'recipientSourceDigest'
  or request_value->>'expectedFundSourceDigest'is distinct from source_value->>'fundSourceDigest'
  or request_value->>'expectedProposalRevisionId'is distinct from source_value#>>'{proposal,revisionId}'
  or request_value->>'expectedFundReviewId'is distinct from source_value#>>'{income,reviewId}'then
  return jsonb_build_object('status','rejected','code','source_changed');end if;
 insert into app.native_playoff_finance_write_operations_v1(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)
  values(a,op,tid,eid,request_value,request_hash);
 insert into app.native_playoff_final_award_sets_v1(tournament_id,event_id,version,proposal_revision_id,fund_review_id,
  qualification_result_version_id,recipient_source_digest,fund_source_digest,source_digest,source_capture,total_minor,
  recipient_count,reason,recorded_by,actor_id,operation_id)
 values(tid,eid,1,(source_value#>>'{proposal,revisionId}')::uuid,(source_value#>>'{income,reviewId}')::uuid,
  (source_value#>>'{proposal,qualificationResultVersionId}')::uuid,source_value->>'recipientSourceDigest',source_value->>'fundSourceDigest',
  source_value->>'sourceDigest',source_value,(source_value#>>'{projection,totalMinor}')::bigint,
  jsonb_array_length(source_value#>'{projection,recipients}'),reason_value,a,a,op)returning id into award_id;
 for group_value in select value from jsonb_array_elements(source_value#>'{projection,groups}')loop
  insert into app.native_playoff_final_award_groups_v1(award_set_id,tournament_id,event_id,first_place,last_place,people,included,per_person_minor,group_total_minor)
  values(award_id,tid,eid,(group_value->>'firstPlace')::integer,(group_value->>'lastPlace')::integer,(group_value->>'people')::integer,
   (group_value->>'included')::boolean,(group_value->>'perPersonMinor')::bigint,(group_value->>'groupTotalMinor')::bigint);
 end loop;
 for recipient_value in select value from jsonb_array_elements(source_value#>'{projection,recipients}')loop
  insert into app.native_playoff_final_award_recipients_v1(award_set_id,tournament_id,event_id,participant_id,profile_id,
   tournament_player_id,display_name,first_place,last_place,included,amount_minor)
  values(award_id,tid,eid,(recipient_value->>'participantId')::uuid,(recipient_value->>'profileId')::uuid,
   recipient_value->>'tournamentPlayerId',recipient_value->>'displayName',(recipient_value->>'firstPlace')::integer,
   (recipient_value->>'lastPlace')::integer,(recipient_value->>'included')::boolean,(recipient_value->>'amountMinor')::bigint);
 end loop;
 response:=jsonb_build_object('status','accepted','code','native_playoff_final_awards_recorded_v1','awardSetId',award_id,
  'version',1,'sourceDigest',source_value->>'sourceDigest','totalMinor',(source_value#>>'{projection,totalMinor}')::bigint,
  'recipientCount',jsonb_array_length(source_value#>'{projection,recipients}'),'awardStatus','recorded_unpaid');
 return app.finish_native_playoff_finance_write_v1(a,tid,eid,op,response);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');
end$$;

create function app.get_native_playoff_final_award_record_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();award app.native_playoff_final_award_sets_v1%rowtype;groups jsonb;recipients jsonb;begin
 if a is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return null;end if;
 select*into award from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid;
 if not found then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('firstPlace',first_place,'lastPlace',last_place,'people',people,'included',included,
  'perPersonMinor',per_person_minor,'groupTotalMinor',group_total_minor)order by first_place),'[]')into groups
 from app.native_playoff_final_award_groups_v1 where award_set_id=award.id;
 select coalesce(jsonb_agg(jsonb_build_object('participantId',participant_id,'profileId',profile_id,'displayName',display_name,
  'tournamentPlayerId',tournament_player_id,'firstPlace',first_place,'lastPlace',last_place,'included',included,
  'amountMinor',amount_minor)order by first_place,participant_id),'[]')into recipients
 from app.native_playoff_final_award_recipients_v1 where award_set_id=award.id;
 return jsonb_build_object('status','recorded','kind','native-playoff-final-award-record-v1','tournamentId',tid,'eventId',eid,
  'awardSetId',award.id,'version',award.version,'proposalRevisionId',award.proposal_revision_id,'fundReviewId',award.fund_review_id,
  'qualificationResultVersionId',award.qualification_result_version_id,'recipientSourceDigest',award.recipient_source_digest,
  'fundSourceDigest',award.fund_source_digest,'sourceDigest',award.source_digest,'sourceCapture',award.source_capture,
  'groups',groups,'recipients',recipients,'totalMinor',award.total_minor,'recipientCount',award.recipient_count,
  'reason',award.reason,'recordedBy',award.recorded_by,'recordedAt',award.recorded_at,'awardStatus',award.award_status,
  'historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false,'payoutAuthorized',false,
  'disbursementAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return null;end$$;

create function app.get_native_playoff_finance_write_reconciliation_v1(tid uuid,eid uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();result jsonb;begin
 if a is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('authorized',true,'result',jsonb_build_object('status','retry_exact','code','operation_busy'));end if;
 select o.result into result from app.native_playoff_finance_write_outcomes_v1 o
  where o.actor_id=a and o.operation_id=op and o.tournament_id=tid and o.event_id=eid;
 return jsonb_build_object('authorized',true,'result',case when result is null then null else result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false)end);
exception when lock_not_available then return null;end$$;

-- Bind the immutable Start-time assessment to one current recorded expense
-- event and to the exact same-event, reviewed native allocation parts. The
-- expense remains part of the ordinary native expense total; callers must not
-- subtract this assessment a second time.
create function app.native_sanctioning_coverage_v1(
 tid uuid,eid uuid,recipient jsonb,expense_event_id uuid
)returns jsonb
language plpgsql security definer set search_path=''as $$
declare snapshot app.event_sanctioning_fee_snapshots%rowtype;
 start_row app.event_play_starts%rowtype;expense_row app.tournament_expense_events%rowtype;
 source_row jsonb;part jsonb;allocated numeric:=0;found_source boolean:=false;
begin
 lock table app.event_play_starts,app.event_sanctioning_fee_snapshots,
  app.tournament_expense_events in share mode nowait;
 select*into start_row from app.event_play_starts where tournament_id=tid and event_id=eid;
 select*into snapshot from app.event_sanctioning_fee_snapshots where tournament_id=tid and event_id=eid;
 if start_row.id is null or snapshot.id is null
  or snapshot.event_play_start_id<>start_row.id
  or snapshot.eligible_participant_count<>start_row.participant_count
  or not exists(select 1 from app.events current_event where current_event.id=eid
   and current_event.tournament_id=tid and current_event.event_type=snapshot.event_kind)
  or snapshot.rate_cents::numeric*snapshot.eligible_participant_count::numeric<>snapshot.total_cents::numeric then
  return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');
 end if;
 if snapshot.total_cents=0 then
  if expense_event_id is not null then
   return jsonb_build_object('status','blocked','code','sanctioning_expense_unexpected');
  end if;
  return jsonb_build_object('status','available','snapshotId',snapshot.id,
   'eventPlayStartId',start_row.id,'rateMinor',snapshot.rate_cents,
   'eligibleParticipantCount',snapshot.eligible_participant_count,'totalMinor',snapshot.total_cents,
   'expenseSourceId',null,'allocatedExpenseMinor',0);
 end if;
 if expense_event_id is null then
  return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');
 end if;
 select*into expense_row from app.tournament_expense_events current_expense
  where current_expense.id=expense_event_id and current_expense.tournament_id=tid
   and current_expense.event_type='recorded'
   and not exists(select 1 from app.tournament_expense_events newer
    where newer.expense_id=current_expense.expense_id and newer.version>current_expense.version);
 if expense_row.id is null then
  return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');
 end if;
 for source_row in select value from jsonb_array_elements(recipient#>'{nativeFinanceSource,raw,allocation,eventSources}')loop
  if source_row->>'sourceId'=expense_event_id::text then
   if found_source or source_row->>'kind'<>'expense'or source_row->>'state'<>'active'
    or source_row->>'physicalEvidenceId'is distinct from expense_event_id::text then
    return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');
   end if;
   found_source:=true;
   for part in select value from jsonb_array_elements(source_row->'allocations')loop
    if part->>'eventId'=eid::text and part->>'bucket'in('player_benefit','operating_expense')then
     if part->>'classificationReviewed'is distinct from'true'
      or part->'poolId'is distinct from'null'::jsonb then
      return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');
     end if;
     allocated:=allocated+(part->>'amountMinor')::numeric;
    end if;
   end loop;
  end if;
 end loop;
 if not found_source or allocated<snapshot.total_cents or allocated>9007199254740991 then
  return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');
 end if;
 if exists(select 1 from app.native_recorded_fund_reviews_v1 prior_review
   where prior_review.tournament_id=tid and prior_review.event_id<>eid
    and prior_review.sanctioning_expense_event_id=expense_event_id)
  or exists(select 1 from app.event_settlement_finals_v2 legacy_final
   join app.event_settlement_drafts_v5 legacy_draft on legacy_draft.id=legacy_final.draft_id
   where legacy_final.tournament_id=tid
    and legacy_draft.sanctioning_expense_event_id=expense_event_id)then
  return jsonb_build_object('status','blocked','code','sanctioning_expense_reused');
 end if;
 return jsonb_build_object('status','available','snapshotId',snapshot.id,
  'eventPlayStartId',start_row.id,'rateMinor',snapshot.rate_cents,
  'eligibleParticipantCount',snapshot.eligible_participant_count,'totalMinor',snapshot.total_cents,
  'expenseSourceId',expense_event_id,'allocatedExpenseMinor',allocated::bigint);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then
  return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');
end$$;


create function app.review_native_recorded_fund_v1(
 tid uuid,eid uuid,request_value jsonb
)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;expected integer;request_hash text;prior_op app.native_playoff_finance_write_operations_v1%rowtype;
 prior_result jsonb;recipient jsonb;proposal app.operational_event_finance_revisions_v1%rowtype;
 prior_review app.native_recorded_fund_reviews_v1%rowtype;record_row app.native_unrestricted_income_records_v1%rowtype;
 income_records jsonb:='[]';income_lines jsonb:='[]';income_latest jsonb:='{}';income_item jsonb;line_item jsonb;
 income_digest text;income_head integer:=0;active_income numeric:=0;
 review_id uuid;review_version integer;review_status text;reason_value text;source_capture jsonb;source_digest text;response jsonb;i integer;
 sanctioning_expense uuid;sanctioning jsonb;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(request_value)is distinct from'object'or(select count(*)from jsonb_object_keys(request_value))<>10
  or not(request_value?&array['kind','operationId','expectedVersion','proposalRevisionId','nativeAllocationRevisionId','incomeHeadVersion','incomeHeadDigest','status','sanctioningExpenseEventId','reason'])
  or request_value->>'kind'is distinct from'native-recorded-fund-review-v1'
  or coalesce(request_value->>'operationId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(request_value->>'proposalRevisionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(request_value->>'nativeAllocationRevisionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or jsonb_typeof(request_value->'expectedVersion')is distinct from'number'or(request_value->>'expectedVersion')!~'^(0|[1-9][0-9]*)$'
  or(request_value->>'expectedVersion')::numeric>2147483646
  or jsonb_typeof(request_value->'incomeHeadVersion')is distinct from'number'or(request_value->>'incomeHeadVersion')!~'^(0|[1-9][0-9]*)$'
  or(request_value->>'incomeHeadVersion')::numeric>2147483647
  or coalesce(request_value->>'incomeHeadDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request_value->'status')is distinct from'string'
  or request_value->>'status'not in('reviewed_zero','recorded_complete')
  or(request_value->'sanctioningExpenseEventId'is distinct from'null'::jsonb
   and(jsonb_typeof(request_value->'sanctioningExpenseEventId')is distinct from'string'
    or coalesce(request_value->>'sanctioningExpenseEventId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
  or jsonb_typeof(request_value->'reason')is distinct from'string'
  or request_value->>'reason'<>app.custom_payout_classification_text_v2(request_value->>'reason')
  or app.event_settings_js_text_length_v3(request_value->>'reason')not between 1 and 2000 then
  return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(request_value->>'operationId')::uuid;expected:=(request_value->>'expectedVersion')::integer;
 sanctioning_expense:=case when request_value->'sanctioningExpenseEventId'='null'::jsonb then null
  else(request_value->>'sanctioningExpenseEventId')::uuid end;
 review_status:=request_value->>'status';reason_value:=request_value->>'reason';
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 request_hash:=encode(extensions.digest(convert_to(jsonb_build_array('native-playoff-finance-write-v1',a,tid,eid,op,request_value)::text,'utf8'),'sha256'),'hex');
 select*into prior_op from app.native_playoff_finance_write_operations_v1 where actor_id=a and operation_id=op;
 if found then
  if prior_op.tournament_id<>tid or prior_op.event_id<>eid or prior_op.request_hash<>request_hash or prior_op.request_payload<>request_value then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select result into prior_result from app.native_playoff_finance_write_outcomes_v1 where actor_id=a and operation_id=op;
  if prior_result is null then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
  return prior_result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if app.native_playoff_final_awards_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','final_awards_already_recorded');end if;
 recipient:=app.get_native_playoff_finance_recipient_source_v1(tid,eid);
 if recipient->>'status'='retry_exact'then return recipient;end if;
 if recipient->>'status'<>'source_available'then return jsonb_build_object('status','rejected','code',coalesce(recipient->>'code','source_unavailable'));end if;
 select*into proposal from app.operational_event_finance_revisions_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if not found or proposal.id::text is distinct from request_value->>'proposalRevisionId'
  or proposal.id::text is distinct from recipient#>>'{proposal,revisionId}'
  or request_value->>'nativeAllocationRevisionId'is distinct from recipient#>>'{nativeFinanceSource,raw,allocation,revisionId}'then
  return jsonb_build_object('status','rejected','code','source_changed');end if;
 sanctioning:=app.native_sanctioning_coverage_v1(tid,eid,recipient,sanctioning_expense);
 if sanctioning->>'status'='retry_exact'then return sanctioning;end if;
 if sanctioning->>'status'<>'available'then
  return jsonb_build_object('status','rejected','code',coalesce(sanctioning->>'code','sanctioning_coverage_unverified'));end if;
 for i in jsonb_array_length(proposal.editor#>'{basis,history}')..jsonb_array_length(proposal.editor->'history')-1 loop
  line_item:=proposal.editor->'history'->i;
  if line_item#>>'{line,category}'is distinct from'unrestricted_income'then return jsonb_build_object('status','rejected','code','unrecorded_finance_edit');end if;
  income_lines:=income_lines||jsonb_build_array(line_item);
 end loop;
 select coalesce(max(version),0)into income_head from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid;
 if income_head<>jsonb_array_length(income_lines)then return jsonb_build_object('status','rejected','code','income_history_incomplete');end if;
 for record_row in select*from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid order by version loop
  line_item:=income_lines->(record_row.version-1);
  if line_item#>>'{line,lineId}'is distinct from record_row.income_id::text
   or line_item#>>'{line,recordId}'is distinct from record_row.record_id::text
   or line_item#>'{line,priorRecordId}'is distinct from coalesce(to_jsonb(record_row.prior_record_id),'null'::jsonb)
   or(line_item#>>'{line,amountMinor}')::numeric is distinct from record_row.amount_minor::numeric
   or(line_item#>>'{line,voided}')::boolean is distinct from record_row.voided
   or line_item->>'label'is distinct from record_row.label or line_item#>>'{line,reason}'is distinct from record_row.reason then
   return jsonb_build_object('status','rejected','code','income_history_changed');end if;
  income_records:=income_records||jsonb_build_array(jsonb_build_object('incomeId',record_row.income_id,'recordId',record_row.record_id,
   'priorRecordId',record_row.prior_record_id,'physicalEvidenceId',record_row.physical_evidence_id,'amountMinor',record_row.amount_minor,
   'voided',record_row.voided,'label',record_row.label,'evidenceReference',record_row.evidence_reference,'reason',record_row.reason,
   'recordedBy',record_row.recorded_by,'recordedAt',record_row.recorded_at));
  income_latest:=jsonb_set(income_latest,array[record_row.income_id::text],jsonb_build_object(
   'voided',record_row.voided,'amountMinor',record_row.amount_minor),true);
 end loop;
 for income_item in select value from jsonb_each(income_latest)loop
  if not(income_item->>'voided')::boolean then active_income:=active_income+(income_item->>'amountMinor')::numeric;end if;
 end loop;
 lock table app.roster_payment_events,app.tournament_expense_events in share mode nowait;
 if exists(select 1 from app.native_unrestricted_income_records_v1 ir
   join app.roster_payment_events p on p.tournament_id=ir.tournament_id and p.id=ir.physical_evidence_id
   where ir.tournament_id=tid)
  or exists(select 1 from app.native_unrestricted_income_records_v1 ir
   join app.tournament_expense_events x on x.tournament_id=ir.tournament_id and x.id=ir.physical_evidence_id
   where ir.tournament_id=tid)then
  return jsonb_build_object('status','rejected','code','physical_evidence_conflict');
 end if;
 income_digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-unrestricted-income-head-v1',tid,eid,income_records)::text,'utf8'),'sha256'),'hex');
 if(request_value->>'incomeHeadVersion')::integer<>income_head or request_value->>'incomeHeadDigest'<>income_digest
  or(review_status='reviewed_zero'and active_income<>0)or(review_status='recorded_complete'and active_income=0)then
  return jsonb_build_object('status','rejected','code','income_head_changed');end if;
 select*into prior_review from app.native_recorded_fund_reviews_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if coalesce(prior_review.version,0)<>expected then return jsonb_build_object('status','rejected','code','stale_version');end if;
 insert into app.native_playoff_finance_write_operations_v1(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)
  values(a,op,tid,eid,request_value,request_hash);
 source_capture:=jsonb_build_object('recipientSourceDigest',recipient->>'sourceDigest','proposalRevisionId',proposal.id,
  'nativeAllocationRevisionId',(request_value->>'nativeAllocationRevisionId')::uuid,'incomeHeadVersion',income_head,
   'incomeHeadDigest',income_digest,'incomeRecords',income_records,'reviewStatus',review_status,
   'sanctioning',sanctioning-'status','reviewReason',reason_value);
 source_digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-recorded-fund-review-v1',source_capture)::text,'utf8'),'sha256'),'hex');
  insert into app.native_recorded_fund_reviews_v1(tournament_id,event_id,version,prior_review_id,proposal_revision_id,
   native_allocation_revision_id,sanctioning_fee_snapshot_id,sanctioning_expense_event_id,sanctioning_allocated_minor,
   income_head_version,income_head_digest,review_status,source_capture,source_digest,reason,
  reviewed_by,actor_id,operation_id)
  values(tid,eid,expected+1,prior_review.id,proposal.id,(request_value->>'nativeAllocationRevisionId')::uuid,
   (sanctioning->>'snapshotId')::uuid,sanctioning_expense,(sanctioning->>'allocatedExpenseMinor')::bigint,income_head,income_digest,
  review_status,source_capture,source_digest,reason_value,a,a,op)returning id,version into review_id,review_version;
 response:=jsonb_build_object('status','accepted','code','native_recorded_fund_reviewed_v1','reviewId',review_id,
  'version',review_version,'reviewStatus',review_status,'sourceDigest',source_digest,'recordedFundAvailable',true,
  'bankReceiptVerified',false,'reviewedBy',a,'reviewedAt',(select reviewed_at from app.native_recorded_fund_reviews_v1 where id=review_id));
 return app.finish_native_playoff_finance_write_v1(a,tid,eid,op,response);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');
end$$;


create function app.record_native_unrestricted_income_v1(
 tid uuid,eid uuid,request_value jsonb
)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;expected integer;request_hash text;prior_op app.native_playoff_finance_write_operations_v1%rowtype;
 prior_result jsonb;proposal app.operational_event_finance_revisions_v1%rowtype;recipient jsonb;
 target jsonb;line_value jsonb;requested_record_id uuid;requested_income_id uuid;requested_prior_record uuid;requested_physical_id uuid;
 source_owner app.native_unrestricted_income_sources_v1%rowtype;head app.native_unrestricted_income_records_v1%rowtype;
 record_version integer;record_pk uuid;source_digest text;response jsonb;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(request_value)is distinct from'object'or(select count(*)from jsonb_object_keys(request_value))<>7
  or not(request_value?&array['kind','operationId','expectedVersion','proposalRevisionId','recordId','physicalEvidenceId','evidenceReference'])
  or request_value->>'kind'is distinct from'native-unrestricted-income-record-v1'
  or coalesce(request_value->>'operationId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(request_value->>'proposalRevisionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(request_value->>'recordId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(request_value->>'physicalEvidenceId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or jsonb_typeof(request_value->'expectedVersion')is distinct from'number'
  or(request_value->>'expectedVersion')!~'^(0|[1-9][0-9]*)$'
  or(request_value->>'expectedVersion')::numeric>2147483646
  or jsonb_typeof(request_value->'evidenceReference')is distinct from'string'
  or request_value->>'evidenceReference'<>app.custom_payout_classification_text_v2(request_value->>'evidenceReference')
  or app.event_settings_js_text_length_v3(request_value->>'evidenceReference')not between 1 and 2000 then
  return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(request_value->>'operationId')::uuid;expected:=(request_value->>'expectedVersion')::integer;
 requested_record_id:=(request_value->>'recordId')::uuid;requested_physical_id:=(request_value->>'physicalEvidenceId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 request_hash:=encode(extensions.digest(convert_to(jsonb_build_array('native-playoff-finance-write-v1',a,tid,eid,op,request_value)::text,'utf8'),'sha256'),'hex');
 select*into prior_op from app.native_playoff_finance_write_operations_v1 where actor_id=a and operation_id=op;
 if found then
  if prior_op.tournament_id<>tid or prior_op.event_id<>eid or prior_op.request_hash<>request_hash or prior_op.request_payload<>request_value then
   return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select result into prior_result from app.native_playoff_finance_write_outcomes_v1 where actor_id=a and operation_id=op;
  if prior_result is null then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
  return prior_result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if app.native_playoff_final_awards_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)then
  return jsonb_build_object('status','rejected','code','final_awards_already_recorded');end if;
 recipient:=app.get_native_playoff_finance_recipient_source_v1(tid,eid);
 if recipient->>'status'='retry_exact'then return recipient;end if;
 if recipient->>'status'<>'source_available'then return jsonb_build_object('status','rejected','code',coalesce(recipient->>'code','source_unavailable'));end if;
 select*into proposal from app.operational_event_finance_revisions_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if not found or proposal.id::text is distinct from request_value->>'proposalRevisionId'
  or proposal.id::text is distinct from recipient#>>'{proposal,revisionId}'then return jsonb_build_object('status','rejected','code','proposal_source_changed');end if;
 select value into target from jsonb_array_elements(proposal.editor->'history')where value#>>'{line,recordId}'=requested_record_id::text;
 if target is null or target#>>'{line,category}'is distinct from'unrestricted_income'
  or target#>>'{line,mode}'is distinct from'estimate'or target#>'{line,source}'is distinct from proposal.editor#>'{basis,source}'then
  return jsonb_build_object('status','rejected','code','income_record_unavailable');end if;
 line_value:=target->'line';requested_income_id:=(line_value->>'lineId')::uuid;
 requested_prior_record:=case when line_value->'priorRecordId'='null'::jsonb then null else(line_value->>'priorRecordId')::uuid end;
 -- Reserve all native source histories before collision checks. This includes
 -- voided/corrected receipt and expense rows across every event in tournament.
 lock table app.roster_payment_events,app.tournament_expense_events in share mode nowait;
 if exists(select 1 from app.roster_payment_events p where p.tournament_id=tid and p.id=requested_physical_id)
  or exists(select 1 from app.tournament_expense_events x where x.tournament_id=tid and x.id=requested_physical_id)then
  return jsonb_build_object('status','rejected','code','physical_evidence_conflict');end if;
 select*into source_owner from app.native_unrestricted_income_sources_v1 s where s.tournament_id=tid and s.income_id=requested_income_id for update;
 if not found then
  if requested_prior_record is not null then return jsonb_build_object('status','rejected','code','income_lineage_invalid');end if;
  if exists(select 1 from app.native_unrestricted_income_sources_v1 s where s.tournament_id=tid
    and(s.physical_evidence_id=requested_physical_id or lower(s.evidence_reference)=lower(request_value->>'evidenceReference')))then
   return jsonb_build_object('status','rejected','code','physical_evidence_conflict');end if;
  -- Insert is delayed until every remaining rejectable preflight below passes.
 else
  if source_owner.event_id<>eid or source_owner.physical_evidence_id<>requested_physical_id
   or lower(source_owner.evidence_reference)<>lower(request_value->>'evidenceReference')then
   return jsonb_build_object('status','rejected','code','physical_evidence_conflict');end if;
 end if;
 select*into head from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if coalesce(head.version,0)<>expected then return jsonb_build_object('status','rejected','code','stale_version');end if;
 if exists(select 1 from app.native_unrestricted_income_records_v1 r where r.tournament_id=tid and r.event_id=eid and r.record_id=requested_record_id)then
  return jsonb_build_object('status','rejected','code','income_record_conflict');end if;
 if requested_prior_record is null then
  if exists(select 1 from app.native_unrestricted_income_records_v1 r where r.tournament_id=tid and r.income_id=requested_income_id)then
   return jsonb_build_object('status','rejected','code','income_lineage_invalid');end if;
 else
  perform 1 from app.native_unrestricted_income_records_v1 own where own.tournament_id=tid and own.income_id=requested_income_id
   and own.record_id=requested_prior_record and own.record_id=(select r.record_id from app.native_unrestricted_income_records_v1 r
    where r.tournament_id=tid and r.income_id=requested_income_id order by r.version desc limit 1);
  if not found then return jsonb_build_object('status','rejected','code','income_lineage_invalid');end if;
 end if;
 if source_owner.income_id is null then
  insert into app.native_unrestricted_income_sources_v1(tournament_id,event_id,income_id,physical_evidence_id,evidence_reference,created_by)
   values(tid,eid,requested_income_id,requested_physical_id,request_value->>'evidenceReference',a);
 end if;
 insert into app.native_playoff_finance_write_operations_v1(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)
  values(a,op,tid,eid,request_value,request_hash);
 source_digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-unrestricted-income-record-v1',recipient->>'sourceDigest',proposal.id,
  target,requested_physical_id,request_value->>'evidenceReference')::text,'utf8'),'sha256'),'hex');
 insert into app.native_unrestricted_income_records_v1(tournament_id,event_id,version,income_id,record_id,prior_record_id,
  physical_evidence_id,evidence_reference,proposal_revision_id,amount_minor,voided,label,reason,recorded_by,actor_id,operation_id,source_capture,source_digest)
 values(tid,eid,expected+1,requested_income_id,requested_record_id,requested_prior_record,requested_physical_id,request_value->>'evidenceReference',proposal.id,
  (line_value->>'amountMinor')::bigint,(line_value->>'voided')::boolean,target->>'label',line_value->>'reason',a,a,op,
  jsonb_build_object('recipientSourceDigest',recipient->>'sourceDigest','proposalRevisionId',proposal.id,'proposalLine',target),source_digest)
 returning id,version into record_pk,record_version;
 response:=jsonb_build_object('status','accepted','code','native_unrestricted_income_recorded_v1','incomeRecordId',record_pk,
  'incomeId',requested_income_id,'version',record_version,'proposalRevisionId',proposal.id,'recordedBookkeepingOnly',true,
  'bankReceiptVerified',false,'coverageGuarantee','all_native_receipt_expense_history_reserved');
 return app.finish_native_playoff_finance_write_v1(a,tid,eid,op,response);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');
end$$;


-- Rebuild the current immutable source. All amounts are derived from current
-- native allocation rows, recorded bookkeeping rows and the current proposal;
-- no posted amount or recipient is trusted.
create function app.native_playoff_final_award_source_v1(
 tid uuid,eid uuid,actor uuid
)returns jsonb
language plpgsql security definer set search_path=''as $$
declare
 recipient jsonb;proposal app.operational_event_finance_revisions_v1%rowtype;
 review app.native_recorded_fund_reviews_v1%rowtype;final_row app.native_playoff_final_award_sets_v1%rowtype;
 editor jsonb;basis_history jsonb;history jsonb;line_item jsonb;record_row app.native_unrestricted_income_records_v1%rowtype;
 income_records jsonb:='[]';income_lines jsonb:='[]';income_latest jsonb:='{}';income_item jsonb;
 income_head integer:=0;income_total numeric:=0;income_head_digest text;
 regular_total numeric:=0;benefit_total numeric:=0;operating_total numeric:=0;fund_total numeric;
 source_row jsonb;part jsonb;allocation_id uuid;recipient_digest text;fund_source_digest text;
 settings jsonb;method text;factor_text text;factor_num numeric;factor_den numeric;dot_at integer;
 qualifier_count integer;requested integer;included_places integer;first_place integer;last_place integer;
 band_count integer:=0;all_band_count integer:=0;i integer;people integer;weight numeric;denominator numeric:=0;raw numeric;amount numeric;previous_amount numeric:=null;
 bands jsonb:='[]';groups jsonb:='[]';recipients jsonb:='[]';override_latest jsonb:='{}';ov jsonb;
 player jsonb;match_row jsonb;participant uuid;place_first integer;place_last integer;included boolean;
 final_winner uuid;final_loser uuid;loser uuid;total_awards numeric:=0;positive_places integer:=0;
 capture jsonb;source_digest text;existing_final jsonb;sanctioning jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed'then
  return jsonb_build_object('status','retry_exact','code','isolation_not_supported');
 end if;
 if app.native_playoff_final_awards_enabled_v1()is distinct from true then
  return jsonb_build_object('status','blocked','code','feature_unavailable');
 end if;
 recipient:=app.get_native_playoff_finance_recipient_source_v1(tid,eid);
 if recipient->>'status'='retry_exact'then return recipient;end if;
 if recipient->>'status'<>'source_available'then
  return jsonb_build_object('status','blocked','code',coalesce(recipient->>'code','recipient_source_unavailable'));
 end if;
 if recipient->>'actorId'is distinct from actor::text then
  return jsonb_build_object('status','blocked','code','actor_source_mismatch');
 end if;
 recipient_digest:=recipient->>'sourceDigest';
 select*into proposal from app.operational_event_finance_revisions_v1
  where tournament_id=tid and event_id=eid order by version desc limit 1;
 if not found or proposal.id::text is distinct from recipient#>>'{proposal,revisionId}'then
  return jsonb_build_object('status','blocked','code','proposal_source_changed');
 end if;
 editor:=proposal.editor;basis_history:=editor#>'{basis,history}';history:=editor->'history';
 if editor->'lineForm'<>'null'::jsonb or editor->'bandForm'<>'null'::jsonb then
  return jsonb_build_object('status','blocked','code','unfinished_proposal_form');
 end if;
 if jsonb_typeof(basis_history)is distinct from'array'or jsonb_typeof(history)is distinct from'array'
  or jsonb_array_length(history)<jsonb_array_length(basis_history)then
  return jsonb_build_object('status','blocked','code','proposal_history_invalid');
 end if;
 for i in 0..jsonb_array_length(basis_history)-1 loop
  if history->i is distinct from basis_history->i then
   return jsonb_build_object('status','blocked','code','native_history_changed');
  end if;
 end loop;
 for i in jsonb_array_length(basis_history)..jsonb_array_length(history)-1 loop
  line_item:=history->i;
  if line_item#>>'{line,category}'is distinct from'unrestricted_income'
   or line_item#>>'{line,mode}'is distinct from'estimate'
   or line_item#>'{line,source}'is distinct from editor#>'{basis,source}'then
   return jsonb_build_object('status','blocked','code','unrecorded_finance_edit');
  end if;
  income_lines:=income_lines||jsonb_build_array(line_item);
 end loop;
 select coalesce(max(version),0)into income_head from app.native_unrestricted_income_records_v1
  where tournament_id=tid and event_id=eid;
 if income_head<>jsonb_array_length(income_lines)then
  return jsonb_build_object('status','blocked','code','income_history_incomplete');
 end if;
 for record_row in select*from app.native_unrestricted_income_records_v1
  where tournament_id=tid and event_id=eid order by version loop
  line_item:=income_lines->(record_row.version-1);
  if line_item#>>'{line,lineId}'is distinct from record_row.income_id::text
   or line_item#>>'{line,recordId}'is distinct from record_row.record_id::text
   or line_item#>'{line,priorRecordId}'is distinct from coalesce(to_jsonb(record_row.prior_record_id),'null'::jsonb)
   or(line_item#>>'{line,amountMinor}')::numeric is distinct from record_row.amount_minor::numeric
   or(line_item#>>'{line,voided}')::boolean is distinct from record_row.voided
   or line_item->>'label'is distinct from record_row.label
   or line_item#>>'{line,reason}'is distinct from record_row.reason then
   return jsonb_build_object('status','blocked','code','income_history_changed');
  end if;
  income_item:=jsonb_build_object(
   'incomeId',record_row.income_id,'recordId',record_row.record_id,
   'priorRecordId',record_row.prior_record_id,'physicalEvidenceId',record_row.physical_evidence_id,
   'amountMinor',record_row.amount_minor,'voided',record_row.voided,'label',record_row.label,
   'evidenceReference',record_row.evidence_reference,'reason',record_row.reason,
   'recordedBy',record_row.recorded_by,'recordedAt',record_row.recorded_at
  );
  income_records:=income_records||jsonb_build_array(income_item);
  income_latest:=jsonb_set(income_latest,array[record_row.income_id::text],income_item,true);
 end loop;
 for income_item in select value from jsonb_each(income_latest)loop
  if not(income_item->>'voided')::boolean then income_total:=income_total+(income_item->>'amountMinor')::numeric;end if;
 end loop;
 if exists(select 1 from app.native_unrestricted_income_records_v1 ir
   join app.roster_payment_events p on p.tournament_id=ir.tournament_id and p.id=ir.physical_evidence_id
   where ir.tournament_id=tid)
  or exists(select 1 from app.native_unrestricted_income_records_v1 ir
   join app.tournament_expense_events x on x.tournament_id=ir.tournament_id and x.id=ir.physical_evidence_id
   where ir.tournament_id=tid)then
  return jsonb_build_object('status','blocked','code','physical_evidence_conflict');
 end if;
 income_head_digest:=encode(extensions.digest(convert_to(jsonb_build_array(
  'native-unrestricted-income-head-v1',tid,eid,income_records
 )::text,'utf8'),'sha256'),'hex');
 select*into review from app.native_recorded_fund_reviews_v1
  where tournament_id=tid and event_id=eid order by version desc limit 1;
 if not found then return jsonb_build_object('status','blocked','code','recorded_fund_review_required');end if;
 allocation_id:=(recipient#>>'{nativeFinanceSource,raw,allocation,revisionId}')::uuid;
 if review.proposal_revision_id<>proposal.id or review.native_allocation_revision_id<>allocation_id
  or review.income_head_version<>income_head or review.income_head_digest<>income_head_digest then
  return jsonb_build_object('status','blocked','code','recorded_fund_review_stale');
 end if;
  if review.source_capture->>'recipientSourceDigest'is distinct from recipient_digest
   or(review.review_status='reviewed_zero'and income_total<>0)
   or(review.review_status='recorded_complete'and income_total=0)then
  return jsonb_build_object('status','blocked','code','recorded_fund_review_invalid');
 end if;
 sanctioning:=app.native_sanctioning_coverage_v1(tid,eid,recipient,review.sanctioning_expense_event_id);
 if sanctioning->>'status'='retry_exact'then return sanctioning;end if;
 if sanctioning->>'status'<>'available'
  or sanctioning->>'snapshotId'is distinct from review.sanctioning_fee_snapshot_id::text
  or(sanctioning->>'allocatedExpenseMinor')::numeric is distinct from review.sanctioning_allocated_minor::numeric
  or review.source_capture->'sanctioning'is distinct from sanctioning-'status'then
  return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');
 end if;
 for source_row in select value from jsonb_array_elements(recipient#>'{nativeFinanceSource,raw,allocation,eventSources}')loop
  if source_row->>'state'<>'active'or source_row->>'physicalEvidenceId'is distinct from source_row->>'sourceId'then
   return jsonb_build_object('status','blocked','code','native_finance_source_changed');
  end if;
  for part in select value from jsonb_array_elements(source_row->'allocations')loop
   if(part->>'classificationReviewed')::boolean is distinct from true or part->'poolId'<>'null'::jsonb
    or part->>'eventId'is distinct from eid::text then
    return jsonb_build_object('status','blocked','code','native_finance_source_changed');
   end if;
   if part->>'bucket'='regular_entry'then regular_total:=regular_total+(part->>'amountMinor')::numeric;
   elsif part->>'bucket'='player_benefit'then benefit_total:=benefit_total+(part->>'amountMinor')::numeric;
   elsif part->>'bucket'='operating_expense'then operating_total:=operating_total+(part->>'amountMinor')::numeric;
   else return jsonb_build_object('status','blocked','code','optional_pool_or_income_source_unsupported');end if;
  end loop;
 end loop;
 fund_total:=regular_total-benefit_total-operating_total+income_total;
 if regular_total<0 or benefit_total<0 or operating_total<0 or income_total<0 or fund_total<0
  or greatest(regular_total,benefit_total,operating_total,income_total,fund_total)>9007199254740991 then
  return jsonb_build_object('status','blocked','code','recorded_fund_invalid');
 end if;
 if jsonb_array_length(editor->'overrideHistory')>0 then
  if jsonb_typeof(editor->'overrideInput')is distinct from'object'
   or editor#>>'{overrideInput,fundMinor}'is distinct from fund_total::bigint::text
   or editor#>'{overrideInput,settings}'is distinct from editor#>'{basis,settings}'
   or editor#>'{overrideInput,qualifierCount}'is distinct from editor#>'{basis,qualifierCount}'
   or jsonb_typeof(editor->'overridePlan')is distinct from'string'
   or(editor->>'overridePlan')::jsonb is distinct from jsonb_build_object('basis',editor->'basis','history',editor->'history')then
   return jsonb_build_object('status','blocked','code','stale_override_plan');
  end if;
 end if;
 qualifier_count:=(recipient#>>'{playoff,qualifierCount}')::integer;
 if qualifier_count not in(4,5)then return jsonb_build_object('status','blocked','code','unsupported_qualifier_count');end if;
 settings:=editor#>'{basis,settings}';method:=settings->>'method';factor_text:=settings->>'factor';
 if factor_text!~'^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$'then return jsonb_build_object('status','blocked','code','invalid_factor');end if;
 dot_at:=strpos(factor_text,'.');factor_den:=case when dot_at=0 then 1 else power(10,length(factor_text)-dot_at)end;
 factor_num:=replace(factor_text,'.','')::numeric;
 if factor_num<factor_den or factor_num>1000*factor_den then return jsonb_build_object('status','blocked','code','factor_outside_technical_domain');end if;
 if method='graduated_all_qualifiers'then requested:=qualifier_count;
 elsif method='custom_top_paid'then requested:=(settings->>'paidPlaces')::integer;
 elsif method='custom_paid_ratio'then return jsonb_build_object('status','blocked','code','custom_ratio_paid_count_policy_unresolved');
 else return jsonb_build_object('status','blocked','code','invalid_settings');end if;
 if requested<1 or requested>qualifier_count then return jsonb_build_object('status','blocked','code','invalid_paid_places');end if;
 first_place:=1;
 while first_place<=qualifier_count loop
  last_place:=least(qualifier_count,case when first_place=1 then 1 else(first_place-1)*2 end);
  if requested between first_place and last_place then included_places:=last_place;end if;
  bands:=bands||jsonb_build_array(jsonb_build_object('firstPlace',first_place,'lastPlace',last_place,'people',last_place-first_place+1));
  first_place:=case when first_place=1 then 2 else first_place*2-1 end;
 end loop;
 all_band_count:=jsonb_array_length(bands);band_count:=0;
 for i in 0..all_band_count-1 loop
  if(bands->i->>'lastPlace')::integer<=included_places then band_count:=band_count+1;end if;
 end loop;
 for i in 0..band_count-1 loop
  weight:=power(factor_num,band_count-1-i)*power(factor_den,i);
  denominator:=denominator+weight*((bands->i->>'people')::integer);
 end loop;
 for ov in select value from jsonb_array_elements(editor->'overrideHistory')loop
  override_latest:=jsonb_set(override_latest,array[(ov->>'firstPlace')||':'||(ov->>'lastPlace')],ov,true);
 end loop;
 for i in 0..all_band_count-1 loop
  first_place:=(bands->i->>'firstPlace')::integer;last_place:=(bands->i->>'lastPlace')::integer;people:=last_place-first_place+1;
  included:=last_place<=included_places;
  if included then
   weight:=power(factor_num,band_count-1-i)*power(factor_den,i);raw:=fund_total*weight;
   amount:=div(raw*2+denominator*500,denominator*1000)*500;
   ov:=override_latest->(first_place||':'||last_place);
   if ov is not null and not(ov->>'voided')::boolean then amount:=(ov->>'perPersonMinor')::numeric;end if;
   if amount<=0 or amount%500<>0 then return jsonb_build_object('status','blocked','code','award_amount_invalid');end if;
   if previous_amount is not null and amount>previous_amount then return jsonb_build_object('status','blocked','code','award_rank_order_invalid');end if;
   previous_amount:=amount;
   total_awards:=total_awards+amount*people;positive_places:=positive_places+people;
  else amount:=0;end if;
  groups:=groups||jsonb_build_array(jsonb_build_object('firstPlace',first_place,'lastPlace',last_place,'people',people,
   'included',included,'perPersonMinor',amount::bigint,'groupTotalMinor',(amount*people)::bigint));
 end loop;
 if total_awards<>fund_total then return jsonb_build_object('status','blocked','code','recorded_fund_imbalance');end if;
 -- Placement is reconstructed only from the verified native series results.
 for match_row in select value from jsonb_array_elements(recipient#>'{playoff,matches}')loop
  if(match_row->>'slot')::integer=qualifier_count-1 then
   final_winner:=(match_row#>>'{result,winnerId}')::uuid;final_loser:=(match_row#>>'{result,loserId}')::uuid;
  end if;
 end loop;
 for player in select value from jsonb_array_elements(recipient#>'{playoff,players}')loop
  participant:=(player->>'participantId')::uuid;
  if participant=final_winner then place_first:=1;place_last:=1;
  elsif participant=final_loser then place_first:=2;place_last:=2;
  else
   place_first:=null;place_last:=null;
   for match_row in select value from jsonb_array_elements(recipient#>'{playoff,matches}')loop
    loser:=(match_row#>>'{result,loserId}')::uuid;
    if loser=participant then
     if(match_row->>'round')='semifinal'then place_first:=3;place_last:=4;
     elsif qualifier_count=5 and(match_row->>'slot')::integer=1 then place_first:=5;place_last:=5;end if;
    end if;
   end loop;
  end if;
  if place_first is null then return jsonb_build_object('status','blocked','code','recipient_mapping_incomplete');end if;
  ov:=null;
  for income_item in select value from jsonb_array_elements(groups)loop
   if(income_item->>'firstPlace')::integer=place_first and(income_item->>'lastPlace')::integer=place_last then ov:=income_item;exit;end if;
  end loop;
  if ov is null then return jsonb_build_object('status','blocked','code','recipient_band_missing');end if;
  recipients:=recipients||jsonb_build_array(jsonb_build_object(
   'participantId',participant,'profileId',(player->>'profileId')::uuid,
   'displayName',player->>'displayName','tournamentPlayerId',player->>'tournamentPlayerId',
   'firstPlace',place_first,'lastPlace',place_last,'included',(ov->>'included')::boolean,
   'amountMinor',(ov->>'perPersonMinor')::bigint
  ));
 end loop;
 if jsonb_array_length(recipients)<>qualifier_count then return jsonb_build_object('status','blocked','code','recipient_mapping_incomplete');end if;
 fund_source_digest:=encode(extensions.digest(convert_to(jsonb_build_array(
  'native-recorded-fund-source-v1',recipient_digest,proposal.id,proposal.source_digest,
   proposal.basis_digest,allocation_id,income_head,income_head_digest,review.id,review.source_digest,sanctioning-'status',
  regular_total,benefit_total,operating_total,income_total,fund_total
 )::text,'utf8'),'sha256'),'hex');
 capture:=jsonb_build_object(
  'kind','native-playoff-final-award-source-v1','actorId',actor,'tournamentId',tid,'eventId',eid,
  'nativeRecipientSource',recipient,'recipientSourceDigest',recipient_digest,
  'proposal',jsonb_build_object('revisionId',proposal.id,'version',proposal.version,'sourceDigest',proposal.source_digest,
   'basisDigest',proposal.basis_digest,'qualificationResultVersionId',proposal.qualification_result_version_id),
  'allocation',jsonb_build_object('revisionId',allocation_id,'version',recipient#>'{nativeFinanceSource,raw,allocation,version}',
   'sourceDigest',recipient#>'{nativeFinanceSource,raw,allocation,sourceDigest}'),
  'income',jsonb_build_object('headVersion',income_head,'headDigest',income_head_digest,
   'reviewId',review.id,'reviewVersion',review.version,'reviewStatus',review.review_status,
   'reviewedBy',review.reviewed_by,'reviewedAt',review.reviewed_at,'incomeTotalMinor',income_total::bigint,
   'records',income_records,'sourceDigest',fund_source_digest),
   'sanctioning',sanctioning-'status',
  'fund',jsonb_build_object('currency','USD','regularEntryIncomeMinor',regular_total::bigint,
   'benefitExpenseMinor',benefit_total::bigint,'operatingExpenseMinor',operating_total::bigint,
   'unrestrictedIncomeMinor',income_total::bigint,'awardFundMinor',fund_total::bigint,
   'recordedFundAvailable',true,'bankReceiptVerified',false),
  'projection',jsonb_build_object('kind','native-unpaid-final-award-projection-v1',
   'requestedPaidPlaces',requested,'includedPaidPlaces',included_places,'positiveAwardPlaces',positive_places,
   'groups',groups,'recipients',recipients,'totalMinor',total_awards::bigint),
  'fundSourceDigest',fund_source_digest,'awardStatus','recordable_unpaid',
  'moneyMoved',false,'payoutAuthorized',false,'disbursementAuthorized',false,'finalizationAuthorized',false
 );
 source_digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-playoff-final-award-source-v1',capture)::text,'utf8'),'sha256'),'hex');
 return capture||jsonb_build_object('status','source_available','sourceDigest',source_digest);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range or division_by_zero then
 return jsonb_build_object('status','blocked','code','source_shape_invalid');
end$$;

do $$declare f text;begin foreach f in array array[
 'app.native_playoff_final_awards_enabled_v1()',
 'app.finish_native_playoff_finance_write_v1(uuid,uuid,uuid,uuid,jsonb)',
 'app.native_sanctioning_coverage_v1(uuid,uuid,jsonb,uuid)',
 'app.native_playoff_final_award_source_v1(uuid,uuid,uuid)',
 'app.record_native_unrestricted_income_v1(uuid,uuid,jsonb)',
 'app.review_native_recorded_fund_v1(uuid,uuid,jsonb)',
 'app.legacy_financial_liability_exists_v1(uuid,uuid)',
 'app.require_no_native_final_award_liability_v1()',
 'app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)',
 'app.get_native_playoff_final_award_record_v1(uuid,uuid)',
 'app.get_native_playoff_finance_write_reconciliation_v1(uuid,uuid,uuid)'
]loop
 execute format('alter function %s owner to postgres',f);
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
end loop;end$$;

commit;


