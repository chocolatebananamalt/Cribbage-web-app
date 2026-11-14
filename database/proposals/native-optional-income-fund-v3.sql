-- PRIVATE LOCAL CANDIDATE. Opt-in V3 income proof, V3 reviews and final-source
-- composition. Old zero-only functions/rows/operation outcomes remain intact.
-- Shared V2 review/FK namespace uses full request hashes including request kind.
begin;
create function app.native_optional_income_fund_enabled_v3()returns boolean language sql immutable set search_path=''as $$select false$$;
alter table app.native_optional_fund_reviews_v2 add column income_head_version integer,
 add column income_head_digest text,add column income_active_minor bigint;
do $$declare d text;begin
 select pg_get_constraintdef(oid)into d from pg_constraint where conrelid='app.native_optional_fund_reviews_v2'::regclass and conname='native_optional_fund_reviews_v2_review_status_check';
 if d is null or position('reviewed_zero'in d)=0 or position('recorded_complete'in d)>0 then raise exception'V2 zero review status constraint changed';end if;
end$$;
alter table app.native_optional_fund_reviews_v2 drop constraint native_optional_fund_reviews_v2_review_status_check;
alter table app.native_optional_fund_reviews_v2 add constraint native_optional_fund_status_v3 check(review_status in('reviewed_zero','recorded_complete')),
 add constraint native_optional_fund_income_pins_v3 check(
  (income_head_version is null and income_head_digest is null and income_active_minor is null and review_status='reviewed_zero')
  or(income_head_version between 0 and 2147483647 and income_head_digest~'^[a-f0-9]{64}$'and income_active_minor between 0 and 9007199254740991
   and income_head_version is not null and income_head_digest is not null and income_active_minor is not null
   and((review_status='reviewed_zero'and income_active_minor=0)or(review_status='recorded_complete'and income_active_minor>0))));

-- Every replacement is exact-count pinned. All existing locks, real V2 FKs,
-- optional review sources, zero-refund checks and sanction coverage survive.
do $$declare d text;p text;change jsonb;old text;replacement text;expected integer;patches jsonb;begin
 d:=replace(pg_get_functiondef('app.native_optional_recorded_fund_source_v2(uuid,uuid,uuid,uuid)'::regprocedure),E'\r\n',E'\n');p:=d;
 patches:=jsonb_build_array(
 jsonb_build_object('old','FUNCTION app.native_optional_recorded_fund_source_v2(','new','FUNCTION app.native_optional_recorded_fund_source_v3('),
 jsonb_build_object('old','declare recipient jsonb;','new','declare income_projection jsonb;recipient jsonb;'),
 jsonb_build_object('old',$a$ -- This bounded version supports explicitly reviewed zero additional income only.
 if exists(select 1 from app.native_unrestricted_income_sources_v1 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid)
 then return jsonb_build_object('status','blocked','code','additional_income_source_unsupported');end if;$a$,
 'new',$a$ if app.native_optional_income_fund_enabled_v3()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 income_projection:=app.native_optional_income_context_v2(actor,tid,eid,false);
 if income_projection is null or income_projection->>'status'is distinct from'income_source_available'then return income_projection;end if;
 if income_projection->'complete'is distinct from'true'::jsonb then return jsonb_build_object('status','blocked','code','income_history_incomplete');end if;
 if income_projection->>'proposalRevisionId'is distinct from recipient#>>'{proposal,revisionId}'or income_projection->>'ownershipRevisionId'is distinct from recipient#>>'{proposal,ownershipRevisionId}'then return jsonb_build_object('status','blocked','code','income_proposal_source_changed');end if;$a$),
 jsonb_build_object('old',$a$if editor->'history'is distinct from editor#>'{basis,history}'or editor->'lineForm'$a$,'new',$a$if editor->'lineForm'$a$),
 jsonb_build_object('old',$a$regular_minor:=(funds->>'regularReceiptsMinor')::numeric-cost_minor;$a$,'new',$a$regular_minor:=(funds->>'regularReceiptsMinor')::numeric-cost_minor+(income_projection->>'activeMinor')::numeric;$a$),
 jsonb_build_object('old',$a$if regular_minor<0 or regular_minor>9007199254740991 then$a$,'new',$a$if(funds->>'recordedReceiptsMinor')::numeric+(income_projection->>'activeMinor')::numeric>9007199254740991 then return jsonb_build_object('status','blocked','code','unsafe_recorded_total');end if;
 if regular_minor<0 or regular_minor>9007199254740991 then$a$),
 jsonb_build_object('old',$a$or regular_minor+cost_minor+qminor+sminor is distinct from(funds->>'recordedReceiptsMinor')::numeric$a$,'new',$a$or regular_minor+cost_minor+qminor+sminor is distinct from((funds->>'recordedReceiptsMinor')::numeric+(income_projection->>'activeMinor')::numeric)$a$),
 jsonb_build_object('old',$a$'incomeEvidence',jsonb_build_object('kind','explicit-zero-review-required-v2','journalHeadVersion',0,'records','[]'::jsonb,'proposalIncomeMinor',0)$a$,'new',$a$'incomeEvidence',income_projection$a$),
 jsonb_build_object('old',$a$'recordedReceiptsMinor',funds->'recordedReceiptsMinor'$a$,'new',$a$'nativeReceiptsMinor',funds->'recordedReceiptsMinor','recordedIncomeMinor',income_projection->'activeMinor','recordedReceiptsMinor',((funds->>'recordedReceiptsMinor')::numeric+(income_projection->>'activeMinor')::numeric)::bigint$a$),
 jsonb_build_object('old','native-optional-recorded-fund-source-v2','new','native-optional-recorded-fund-source-v3','count',2));
 for change in select value from jsonb_array_elements(patches)loop old:=change->>'old';replacement:=change->>'new';expected:=coalesce((change->>'count')::integer,1);
  if(length(p)-length(replace(p,old,'')))/length(old)<>expected then raise exception'Income V3 source anchor changed: %',old;end if;p:=replace(p,old,replacement);
 end loop;execute p;
end$$;

-- New requests share the immutable V2 journal reservation namespace; kind V3
-- makes them hash-distinct. The old V2 writer/reconciliation is not replaced.
do $$declare d text;p text;change jsonb;old text;replacement text;expected integer;patches jsonb;begin
 d:=replace(pg_get_functiondef('app.review_native_optional_recorded_fund_v2(uuid,uuid,uuid,uuid,jsonb)'::regprocedure),E'\r\n',E'\n');p:=d;
 patches:=jsonb_build_array(
 jsonb_build_object('old','FUNCTION app.review_native_optional_recorded_fund_v2(','new','FUNCTION app.review_native_optional_recorded_fund_v3('),
 jsonb_build_object('old',$a$if app.native_optional_recorded_fund_enabled_v2()is distinct from true then$a$,'new',$a$if app.native_optional_income_fund_enabled_v3()is distinct from true or app.native_optional_recorded_fund_enabled_v2()is distinct from true then$a$),
 jsonb_build_object('old',$a$(select count(*)from jsonb_object_keys(request))<>9$a$,'new',$a$(select count(*)from jsonb_object_keys(request))<>11$a$),
 jsonb_build_object('old',$a$'status','reason'])$a$,'new',$a$'status','reason','incomeHeadVersion','incomeHeadDigest'])$a$),
 jsonb_build_object('old',$a$request->>'kind'is distinct from'native-optional-recorded-fund-review-v2'or request->>'status'is distinct from'reviewed_zero'$a$,
 'new',$a$request->>'kind'is distinct from'native-optional-recorded-fund-review-v3'or coalesce(request->>'status','')not in('reviewed_zero','recorded_complete')
  or jsonb_typeof(request->'incomeHeadVersion')is distinct from'number'or coalesce(request->>'incomeHeadVersion','')!~'^(0|[1-9][0-9]{0,9})$'or(request->>'incomeHeadVersion')::numeric>2147483647
  or coalesce(request->>'incomeHeadDigest','')!~'^[a-f0-9]{64}$'$a$),
 jsonb_build_object('old','app.native_optional_recorded_fund_source_v2(actor,tid,eid,requested_expense_id)','new','app.native_optional_recorded_fund_source_v3(actor,tid,eid,requested_expense_id)'),
 jsonb_build_object('old',$a$select*into previous from app.native_optional_fund_reviews_v2$a$,
 'new',$a$if source_value#>>'{incomeEvidence,headVersion}'is distinct from request->>'incomeHeadVersion'or source_value#>>'{incomeEvidence,headDigest}'is distinct from request->>'incomeHeadDigest'
  or(request->>'status'='reviewed_zero'and(source_value#>>'{incomeEvidence,activeMinor}')::numeric<>0)
  or(request->>'status'='recorded_complete'and(source_value#>>'{incomeEvidence,activeMinor}')::numeric<=0)
 then return jsonb_build_object('status','rejected','code','income_head_changed');end if;
 select*into previous from app.native_optional_fund_reviews_v2$a$),
 jsonb_build_object('old',$a$source_digest,source_capture,reason,actor_id,operation_id)$a$,'new',$a$source_digest,source_capture,reason,actor_id,operation_id,income_head_version,income_head_digest,income_active_minor)$a$),
 jsonb_build_object('old',$a$::bigint,'reviewed_zero',source_value->>'sourceDigest',source_value,request->>'reason',actor,op);$a$,
 'new',$a$::bigint,request->>'status',source_value->>'sourceDigest',source_value,request->>'reason',actor,op,(request->>'incomeHeadVersion')::integer,request->>'incomeHeadDigest',(source_value#>>'{incomeEvidence,activeMinor}')::bigint);$a$),
 jsonb_build_object('old','optional_recorded_fund_reviewed_v2','new','optional_recorded_fund_reviewed_v3'),
 jsonb_build_object('old',$a$'reviewStatus','reviewed_zero'$a$,'new',$a$'reviewStatus',request->'status','incomeHeadVersion',request->'incomeHeadVersion','incomeHeadDigest',request->'incomeHeadDigest','incomeActiveMinor',source_value#>'{incomeEvidence,activeMinor}'$a$));
 for change in select value from jsonb_array_elements(patches)loop old:=change->>'old';replacement:=change->>'new';expected:=coalesce((change->>'count')::integer,1);
  if(length(p)-length(replace(p,old,'')))/length(old)<>expected then raise exception'Income V3 review anchor changed: %',old;end if;p:=replace(p,old,replacement);
 end loop;execute p;
end$$;
create function app.reconcile_native_optional_recorded_fund_v3(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language sql security definer set search_path=''as $$select app.reconcile_native_optional_recorded_fund_v2(actor,tid,eid,op,request)$$;

-- Preserve the old zero-only source output even after nullable V3 metadata is
-- added to its table rowtype. Its captured old JSON and hashes remain identical.
do $$declare d text;p text;old text;begin
 d:=replace(pg_get_functiondef('app.native_optional_final_award_source_v2(uuid,uuid,uuid)'::regprocedure),E'\r\n',E'\n');
 p:=replace(d,'FUNCTION app.native_optional_final_award_source_v2(','FUNCTION app.native_optional_final_award_source_zero_v2(');
 if p=d then raise exception'Income zero-final-source name anchor changed';end if;
 old:=$a$'fundReview',to_jsonb(review)$a$;
 if(length(p)-length(replace(p,old,'')))/length(old)<>1 then raise exception'Income zero-final-source review anchor changed';end if;
 execute replace(p,old,$a$'fundReview',to_jsonb(review)-array['income_head_version','income_head_digest','income_active_minor']$a$);
end$$;
do $$declare d text;p text;change jsonb;old text;replacement text;expected integer;patches jsonb;begin
 d:=replace(pg_get_functiondef('app.native_optional_final_award_source_v2(uuid,uuid,uuid)'::regprocedure),E'\r\n',E'\n');p:=d;
 patches:=jsonb_build_array(
 jsonb_build_object('old','FUNCTION app.native_optional_final_award_source_v2(','new','FUNCTION app.native_optional_final_award_source_v3('),
 jsonb_build_object('old',$a$if app.native_optional_final_awards_enabled_v2()is distinct from true then$a$,'new',$a$if app.native_optional_income_fund_enabled_v3()is distinct from true or app.native_optional_final_awards_enabled_v2()is distinct from true then$a$),
 jsonb_build_object('old',$a$review.review_status is distinct from'reviewed_zero'then$a$,'new',$a$review.review_status not in('reviewed_zero','recorded_complete')or review.income_head_version is null then$a$),
 jsonb_build_object('old','app.native_optional_recorded_fund_source_v2(actor,tid,eid,review.sanctioning_expense_event_id)','new','app.native_optional_recorded_fund_source_v3(actor,tid,eid,review.sanctioning_expense_event_id)'),
 jsonb_build_object('old',$a$if review.source_digest is distinct from source_value->>'sourceDigest'$a$,
 'new',$a$if review.income_head_version::text is distinct from source_value#>>'{incomeEvidence,headVersion}'or review.income_head_digest is distinct from source_value#>>'{incomeEvidence,headDigest}'
  or review.income_active_minor::text is distinct from source_value#>>'{incomeEvidence,activeMinor}'
  or(review.review_status='reviewed_zero'and review.income_active_minor<>0)or(review.review_status='recorded_complete'and review.income_active_minor<=0)
 then return jsonb_build_object('status','blocked','code','recorded_fund_review_stale');end if;
 if review.source_digest is distinct from source_value->>'sourceDigest'$a$),
 jsonb_build_object('old','native-optional-final-award-source-v2','new','native-optional-final-award-source-v3','count',2));
 for change in select value from jsonb_array_elements(patches)loop old:=change->>'old';replacement:=change->>'new';expected:=coalesce((change->>'count')::integer,1);
  if(length(p)-length(replace(p,old,'')))/length(old)<>expected then raise exception'Income V3 final-source anchor changed: %',old;end if;p:=replace(p,old,replacement);
 end loop;execute p;
end$$;

-- Only new operations whose latest review actually records V3 income pins opt
-- into V3. Exact old final writer outcomes are replayed before source lookup.
create or replace function app.native_optional_final_award_source_v2(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare latest_income_version integer;begin
 if app.native_optional_income_fund_enabled_v3()is true then
  if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
  if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
  if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
  perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
  perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
  if app.native_optional_final_awards_enabled_v2()is distinct from true then return app.native_optional_final_award_source_zero_v2(actor,tid,eid);end if;
  lock table app.native_optional_fund_operations_v2,app.native_optional_fund_reviews_v2,app.native_optional_fund_outcomes_v2 in share mode nowait;
  select income_head_version into latest_income_version from app.native_optional_fund_reviews_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
  if latest_income_version is not null then return app.native_optional_final_award_source_v3(actor,tid,eid);end if;
 end if;
 return app.native_optional_final_award_source_zero_v2(actor,tid,eid);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
do $$declare signature text;begin foreach signature in array array[
 'app.native_optional_income_fund_enabled_v3()','app.native_optional_recorded_fund_source_v3(uuid,uuid,uuid,uuid)',
 'app.review_native_optional_recorded_fund_v3(uuid,uuid,uuid,uuid,jsonb)','app.reconcile_native_optional_recorded_fund_v3(uuid,uuid,uuid,uuid,jsonb)',
 'app.native_optional_final_award_source_zero_v2(uuid,uuid,uuid)','app.native_optional_final_award_source_v3(uuid,uuid,uuid)','app.native_optional_final_award_source_v2(uuid,uuid,uuid)'
]loop execute format('alter function %s owner to postgres',signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);end loop;end$$;
commit;
