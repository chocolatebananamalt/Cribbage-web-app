-- PRIVATE DEFAULT-OFF candidate. Atomic recorded-unpaid regular/Q/Side awards.
-- No bank verification, disbursement, legacy fallback or production enablement.
begin;
create function app.native_optional_final_awards_enabled_v2()returns boolean language sql immutable set search_path=''as $$select false$$;
create table app.native_optional_final_operations_v2(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 request_payload jsonb not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-final-awards-v2',actor_id,operation_id,tournament_id,event_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.native_optional_final_award_sets_v2(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,version integer not null check(version=1),
 fund_review_id uuid not null,proposal_revision_id uuid not null,ownership_revision_id uuid not null,qualification_id uuid not null,
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),source_capture jsonb not null,
 regular_minor bigint not null check(regular_minor between 0 and 9007199254740991),q_minor bigint not null check(q_minor between 0 and 9007199254740991),side_minor bigint not null check(side_minor between 0 and 9007199254740991),
 total_minor bigint not null check(total_minor between 0 and 9007199254740991 and total_minor=regular_minor+q_minor+side_minor),
 recipient_count integer not null check(recipient_count between 1 and 10000),actor_id uuid not null,operation_id uuid not null,reason text not null,
 award_status text not null default'recorded_unpaid'check(award_status='recorded_unpaid'),
 money_moved boolean not null default false check(not money_moved),payout_authorized boolean not null default false check(not payout_authorized),
 disbursement_authorized boolean not null default false check(not disbursement_authorized),finalization_authorized boolean not null default false check(not finalization_authorized),
 created_at timestamptz not null default clock_timestamp(),unique(tournament_id,event_id),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(fund_review_id,tournament_id,event_id)references app.native_optional_fund_reviews_v2(id,tournament_id,event_id),
 foreign key(proposal_revision_id,tournament_id,event_id)references app.native_optional_finance_revisions_v2(id,tournament_id,event_id),
 foreign key(ownership_revision_id,tournament_id,event_id)references app.native_optional_pool_ownership_revisions_v2(id,tournament_id,event_id),
 foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_optional_final_operations_v2(actor_id,operation_id,tournament_id,event_id),
 check(reason=app.custom_payout_classification_text_v2(reason)and app.event_settings_js_text_length_v3(reason)between 1 and 2000)
);
create table app.native_optional_final_regular_groups_v2(
 award_set_id uuid not null,tournament_id uuid not null,event_id uuid not null,first_place integer not null,last_place integer not null,people integer not null,
 included boolean not null,per_person_minor bigint not null,group_total_minor bigint not null,
 primary key(award_set_id,first_place,last_place),
 foreign key(award_set_id,tournament_id,event_id)references app.native_optional_final_award_sets_v2(id,tournament_id,event_id),
 check(first_place>=1 and last_place>=first_place and people=last_place-first_place+1),
 check((included and per_person_minor>0 and per_person_minor%500=0 and group_total_minor=people::bigint*per_person_minor)or(not included and per_person_minor=0 and group_total_minor=0))
);
create table app.native_optional_final_pools_v2(
 award_set_id uuid not null,tournament_id uuid not null,event_id uuid not null,fund_key text not null,pool_kind text not null check(pool_kind in('q','side')),
 q_pool_version_id uuid references app.tournament_setup_q_pool_versions(id),side_pool_id uuid references app.event_side_pools(id),
 q_review_id uuid references app.q_obligation_reviews_v2(id),side_review_id uuid references app.side_pool_recipient_reviews_v3(id),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),fund_minor bigint not null check(fund_minor between 500 and 9007199254740991 and fund_minor%500=0),source_rows jsonb not null,
 primary key(award_set_id,fund_key),
 foreign key(award_set_id,tournament_id,event_id)references app.native_optional_final_award_sets_v2(id,tournament_id,event_id),
 check((pool_kind='q'and q_pool_version_id is not null and q_review_id is not null and side_pool_id is null and side_review_id is null and fund_key='q:'||q_pool_version_id::text)
  or(pool_kind='side'and side_pool_id is not null and side_review_id is not null and q_pool_version_id is null and q_review_id is null and fund_key='side:'||side_pool_id::text)),
 check(jsonb_typeof(source_rows)='array')
);
create table app.native_optional_final_recipients_v2(
 award_set_id uuid not null,tournament_id uuid not null,event_id uuid not null,fund_key text not null,pool_kind text not null check(pool_kind in('regular','q','side')),
 participant_id uuid not null,profile_id uuid,display_name text not null,amount_minor bigint not null,
 first_place integer,last_place integer,source_row jsonb not null,
 primary key(award_set_id,fund_key,participant_id),
 foreign key(award_set_id,tournament_id,event_id)references app.native_optional_final_award_sets_v2(id,tournament_id,event_id),
 foreign key(participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 foreign key(participant_id,profile_id,event_id,tournament_id)references app.event_participants(id,profile_id,event_id,tournament_id),
 check(amount_minor between 0 and 9007199254740991),
 check((pool_kind='regular'and fund_key='regular'and profile_id is not null and first_place is not null and last_place is not null and first_place>=1 and last_place>=first_place and amount_minor>=0 and amount_minor%500=0)
  or(pool_kind in('q','side')and starts_with(fund_key,pool_kind||':')and first_place is null and last_place is null and amount_minor>0 and amount_minor%500=0))
);
create table app.native_optional_final_outcomes_v2(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_optional_final_operations_v2(actor_id,operation_id,tournament_id,event_id)
);
do $$declare n text;begin foreach n in array array['native_optional_final_operations_v2','native_optional_final_award_sets_v2','native_optional_final_regular_groups_v2','native_optional_final_pools_v2','native_optional_final_recipients_v2','native_optional_final_outcomes_v2']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;

-- Current final source requires the latest exact reviewed-zero source. A source
-- projection never itself certifies an independent review or records a liability.
create function app.native_optional_final_award_source_v2(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare review app.native_optional_fund_reviews_v2%rowtype;source_value jsonb;capture_value jsonb;digest text;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if app.native_optional_final_awards_enabled_v2()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','blocked','code','final_awards_already_recorded');end if;
 lock table app.native_optional_fund_operations_v2,app.native_optional_fund_reviews_v2,app.native_optional_fund_outcomes_v2 in share mode nowait;
 select*into review from app.native_optional_fund_reviews_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if review.id is null or review.review_status is distinct from'reviewed_zero'then return jsonb_build_object('status','blocked','code','recorded_fund_review_required');end if;
 source_value:=app.native_optional_recorded_fund_source_v2(actor,tid,eid,review.sanctioning_expense_event_id);
 if source_value is null or source_value->>'status'is distinct from'source_available'then return source_value;end if;
 if review.source_digest is distinct from source_value->>'sourceDigest'or review.source_capture is distinct from source_value
  or review.proposal_revision_id::text is distinct from source_value->>'proposalRevisionId'or review.ownership_revision_id::text is distinct from source_value->>'ownershipRevisionId'
 then return jsonb_build_object('status','blocked','code','recorded_fund_review_stale');end if;
 if source_value#>>'{regularProjection,status}'is distinct from'calculated'then return jsonb_build_object('status','blocked','code',coalesce(source_value#>>'{regularProjection,code}','regular_awards_unresolved'));end if;
 if(source_value#>>'{regularProjection,totalMinor}')::numeric is distinct from(source_value#>>'{funds,regularFundMinor}')::numeric then return jsonb_build_object('status','blocked','code','recorded_fund_imbalance');end if;
 capture_value:=jsonb_build_object('kind','native-optional-final-award-source-v2','actorId',actor,'tournamentId',tid,'eventId',eid,'fundSource',source_value,
  'fundReview',to_jsonb(review),'regularProjection',source_value->'regularProjection','optionalPools',source_value->'optionalPools');
 digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-final-award-source-v2',capture_value)::text,'utf8'),'sha256'),'hex');
 return capture_value||jsonb_build_object('status','source_available','sourceDigest',digest,'proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false,'disbursementAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','blocked','code','source_shape_invalid');end$$;

-- This trigger composes with all existing V1 guards. Joint finals are scoped
-- tournament-wide; event finals are scoped to the exact event. No old row changes.
create function app.guard_native_optional_final_liability_v2()returns trigger
language plpgsql security definer set search_path=''as $$
declare current_source jsonb;current_count integer;p jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'optional_final_isolation_not_supported';end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if tg_table_name='native_optional_final_award_sets_v2'then
  if app.legacy_financial_liability_exists_v1(new.tournament_id,new.event_id)is distinct from false
   or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=new.tournament_id and event_id=new.event_id)
  then raise exception'other_final_award_liability_exists';end if;
  current_source:=app.native_optional_final_award_source_v2(new.actor_id,new.tournament_id,new.event_id);
  if current_source is null or current_source->>'status'is distinct from'source_available'
   or current_source is distinct from new.source_capture or current_source->>'sourceDigest'is distinct from new.source_digest
   or current_source#>>'{fundReview,id}'is distinct from new.fund_review_id::text
   or current_source#>>'{fundSource,proposalRevisionId}'is distinct from new.proposal_revision_id::text
   or current_source#>>'{fundSource,ownershipRevisionId}'is distinct from new.ownership_revision_id::text
   or current_source#>>'{fundSource,recipientSource,playoff,qualificationResultVersionId}'is distinct from new.qualification_id::text
   or(current_source#>>'{fundSource,funds,regularFundMinor}')::numeric is distinct from new.regular_minor::numeric
   or(current_source#>>'{fundSource,funds,qFundMinor}')::numeric is distinct from new.q_minor::numeric
   or(current_source#>>'{fundSource,funds,sideFundMinor}')::numeric is distinct from new.side_minor::numeric
  then raise exception'optional_final_source_changed';end if;
  current_count:=jsonb_array_length(current_source#>'{regularProjection,recipients}');
  for p in select value from jsonb_array_elements(current_source->'optionalPools')loop current_count:=current_count+jsonb_array_length(p->'rows');end loop;
  if new.recipient_count is distinct from current_count then raise exception'optional_final_recipient_count_changed';end if;
 elsif tg_table_name='multi_event_joint_finals_v1'then
  if exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=new.tournament_id)then raise exception'optional_final_award_liability_exists';end if;
 elsif exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=new.tournament_id and event_id=new.event_id)then raise exception'optional_final_award_liability_exists';end if;
 return new;
end$$;
do $$declare n text;begin foreach n in array array['native_optional_final_award_sets_v2','native_playoff_final_award_sets_v1','standard_singles_settlement_final_versions','event_settlement_finals_v2','q_accounting_finals_v6','no_q_accounting_finals_v7','prize_accounting_finals_v8','prize_accounting_finals_v9','multi_event_unpaid_finals_v1','multi_event_joint_finals_v1']loop
 execute format('create trigger aa_optional_final_liability_v2 before insert on app.%I for each row execute function app.guard_native_optional_final_liability_v2()',n);
end loop;end$$;
create function app.guard_native_optional_financial_source_open_v2()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'optional_final_isolation_not_supported';end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=new.tournament_id and event_id=new.event_id)then raise exception'optional_financial_source_already_finalized';end if;
 return new;
end$$;
do $$declare n text;begin foreach n in array array['native_optional_pool_ownership_revisions_v2','native_optional_finance_revisions_v2','native_optional_finance_source_adoptions_v2','native_optional_fund_reviews_v2']loop
 execute format('create trigger aa_optional_source_open_v2 before insert on app.%I for each row execute function app.guard_native_optional_financial_source_open_v2()',n);
end loop;end$$;

create function app.record_native_optional_final_awards_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare prior app.native_optional_final_operations_v2%rowtype;source_value jsonb;fund jsonb;regular jsonb;p jsonb;r jsonb;g jsonb;
 h text;result_value jsonb;award_id uuid:=extensions.gen_random_uuid();total numeric;count_rows integer;pool_key text;participant_row app.event_participants%rowtype;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null or op is null then return null;end if;
 if app.native_optional_final_awards_enabled_v2()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>10
  or not(request?&array['kind','expectedVersion','fundReviewId','fundReviewVersion','sourceDigest','proposalRevisionId','ownershipRevisionId','recipientSourceDigest','reviewed','reason'])
  or request->>'kind'is distinct from'native-optional-final-awards-v2'or request->'expectedVersion'is distinct from'0'::jsonb or request->'reviewed'is distinct from'true'::jsonb
  or jsonb_typeof(request->'fundReviewVersion')is distinct from'number'or coalesce(request->>'fundReviewVersion','')!~'^[1-9][0-9]{0,9}$'or(request->>'fundReviewVersion')::numeric>2147483647
  or coalesce(request->>'fundReviewId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or coalesce(request->>'proposalRevisionId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
  or coalesce(request->>'ownershipRevisionId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or coalesce(request->>'sourceDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'recipientSourceDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'is distinct from app.custom_payout_classification_text_v2(request->>'reason')or app.event_settings_js_text_length_v3(request->>'reason')not between 1 and 2000
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-final-awards-v2',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.native_optional_final_operations_v2 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid or prior.request_payload is distinct from request or prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select result into result_value from app.native_optional_final_outcomes_v2 where actor_id=actor and operation_id=op;
  return coalesce(result_value,jsonb_build_object('status','retry_exact','code','operation_incomplete'));
 end if;
 source_value:=app.native_optional_final_award_source_v2(actor,tid,eid);
 if source_value->>'status'='retry_exact'then return source_value;end if;
 if source_value is null or source_value->>'status'is distinct from'source_available'then return jsonb_build_object('status','rejected','code',coalesce(source_value->>'code','source_unavailable'));end if;
 if source_value->>'sourceDigest'is distinct from request->>'sourceDigest'or source_value#>>'{fundReview,id}'is distinct from request->>'fundReviewId'
  or source_value#>>'{fundReview,version}'is distinct from request->>'fundReviewVersion'or source_value#>>'{fundSource,proposalRevisionId}'is distinct from request->>'proposalRevisionId'
  or source_value#>>'{fundSource,ownershipRevisionId}'is distinct from request->>'ownershipRevisionId'or source_value#>>'{fundSource,recipientSource,sourceDigest}'is distinct from request->>'recipientSourceDigest'
 then return jsonb_build_object('status','rejected','code','source_changed');end if;
 fund:=source_value#>'{fundSource,funds}';regular:=source_value->'regularProjection';
 total:=(fund->>'regularFundMinor')::numeric+(fund->>'qFundMinor')::numeric+(fund->>'sideFundMinor')::numeric;
 if total<0 or total>9007199254740991 or total+(fund->>'regularCostMinor')::numeric is distinct from(fund->>'recordedReceiptsMinor')::numeric then return jsonb_build_object('status','rejected','code','nonconserving_awards');end if;
 count_rows:=jsonb_array_length(regular->'recipients');for p in select value from jsonb_array_elements(source_value->'optionalPools')loop count_rows:=count_rows+jsonb_array_length(p->'rows');end loop;
 if count_rows<1 or count_rows>10000 then return jsonb_build_object('status','rejected','code','technical_resource_bound');end if;
 insert into app.native_optional_final_operations_v2(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)values(actor,op,tid,eid,request,h);
 insert into app.native_optional_final_award_sets_v2(id,tournament_id,event_id,version,fund_review_id,proposal_revision_id,ownership_revision_id,qualification_id,source_digest,source_capture,regular_minor,q_minor,side_minor,total_minor,recipient_count,actor_id,operation_id,reason)
 values(award_id,tid,eid,1,(request->>'fundReviewId')::uuid,(request->>'proposalRevisionId')::uuid,(request->>'ownershipRevisionId')::uuid,
  (source_value#>>'{fundSource,recipientSource,playoff,qualificationResultVersionId}')::uuid,source_value->>'sourceDigest',source_value,
  (fund->>'regularFundMinor')::bigint,(fund->>'qFundMinor')::bigint,(fund->>'sideFundMinor')::bigint,total::bigint,count_rows,actor,op,request->>'reason');
 for g in select value from jsonb_array_elements(regular->'groups')loop
  insert into app.native_optional_final_regular_groups_v2(award_set_id,tournament_id,event_id,first_place,last_place,people,included,per_person_minor,group_total_minor)
  values(award_id,tid,eid,(g->>'firstPlace')::integer,(g->>'lastPlace')::integer,(g->>'people')::integer,(g->>'included')::boolean,(g->>'perPersonMinor')::bigint,(g->>'groupTotalMinor')::bigint);
 end loop;
 for r in select value from jsonb_array_elements(regular->'recipients')loop
  insert into app.native_optional_final_recipients_v2(award_set_id,tournament_id,event_id,fund_key,pool_kind,participant_id,profile_id,display_name,amount_minor,first_place,last_place,source_row)
  values(award_id,tid,eid,'regular','regular',(r->>'participantId')::uuid,(r->>'profileId')::uuid,r->>'displayName',(r->>'amountMinor')::bigint,(r->>'firstPlace')::integer,(r->>'lastPlace')::integer,r);
 end loop;
 for p in select value from jsonb_array_elements(source_value->'optionalPools')loop
  pool_key:=(p->>'kind')||':'||(p->>'poolId');
  insert into app.native_optional_final_pools_v2(award_set_id,tournament_id,event_id,fund_key,pool_kind,q_pool_version_id,side_pool_id,q_review_id,side_review_id,source_digest,fund_minor,source_rows)
  values(award_id,tid,eid,pool_key,p->>'kind',case when p->>'kind'='q'then(p->>'poolId')::uuid end,case when p->>'kind'='side'then(p->>'poolId')::uuid end,
   case when p->>'kind'='q'then(p->>'reviewId')::uuid end,case when p->>'kind'='side'then(p->>'reviewId')::uuid end,p->>'sourceDigest',(p->>'fundMinor')::bigint,p->'rows');
  for r in select value from jsonb_array_elements(p->'rows')loop
   select*into strict participant_row from app.event_participants ep where ep.id=(r->>'participantId')::uuid and ep.event_id=eid and ep.tournament_id=tid;
   insert into app.native_optional_final_recipients_v2(award_set_id,tournament_id,event_id,fund_key,pool_kind,participant_id,profile_id,display_name,amount_minor,source_row)
   values(award_id,tid,eid,pool_key,p->>'kind',participant_row.id,participant_row.profile_id,r->>'displayName',(r->>'amountMinor')::bigint,r);
  end loop;
 end loop;
 if(select coalesce(sum(amount_minor),0)from app.native_optional_final_recipients_v2 where award_set_id=award_id)<>total
  or(select count(*)from app.native_optional_final_recipients_v2 where award_set_id=award_id)<>count_rows
  or exists(select 1 from app.native_optional_final_pools_v2 pool where pool.award_set_id=award_id and pool.fund_minor<>(select coalesce(sum(rec.amount_minor),0)from app.native_optional_final_recipients_v2 rec where rec.award_set_id=pool.award_set_id and rec.fund_key=pool.fund_key))
 then raise exception'optional_final_award_write_inconsistent';end if;
 result_value:=jsonb_build_object('status','optional_final_awards_recorded_v2','awardSetId',award_id,'version',1,'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'sourceDigest',source_value->>'sourceDigest',
  'regularMinor',fund->'regularFundMinor','qMinor',fund->'qFundMinor','sideMinor',fund->'sideFundMinor','totalMinor',total::bigint,'recipientCount',count_rows,'awardStatus','recorded_unpaid','moneyMoved',false,'payoutAuthorized',false,'disbursementAuthorized',false,'finalizationAuthorized',false);
 insert into app.native_optional_final_outcomes_v2(actor_id,operation_id,tournament_id,event_id,result)values(actor,op,tid,eid,result_value);return result_value;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');end$$;

create function app.get_native_optional_final_award_record_v2(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$declare record_row app.native_optional_final_award_sets_v2%rowtype;groups jsonb;pools jsonb;recipients jsonb;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 select*into record_row from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid;if not found then return null;end if;
 select coalesce(jsonb_agg(to_jsonb(x)order by x.first_place),'[]')into groups from app.native_optional_final_regular_groups_v2 x where x.award_set_id=record_row.id;
 select coalesce(jsonb_agg(to_jsonb(x)order by x.fund_key),'[]')into pools from app.native_optional_final_pools_v2 x where x.award_set_id=record_row.id;
 select coalesce(jsonb_agg(to_jsonb(x)order by x.fund_key,x.participant_id),'[]')into recipients from app.native_optional_final_recipients_v2 x where x.award_set_id=record_row.id;
 return jsonb_build_object('kind','native-optional-final-award-record-v2','awardSet',to_jsonb(record_row),'regularGroups',groups,'optionalPools',pools,'recipients',recipients,'historicalRecord',true,'currentFundAuthority',false,'moneyMoved',false,'payoutAuthorized',false,'disbursementAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function app.reconcile_native_optional_final_awards_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$declare prior app.native_optional_final_operations_v2%rowtype;r jsonb;h text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into prior from app.native_optional_final_operations_v2 where actor_id=actor and operation_id=op;if not found then return jsonb_build_object('status','unknown','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op);end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-final-awards-v2',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid or prior.request_payload is distinct from request or prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select result into r from app.native_optional_final_outcomes_v2 where actor_id=actor and operation_id=op;if not found then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
 return jsonb_build_object('status','historical_operation','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',prior.request_payload,'result',r,'currentFundAuthority',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

do $$declare signature text;begin foreach signature in array array[
 'app.native_optional_final_awards_enabled_v2()','app.native_optional_final_award_source_v2(uuid,uuid,uuid)',
 'app.guard_native_optional_final_liability_v2()','app.guard_native_optional_financial_source_open_v2()',
 'app.record_native_optional_final_awards_v2(uuid,uuid,uuid,uuid,jsonb)','app.get_native_optional_final_award_record_v2(uuid,uuid,uuid)',
 'app.reconcile_native_optional_final_awards_v2(uuid,uuid,uuid,uuid,jsonb)'
]loop execute format('alter function %s owner to postgres',signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);end loop;end$$;
commit;
