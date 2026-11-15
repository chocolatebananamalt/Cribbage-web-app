-- UNEXECUTED LOCAL SOURCE CANDIDATE. All gates false, EXECUTE revoked.
-- Requires current large-field provenance and existing V2 proposal/fund readers.
begin;
create function app.modern_prize_awards_enabled_v2()returns boolean language sql stable set search_path=''as $gate$select false$gate$;
create function app.current_native_prize_fund_v2(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare c jsonb;r jsonb;body jsonb;begin
 if app.modern_prize_awards_enabled_v2()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 c:=app.get_native_recorded_fund_review_source_v1(tid,eid);if c->>'status'='retry_exact'then return c;end if;
 if c->>'status'is distinct from'review_source_available'then return jsonb_build_object('status','blocked','code','fund_source_unavailable');end if;
 r:=c->'latestReview';
 if r is null or r='null'::jsonb or r->'proposalRevisionId'is distinct from c->'proposalRevisionId'or r->'nativeAllocationRevisionId'is distinct from c->'nativeAllocationRevisionId'
  or r->'incomeHeadVersion'is distinct from c#>'{income,headVersion}'or r->'incomeHeadDigest'is distinct from c#>'{income,headDigest}'or r->'reviewStatus'is distinct from c#>'{income,suggestedStatus}'
  or r->'recipientSourceDigest'is distinct from c#>'{recipientSource,sourceDigest}'or r->'sanctioningSnapshotId'is distinct from c#>'{sanctioning,snapshotId}'then return jsonb_build_object('status','blocked','code','fund_review_stale');end if;
 if c#>'{sanctioning,totalMinor}'='0'::jsonb then
  if r->'sanctioningExpenseEventId'is distinct from'null'::jsonb or r->'sanctioningAllocatedMinor'is distinct from'0'::jsonb then return jsonb_build_object('status','blocked','code','fund_fee_review_stale');end if;
 elsif not exists(select 1 from jsonb_array_elements(c#>'{sanctioning,candidates}')x where x->'expenseSourceId'=r->'sanctioningExpenseEventId'and x->'allocatedExpenseMinor'=r->'sanctioningAllocatedMinor')then return jsonb_build_object('status','blocked','code','fund_fee_review_stale');end if;
 body:=jsonb_build_object('kind','current-native-prize-fund-v2','status','source_available','actorId',auth.uid(),'tournamentId',tid,'eventId',eid,'capture',c,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 return body||jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(jsonb_build_array('current-native-prize-fund-v2',body)::text,'utf8'),'sha256'),'hex'));
end$body$;

-- The modern source keeps both prior fund review and new prize policy captures.
-- Only methods whose final-field/fee conditions are unambiguous are recordable.
create function app.current_modern_prize_award_source_v2(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare f jsonb;w jsonb;c jsonb;n jsonb;raw jsonb;input jsonb;b jsonb;plan jsonb;draft jsonb;head jsonb;players jsonb;matches jsonb;nodes jsonb;node jsonb;g jsonb;p jsonb;m jsonb;ov jsonb;body jsonb;fee_source jsonb:='null';fee numeric;fee_choice text;first_round_paid boolean:=false;
 q integer;paid integer;requested integer;first_place integer:=1;last_place integer;unit integer;people integer;rounds integer;r integer;pf integer;pl integer;winner text;loser text;method text;
 fund numeric;amount numeric;total numeric:=0;groups jsonb:='[]';recipients jsonb:='[]';bands jsonb:='[]';factor_num numeric:=1;factor_den numeric:=1;weight numeric;denominator numeric:=0;factor_text text;dot_at integer;band_count integer:=0;idx integer;
 begin
 f:=app.current_native_prize_fund_v2(tid,eid);if f->>'status'='retry_exact'then return f;end if;if f->>'status'is distinct from'source_available'then return f;end if;
 w:=app.get_playoff_prize_proposal_workspace_v2(tid,eid);
 if w->>'kind'is distinct from'playoff-prize-proposal-workspace-v2'or w->'stale'is distinct from'false'::jsonb or w->'head'='null'::jsonb then return jsonb_build_object('status','blocked','code','current_prize_proposal_required');end if;
 head:=w->'head';c:=f->'capture';n:=c->'recipientSource';raw:=n#>'{nativeFinanceSource,raw}';input:=w#>'{nativeSource,capture,input}';b:=w#>'{nativeSource,capture}';
 if b->'bindingId'is distinct from raw#>'{binding,bindingId}'or b->'activationId'is distinct from raw#>'{binding,activationId}'or b->'setupEventVersionId'is distinct from raw#>'{binding,setupEventVersionId}'or b->'contextReviewId'is distinct from raw#>'{binding,reviewId}'
  or input#>'{binding,settingsSnapshotId}'is distinct from raw#>'{binding,settingsSnapshotId}'or input#>'{binding,eventKind}'is distinct from raw#>'{event,eventKind}'
  or input#>'{ledger,allocationRevisionId}'is distinct from raw#>'{allocation,revisionId}'or input#>'{ledger,current,sourceVersion}'is distinct from raw#>'{allocation,version}'or input#>'{ledger,current,sourceDigest}'is distinct from raw#>'{allocation,sourceDigest}'
  or input#>'{qualification,currentResultVersionId}'is distinct from n#>'{proposal,qualificationResultVersionId}'then return jsonb_build_object('status','blocked','code','prize_fund_binding_changed');end if;
 if(select jsonb_agg(x order by x::text)from jsonb_array_elements(input#>'{ledger,current,sources}')x)is distinct from(select jsonb_agg(x order by x::text)from jsonb_array_elements(raw#>'{allocation,eventSources}')x)
  or(select jsonb_agg(jsonb_build_array(x->'participantId',x->'qualificationRank')order by x->>'participantId')from jsonb_array_elements(input#>'{qualification,result,qualifiers}')x)is distinct from(select jsonb_agg(jsonb_build_array(x->'participantId',x->'seed')order by x->>'participantId')from jsonb_array_elements(n#>'{playoff,players}')x)then return jsonb_build_object('status','blocked','code','prize_fund_evidence_changed');end if;
 -- Current fund capture already proves full income lineage and reviewed heads.
 -- Compare allocation-only baseline + separately recorded income exactly once.
 if (select coalesce(sum(case income_parts.value->>'bucket'when'regular_entry'then(income_parts.value->>'amountMinor')::numeric when'player_benefit'then-(income_parts.value->>'amountMinor')::numeric when'operating_expense'then-(income_parts.value->>'amountMinor')::numeric else 0 end),0)
 from jsonb_array_elements(input#>'{ledger,current,sources}')income_sources(value) cross join lateral jsonb_array_elements(income_sources.value->'allocations')income_parts(value)
 where income_sources.value->>'state'='active'and income_parts.value->>'eventId'=eid::text)+(c#>>'{income,activeMinor}')::numeric
 is distinct from(c#>>'{totals,recordedFundMinor}')::numeric then return jsonb_build_object('status','blocked','code','latest_income_or_fund_coverage_unsupported');end if;
 q:=(n#>>'{playoff,qualifierCount}')::integer;nodes:=app.playoff_series_chart_slots_v2(q);if nodes is null then return jsonb_build_object('status','blocked','code','unsupported_field');end if;
 select x into plan from jsonb_array_elements(input#>'{prizeSource,snapshot,plans}')x where x->'eventClientRowId'=input#>'{binding,eventClientRowId}'and x->'eventKind'=input#>'{binding,eventKind}'and x->>'mode'='proposed_v2';draft:=plan->'draft';method:=draft->>'method';
 if method not in('equal','winner-takes-all','graduated','winner-multiplier')or method is null then return jsonb_build_object('status','blocked','code','modern_method_final_evidence_required');end if;
 unit:=case draft#>>'{rounding,regular}'when'1'then 100 when'5'then 500 when'10'then 1000 else null end;if unit is null then return jsonb_build_object('status','blocked','code','saved_rounding_required');end if;
 requested:=case when method='winner-takes-all'then 1 when draft->>'recipients'='all'then q when draft->>'recipients'~'^top-(2|4|8|16|32|64|128)$'then split_part(draft->>'recipients','-',2)::integer else null end;
 if requested is null or requested<1 or requested>q then return jsonb_build_object('status','blocked','code','paid_place_policy_unresolved');end if;
 while first_place<=q loop last_place:=least(q,case when first_place=1 then 1 else(first_place-1)*2 end);if requested between first_place and last_place then paid:=last_place;exit;end if;first_place:=case when first_place=1 then 2 else first_place*2-1 end;end loop;
 -- Completed native chart establishes the actual first-round loser cohort.
 -- The private collector rechecks current obligation/receipt heads under locks.
 -- Its entire capture is pinned in the source hash and recomputed by the writer.
 rounds:=(nodes->(jsonb_array_length(nodes)-1)->>'roundNumber')::integer;
 first_round_paid:=method in('graduated','winner-multiplier')and paid>=power(2,rounds-1)::integer+1;
 if first_round_paid then
  fee_source:=app.get_current_common_entry_fee_source_v1(tid,eid);
  if fee_source->>'status'='retry_exact'then return fee_source;end if;
  if fee_source->>'kind'is distinct from'current-common-entry-fee-source-v1'or fee_source->>'status'is distinct from'source_available'then return jsonb_build_object('status','blocked','code','verified_entry_fee_reference_required');end if;
  if fee_source->'fundSource'is distinct from f then return jsonb_build_object('status','blocked','code','entry_fee_source_changed');end if;
  fee:=(fee_source#>>'{evidence,advertisedFeeMinor}')::numeric;fee_choice:=draft->>'firstRoundComparison';
  if fee_choice is null or fee_choice not in('less','equal','more')then return jsonb_build_object('status','blocked','code','first_round_intention_review_required');end if;
  if fee_choice='equal'and mod(fee,unit)<>0 then return jsonb_build_object('status','blocked','code','entry_fee_rounding_incompatible');end if;
 end if;
 if method in('graduated','winner-multiplier')then
  factor_text:=case when method='graduated'then draft->>'incrementFactorText'else draft->>'winnerMultiplierText'end;
  if factor_text is null or length(factor_text)>16 or factor_text!~'^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$'then return jsonb_build_object('status','blocked','code','invalid_saved_factor');end if;
  dot_at:=strpos(factor_text,'.');factor_den:=case when dot_at=0 then 1 else power(10,length(factor_text)-dot_at)end;factor_num:=replace(factor_text,'.','')::numeric;
  if factor_num<factor_den or factor_num>1000*factor_den then return jsonb_build_object('status','blocked','code','invalid_saved_factor');end if;
 end if;
 if app.valid_playoff_prize_proposal_history_v2(input,head->'overrideHistory')is distinct from true then return jsonb_build_object('status','blocked','code','invalid_override_history');end if;
 fund:=(c#>>'{totals,recordedFundMinor}')::numeric;
 first_place:=1;while first_place<=q loop
  last_place:=least(q,case when first_place=1 then 1 else(first_place-1)*2 end);people:=last_place-first_place+1;
  bands:=bands||jsonb_build_array(jsonb_build_object('firstPlace',first_place,'lastPlace',last_place,'people',people));if last_place<=paid then band_count:=band_count+1;end if;
  first_place:=case when first_place=1 then 2 else first_place*2-1 end;
 end loop;
 for idx in 0..band_count-1 loop
  weight:=case when method='graduated'then power(factor_num,band_count-1-idx)*power(factor_den,idx)when method='winner-multiplier'then case when idx=0 then factor_num else factor_den end else 1 end;
  denominator:=denominator+weight*(bands->idx->>'people')::integer;
 end loop;
 for idx in 0..jsonb_array_length(bands)-1 loop
  first_place:=(bands->idx->>'firstPlace')::integer;last_place:=(bands->idx->>'lastPlace')::integer;people:=(bands->idx->>'people')::integer;
  if last_place<=paid then
   weight:=case when method='graduated'then power(factor_num,band_count-1-idx)*power(factor_den,idx)when method='winner-multiplier'then case when idx=0 then factor_num else factor_den end else 1 end;
   amount:=div(fund*weight*2+denominator*unit,denominator*unit*2)*unit;
   select x into ov from jsonb_array_elements(head->'overrideHistory')with ordinality a(x,ord)where(x->>'firstPlace')::integer=first_place and(x->>'lastPlace')::integer=last_place order by ord desc limit 1;
   if ov is not null and ov->'voided'='false'::jsonb then
    if method='graduated'then amount:=(ov->>'perPersonMinor')::numeric;
    elsif(ov->>'perPersonMinor')::numeric<>amount then return jsonb_build_object('status','blocked','code','manual_method_review_required');end if;
   end if;
   if amount<=0 or amount>9007199254740991 or mod(amount,unit)<>0 then return jsonb_build_object('status','blocked','code','invalid_group_award');end if;
   if idx>0 and amount>(groups->(idx-1)->>'perPersonMinor')::numeric then return jsonb_build_object('status','blocked','code','rank_order_violation');end if;
   total:=total+amount*people;
  else amount:=0;end if;
  groups:=groups||jsonb_build_array(jsonb_build_object('firstPlace',first_place,'lastPlace',last_place,'people',people,'included',last_place<=paid,'perPersonMinor',amount::bigint,'groupTotalMinor',(amount*people)::bigint));
 end loop;
 if total<>fund then return jsonb_build_object('status','blocked','code','fund_imbalance');end if;
 if first_round_paid then
  select x into g from jsonb_array_elements(groups)x where(x->>'lastPlace')::integer=q;
  amount:=(g->>'perPersonMinor')::numeric;
  if g->'included'is distinct from'true'::jsonb or (case fee_choice when'less'then amount>=fee when'equal'then amount<>fee when'more'then amount<=fee else true end) then
   return jsonb_build_object('status','blocked','code','first_round_intention_not_satisfied');end if;
 end if;
 players:=n#>'{playoff,players}';matches:=n#>'{playoff,matches}';rounds:=(nodes->(jsonb_array_length(nodes)-1)->>'roundNumber')::integer;
 select x#>>'{result,winnerId}'into winner from jsonb_array_elements(matches)x where(x->>'slot')::integer=q-1;
 for p in select value from jsonb_array_elements(players)loop
  pf:=null;pl:=null;
  if p->>'participantId'=winner then pf:=1;pl:=1;else
   for m in select value from jsonb_array_elements(matches)loop
    if m#>>'{result,loserId}'=p->>'participantId'then node:=nodes->((m->>'slot')::integer-1);r:=(node->>'roundNumber')::integer;pf:=power(2,rounds-r)::integer+1;pl:=least(q,power(2,rounds-r+1)::integer);end if;
   end loop;
  end if;
  select x into g from jsonb_array_elements(groups)x where(x->>'firstPlace')::integer=pf and(x->>'lastPlace')::integer=pl;
  if g is null then return jsonb_build_object('status','blocked','code','recipient_group_unavailable');end if;
  recipients:=recipients||jsonb_build_array(jsonb_build_object('participantId',p->'participantId','profileId',p->'profileId','displayName',p->'displayName','tournamentPlayerId',p->'tournamentPlayerId','firstPlace',pf,'lastPlace',pl,'included',g->'included','amountMinor',g->'perPersonMinor'));
 end loop;
 if jsonb_array_length(recipients)<>q or(select count(distinct x->>'participantId')from jsonb_array_elements(recipients)x)<>q or(select sum((x->>'amountMinor')::numeric)from jsonb_array_elements(recipients)x)<>fund then return jsonb_build_object('status','blocked','code','recipient_reconciliation_failed');end if;
 body:=jsonb_build_object('kind','modern-prize-award-source-v2','actorId',auth.uid(),'tournamentId',tid,'eventId',eid,'fundSource',f,'prizeWorkspace',w,'entryFeeSource',fee_source,'plan',draft,'roundingUnitMinor',unit,'groups',groups,'recipients',recipients,'totalMinor',fund::bigint,'directorReviewRequired',true,'moneyMoved',false,'payoutAuthorized',false);
 return body||jsonb_build_object('status','source_available','sourceDigest',encode(extensions.digest(convert_to(jsonb_build_array('modern-prize-award-source-v2',body)::text,'utf8'),'sha256'),'hex'));
 exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');when invalid_text_representation or numeric_value_out_of_range or division_by_zero then return jsonb_build_object('status','blocked','code','source_invalid');end$body$;

create table app.modern_prize_award_operations_v2(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,request jsonb not null,request_hash text not null,
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('modern-prize-award-request-v2',actor_id,tournament_id,event_id,operation_id,request)::text,'utf8'),'sha256'),'hex'))
);
create table app.modern_prize_award_sets_v2(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,actor_id uuid not null,operation_id uuid not null,
 prize_revision_id uuid not null,fund_review_id uuid not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),source_capture jsonb not null,
 plan jsonb not null,rounding_unit_minor integer not null check(rounding_unit_minor in(100,500,1000)),total_minor bigint not null check(total_minor>0 and total_minor<=9007199254740991),recipient_count integer not null check(recipient_count between 4 and 64),
 reason text not null,recorded_at timestamptz not null default clock_timestamp(),status text not null default'recorded_unpaid'check(status='recorded_unpaid'),
 unique(tournament_id,event_id),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(prize_revision_id,tournament_id,event_id)references app.playoff_prize_proposal_revisions_v2(id,tournament_id,event_id),
 foreign key(fund_review_id,tournament_id,event_id)references app.native_recorded_fund_reviews_v1(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.modern_prize_award_operations_v2(actor_id,operation_id,tournament_id,event_id),
 check(source_capture->>'sourceDigest'=source_digest),check(source_capture->'plan'=plan),check((source_capture->>'roundingUnitMinor')::integer=rounding_unit_minor),check((source_capture->>'totalMinor')::bigint=total_minor)
);
create table app.modern_prize_award_groups_v2(
 award_set_id uuid not null,tournament_id uuid not null,event_id uuid not null,first_place integer not null,last_place integer not null,people integer not null,included boolean not null,
 per_person_minor bigint not null,group_total_minor bigint not null,rounding_unit_minor integer not null check(rounding_unit_minor in(100,500,1000)),
 primary key(award_set_id,first_place),foreign key(award_set_id,tournament_id,event_id)references app.modern_prize_award_sets_v2(id,tournament_id,event_id),
 check(first_place>=1 and last_place>=first_place and last_place<=64 and people=last_place-first_place+1),check((included and per_person_minor>0 and per_person_minor%rounding_unit_minor=0 and group_total_minor=per_person_minor*people)or(not included and per_person_minor=0 and group_total_minor=0))
);
create table app.modern_prize_award_recipients_v2(
 award_set_id uuid not null,tournament_id uuid not null,event_id uuid not null,participant_id uuid not null,profile_id uuid not null,display_name text not null,tournament_player_id text not null,
 first_place integer not null,last_place integer not null,included boolean not null,amount_minor bigint not null,rounding_unit_minor integer not null check(rounding_unit_minor in(100,500,1000)),
 primary key(award_set_id,participant_id),foreign key(award_set_id,tournament_id,event_id)references app.modern_prize_award_sets_v2(id,tournament_id,event_id),
 foreign key(participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 check((included and amount_minor>0 and amount_minor%rounding_unit_minor=0)or(not included and amount_minor=0))
);
create table app.modern_prize_award_outcomes_v2(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,result jsonb not null,
 primary key(actor_id,operation_id),foreign key(actor_id,operation_id,tournament_id,event_id)references app.modern_prize_award_operations_v2(actor_id,operation_id,tournament_id,event_id)
);
do $security$declare t text;begin foreach t in array array['modern_prize_award_operations_v2','modern_prize_award_sets_v2','modern_prize_award_groups_v2','modern_prize_award_recipients_v2','modern_prize_award_outcomes_v2']loop
 execute format('alter table app.%I owner to postgres',t);execute format('alter table app.%I enable row level security',t);execute format('alter table app.%I force row level security',t);execute format('revoke all on app.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',t);
 execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',t);
end loop;end$security$;

-- Reciprocal insert guards serialize on the same tournament lock. Joint legacy
-- finals collide tournament-wide, all other final records collide by event.
create function app.guard_modern_prize_award_liability_v2()returns trigger language plpgsql security definer set search_path=''set timezone='UTC'as $body$
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'modern_award_isolation_unsupported';end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if tg_table_name='modern_prize_award_sets_v2'then
  if app.legacy_financial_liability_exists_v1(new.tournament_id,new.event_id)is distinct from false or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=new.tournament_id and event_id=new.event_id)or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=new.tournament_id and event_id=new.event_id)then raise exception'modern_award_existing_liability';end if;
 elsif tg_table_name='multi_event_joint_finals_v1'then
  if exists(select 1 from app.modern_prize_award_sets_v2 where tournament_id=new.tournament_id)then raise exception'modern_award_existing_liability';end if;
 elsif exists(select 1 from app.modern_prize_award_sets_v2 where tournament_id=new.tournament_id and event_id=new.event_id)then raise exception'modern_award_existing_liability';end if;
 return new;end$body$;
do $guards$declare t text;begin foreach t in array array['modern_prize_award_sets_v2','native_playoff_final_award_sets_v1','native_optional_final_award_sets_v2','standard_singles_settlement_final_versions','event_settlement_finals_v2','q_accounting_finals_v6','no_q_accounting_finals_v7','prize_accounting_finals_v8','prize_accounting_finals_v9','multi_event_unpaid_finals_v1','multi_event_joint_finals_v1','native_recorded_fund_reviews_v1','native_unrestricted_income_records_v1','operational_event_finance_revisions_v1','playoff_prize_proposal_revisions_v2','playoff_series_generations_v1']loop
 execute format('create trigger zz_modern_award_guard_v2 before insert on app.%I for each row execute function app.guard_modern_prize_award_liability_v2()',t);
end loop;end$guards$;

create function app.record_modern_prize_awards_v2(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare actor uuid:=auth.uid();h text;prior app.modern_prize_award_operations_v2%rowtype;s jsonb;award uuid;g jsonb;r jsonb;unit integer;response jsonb;begin
 if actor is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if app.modern_prize_awards_enabled_v2()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_unsupported');end if;
 if tid is null or eid is null or op is null or (case when jsonb_typeof(request)='object'then(select count(*)from jsonb_object_keys(request))<>5 or not(request?&array['expectedSourceDigest','expectedPrizeRevisionId','expectedFundReviewId','reason','reviewed'])else true end)or request->'reviewed'is distinct from'true'::jsonb
  or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'expectedPrizeRevisionId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or coalesce(request->>'expectedFundReviewId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'is distinct from app.custom_payout_classification_text_v2(request->>'reason')or app.event_settings_js_text_length_v3(request->>'reason')not between 1 and 2000 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('modern-prize-v2:'||actor||':'||op,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for key share nowait;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('modern-prize-award-request-v2',actor,tid,eid,op,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.modern_prize_award_operations_v2 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id<>tid or prior.event_id<>eid or prior.request<>request or prior.request_hash<>h then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  select result into response from app.modern_prize_award_outcomes_v2 where actor_id=actor and operation_id=op;return coalesce(response,jsonb_build_object('status','retry_exact','code','operation_incomplete'));end if;
 if exists(select 1 from app.modern_prize_award_sets_v2 where tournament_id=tid and event_id=eid)or app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','existing_awards');end if;
 s:=app.current_modern_prize_award_source_v2(tid,eid);if s->>'status'='retry_exact'then return s;end if;
 if s->>'status'is distinct from'source_available'then return jsonb_build_object('status','rejected','code',coalesce(s->>'code','source_unavailable'));end if;
 if s->'sourceDigest'is distinct from request->'expectedSourceDigest'or s#>'{prizeWorkspace,head,revisionId}'is distinct from request->'expectedPrizeRevisionId'or s#>'{fundSource,capture,latestReview,reviewId}'is distinct from request->'expectedFundReviewId'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 unit:=(s->>'roundingUnitMinor')::integer;
 insert into app.modern_prize_award_operations_v2 values(actor,op,tid,eid,request,h);
 insert into app.modern_prize_award_sets_v2(tournament_id,event_id,actor_id,operation_id,prize_revision_id,fund_review_id,source_digest,source_capture,plan,rounding_unit_minor,total_minor,recipient_count,reason)
 values(tid,eid,actor,op,(request->>'expectedPrizeRevisionId')::uuid,(request->>'expectedFundReviewId')::uuid,s->>'sourceDigest',s,s->'plan',unit,(s->>'totalMinor')::bigint,jsonb_array_length(s->'recipients'),request->>'reason')returning id into award;
 for g in select value from jsonb_array_elements(s->'groups')loop insert into app.modern_prize_award_groups_v2 values(award,tid,eid,(g->>'firstPlace')::integer,(g->>'lastPlace')::integer,(g->>'people')::integer,(g->>'included')::boolean,(g->>'perPersonMinor')::bigint,(g->>'groupTotalMinor')::bigint,unit);end loop;
 for r in select value from jsonb_array_elements(s->'recipients')loop insert into app.modern_prize_award_recipients_v2 values(award,tid,eid,(r->>'participantId')::uuid,(r->>'profileId')::uuid,r->>'displayName',r->>'tournamentPlayerId',(r->>'firstPlace')::integer,(r->>'lastPlace')::integer,(r->>'included')::boolean,(r->>'amountMinor')::bigint,unit);end loop;
 if(select count(*)from app.modern_prize_award_groups_v2 where award_set_id=award)<>jsonb_array_length(s->'groups')or exists(select 1 from jsonb_array_elements(s->'recipients')x where not exists(select 1 from app.modern_prize_award_recipients_v2 y where y.award_set_id=award and y.participant_id::text=x->>'participantId'and y.profile_id::text=x->>'profileId'and y.display_name=x->>'displayName'and y.tournament_player_id=x->>'tournamentPlayerId'and y.first_place=(x->>'firstPlace')::integer and y.last_place=(x->>'lastPlace')::integer and y.included=(x->>'included')::boolean and y.amount_minor=(x->>'amountMinor')::bigint and y.rounding_unit_minor=unit))or exists(select 1 from jsonb_array_elements(s->'groups')x where not exists(select 1 from app.modern_prize_award_groups_v2 y where y.award_set_id=award and y.first_place=(x->>'firstPlace')::integer and y.last_place=(x->>'lastPlace')::integer and y.people=(x->>'people')::integer and y.included=(x->>'included')::boolean and y.per_person_minor=(x->>'perPersonMinor')::bigint and y.group_total_minor=(x->>'groupTotalMinor')::bigint and y.rounding_unit_minor=unit))or(select sum(amount_minor)from app.modern_prize_award_recipients_v2 where award_set_id=award)<>(s->>'totalMinor')::bigint or(select count(*)from app.modern_prize_award_recipients_v2 where award_set_id=award)<>jsonb_array_length(s->'recipients')or(select sum(group_total_minor)from app.modern_prize_award_groups_v2 where award_set_id=award)<>(s->>'totalMinor')::bigint then raise exception'modern_award_postcondition_failed';end if;
 response:=jsonb_build_object('actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'requestHash',h,'status','accepted','kind','modern-prize-award-receipt-v2','awardSetId',award,'sourceDigest',s->>'sourceDigest','prizeRevisionId',request->>'expectedPrizeRevisionId','fundReviewId',request->>'expectedFundReviewId','totalMinor',s->'totalMinor','recordedUnpaid',true,'historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false,'payoutAuthorized',false);
 insert into app.modern_prize_award_outcomes_v2 values(actor,op,tid,eid,response);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'modern_prize_awards_v2',award,'recorded_unpaid',response);
 return response;
 exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$body$;

do $functions$declare f text;begin foreach f in array array['app.modern_prize_awards_enabled_v2()','app.current_native_prize_fund_v2(uuid,uuid)','app.current_modern_prize_award_source_v2(uuid,uuid)','app.guard_modern_prize_award_liability_v2()','app.record_modern_prize_awards_v2(uuid,uuid,uuid,jsonb)']loop execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;end$functions$;
create function app.get_modern_prize_award_record_v2(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare a uuid:=auth.uid();s app.modern_prize_award_sets_v2%rowtype;groups jsonb;recipients jsonb;begin
 if a is null or app.modern_prize_awards_enabled_v2()is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_unsupported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for key share nowait;if not found then return null;end if;
 select*into s from app.modern_prize_award_sets_v2 where tournament_id=tid and event_id=eid;if not found then return null;end if;
 select jsonb_agg(jsonb_build_object('firstPlace',first_place,'lastPlace',last_place,'people',people,'included',included,'perPersonMinor',per_person_minor,'groupTotalMinor',group_total_minor)order by first_place)into groups from app.modern_prize_award_groups_v2 where award_set_id=s.id;
 select jsonb_agg(jsonb_build_object('participantId',participant_id,'profileId',profile_id,'displayName',display_name,'tournamentPlayerId',tournament_player_id,'firstPlace',first_place,'lastPlace',last_place,'included',included,'amountMinor',amount_minor)order by participant_id)into recipients from app.modern_prize_award_recipients_v2 where award_set_id=s.id;
 return jsonb_build_object('kind','modern-prize-award-record-v2','tournamentId',tid,'eventId',eid,'awardSetId',s.id,'recordedBy',s.actor_id,'recordedAt',s.recorded_at,'reason',s.reason,'prizeRevisionId',s.prize_revision_id,'fundReviewId',s.fund_review_id,'sourceDigest',s.source_digest,'sourceCapture',s.source_capture,'plan',s.plan,'roundingUnitMinor',s.rounding_unit_minor,'groups',groups,'recipients',recipients,'totalMinor',s.total_minor,'status','recorded_unpaid','historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false,'payoutAuthorized',false);
 exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$body$;
alter function app.get_modern_prize_award_record_v2(uuid,uuid)owner to postgres;
revoke all on function app.get_modern_prize_award_record_v2(uuid,uuid)from public,anon,authenticated,service_role;
-- Public RPC names for future normal-session transport; still revoked/off.
create function public.get_modern_prize_award_source_provider_v2(p_tid uuid,p_eid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $wrapper$begin if app.modern_prize_awards_enabled_v2()is distinct from true or app.require_operational_provider_official_v1(p_tid)is null then return null;end if;return app.current_modern_prize_award_source_v2(p_tid,p_eid);end$wrapper$;
create function public.get_modern_prize_award_record_provider_v2(p_tid uuid,p_eid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $wrapper$begin if app.modern_prize_awards_enabled_v2()is distinct from true or app.require_operational_provider_official_v1(p_tid)is null then return null;end if;return app.get_modern_prize_award_record_v2(p_tid,p_eid);end$wrapper$;
create function public.record_modern_prize_awards_provider_v2(p_tid uuid,p_eid uuid,p_operation_id uuid,p_request jsonb)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $wrapper$begin if app.modern_prize_awards_enabled_v2()is distinct from true or app.require_operational_provider_official_v1(p_tid)is null then return null;end if;return app.record_modern_prize_awards_v2(p_tid,p_eid,p_operation_id,p_request);end$wrapper$;
do $wrappers$declare f text;begin foreach f in array array['public.get_modern_prize_award_source_provider_v2(uuid,uuid)','public.get_modern_prize_award_record_provider_v2(uuid,uuid)','public.record_modern_prize_awards_provider_v2(uuid,uuid,uuid,jsonb)']loop execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;end$wrappers$;

commit;
