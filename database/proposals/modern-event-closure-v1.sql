-- PRIVATE / DEFAULT OFF. Bind existing Close Event play lifecycle to the
-- accepted unpaid snapshot; do not redefine legacy sporting playState.
begin;
create function app.modern_event_closure_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;
create table app.modern_event_closures_v1(
 id uuid primary key default extensions.gen_random_uuid(),actor_id uuid not null references app.profiles(id),session_id uuid not null,operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,snapshot_id uuid not null,play_close_id uuid not null references app.event_play_closes(id),request jsonb not null,result jsonb not null,closed_at timestamptz not null default clock_timestamp(),
 unique(actor_id,operation_id),unique(tournament_id,event_id),
 foreign key(snapshot_id,tournament_id,event_id)references app.modern_event_final_snapshots_v1(id,tournament_id,event_id)
);
alter table app.modern_event_closures_v1 enable row level security;
alter table app.modern_event_closures_v1 force row level security;
revoke all on app.modern_event_closures_v1 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.modern_event_closures_v1 for each row execute function app.reject_immutable_history();
create trigger no_truncate before truncate on app.modern_event_closures_v1 for each statement execute function app.reject_immutable_history();
create function app.current_modern_event_closure_v1(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare w jsonb;c app.modern_event_closures_v1%rowtype;ready jsonb;begin
 if app.modern_event_closure_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 w:=public.get_modern_event_final_workspace_v1(actor,sid,tid,eid);
 if w->>'status'is distinct from'recorded'or w->'currentSourceVerified'is distinct from'true'::jsonb then return jsonb_build_object('status','held','code','current_final_snapshot_required','currentSourceVerified',false);end if;
 ready:=app.event_play_close_readiness_v1(eid);
 if coalesce((ready->>'scheduledGames')::integer,0)<=0 or coalesce((ready->>'unresolvedGames')::integer,-1)<>0 then return jsonb_build_object('status','held','code','games_unresolved','currentSourceVerified',false);end if;
 select*into c from app.modern_event_closures_v1 where tournament_id=tid and event_id=eid;
 if c.id is not null and(c.snapshot_id::text is distinct from w#>>'{record,id}'or app.event_play_close_state_v1(eid)<>'closed'or not exists(select 1 from app.event_play_closes x where x.id=c.play_close_id and x.event_id=eid and x.tournament_id=tid and x.action='closed'))then return jsonb_build_object('status','held','code','closure_source_changed','currentSourceVerified',false);end if;
 return w||jsonb_build_object('kind','modern-event-closure-workspace-v1','status',case when c.id is null then'review'else'recorded'end,'snapshotId',w#>'{record,id}','closureId',c.id,'closeState',app.event_play_close_state_v1(eid),'readiness',ready);
end$$;
create function app.record_modern_event_closure_v1(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
declare prior app.modern_event_closures_v1%rowtype;w jsonb;r jsonb;inner_result jsonb;close_row app.event_play_closes%rowtype;new_id uuid:=extensions.gen_random_uuid();begin
 if app.modern_event_closure_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_unsupported');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array['kind','expectedSourceDigest','snapshotId','confirmed','reason'])is distinct from true or request->>'kind'is distinct from'modern-event-close-v1'or request->'confirmed'is distinct from'true'::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->'reason')is distinct from true or length(request->>'reason')>1000 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 -- Same order as existing lifecycle mutation. Try locks never wait through a
 -- different operation's lock-order inversion. Scope lock also serializes funds.
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('event-play-gate:'||eid::text,0))or not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 select*into prior from app.modern_event_closures_v1 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id=tid and prior.event_id=eid and prior.request=request then return prior.result;end if;return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 if exists(select 1 from app.modern_event_closures_v1 where tournament_id=tid and event_id=eid)or exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 w:=app.current_modern_event_closure_v1(actor,sid,tid,eid);
 if w->>'status'is distinct from'review'or w->'currentSourceVerified'is distinct from'true'::jsonb or w->>'snapshotId'is distinct from request->>'snapshotId'or w#>>'{source,sourceDigest}'is distinct from request->>'expectedSourceDigest'then return jsonb_build_object('status','rejected','code','review_source_changed');end if;
 begin
  inner_result:=public.close_event_play_v1(actor,tid,eid,request->>'reason',true,op);
  if inner_result->>'status'not in('event_play_closed','already_closed')or inner_result->>'status'is null then raise exception using errcode='ZMC01',message='event_close_refused';end if;
  select*into close_row from app.event_play_closes where tournament_id=tid and event_id=eid order by sequence_number desc limit 1;
  if close_row.id is null or close_row.action<>'closed'or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception'event_close_postcondition_failed';end if;
  -- Close changes no captured sporting playState; revalidate the exact snapshot
  -- after the real lifecycle writer rather than assuming its result is enough.
  w:=app.current_modern_event_closure_v1(actor,sid,tid,eid);
  if w->>'status'is distinct from'review'or w->>'snapshotId'is distinct from request->>'snapshotId'or w#>>'{source,sourceDigest}'is distinct from request->>'expectedSourceDigest'then raise exception'event_close_source_changed';end if;
  r:=jsonb_build_object('kind','modern-event-close-receipt-v1','status','accepted','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'closureId',new_id,'snapshotId',request->'snapshotId','sourceDigest',request->'expectedSourceDigest','closeState','closed','historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false,'payoutAuthorized',false,'officialMrpAwarded',false,'accSubmissionPerformed',false);
  insert into app.modern_event_closures_v1(id,actor_id,session_id,operation_id,tournament_id,event_id,snapshot_id,play_close_id,request,result)values(new_id,actor,sid,op,tid,eid,(request->>'snapshotId')::uuid,close_row.id,request,r);
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'modern_event_closure_v1',new_id,'event_closed_against_unpaid_snapshot',r||jsonb_build_object('sessionId',sid,'playCloseId',close_row.id));
 exception when sqlstate'ZMC01'then return coalesce(inner_result,jsonb_build_object('status','rejected','code','event_close_refused'));end;
 return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function public.get_modern_event_closure_workspace_v1(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language sql security definer set search_path=''as $$select app.current_modern_event_closure_v1(actor,sid,tid,eid)$$;
create function public.record_modern_event_closure_provider_v1(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language sql security definer set search_path=''as $$select app.record_modern_event_closure_v1(actor,sid,tid,eid,op,request)$$;
create function public.get_modern_event_closure_operation_v1(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$declare c app.modern_event_closures_v1%rowtype;begin
 if app.modern_event_closure_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 select*into c from app.modern_event_closures_v1 where actor_id=actor and operation_id=op;if not found then return jsonb_build_object('status','unknown','code','operation_not_found');end if;
 if c.tournament_id<>tid or c.event_id<>eid or c.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;return c.result;end$$;
do $$declare r record;begin for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='app'and p.proname in('modern_event_closure_enabled_v1','current_modern_event_closure_v1','record_modern_event_closure_v1'))or(n.nspname='public'and p.proname in('get_modern_event_closure_workspace_v1','record_modern_event_closure_provider_v1','get_modern_event_closure_operation_v1'))loop execute format('alter function %s owner to postgres',r.signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);end loop;end$$;
commit;
