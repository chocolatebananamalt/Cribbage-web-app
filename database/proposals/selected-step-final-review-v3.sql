-- PRIVATE / DEFAULT OFF. Genuine modern ownership, prize proposal and completed
-- native-series collector. No legacy proposal/allocation IDs are manufactured.
-- Depends on selected-step-regular-ledger-v3, existing series/large-field and
-- native sporting reader, proposal store, optional fee and income journals.
begin;
create function app.selected_step_final_review_enabled_v3()returns boolean language sql stable set search_path=''as $gate$select false$gate$;
create function app.selected_step_final_access_v3(actor uuid,sid uuid,tid uuid,eid uuid)returns boolean
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
begin
 if sid is null or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return false;end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return false;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;if not found then return false;end if;
 perform 1 from auth.users where id=actor and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp())for share nowait;if not found then return false;end if;
 perform 1 from auth.sessions where id=sid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;return found;
end$body$;

-- INSTALLER_CLONES: exact-count source edits only. Existing functions remain
-- unchanged. Recursive readers use the same V3 gate, original parent/result
-- hashes and two independent submissions plus confirmations. No game writer.

do $clone$declare original regprocedure:='app.playoff_series_match_source_v1(uuid,uuid,uuid,integer)'::regprocedure;d text;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted selected-step clone prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["app.event_settings_playoff_source_v1(tid,eid)","app.selected_step_pool_playoff_source_v3(actor,tid,eid)",1],["app.playoff_series_current_result_v1(tid,eid,qid,","app.selected_step_series_current_result_v3(actor,tid,eid,qid,",2]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'selected-step clone anchor changed: %: %','app.selected_step_series_match_source_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.selected_step_series_match_source_v3(actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.selected_step_series_match_source_v3(actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer)owner to postgres';
 execute 'revoke all on function app.selected_step_series_match_source_v3(actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.playoff_series_current_result_v1(uuid,uuid,uuid,integer)'::regprocedure;d text;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted selected-step clone prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["app.playoff_series_match_source_v1(tid,eid,qid,slot_no)","app.selected_step_series_match_source_v3(actor,tid,eid,qid,slot_no)",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'selected-step clone anchor changed: %: %','app.selected_step_series_current_result_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.selected_step_series_current_result_v3(actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.selected_step_series_current_result_v3(actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer)owner to postgres';
 execute 'revoke all on function app.selected_step_series_current_result_v3(actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='public.get_native_playoff_mrp_source_v1(uuid,uuid)'::regprocedure;d text;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted selected-step clone prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare actor uuid;","declare ",1],["app.native_playoff_mrp_source_enabled_v1()","app.selected_step_final_review_enabled_v3()",2],["actor:=app.native_playoff_mrp_actor_v1(p_tournament_id);if actor is null then return null;end if;","if app.selected_step_final_access_v3(actor,sid,p_tournament_id,p_event_id)is distinct from true then return null;end if;",1],["app.native_playoff_mrp_actor_v1(p_tournament_id)is distinct from actor","app.selected_step_final_access_v3(actor,sid,p_tournament_id,p_event_id)is distinct from true",1],["app.event_settings_playoff_source_v1(p_tournament_id,p_event_id)","app.selected_step_pool_playoff_source_v3(actor,p_tournament_id,p_event_id)",1],["app.playoff_series_match_source_v1(\n   p_tournament_id","app.selected_step_series_match_source_v3(\n   actor,p_tournament_id",1],["app.playoff_series_current_result_v1(\n   p_tournament_id","app.selected_step_series_current_result_v3(\n   actor,p_tournament_id",1],["''sessionId'',auth.jwt()->>''session_id'',","",1],["native-playoff-sporting-source-v1","selected-step-sporting-source-v3",2]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'selected-step clone anchor changed: %: %','app.selected_step_sporting_source_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.selected_step_sporting_source_v3(actor uuid, sid uuid, p_tournament_id uuid, p_event_id uuid)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.selected_step_sporting_source_v3(actor uuid, sid uuid, p_tournament_id uuid, p_event_id uuid)owner to postgres';
 execute 'revoke all on function app.selected_step_sporting_source_v3(actor uuid, sid uuid, p_tournament_id uuid, p_event_id uuid)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.get_playoff_prize_proposal_workspace_v2(uuid,uuid)'::regprocedure;d text;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted selected-step clone prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare actor uuid:=auth.uid();","declare ",1],["begin\n if","begin\n if app.selected_step_final_review_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if",1],["app.get_playoff_prize_native_source_v2(tid,eid)","app.get_selected_step_prize_source_v3(actor,tid,eid)",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'selected-step clone anchor changed: %: %','app.get_selected_step_prize_workspace_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.get_selected_step_prize_workspace_v3(actor uuid, sid uuid, tid uuid, eid uuid)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.get_selected_step_prize_workspace_v3(actor uuid, sid uuid, tid uuid, eid uuid)owner to postgres';
 execute 'revoke all on function app.get_selected_step_prize_workspace_v3(actor uuid, sid uuid, tid uuid, eid uuid)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.save_playoff_prize_proposal_v2(uuid,uuid,text)'::regprocedure;d text;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted selected-step clone prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare actor uuid:=auth.uid();","declare ",1],["begin\n if","begin\n if app.selected_step_final_review_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if",1],["app.get_playoff_prize_native_source_v2(tid,eid)","app.get_selected_step_prize_source_v3(actor,tid,eid)",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'selected-step clone anchor changed: %: %','app.save_selected_step_prize_proposal_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.save_selected_step_prize_proposal_v3(actor uuid, sid uuid, tid uuid, eid uuid, request_text text)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.save_selected_step_prize_proposal_v3(actor uuid, sid uuid, tid uuid, eid uuid, request_text text)owner to postgres';
 execute 'revoke all on function app.save_selected_step_prize_proposal_v3(actor uuid, sid uuid, tid uuid, eid uuid, request_text text)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.get_playoff_prize_proposal_operation_v2(uuid,uuid,text)'::regprocedure;d text;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted selected-step clone prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare actor uuid:=auth.uid();","declare ",1],["begin\n if","begin\n if app.selected_step_final_review_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'selected-step clone anchor changed: %: %','app.get_selected_step_prize_operation_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.get_selected_step_prize_operation_v3(actor uuid, sid uuid, tid uuid, eid uuid, request_text text)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.get_selected_step_prize_operation_v3(actor uuid, sid uuid, tid uuid, eid uuid, request_text text)owner to postgres';
 execute 'revoke all on function app.get_selected_step_prize_operation_v3(actor uuid, sid uuid, tid uuid, eid uuid, request_text text)from public,anon,authenticated,service_role';
end$clone$;

create table app.selected_step_fund_operations_v3(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 session_id uuid not null,request jsonb not null,request_hash text not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('selected-step-fund-review-v3',actor_id,tournament_id,event_id,operation_id,request)::text,'utf8'),'sha256'),'hex'))
);
create table app.selected_step_fund_reviews_v3(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,version integer not null check(version>0),prior_review_id uuid,
 actor_id uuid not null,operation_id uuid not null,proposal_revision_id uuid not null,ownership_revision_id uuid not null,
 sanctioning_snapshot_id uuid not null,sanctioning_expense_event_id uuid,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),source_capture jsonb not null,
 reason text not null,created_at timestamptz not null default clock_timestamp(),unique(tournament_id,event_id,version),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(prior_review_id,tournament_id,event_id)references app.selected_step_fund_reviews_v3(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.selected_step_fund_operations_v3(actor_id,operation_id,tournament_id,event_id),
 foreign key(proposal_revision_id,tournament_id,event_id)references app.playoff_prize_proposal_revisions_v2(id,tournament_id,event_id),
 foreign key(ownership_revision_id,tournament_id,event_id)references app.selected_step_pool_ownership_revisions_v3(id,tournament_id,event_id),
 foreign key(sanctioning_snapshot_id,tournament_id,event_id)references app.event_sanctioning_fee_snapshots(id,tournament_id,event_id),
 foreign key(sanctioning_expense_event_id)references app.tournament_expense_events(id),
 check(reason=app.custom_payout_classification_text_v2(reason)and app.event_settings_js_text_length_v3(reason)between 1 and 2000)
);
create table app.selected_step_fund_outcomes_v3(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,result jsonb not null,
 primary key(actor_id,operation_id),foreign key(actor_id,operation_id,tournament_id,event_id)references app.selected_step_fund_operations_v3(actor_id,operation_id,tournament_id,event_id)
);
do $security$declare t text;begin foreach t in array array['selected_step_fund_operations_v3','selected_step_fund_reviews_v3','selected_step_fund_outcomes_v3']loop
 execute format('alter table app.%I owner to postgres',t);execute format('alter table app.%I enable row level security',t);execute format('alter table app.%I force row level security',t);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',t);
 execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',t);
end loop;end$security$;

-- Reciprocal expense-coverage protection: old-domain writers also reject an
-- expense already reviewed in V3 for a different event. Same tournament lock
-- serializes both directions; history remains readable and unchanged.
create function app.guard_selected_step_sanction_reuse_v3()returns trigger
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare expense_id uuid;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'selected_step_review_isolation_unsupported';end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if tg_table_name='event_settlement_finals_v2'then
  select sanctioning_expense_event_id into expense_id from app.event_settlement_drafts_v5 where id=new.draft_id and tournament_id=new.tournament_id and event_id=new.event_id;
 else expense_id:=new.sanctioning_expense_event_id;end if;
 if expense_id is null then return new;end if;
 if exists(select 1 from app.selected_step_fund_reviews_v3 where tournament_id=new.tournament_id and event_id<>new.event_id and sanctioning_expense_event_id=expense_id)
  or(tg_table_name='selected_step_fund_reviews_v3'and(
   exists(select 1 from app.native_recorded_fund_reviews_v1 where tournament_id=new.tournament_id and event_id<>new.event_id and sanctioning_expense_event_id=expense_id)
   or exists(select 1 from app.native_optional_fund_reviews_v2 where tournament_id=new.tournament_id and event_id<>new.event_id and sanctioning_expense_event_id=expense_id)
   or exists(select 1 from app.event_settlement_finals_v2 f join app.event_settlement_drafts_v5 d on d.id=f.draft_id where f.tournament_id=new.tournament_id and f.event_id<>new.event_id and d.sanctioning_expense_event_id=expense_id)))
 then raise exception'selected_step_sanctioning_expense_reused';end if;
 return new;
end$body$;
do $reciprocal$declare t text;begin foreach t in array array['selected_step_fund_reviews_v3','native_recorded_fund_reviews_v1','native_optional_fund_reviews_v2','event_settlement_finals_v2']loop
 execute format('create trigger zz_selected_step_sanction_reuse_v3 before insert on app.%I for each row execute function app.guard_selected_step_sanction_reuse_v3()',t);
end loop;end$reciprocal$;

create function app.selected_step_sanctioning_coverage_v3(tid uuid,eid uuid,owned jsonb,expense_id uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare snap app.event_sanctioning_fee_snapshots%rowtype;started app.event_play_starts%rowtype;item jsonb;amount numeric;
begin
 lock table app.event_play_starts,app.event_sanctioning_fee_snapshots,app.tournament_expense_events,
 app.native_recorded_fund_reviews_v1,app.native_optional_fund_reviews_v2,app.selected_step_fund_reviews_v3,
 app.event_settlement_finals_v2,app.event_settlement_drafts_v5 in share mode nowait;
 select*into started from app.event_play_starts where tournament_id=tid and event_id=eid;
 select*into snap from app.event_sanctioning_fee_snapshots where tournament_id=tid and event_id=eid;
 if snap.id is null or started.id is null or snap.event_play_start_id is distinct from started.id
  or snap.eligible_participant_count is distinct from started.participant_count
  or snap.rate_cents::numeric*snap.eligible_participant_count is distinct from snap.total_cents::numeric
  or not exists(select 1 from app.events where id=eid and tournament_id=tid and event_type=snap.event_kind)
 then return jsonb_build_object('status','blocked','code','sanctioning_snapshot_changed');end if;
 if snap.total_cents=0 then
  if selected_step_sanctioning_coverage_v3.expense_id is not null then return jsonb_build_object('status','blocked','code','sanctioning_expense_unexpected');end if;amount:=0;
 else
  select x into item from jsonb_array_elements(owned->'ledger'->'sources')x where x->>'sourceId'=selected_step_sanctioning_coverage_v3.expense_id::text and x->>'kind'='expense';
  if selected_step_sanctioning_coverage_v3.expense_id is null or item is null or not exists(select 1 from app.tournament_expense_events x
   where x.id=selected_step_sanctioning_coverage_v3.expense_id and x.tournament_id=tid and x.event_type='recorded'and x.amount_minor::numeric=(item->>'amountMinor')::numeric
   and not exists(select 1 from app.tournament_expense_events newer where newer.expense_id=x.expense_id and newer.version>x.version))
  then return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');end if;
  select sum((x->>'amountMinor')::numeric)into amount from jsonb_array_elements(item->'allocations')x
   where x->>'eventId'=eid::text and x->>'bucket'in('player_benefit','operating_expense')and x->'classificationReviewed'='true'::jsonb and x->'poolId'='null'::jsonb;
  if amount is null or amount<snap.total_cents or amount is distinct from(item->>'amountMinor')::numeric then return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');end if;
  if exists(select 1 from app.native_recorded_fund_reviews_v1 where tournament_id=tid and event_id<>eid and sanctioning_expense_event_id=selected_step_sanctioning_coverage_v3.expense_id)
   or exists(select 1 from app.native_optional_fund_reviews_v2 where tournament_id=tid and event_id<>eid and sanctioning_expense_event_id=selected_step_sanctioning_coverage_v3.expense_id)
   or exists(select 1 from app.selected_step_fund_reviews_v3 where tournament_id=tid and event_id<>eid and sanctioning_expense_event_id=selected_step_sanctioning_coverage_v3.expense_id)
   or exists(select 1 from app.event_settlement_finals_v2 f join app.event_settlement_drafts_v5 d on d.id=f.draft_id where f.tournament_id=tid and d.sanctioning_expense_event_id=selected_step_sanctioning_coverage_v3.expense_id)
  then return jsonb_build_object('status','blocked','code','sanctioning_expense_reused');end if;
 end if;
 -- Assessment is COVERED by the already-subtracted classified expense. Never
 -- deduct it again from the regular fund or from either optional pool.
 return jsonb_build_object('status','available','snapshotId',snap.id,'eventPlayStartId',started.id,'totalMinor',snap.total_cents,'expenseSourceId',selected_step_sanctioning_coverage_v3.expense_id,'allocatedExpenseMinor',amount,'deductAgain',false);
end$body$;

create function app.selected_step_final_review_source_v3(actor uuid,sid uuid,tid uuid,eid uuid,expense_id uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare workspace jsonb;native jsonb;owned jsonb;sport jsonb;pools jsonb;sanction jsonb;capture jsonb;h text;
begin
 if app.selected_step_final_review_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 lock table app.playoff_prize_proposal_heads_v2,app.playoff_prize_proposal_revisions_v2,app.playoff_prize_proposal_operations_v2,app.playoff_prize_proposal_outcomes_v2 in share mode nowait;
 if app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false
  or exists(select 1 from app.modern_prize_award_sets_v2 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)
 then return jsonb_build_object('status','blocked','code','existing_regular_liability');end if;
 workspace:=app.get_selected_step_prize_workspace_v3(actor,sid,tid,eid);
 if workspace->>'status'='retry_exact'then return workspace;end if;
 if workspace is null or workspace->'stale'is distinct from'false'::jsonb or workspace->'head'is null or workspace->'head'='null'::jsonb then return jsonb_build_object('status','blocked','code','current_modern_prize_proposal_required');end if;
 native:=workspace->'nativeSource';owned:=native#>'{capture,ownershipLedger}';
 if native->>'kind'is distinct from'selected-step-prize-source-v3'or owned->>'kind'is distinct from'selected-step-regular-ledger-v3'
 then return jsonb_build_object('status','blocked','code','modern_owned_source_required');end if;
 sport:=app.selected_step_sporting_source_v3(actor,sid,tid,eid);
 if sport->>'status'='retry_exact'then return sport;end if;
 if sport is null or sport->>'status'is distinct from'source_available'then return coalesce(sport,jsonb_build_object('status','blocked','code','completed_playoff_source_required'));end if;
 if sport#>'{qualification,resultVersionId}'is distinct from native#>'{capture,input,qualification,currentResultVersionId}'
  or sport->'binding'is distinct from jsonb_build_object('bindingId',native#>'{capture,prizeActivation,settingsBinding,id}',
   'settingsSnapshotId',native#>'{capture,input,binding,settingsSnapshotId}','reviewId',native#>'{capture,prizeActivation,settingsBinding,review_id}',
   'activationId',native#>'{capture,prizeActivation,activation,id}')
  or sport#>'{playoff,gateDigest}'is distinct from owned#>'{capture,ownershipSource,capture,nativePlayoffSource,sourceDigest}'
 then return jsonb_build_object('status','blocked','code','sporting_prize_source_changed');end if;
 pools:=app.get_selected_step_pool_source_v3(actor,tid,eid);
 if pools->>'status'='retry_exact'then return pools;end if;
 if pools is null or pools->>'status'is distinct from'source_available'
  or pools->'ownershipRevisionId'is distinct from owned->'ownershipRevisionId'
  or pools->'ownershipSource'is distinct from owned#>'{capture,ownershipSource}'
  or pools->'qMinor'is distinct from owned#>'{funds,qReceiptsMinor}'or pools->'sideMinor'is distinct from owned#>'{funds,sideReceiptsMinor}'
  or pools->'qualificationResultVersionId'is distinct from sport#>'{qualification,resultVersionId}'
 then return jsonb_build_object('status','blocked','code','current_separate_pool_proof_required');end if;
 perform app.lock_native_optional_income_sources_v2();
 -- Zero is a narrowly supported explicit review, never inferred from an
 -- unavailable journal. Any root/history (even voided) holds for its real
 -- versioned income adapter; cannot silently omit an older-domain correction.
 if exists(select 1 from app.native_unrestricted_income_sources_v1 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_optional_income_records_v2 where tournament_id=tid and event_id=eid)
 then return jsonb_build_object('status','blocked','code','modern_income_lineage_adapter_required');end if;
 sanction:=app.selected_step_sanctioning_coverage_v3(tid,eid,owned,expense_id);
 if sanction->>'status'is distinct from'available'then return sanction;end if;
 capture:=jsonb_build_object('kind','selected-step-final-review-source-v3','actorId',actor,'tournamentId',tid,'eventId',eid,
  'prizeWorkspace',workspace,'ownershipLedger',owned,'sportingSource',sport,'optionalPools',pools,'sanctioning',sanction,
  'income',jsonb_build_object('status','explicit_zero_review_required','roots','[]'::jsonb,'records','[]'::jsonb,'activeMinor',0),
  'totals',owned->'funds','moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 -- Session identity is checked live but not hashed: a fresh valid session may
 -- recover an actor's exact request. No JWT/session claims are overwritten.
 capture:=jsonb_set(capture,'{sportingSource}',sport-'sessionId',false);
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 h:=encode(extensions.digest(convert_to(capture::text,'utf8'),'sha256'),'hex');
 return capture||jsonb_build_object('status','source_available','sourceDigest',h,'recordedFundComplete',false,'directorReviewRequired',true);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','blocked','code','modern_final_source_invalid');end$body$;

create function app.review_selected_step_fund_v3(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare prior app.selected_step_fund_operations_v3%rowtype;head app.selected_step_fund_reviews_v3%rowtype;
 source jsonb;h text;result jsonb;rid uuid:=extensions.gen_random_uuid();expense_id uuid;
begin
 if app.selected_step_final_review_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if op is null or(case when jsonb_typeof(request)='object'then(select count(*)from jsonb_object_keys(request))<>7 or not(request?&array['kind','expectedVersion','sourceDigest','sanctioningExpenseEventId','incomeStatus','reviewed','reason'])else true end)
  or request->>'kind'is distinct from'selected-step-fund-review-v3'or request->>'incomeStatus'is distinct from'reviewed_zero'or request->'reviewed'is distinct from'true'::jsonb
  or jsonb_typeof(request->'expectedVersion')is distinct from'number'or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,9})$'or(request->>'expectedVersion')::numeric>=2147483647
  or coalesce(request->>'sourceDigest','')!~'^[a-f0-9]{64}$'
  or(request->'sanctioningExpenseEventId'is distinct from'null'::jsonb and coalesce(request->>'sanctioningExpenseEventId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$')
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'is distinct from app.custom_payout_classification_text_v2(request->>'reason')or app.event_settings_js_text_length_v3(request->>'reason')not between 1 and 2000
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('selected-step-fund-v3:'||actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('selected-step-fund-review-v3',actor,tid,eid,op,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.selected_step_fund_operations_v3 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid or prior.request is distinct from request or prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  select o.result into result from app.selected_step_fund_outcomes_v3 o where o.actor_id=actor and o.operation_id=op;
  return coalesce(result,jsonb_build_object('status','retry_exact','code','operation_incomplete'));
 end if;
 expense_id:=case when request->'sanctioningExpenseEventId'='null'::jsonb then null else(request->>'sanctioningExpenseEventId')::uuid end;
 source:=app.selected_step_final_review_source_v3(actor,sid,tid,eid,expense_id);
 if source->>'status'='retry_exact'then return source;end if;
 if source is null or source->>'status'is distinct from'source_available'then return jsonb_build_object('status','rejected','code',coalesce(source->>'code','source_unavailable'));end if;
 if source->>'sourceDigest'is distinct from request->>'sourceDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 select*into head from app.selected_step_fund_reviews_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if coalesce(head.version,0)::numeric is distinct from(request->>'expectedVersion')::numeric then return jsonb_build_object('status','rejected','code','stale_version');end if;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 insert into app.selected_step_fund_operations_v3(actor_id,operation_id,tournament_id,event_id,session_id,request,request_hash)values(actor,op,tid,eid,sid,request,h);
 insert into app.selected_step_fund_reviews_v3(id,tournament_id,event_id,version,prior_review_id,actor_id,operation_id,proposal_revision_id,ownership_revision_id,sanctioning_snapshot_id,sanctioning_expense_event_id,source_digest,source_capture,reason)
 values(rid,tid,eid,coalesce(head.version,0)+1,head.id,actor,op,(source#>>'{prizeWorkspace,head,revisionId}')::uuid,(source#>>'{ownershipLedger,ownershipRevisionId}')::uuid,
  (source#>>'{sanctioning,snapshotId}')::uuid,expense_id,source->>'sourceDigest',source,request->>'reason');
 result:=jsonb_build_object('status','selected_step_fund_reviewed_v3','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'reviewId',rid,
  'version',coalesce(head.version,0)+1,'sourceDigest',source->>'sourceDigest','incomeStatus','reviewed_zero','moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 insert into app.selected_step_fund_outcomes_v3(actor_id,operation_id,tournament_id,event_id,result)values(actor,op,tid,eid,result);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)
 values(tid,actor,'selected_step_fund_review_v3',rid,'reviewed',result||jsonb_build_object('sessionId',sid,'reason',request->>'reason'));
 return result;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');end$body$;

create function app.current_selected_step_fund_v3(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare head app.selected_step_fund_reviews_v3%rowtype;source jsonb;operation app.selected_step_fund_operations_v3%rowtype;outcome jsonb;
begin
 if app.selected_step_final_review_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 lock table app.selected_step_fund_operations_v3,app.selected_step_fund_reviews_v3,app.selected_step_fund_outcomes_v3 in share mode nowait;
 select*into head from app.selected_step_fund_reviews_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if head.id is null then return jsonb_build_object('status','blocked','code','modern_fund_review_required');end if;
 source:=app.selected_step_final_review_source_v3(actor,sid,tid,eid,head.sanctioning_expense_event_id);
 if source->>'status'='retry_exact'then return source;end if;
 if source is null or source->>'status'is distinct from'source_available'or source->>'sourceDigest'is distinct from head.source_digest or source is distinct from head.source_capture
 then return jsonb_build_object('status','blocked','code','modern_fund_review_stale');end if;
 select*into operation from app.selected_step_fund_operations_v3 where actor_id=head.actor_id and operation_id=head.operation_id and tournament_id=tid and event_id=eid;
 select o.result into outcome from app.selected_step_fund_outcomes_v3 o where o.actor_id=head.actor_id and o.operation_id=head.operation_id and o.tournament_id=tid and o.event_id=eid;
 if operation.operation_id is null or operation.request->>'sourceDigest'is distinct from head.source_digest or operation.request->>'incomeStatus'is distinct from'reviewed_zero'
  or operation.request->'reviewed'is distinct from'true'::jsonb or outcome->>'reviewId'is distinct from head.id::text or outcome->>'sourceDigest'is distinct from head.source_digest
 then return jsonb_build_object('status','blocked','code','modern_fund_journal_incomplete');end if;
 return jsonb_build_object('status','source_available','kind','current-selected-step-fund-v3','actorId',actor,'tournamentId',tid,'eventId',eid,
  'reviewId',head.id,'reviewVersion',head.version,'sourceDigest',head.source_digest,'capture',source,'recordedFundComplete',true,
  'bankReceiptVerified',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$body$;

do $functions$declare signature text;begin foreach signature in array array[
 'app.selected_step_final_review_enabled_v3()','app.selected_step_final_access_v3(uuid,uuid,uuid,uuid)',
 'app.selected_step_sanctioning_coverage_v3(uuid,uuid,jsonb,uuid)','app.guard_selected_step_sanction_reuse_v3()',
 'app.selected_step_final_review_source_v3(uuid,uuid,uuid,uuid,uuid)',
 'app.review_selected_step_fund_v3(uuid,uuid,uuid,uuid,uuid,jsonb)',
 'app.current_selected_step_fund_v3(uuid,uuid,uuid,uuid)'
 ]loop execute format('alter function %s owner to postgres',signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);end loop;end$functions$;
commit;
