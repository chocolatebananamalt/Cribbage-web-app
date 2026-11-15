-- LOCAL, UNEXECUTED, PRIVATE, DEFAULT-OFF CANDIDATE. No grants/migration.
-- Depends on reviewed native publication/recovery/cancellation proposals.
-- A simulated Start is NOT ordinary attendance, Start Play or score authority.
begin;
create function app.native_mixed_simulation_start_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.native_mixed_simulation_start_recovery_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create function app.native_mixed_simulation_start_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array[
 'expectedAttendanceSourceDigest','expectedContextId','expectedScheduleSourceDigest','kind','operationId','reason','statement']
 and v->>'kind'='native-mixed-simulation-start-v1'
 and app.native_mixed_simulation_uuid_v1(v->>'operationId')
 and app.native_mixed_simulation_uuid_v1(v->>'expectedContextId')
 and jsonb_typeof(v->'expectedAttendanceSourceDigest')='string'
 and coalesce(v->>'expectedAttendanceSourceDigest','')~'^[a-f0-9]{64}$'
 and jsonb_typeof(v->'expectedScheduleSourceDigest')='string'
 and coalesce(v->>'expectedScheduleSourceDigest','')~'^[a-f0-9]{64}$'
 and app.native_mixed_simulation_reason_v1(v,'reason')
 and v->>'statement'='fictional-test-only-no-ordinary-attendance-v1'$$;

create table app.native_mixed_simulation_starts_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 operation_receipt_id uuid not null unique references app.operation_receipts(id),
 publication_context_id uuid not null,request_payload jsonb not null,
 source_capture jsonb not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 started_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(publication_context_id,tournament_id,event_id)references app.native_mixed_simulation_publication_contexts_v1(id,tournament_id,event_id),
 check(app.native_mixed_simulation_start_request_valid_v1(request_payload)is true),
 check(request_payload->>'operationId'=operation_id::text),
 check(source_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array(
  'native-mixed-simulation-start-source-v1',actor_id,operation_id,tournament_id,event_id,publication_context_id,request_payload,source_capture)))
);
alter table app.native_mixed_simulation_starts_v1 owner to postgres;
alter table app.native_mixed_simulation_starts_v1 enable row level security;
alter table app.native_mixed_simulation_starts_v1 force row level security;
revoke all on table app.native_mixed_simulation_starts_v1 from public,anon,authenticated,service_role;
create trigger native_mixed_simulation_start_immutable_v1 before update or delete on app.native_mixed_simulation_starts_v1
 for each row execute function app.reject_immutable_history();

create function app.native_mixed_simulation_start_receipt_v1(s app.native_mixed_simulation_starts_v1)returns jsonb
language sql stable security definer set search_path=''set timezone='UTC'as $$
 select jsonb_build_object('kind','native-mixed-simulation-start-receipt-v1','status','accepted','code','simulated_start_recorded',
 'actorId',(s).actor_id,'tournamentId',(s).tournament_id,'eventId',(s).event_id,'operationId',(s).operation_id,
 'request',(s).request_payload,'startId',(s).id,'contextId',(s).publication_context_id,'sourceDigest',(s).source_digest,
 'startedAt',to_char((s).started_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'participantCount',18,'gameCount',12,'matchCount',108,'simulationStarted',true,
 'currentSourceVerified',true,'historicalReceipt',false,
 'ordinaryAttendanceUsed',false,'normalStartAuthorized',false,'scoringAuthorized',false,
 'humanPresenceVerified',false,'paymentVerified',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false)
 $$;

create function app.native_mixed_simulation_start_bound_v1(start_value uuid)returns boolean
language sql stable security definer set search_path=''as $$
 select exists(select 1 from app.native_mixed_simulation_starts_v1 s
 join app.operation_receipts r on r.id=s.operation_receipt_id
 join app.native_mixed_simulation_publication_contexts_v1 c on c.id=s.publication_context_id and c.tournament_id=s.tournament_id and c.event_id=s.event_id
 where s.id=start_value
 and r.actor_profile_id=s.actor_id and r.client_operation_id=s.operation_id and r.tournament_id=s.tournament_id
 and r.operation_type='native_mixed_simulation_start_v1'and r.target_id=s.id and r.outcome='accepted'
 and r.request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-start-v1',s.actor_id,s.tournament_id,s.event_id,s.request_payload))
 and r.response_payload=app.native_mixed_simulation_start_receipt_v1(s)
 and app.native_mixed_simulation_publication_bound_v1(c.id)is true
 and s.source_capture->>'kind'='native-mixed-simulation-schedule-source-v1'
 and s.source_capture->>'actorId'=s.actor_id::text and s.source_capture->>'tournamentId'=s.tournament_id::text
 and s.source_capture->>'eventId'=s.event_id::text
 and s.request_payload->>'expectedContextId'=c.id::text
 and s.source_capture#>>'{publication,contextId}'=c.id::text
 and s.request_payload->>'expectedScheduleSourceDigest'=s.source_capture->>'sourceDigest'
 and s.request_payload->>'expectedAttendanceSourceDigest'=c.attendance_source_digest
 and s.source_capture#>>'{attendance,sourceDigest}'=c.attendance_source_digest
 and s.source_capture->'fixedAssignments'=c.source_capture->'nativeAssignments'
 and s.source_capture->'canonicalGames'=c.source_capture->'nativeGames'
 and s.source_capture->'normalStartAuthorized'='false'::jsonb
 and s.source_capture->'ordinaryAttendanceUsed'='false'::jsonb
 and exists(select 1 from app.audit_events a where a.operation_receipt_id=r.id and a.tournament_id=s.tournament_id
  and a.actor_profile_id=s.actor_id and a.entity_type='native_mixed_simulation_start'and a.entity_id=s.id
  and a.action='native_mixed_simulation_started'and a.after_state=r.response_payload))$$;

create function app.record_native_mixed_simulation_start_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare op uuid;old app.operation_receipts%rowtype;s app.native_mixed_simulation_starts_v1%rowtype;
 source jsonb;digest text;idv uuid:=extensions.gen_random_uuid();receipt_id uuid:=extensions.gen_random_uuid();response jsonb;rh text;
begin
 if app.native_mixed_simulation_start_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if actor is null or tid is null or eid is null or current_setting('transaction_isolation')<>'read committed'
  or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if app.native_mixed_simulation_start_request_valid_v1(request)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(request->>'operationId')::uuid;rh:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-start-v1',actor,tid,eid,request));
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))
 then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 perform 1 from app.profiles where id=actor for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;if not found then return null;end if;
 -- Resolve this actor's exact immutable operation BEFORE checking fresh consent/source.
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then
  if old.tournament_id<>tid or old.operation_type<>'native_mixed_simulation_start_v1'or old.request_hash<>rh then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select*into s from app.native_mixed_simulation_starts_v1 where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
  if s.id is null or s.request_payload is distinct from request or app.native_mixed_simulation_start_bound_v1(s.id)is distinct from true
  then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  return old.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'and status='open'and registration_status='closed'for update nowait;
 if not found then return jsonb_build_object('status','rejected','code','test_scope_required');end if;
 perform app.lock_native_mixed_simulation_sources_v1();
 lock table app.native_mixed_simulation_starts_v1,app.native_mixed_simulation_cancellations_v1 in share row exclusive mode nowait;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true
  or exists(select 1 from app.native_mixed_simulation_cancellations_v1 where actor_id=actor and operation_id=op)
 then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 if exists(select 1 from app.native_mixed_simulation_starts_v1 where tournament_id=tid and event_id=eid)
 then return jsonb_build_object('status','rejected','code','simulation_already_started');end if;
 if exists(select 1 from app.native_mixed_simulation_cancellations_v1 where tournament_id=tid and event_id=eid and action='draw')
 then return jsonb_build_object('status','rejected','code','draw_terminal');end if;
 source:=app.native_mixed_simulation_schedule_source_v1(actor,tid,eid);
 if source->>'status'is distinct from'source_available'
  or source#>>'{publication,contextId}'is distinct from request->>'expectedContextId'
  or source->>'sourceDigest'is distinct from request->>'expectedScheduleSourceDigest'
  or source#>>'{attendance,sourceDigest}'is distinct from request->>'expectedAttendanceSourceDigest'
  or source#>'{publication,assignmentCount}'is distinct from'18'::jsonb
  or source#>'{publication,roundCount}'is distinct from'12'::jsonb
  or source#>'{publication,matchCount}'is distinct from'108'::jsonb
  or app.native_mixed_admission_score_history_empty_v1(tid,eid)is distinct from true
  or exists(select 1 from app.canonical_games where event_id=eid and state<>'pending')
 then return jsonb_build_object('status','rejected','code','publication_or_readiness_changed');end if;
 digest:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-start-source-v1',actor,op,tid,eid,(request->>'expectedContextId')::uuid,request,source));
 -- Build the immutable receipt once; operation_receipts are never updated.
 select idv,tid,eid,actor,op,receipt_id,(request->>'expectedContextId')::uuid,request,source,digest,clock_timestamp()into s;
 response:=app.native_mixed_simulation_start_receipt_v1(s);
 -- Generic receipt/audit reservation, explicitly SIMULATED; no ordinary Start row.
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(receipt_id,actor,tid,'native_mixed_simulation_start_v1',idv,rh,op,'accepted',response,clock_timestamp());
 insert into app.native_mixed_simulation_starts_v1(id,tournament_id,event_id,actor_id,operation_id,operation_receipt_id,publication_context_id,request_payload,source_capture,source_digest,started_at)
 values(s.id,s.tournament_id,s.event_id,s.actor_id,s.operation_id,s.operation_receipt_id,s.publication_context_id,s.request_payload,s.source_capture,s.source_digest,s.started_at);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(tid,actor,receipt_id,'native_mixed_simulation_start',idv,'native_mixed_simulation_started',response);
 if app.native_mixed_simulation_start_bound_v1(idv)is distinct from true then raise exception'simulated start postcondition failed';end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.get_native_mixed_simulation_start_operation_v1(actor uuid,tid uuid,eid uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare s app.native_mixed_simulation_starts_v1%rowtype;begin
 if app.native_mixed_simulation_start_recovery_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','recovery_unavailable');end if;
 if actor is null or tid is null or eid is null or op is null or current_setting('transaction_isolation')<>'read committed'
  or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;if not found then return null;end if;
 lock table app.native_mixed_simulation_starts_v1,app.operation_receipts,app.audit_events in share mode nowait;
 select*into s from app.native_mixed_simulation_starts_v1 where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
 if not found then return null;end if;
 if app.native_mixed_simulation_start_bound_v1(s.id)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 return app.native_mixed_simulation_start_receipt_v1(s)||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.get_native_mixed_simulation_started_source_v1(actor uuid,tid uuid,eid uuid,start_value uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare s app.native_mixed_simulation_starts_v1%rowtype;source jsonb;begin
 if app.native_mixed_simulation_start_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if actor is null or tid is null or eid is null or start_value is null or current_setting('transaction_isolation')<>'read committed'
  or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_simulation_sources_v1();
 lock table app.native_mixed_simulation_starts_v1 in share mode nowait;
 select*into s from app.native_mixed_simulation_starts_v1 where id=start_value and actor_id=actor and tournament_id=tid and event_id=eid;
 if not found or app.native_mixed_simulation_start_bound_v1(s.id)is distinct from true then return jsonb_build_object('status','blocked','code','start_unavailable');end if;
 source:=app.native_mixed_simulation_schedule_source_v1(actor,tid,eid);
 if source->>'status'is distinct from'source_available'or source is distinct from s.source_capture
 then return jsonb_build_object('status','blocked','code','publication_or_readiness_changed');end if;
 return jsonb_build_object('kind','native-mixed-simulation-start-source-v1','actorId',actor,'tournamentId',tid,'eventId',eid,
 'receipt',app.native_mixed_simulation_start_receipt_v1(s),'currentSourceVerified',true,'normalStartAuthorized',false,'scoringAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

do $$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_simulation_start_enabled_v1()'::regprocedure,
 'app.native_mixed_simulation_start_recovery_enabled_v1()'::regprocedure,
 'app.native_mixed_simulation_start_request_valid_v1(jsonb)'::regprocedure,
 'app.native_mixed_simulation_start_receipt_v1(app.native_mixed_simulation_starts_v1)'::regprocedure,
 'app.native_mixed_simulation_start_bound_v1(uuid)'::regprocedure,
 'app.record_native_mixed_simulation_start_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.get_native_mixed_simulation_start_operation_v1(uuid,uuid,uuid,uuid)'::regprocedure,
 'app.get_native_mixed_simulation_started_source_v1(uuid,uuid,uuid,uuid)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$$;
commit;
