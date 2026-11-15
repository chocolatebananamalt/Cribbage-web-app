-- PRIVATE / DEFAULT OFF. Complete funded optional pools only after actual
-- current manual sporting/regular-award/fund proof and an explicitly saved pool proposal.
begin;
create function app.manual_pool_finalization_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;
create table app.manual_pool_final_authorizations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,session_id uuid not null,
 request jsonb not null,request_hash text not null,source_digest text not null,source_capture jsonb not null,
 qualification_id uuid not null,ownership_revision_id uuid not null,prize_revision_id uuid not null,fund_review_id uuid not null,regular_award_set_id uuid not null,pool_proposal_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 constraint manual_pool_operation_fk foreign key(actor_id,operation_id,tournament_id,event_id)references app.selected_step_pool_operations_v3(actor_id,operation_id,tournament_id,event_id)deferrable initially deferred,
 foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id),
 foreign key(ownership_revision_id,tournament_id,event_id)references app.selected_step_pool_ownership_revisions_v3(id,tournament_id,event_id),
 foreign key(prize_revision_id,tournament_id,event_id)references app.playoff_prize_proposal_revisions_v2(id,tournament_id,event_id),
 foreign key(fund_review_id,tournament_id,event_id)references app.selected_step_fund_reviews_v3(id,tournament_id,event_id),
 foreign key(regular_award_set_id,tournament_id,event_id)references app.selected_step_award_sets_v3(id,tournament_id,event_id),
 foreign key(pool_proposal_id,tournament_id,event_id)references app.selected_step_pool_revisions_v3(id,tournament_id,event_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('manual-pool-final-request-v1',actor_id,tournament_id,event_id,operation_id,request)::text,'utf8'),'sha256'),'hex')),
 check(source_digest~'^[a-f0-9]{64}$'and source_capture->>'sourceDigest'=source_digest)
);
create table app.manual_pool_final_outcomes_v1(actor_id uuid not null,operation_id uuid not null,result jsonb not null,primary key(actor_id,operation_id),foreign key(actor_id,operation_id)references app.manual_pool_final_authorizations_v1(actor_id,operation_id));
create function app.current_manual_pool_final_source_v1(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare a jsonb;f jsonb;o jsonb;p jsonb;h app.selected_step_pool_revisions_v3%rowtype;c jsonb;digest text;begin
 if app.manual_pool_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_unsupported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 a:=public.get_selected_step_award_workspace_provider_v3(actor,sid,tid,eid);
 if a->>'status'='retry_exact'then return a;end if;
 if a->>'status'is distinct from'recorded'or a->'currentSourceVerified'is distinct from'true'::jsonb or a#>>'{source,kind}'is distinct from'selected-step-manual-award-source-v3'
  or a#>>'{source,fundSource,capture,sportingSource,eventKind}'is distinct from'main'
  or coalesce(a#>>'{source,fundSource,capture,sportingSource,qualification,qualifierCount}','')not in('4','5')
 then return jsonb_build_object('status','blocked','code','current_main_four_or_five_manual_regular_awards_required');end if;
 -- Five qualifiers have four real series, including the preliminary match.
 -- Admit neither a four-series summary standing in for detailed proof nor a
 -- missing preliminary result. The actual manual collector/award reader has
 -- already independently replayed every persisted game in these series.
 if jsonb_typeof(a#>'{source,fundSource,capture,sportingSource,playoff,matches}')is distinct from'array'
  or jsonb_array_length(a#>'{source,fundSource,capture,sportingSource,playoff,matches}')<>(a#>>'{source,fundSource,capture,sportingSource,qualification,qualifierCount}')::integer-1
  or exists(select 1 from generate_series(1,(a#>>'{source,fundSource,capture,sportingSource,qualification,qualifierCount}')::integer-1)slot_no
   where(select count(*)from jsonb_array_elements(a#>'{source,fundSource,capture,sportingSource,playoff,matches}')m where m->'slot'=to_jsonb(slot_no))<>1)
 then return jsonb_build_object('status','blocked','code','complete_manual_series_set_required');end if;
 f:=app.current_selected_step_fund_v3(actor,sid,tid,eid);o:=app.selected_step_regular_ledger_v3(actor,tid,eid);p:=app.get_selected_step_pool_source_v3(actor,tid,eid);
 if f->>'status'='retry_exact'then return f;end if;if o->>'status'='retry_exact'then return o;end if;if p->>'status'='retry_exact'then return p;end if;
 if f->>'status'is distinct from'source_available'or f->'recordedFundComplete'is distinct from'true'::jsonb or f is distinct from a#>'{source,fundSource}'
  or o->>'status'is distinct from'source_available'or o is distinct from f#>'{capture,ownershipLedger}'
  or p->>'status'is distinct from'source_available'or p is distinct from f#>'{capture,optionalPools}'
  or p->'qualificationResultVersionId'is distinct from f#>'{capture,sportingSource,qualification,resultVersionId}'
  or p->'ownershipRevisionId'is distinct from o->'ownershipRevisionId'
  or p->'qMinor'is distinct from o#>'{funds,qReceiptsMinor}'or p->'sideMinor'is distinct from o#>'{funds,sideReceiptsMinor}'
 then return jsonb_build_object('status','blocked','code','current_manual_financial_sources_required');end if;
 if(p->>'totalMinor')::numeric<=0 then return jsonb_build_object('status','blocked','code','funded_optional_pools_required');end if;
 lock table app.selected_step_pool_revisions_v3 in share mode nowait;
 select*into h from app.selected_step_pool_revisions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if h.id is null or h.source_capture is distinct from p or h.source_digest is distinct from p->>'sourceDigest'or h.ownership_revision_id::text is distinct from o->>'ownershipRevisionId'
 then return jsonb_build_object('status','blocked','code','current_saved_pool_proposal_required');end if;
 c:=jsonb_build_object('kind','manual-pool-final-source-v1','actorId',actor,'tournamentId',tid,'eventId',eid,
  'qualificationId',f#>'{capture,sportingSource,qualification,resultVersionId}','ownershipRevisionId',o->'ownershipRevisionId','prizeRevisionId',a#>'{record,prizeRevisionId}',
  'fundReviewId',f->'reviewId','regularAwardSetId',a#>'{record,awardSetId}','poolProposalRevisionId',h.id,
  'regularSource',a->'source','regularRecord',a->'record','fund',f,'ownership',o,'poolSource',p,'poolProposal',to_jsonb(h),
  'moneyMoved',false,'payoutAuthorized',false,'officialMrpAwarded',false);
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 digest:=encode(extensions.digest(convert_to(c::text,'utf8'),'sha256'),'hex');return c||jsonb_build_object('status','source_available','sourceDigest',digest);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function app.assert_manual_pool_final_insert_v1(n jsonb)returns void language plpgsql security definer set search_path=''as $$
declare a app.manual_pool_final_authorizations_v1%rowtype;j app.selected_step_pool_operations_v3%rowtype;s jsonb;p jsonb;begin
 select*into a from app.manual_pool_final_authorizations_v1 where actor_id=(n->>'actor_id')::uuid and operation_id=(n->>'operation_id')::uuid and tournament_id=(n->>'tournament_id')::uuid and event_id=(n->>'event_id')::uuid;
 if a.operation_id is null or app.selected_step_final_access_v3(a.actor_id,a.session_id,a.tournament_id,a.event_id)is distinct from true then raise exception'manual_pool_authorization_required';end if;
 s:=app.current_manual_pool_final_source_v1(a.actor_id,a.session_id,a.tournament_id,a.event_id);p:=s->'poolSource';
 select*into j from app.selected_step_pool_operations_v3 where actor_id=a.actor_id and operation_id=a.operation_id and tournament_id=a.tournament_id and event_id=a.event_id;
 if s->>'status'is distinct from'source_available'or s is distinct from a.source_capture or s->>'sourceDigest'is distinct from a.source_digest
  or n->>'proposal_revision_id'is distinct from a.pool_proposal_id::text or n->'source_capture'is distinct from p or n->>'source_digest'is distinct from p->>'sourceDigest'
  or n->'q_minor'is distinct from p->'qMinor'or n->'side_minor'is distinct from p->'sideMinor'or n->'total_minor'is distinct from p->'totalMinor'
  or a.qualification_id::text is distinct from s->>'qualificationId'or a.ownership_revision_id::text is distinct from s->>'ownershipRevisionId'or a.prize_revision_id::text is distinct from s->>'prizeRevisionId'
  or a.fund_review_id::text is distinct from s->>'fundReviewId'or a.regular_award_set_id::text is distinct from s->>'regularAwardSetId'
  or j.operation_id is null or j.request->>'kind'is distinct from'selected-step-pool-finalize-v3'or j.request->'reviewed'is distinct from'true'::jsonb
  or j.request->>'proposalRevisionId'is distinct from n->>'proposal_revision_id'or j.request->>'expectedSourceDigest'is distinct from n->>'source_digest'
  or n->>'reason'is distinct from j.request->>'reason'or a.request->>'reason'is distinct from j.request->>'reason'
 then raise exception'manual_pool_insert_source_changed';end if;
end$$;
-- Preserve the original regular-award admission and all other protocol holds.
do $guard$declare d text;old text:='if tg_table_name<>''selected_step_award_sets_v3''then raise exception''modern_manual_finance_bridge_required'';end if;';begin
 if not exists(select 1 from pg_proc where oid='app.guard_modern_manual_finalization_v1()'::regprocedure and proowner='postgres'::regrole and prosecdef)then raise exception'untrusted manual final guard';end if;
 d:=replace(pg_get_functiondef('app.guard_modern_manual_finalization_v1()'::regprocedure),E'\r\n',E'\n');if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'manual pool guard anchor changed';end if;
 execute replace(replace(d,old,'if tg_table_name=''selected_step_pool_finals_v3''then perform app.assert_manual_pool_final_insert_v1(to_jsonb(new));return new;end if; '||old),'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$guard$;
-- Reuse the genuine current-recipient proof reader, retaining full replay.
do $reader$declare d text;old text:='if app.selected_step_pool_results_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;';begin
 if not exists(select 1 from pg_proc where oid='public.get_selected_step_pool_results_provider_v3(uuid,uuid,uuid)'::regprocedure and proowner='postgres'::regrole and prosecdef)then raise exception'untrusted current pool reader';end if;
 select replace(prosrc,E'\r\n',E'\n')into d from pg_proc where oid='public.get_selected_step_pool_results_provider_v3(uuid,uuid,uuid)'::regprocedure;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'manual pool reader anchor changed';end if;
 d:=replace(d,old,'if app.manual_pool_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;');
 execute format('create function app.current_manual_pool_result_v1(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''''set timezone=''UTC''as %L',d);
end$reader$;
create function app.record_manual_pool_final_v1(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare prior app.manual_pool_final_authorizations_v1%rowtype;s jsonb;inner_request jsonb;r jsonb;proof jsonb;result jsonb;h text;begin
 if app.manual_pool_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_unsupported');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array['kind','expectedSourceDigest','poolProposalRevisionId','expectedPoolSourceDigest','regularAwardSetId','fundReviewId','reviewed','reason'])is distinct from true
  or request->>'kind'is distinct from'manual-pool-finalize-v1'or request->'reviewed'is distinct from'true'::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->'reason')is distinct from true
  or jsonb_typeof(request->'expectedSourceDigest')is distinct from'string'or jsonb_typeof(request->'expectedPoolSourceDigest')is distinct from'string'or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'expectedPoolSourceDigest','')!~'^[a-f0-9]{64}$'
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('selected-step-pool-op-v3:'||actor||':'||op,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('manual-pool-final-request-v1',actor,tid,eid,op,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.manual_pool_final_authorizations_v1 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id<>tid or prior.event_id<>eid or prior.request_hash<>h or prior.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  select o.result into result from app.manual_pool_final_outcomes_v1 o where o.actor_id=actor and o.operation_id=op;return coalesce(result,jsonb_build_object('status','retry_exact','code','operation_incomplete'));
 end if;
 if exists(select 1 from app.selected_step_pool_operations_v3 where actor_id=actor and operation_id=op)then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 s:=app.current_manual_pool_final_source_v1(actor,sid,tid,eid);if s->>'status'='retry_exact'then return s;end if;
 if s->>'status'is distinct from'source_available'then return jsonb_build_object('status','rejected','code',coalesce(s->>'code','current_source_required'));end if;
 if s->>'sourceDigest'is distinct from request->>'expectedSourceDigest'or s->>'poolProposalRevisionId'is distinct from request->>'poolProposalRevisionId'or s#>>'{poolSource,sourceDigest}'is distinct from request->>'expectedPoolSourceDigest'
  or s->>'regularAwardSetId'is distinct from request->>'regularAwardSetId'or s->>'fundReviewId'is distinct from request->>'fundReviewId'then return jsonb_build_object('status','rejected','code','review_source_changed');end if;
 if exists(select 1 from app.selected_step_pool_finals_v3 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','pool_final_already_recorded');end if;
 inner_request:=jsonb_build_object('kind','selected-step-pool-finalize-v3','proposalRevisionId',s->'poolProposalRevisionId','expectedSourceDigest',s#>'{poolSource,sourceDigest}','reason',request->'reason','reviewed',true);
 begin
  insert into app.manual_pool_final_authorizations_v1(actor_id,operation_id,tournament_id,event_id,session_id,request,request_hash,source_digest,source_capture,qualification_id,ownership_revision_id,prize_revision_id,fund_review_id,regular_award_set_id,pool_proposal_id)
   values(actor,op,tid,eid,sid,request,h,s->>'sourceDigest',s,(s->>'qualificationId')::uuid,(s->>'ownershipRevisionId')::uuid,(s->>'prizeRevisionId')::uuid,(s->>'fundReviewId')::uuid,(s->>'regularAwardSetId')::uuid,(s->>'poolProposalRevisionId')::uuid);
  r:=app.record_selected_step_pool_v3(actor,tid,eid,op,inner_request);
  if r->>'status'is distinct from'awards_recorded_unpaid'then raise exception using errcode='ZMP01',message='inner_not_accepted';end if;
  proof:=app.current_manual_pool_result_v1(actor,sid,tid,eid);
  if proof->>'status'is distinct from'source_available'or proof->'finalId'is distinct from r->'finalId'or proof->'sourceCapture'is distinct from s->'poolSource' or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception'manual_pool_postcondition_failed';end if;
  result:=jsonb_build_object('kind','manual-pool-final-receipt-v1','status','accepted','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'requestHash',h,'sourceDigest',s->'sourceDigest','poolFinalId',r->'finalId','innerReceipt',r,'historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false,'payoutAuthorized',false,'officialMrpAwarded',false);
  insert into app.manual_pool_final_outcomes_v1 values(actor,op,result);
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'manual_pool_final_v1',(r->>'finalId')::uuid,'approved_unpaid',result||jsonb_build_object('sessionId',sid));
  set constraints app.manual_pool_operation_fk immediate;
 exception when sqlstate'ZMP01'then return coalesce(r,jsonb_build_object('status','rejected','code','pool_final_unavailable'));end;
 return result;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
-- History lookup is separate from fresh proof and never promotes a receipt.
create function public.get_manual_pool_final_operation_v1(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
declare a app.manual_pool_final_authorizations_v1%rowtype;r jsonb;begin
 if app.manual_pool_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 select*into a from app.manual_pool_final_authorizations_v1 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','unknown','code','operation_not_found');end if;
 if a.tournament_id<>tid or a.event_id<>eid or a.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 select result into r from app.manual_pool_final_outcomes_v1 where actor_id=actor and operation_id=op;return coalesce(r,jsonb_build_object('status','retry_exact','code','operation_incomplete'));end$$;
create function public.record_manual_pool_final_provider_v1(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language sql security definer set search_path=''as $$select app.record_manual_pool_final_v1(actor,sid,tid,eid,op,request)$$;
create function public.get_manual_pool_final_source_provider_v1(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language sql security definer set search_path=''as $$select app.current_manual_pool_final_source_v1(actor,sid,tid,eid)$$;
create function public.get_manual_pool_final_workspace_v1(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare s jsonb;r jsonb;begin
 s:=app.current_manual_pool_final_source_v1(actor,sid,tid,eid);if s is null or s->>'status'='retry_exact'then return s;end if;
 if s->>'status'is distinct from'source_available'then return jsonb_build_object('status','held','code',coalesce(s->>'code','source_unavailable'));end if;
 r:=app.current_manual_pool_result_v1(actor,sid,tid,eid);if r->>'status'='retry_exact'then return r;end if;
 if r->>'status'is distinct from'source_available'and r->>'code'is distinct from'pool_awards_not_recorded'then return jsonb_build_object('status','held','code',coalesce(r->>'code','pool_record_unavailable'));end if;
 return jsonb_build_object('kind','manual-pool-final-workspace-v1','actorId',actor,'tournamentId',tid,'eventId',eid,'status',case when r->>'status'='source_available'then'recorded'else'review'end,'source',s,'record',case when r->>'status'='source_available'then r else null end,'currentSourceVerified',true,'moneyMoved',false,'officialMrpAwarded',false);end$$;
do $security$declare t text;r record;begin
 foreach t in array array['manual_pool_final_authorizations_v1','manual_pool_final_outcomes_v1']loop
  execute format('alter table app.%I owner to postgres',t);execute format('alter table app.%I enable row level security',t);execute format('alter table app.%I force row level security',t);execute format('revoke all on app.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',t);execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',t);
 end loop;
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='app'and p.proname in('manual_pool_finalization_enabled_v1','current_manual_pool_final_source_v1','assert_manual_pool_final_insert_v1','current_manual_pool_result_v1','record_manual_pool_final_v1'))or(n.nspname='public'and p.proname in('get_manual_pool_final_operation_v1','record_manual_pool_final_provider_v1','get_manual_pool_final_source_provider_v1','get_manual_pool_final_workspace_v1'))loop execute format('alter function %s owner to postgres',r.signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);end loop;
end$security$;
commit;
