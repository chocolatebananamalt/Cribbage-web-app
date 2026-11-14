-- UNEXECUTED default-off read-only Results candidate. Existing writers untouched.
-- Requires native-optional-income-fund-v3 and its original V2 dependencies.
begin;
create function app.native_pool_award_results_enabled_v2()returns boolean language sql stable set search_path=''as $gate$select false$gate$;
-- V3 income also has its own post-final close. Fork ONLY that predicate for
-- this read chain; retain competing finals, history completeness and all locks.
do $income_copy$declare d text;p text;old text;begin
 d:=replace(pg_get_functiondef('app.native_optional_income_context_v2(uuid,uuid,uuid,boolean)'::regprocedure),E'\r\n',E'\n');
 old:=$income_anchor$ if exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_playoff_final_award_sets_v1$income_anchor$;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'pool_results_income_read_anchor_changed';end if;
 p:=replace(d,'FUNCTION app.native_optional_income_context_v2(','FUNCTION app.native_pool_results_income_context_v2(');
 if p=d then raise exception'pool_results_income_read_signature_changed';end if;
 execute replace(p,old,' if exists(select 1 from app.native_playoff_final_award_sets_v1');
 alter function app.native_pool_results_income_context_v2(uuid,uuid,uuid,boolean)owner to postgres;
 revoke all on function app.native_pool_results_income_context_v2(uuid,uuid,uuid,boolean)from public,anon,authenticated,service_role;
end$income_copy$;
-- Derive separate READ functions. Remove only the original function's own-final
-- presence check; preserve every permission, source lock and competing-liability
-- check. Never replace the original or allow a writer to call these variants.
do $copies$declare n text;d text;old text;changed text;begin
 old:=$anchor$ if to_regclass('app.native_optional_final_award_sets_v2')is not null then
  execute 'select exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=$1 and event_id=$2)'into optional_final_exists using tid,eid;
  if optional_final_exists then return jsonb_build_object('status','blocked','code','final_awards_already_recorded');end if;
 end if;$anchor$;
 foreach n in array array['v2','v3']loop
  d:=replace(pg_get_functiondef(to_regprocedure('app.native_optional_recorded_fund_source_'||n||'(uuid,uuid,uuid,uuid)')),E'\r\n',E'\n');
  if d is null or(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'pool_results_read_copy_anchor_changed';end if;
  changed:=replace(d,'FUNCTION app.native_optional_recorded_fund_source_'||n||'(','FUNCTION app.native_pool_results_fund_source_'||n||'(');
  if changed=d then raise exception'pool_results_read_copy_signature_changed';end if;
  if n='v3'then
   if(length(changed)-length(replace(changed,'app.native_optional_income_context_v2(actor,tid,eid,false)','')))/length('app.native_optional_income_context_v2(actor,tid,eid,false)')<>1 then raise exception'pool_results_v3_income_route_anchor_changed';end if;
   changed:=replace(changed,'app.native_optional_income_context_v2(actor,tid,eid,false)','app.native_pool_results_income_context_v2(actor,tid,eid,false)');
  end if;
  execute replace(changed,old,' -- Read-only Results may examine an already-recorded final.');
  execute format('alter function app.native_pool_results_fund_source_%s(uuid,uuid,uuid,uuid)owner to postgres',n);
  execute format('revoke all on function app.native_pool_results_fund_source_%s(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role',n);
 end loop;
end$copies$;
create function public.get_native_pool_award_results_provider_v2(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare a app.native_optional_final_award_sets_v2%rowtype;r app.native_optional_fund_reviews_v2%rowtype;current_fund jsonb;stored_fund jsonb;review_document jsonb;
 p record;rows jsonb;pools jsonb:='[]';total numeric:=0;projection_rows jsonb;label text;seating_id uuid;
begin
 if app.native_pool_award_results_enabled_v2()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 lock table app.native_optional_final_award_sets_v2,app.native_optional_final_pools_v2,app.native_optional_final_recipients_v2,app.native_optional_fund_reviews_v2,app.event_side_pool_definition_versions,
  app.event_participants,app.initial_seating_publications,app.initial_seating_assignments,app.operation_receipts in share mode nowait;
 select*into a from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid;
 if a.id is null then return jsonb_build_object('status','held','code','no_pool_award_record');end if;
 select*into r from app.native_optional_fund_reviews_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if r.id is distinct from a.fund_review_id then return jsonb_build_object('status','held','code','pool_fund_review_changed');end if;
 stored_fund:=a.source_capture->'fundSource';
 if stored_fund->>'kind'='native-optional-recorded-fund-source-v2'and r.income_head_version is null and r.income_head_digest is null and r.income_active_minor is null and r.review_status='reviewed_zero'then
  review_document:=to_jsonb(r)-array['income_head_version','income_head_digest','income_active_minor'];
  current_fund:=app.native_pool_results_fund_source_v2(actor,tid,eid,r.sanctioning_expense_event_id);
 elsif stored_fund->>'kind'='native-optional-recorded-fund-source-v3'and r.income_head_version is not null then
  review_document:=to_jsonb(r);
  current_fund:=app.native_pool_results_fund_source_v3(actor,tid,eid,r.sanctioning_expense_event_id);
 else return jsonb_build_object('status','held','code','unsupported_pool_fund_version');end if;
 if a.source_capture->'fundReview'is distinct from review_document then return jsonb_build_object('status','held','code','pool_fund_review_changed');end if;
 if current_fund->>'status'='retry_exact'then return current_fund;end if;
 if current_fund->>'status'is distinct from'source_available'or current_fund is distinct from stored_fund then return jsonb_build_object('status','held','code','pool_award_source_changed');end if;
 if current_fund->>'refundPolicy'is distinct from'no-pool-refunds-v1' then return jsonb_build_object('status','held','code','pool_refund_policy_unresolved');end if;
 select s.id into seating_id from app.initial_seating_publications s join app.operation_receipts o on o.id=s.operation_receipt_id and o.tournament_id=s.tournament_id and o.actor_profile_id=s.actor_profile_id
  where s.tournament_id=tid and o.outcome='accepted'and o.operation_type='publish_initial_seating'and o.target_id=tid
   and o.response_payload->>'status'='initial_seating_published'and o.response_payload->>'publicationId'=s.id::text;
 if seating_id is null then return jsonb_build_object('status','held','code','verified_initial_seating_required');end if;
 for p in select*from app.native_optional_final_pools_v2 where award_set_id=a.id and tournament_id=tid and event_id=eid order by fund_key loop
  select x->'rows'into projection_rows from jsonb_array_elements(current_fund->'optionalPools')x where x->>'kind'=p.pool_kind and x->>'poolId'=coalesce(p.q_pool_version_id,p.side_pool_id)::text
   and x->>'reviewId'=coalesce(p.q_review_id,p.side_review_id)::text and x->>'sourceDigest'=p.source_digest and(x->>'fundMinor')::bigint=p.fund_minor;
  if projection_rows is null or projection_rows is distinct from p.source_rows then return jsonb_build_object('status','held','code','pool_record_projection_changed');end if;
  if exists(select 1 from app.native_optional_final_recipients_v2 x where x.award_set_id=a.id and x.fund_key=p.fund_key and(x.pool_kind<>p.pool_kind or not exists(select 1 from jsonb_array_elements(projection_rows)y where y->>'participantId'=x.participant_id::text and y->>'displayName'=x.display_name and(y->>'amountMinor')::bigint=x.amount_minor and y=x.source_row)))
   or(select count(*)from app.native_optional_final_recipients_v2 where award_set_id=a.id and fund_key=p.fund_key)<>jsonb_array_length(projection_rows)
   or(select coalesce(sum(amount_minor),0)from app.native_optional_final_recipients_v2 where award_set_id=a.id and fund_key=p.fund_key)<>p.fund_minor then
   return jsonb_build_object('status','held','code','pool_recipients_changed');end if;
  if exists(select 1 from app.native_optional_final_recipients_v2 r where r.award_set_id=a.id and r.fund_key=p.fund_key and not exists(
   select 1 from app.event_participants ep join app.initial_seating_assignments seat on seat.tournament_id=ep.tournament_id and seat.roster_entry_id=ep.roster_entry_id and seat.publication_id=seating_id
    where ep.id=r.participant_id and ep.tournament_id=tid and ep.event_id=eid and ep.table_seat=seat.verification_id))then
   return jsonb_build_object('status','held','code','pool_tournament_identity_unavailable');end if;
  select coalesce(jsonb_agg(jsonb_build_object('participantId',r.participant_id,'name',r.display_name,'tournamentPlayerId',seat.verification_id,'amountMinor',r.amount_minor)order by r.participant_id),'[]')into rows
   from app.native_optional_final_recipients_v2 r join app.event_participants ep on ep.id=r.participant_id and ep.tournament_id=r.tournament_id and ep.event_id=r.event_id
   join app.initial_seating_assignments seat on seat.tournament_id=ep.tournament_id and seat.roster_entry_id=ep.roster_entry_id and seat.publication_id=seating_id and seat.verification_id=ep.table_seat
   where r.award_set_id=a.id and r.fund_key=p.fund_key;
  label:=null;
  if p.pool_kind='q'then select 'Q-Pool '||slot::text||' - '||pool_type_code into label from app.tournament_setup_q_pool_versions where id=p.q_pool_version_id and tournament_id=tid;
  else select display_name into label from app.event_side_pool_definition_versions where pool_id=p.side_pool_id and tournament_id=tid and event_id=eid order by version desc limit 1;end if;
  if label is null then return jsonb_build_object('status','held','code','pool_label_unavailable');end if;
  pools:=pools||jsonb_build_array(jsonb_build_object('poolId',coalesce(p.q_pool_version_id,p.side_pool_id),'label',label,'kind',p.pool_kind,'fundMinor',p.fund_minor,'roundingUnitMinor',500,'recipients',rows));total:=total+p.fund_minor;
 end loop;
 if jsonb_array_length(pools)<>jsonb_array_length(current_fund->'optionalPools')or total<>a.q_minor+a.side_minor then return jsonb_build_object('status','held','code','pool_fund_totals_changed');end if;
 return jsonb_build_object('kind','current-native-pool-award-results-v2','status','source_available','actorId',actor,'tournamentId',tid,'eventId',eid,'qualificationResultVersionId',a.qualification_id,
  'awardSetId',a.id,'seatingPublicationId',seating_id,'recordedAt',a.created_at,'qMinor',a.q_minor,'sideMinor',a.side_minor,'totalMinor',total,'pools',pools,'refundPolicy','no-pool-refunds-v1','snapshotConsistency','locked_source_snapshot',
  'moneyMoved',false,'payoutAuthorized',false,'bankReceiptVerified',false,'writeAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$body$;
alter function app.native_pool_award_results_enabled_v2()owner to postgres;
alter function public.get_native_pool_award_results_provider_v2(uuid,uuid,uuid)owner to postgres;
revoke all on function app.native_pool_award_results_enabled_v2(),public.get_native_pool_award_results_provider_v2(uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
