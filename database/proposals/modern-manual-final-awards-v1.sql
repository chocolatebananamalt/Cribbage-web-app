-- PRIVATE DEFAULT OFF. Real V3 UNPAID journal, distinct ordinary-manual source.
-- No payment authority and no replacement of native digital proof.
begin;
create function app.manual_final_awards_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;
create table app.manual_final_authorizations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,session_id uuid not null,
 qualification_id uuid not null,prize_revision_id uuid not null,fund_review_id uuid not null,source_digest text not null,source_capture jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 constraint manual_final_authorization_operation_fk foreign key(actor_id,operation_id,tournament_id,event_id)references app.selected_step_award_operations_v3(actor_id,operation_id,tournament_id,event_id)deferrable initially deferred,
 foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id),
 foreign key(prize_revision_id,tournament_id,event_id)references app.playoff_prize_proposal_revisions_v2(id,tournament_id,event_id),
 foreign key(fund_review_id,tournament_id,event_id)references app.selected_step_fund_reviews_v3(id,tournament_id,event_id),
 check(source_capture->>'kind'='selected-step-manual-award-source-v3'and source_capture->>'sourceDigest'=source_digest and source_digest~'^[a-f0-9]{64}$'),
 check(source_capture#>>'{fundSource,capture,sportingSource,qualification,resultVersionId}'=qualification_id::text),
 check(source_capture#>>'{prizeWorkspace,head,revisionId}'=prize_revision_id::text and source_capture#>>'{fundSource,reviewId}'=fund_review_id::text)
);
alter table app.manual_final_authorizations_v1 owner to postgres;alter table app.manual_final_authorizations_v1 enable row level security;alter table app.manual_final_authorizations_v1 force row level security;
revoke all on app.manual_final_authorizations_v1 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.manual_final_authorizations_v1 for each row execute function app.reject_immutable_history();
create trigger no_truncate before truncate on app.manual_final_authorizations_v1 for each statement execute function app.reject_immutable_history();
-- Exact source clone retains every approved monetary/eligibility guard. It
-- replaces the temporary hold with a real, exclusive current manual contract.
do $manual_source$declare body text;old text;replacement text;begin
 if not exists(select 1 from pg_proc where oid=to_regprocedure('app.current_selected_step_award_source_v3(uuid,uuid,uuid,uuid)')and proowner='postgres'::regrole and prosecdef)then raise exception'untrusted manual final source';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid='app.current_selected_step_award_source_v3(uuid,uuid,uuid,uuid)'::regprocedure;
 old:=' if n->>''kind''=''modern-manual-sporting-source-v1''then return jsonb_build_object(''status'',''blocked'',''code'',''manual_final_award_adapter_required'');end if;';
 replacement:=' if app.manual_final_awards_enabled_v1()is distinct from true or n->>''kind''is distinct from''modern-manual-sporting-source-v1''or n->>''status''is distinct from''source_available''or n->>''sourceConsistency''is distinct from''locked_database_capture''or n#>>''{playoff,proofKind}''is distinct from''ordinary-manual-playoff-v1''or n->>''eventKind''is distinct from''main''or(n#>>''{qualification,qualifierCount}'')::integer not in(4,5)then return jsonb_build_object(''status'',''blocked'',''code'',''current_manual_award_proof_required'');end if;';
 if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception'manual source hold anchor changed';end if;body:=replace(body,old,replacement);
 old:='selected-step-award-source-v3';if(length(body)-length(replace(body,old,'')))/length(old)<>2 then raise exception'manual source domain anchor changed';end if;body:=replace(body,old,'selected-step-manual-award-source-v3');
 execute format('create function app.current_manual_final_source_v1(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''''set timezone=''UTC''as %L',body);
end$manual_source$;
do $manual_writer$declare body text;old text:='app.current_selected_step_award_source_v3(actor,sid,tid,eid)';begin
 if not exists(select 1 from pg_proc where oid=to_regprocedure('app.record_selected_step_awards_v3(uuid,uuid,uuid,uuid,uuid,jsonb)')and proowner='postgres'::regrole and prosecdef)then raise exception'untrusted manual final writer';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid='app.record_selected_step_awards_v3(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure;
 if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception'manual writer source anchor changed';end if;body:=replace(body,old,'app.current_manual_final_source_v1(actor,sid,tid,eid)');
 execute format('create function app.record_manual_final_inner_v1(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''''set timezone=''UTC''as %L',body);
end$manual_writer$;
create function app.record_manual_final_awards_v1(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare prior app.selected_step_award_operations_v3%rowtype;s jsonb;outcome jsonb;set_id uuid;begin
 if app.manual_final_awards_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_unsupported');end if;
 if op is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('modern-prize-v2:'||actor||':'||op,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 -- Exact committed history is recoverable without promoting a stale source or
 -- inserting another admission. No stored request bytes are substituted.
 select*into prior from app.selected_step_award_operations_v3 where actor_id=actor and operation_id=op;
 if prior.operation_id is not null then
  if prior.tournament_id<>tid or prior.event_id<>eid or prior.request is distinct from request or not exists(select 1 from app.manual_final_authorizations_v1 a where a.actor_id=actor and a.operation_id=op and a.tournament_id=tid and a.event_id=eid)then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  select o.result into outcome from app.selected_step_award_outcomes_v3 o where o.actor_id=actor and o.operation_id=op and o.tournament_id=tid and o.event_id=eid;
  return coalesce(outcome,jsonb_build_object('status','retry_exact','code','operation_incomplete'));
 end if;
 if jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>5 or not(request?&array['expectedSourceDigest','expectedPrizeRevisionId','expectedFundReviewId','reason','reviewed'])or request->'reviewed'is distinct from'true'::jsonb then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 s:=app.current_manual_final_source_v1(actor,sid,tid,eid);if s->>'status'is distinct from'source_available'then return coalesce(s,jsonb_build_object('status','rejected','code','current_manual_award_proof_required'));end if;
 if s->'sourceDigest'is distinct from request->'expectedSourceDigest'or s#>'{prizeWorkspace,head,revisionId}'is distinct from request->'expectedPrizeRevisionId'or s#>'{fundSource,reviewId}'is distinct from request->'expectedFundReviewId'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 begin
  insert into app.manual_final_authorizations_v1(actor_id,operation_id,tournament_id,event_id,session_id,qualification_id,prize_revision_id,fund_review_id,source_digest,source_capture)values(actor,op,tid,eid,sid,(s#>>'{fundSource,capture,sportingSource,qualification,resultVersionId}')::uuid,(request->>'expectedPrizeRevisionId')::uuid,(request->>'expectedFundReviewId')::uuid,s->>'sourceDigest',s);
  outcome:=app.record_manual_final_inner_v1(actor,sid,tid,eid,op,request);
  if outcome->>'status'is distinct from'accepted'then raise exception using errcode='ZMM01',message='manual_award_attempt_not_recorded';end if;
  set_id:=(outcome->>'awardSetId')::uuid;
  if not exists(select 1 from app.selected_step_award_sets_v3 a join app.selected_step_award_outcomes_v3 o on o.actor_id=a.actor_id and o.operation_id=a.operation_id and o.tournament_id=a.tournament_id and o.event_id=a.event_id where a.id=set_id and a.actor_id=actor and a.operation_id=op and a.tournament_id=tid and a.event_id=eid and a.source_capture=s and o.result=outcome)
   then raise exception'manual_award_commit_postcondition_failed';end if;
  set constraints app.manual_final_authorization_operation_fk immediate;
  return outcome;
 exception when sqlstate'ZMM01'then return coalesce(outcome,jsonb_build_object('status','retry_exact','code','outcome_unknown'));end;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
-- Replace only the closed manual finalization backstop. All old/native/pool
-- domains remain blocked. The exception requires actual source reconstruction
-- AGAIN at insert and matches every available NEW financial/identity field.
create or replace function app.guard_modern_manual_finalization_v1()returns trigger language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare admission app.manual_final_authorizations_v1%rowtype;stored_op app.selected_step_award_operations_v3%rowtype;s jsonb;begin
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if tg_table_name='multi_event_joint_finals_v1'then if exists(select 1 from app.modern_manual_playoff_matches_v1 where tournament_id=new.tournament_id)then raise exception'modern_manual_finance_bridge_required';end if;return new;end if;
 if not exists(select 1 from app.modern_manual_playoff_matches_v1 where tournament_id=new.tournament_id and event_id=new.event_id)then return new;end if;
 if tg_table_name<>'selected_step_award_sets_v3'then raise exception'modern_manual_finance_bridge_required';end if;
 select*into admission from app.manual_final_authorizations_v1 where actor_id=new.actor_id and operation_id=new.operation_id and tournament_id=new.tournament_id and event_id=new.event_id;
 if admission.operation_id is null or app.manual_final_awards_enabled_v1()is distinct from true or app.selected_step_final_access_v3(new.actor_id,admission.session_id,new.tournament_id,new.event_id)is distinct from true then raise exception'manual_award_authorization_required';end if;
 select*into stored_op from app.selected_step_award_operations_v3 where actor_id=new.actor_id and operation_id=new.operation_id and tournament_id=new.tournament_id and event_id=new.event_id;
 s:=app.current_manual_final_source_v1(new.actor_id,admission.session_id,new.tournament_id,new.event_id);
 if s->>'status'is distinct from'source_available'or s->>'kind'is distinct from'selected-step-manual-award-source-v3'or s is distinct from admission.source_capture or s is distinct from new.source_capture
  or new.source_digest is distinct from admission.source_digest or new.source_digest is distinct from s->>'sourceDigest'
  or new.prize_revision_id is distinct from admission.prize_revision_id or new.fund_review_id is distinct from admission.fund_review_id
  or new.prize_revision_id::text is distinct from s#>>'{prizeWorkspace,head,revisionId}'or new.fund_review_id::text is distinct from s#>>'{fundSource,reviewId}'
  or admission.qualification_id::text is distinct from s#>>'{fundSource,capture,sportingSource,qualification,resultVersionId}'
  or new.plan is distinct from s->'plan'or new.rounding_unit_minor is distinct from(s->>'roundingUnitMinor')::integer or new.total_minor is distinct from(s->>'totalMinor')::bigint
  or new.recipient_count is distinct from jsonb_array_length(s->'recipients')or new.reason is distinct from stored_op.request->>'reason'or new.status is distinct from'recorded_unpaid'
  or stored_op.operation_id is null or stored_op.request->'expectedSourceDigest'is distinct from s->'sourceDigest'or stored_op.request->>'expectedPrizeRevisionId'is distinct from new.prize_revision_id::text or stored_op.request->>'expectedFundReviewId'is distinct from new.fund_review_id::text or stored_op.request->'reviewed'is distinct from'true'::jsonb
 then raise exception'manual_award_insert_source_changed';end if;
 return new;
end$$;
create function app.selected_step_award_dispatch_source_v3(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if exists(select 1 from app.modern_manual_playoff_matches_v1 where tournament_id=tid and event_id=eid)then return app.current_manual_final_source_v1(actor,sid,tid,eid);end if;return app.current_selected_step_award_source_v3(actor,sid,tid,eid);
end$$;
create function app.selected_step_award_dispatch_write_v3(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if exists(select 1 from app.modern_manual_playoff_matches_v1 where tournament_id=tid and event_id=eid)then return app.record_manual_final_awards_v1(actor,sid,tid,eid,op,request);end if;return app.record_selected_step_awards_v3(actor,sid,tid,eid,op,request);
end$$;
do $transport$declare signature text;body text;old text;replacement text;begin
 for signature,old,replacement in select*from(values
 ('public.get_selected_step_award_workspace_provider_v3(uuid,uuid,uuid,uuid)','source:=app.current_selected_step_award_source_v3(actor,sid,tid,eid);','source:=app.selected_step_award_dispatch_source_v3(actor,sid,tid,eid);'),
 ('public.record_selected_step_awards_provider_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','return app.record_selected_step_awards_v3(actor,sid,tid,eid,op,request);','return app.selected_step_award_dispatch_write_v3(actor,sid,tid,eid,op,request);'))v loop
  if not exists(select 1 from pg_proc where oid=to_regprocedure(signature)and proowner='postgres'::regrole and prosecdef)then raise exception'untrusted manual award transport';end if;body:=replace(pg_get_functiondef(to_regprocedure(signature)),E'\r\n',E'\n');if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception'manual award transport anchor changed';end if;execute replace(replace(body,old,replacement),'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
 end loop;
end$transport$;
do $$declare signature text;begin foreach signature in array array['app.manual_final_awards_enabled_v1()','app.current_manual_final_source_v1(uuid,uuid,uuid,uuid)','app.record_manual_final_inner_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_manual_final_awards_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.selected_step_award_dispatch_source_v3(uuid,uuid,uuid,uuid)','app.selected_step_award_dispatch_write_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','app.guard_modern_manual_finalization_v1()']loop execute format('alter function %s owner to postgres',signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);end loop;end$$;
commit;
