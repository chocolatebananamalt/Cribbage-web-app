-- LOCAL, UNEXECUTED, PRIVATE, DEFAULT-OFF CANDIDATE.
-- Proves only that no simulation operation COMMITTED while serialized by the
-- actor/operation and event-pipeline locks. It does not prove that an aborted
-- transaction never ran or never consumed random entropy. A cancelled draw is
-- therefore terminal for this event and never authorizes a replacement draw.
begin;

create function app.native_mixed_simulation_cancellation_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.native_mixed_simulation_cancellation_recovery_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create function app.native_mixed_simulation_cancellation_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array['action','kind','operationId','operationRequest','reason']
 and v->>'kind'='native-mixed-simulation-cancellation-v1'
 and app.native_mixed_simulation_uuid_v1(v->>'operationId')
 and v->>'action'in('plan','draw','review','publish')
 and v->'operationRequest'->>'operationId'=v->>'operationId'
 and app.native_mixed_simulation_reason_v1(v,'reason')
 and(case v->>'action'
  when'plan'then app.native_mixed_simulation_plan_request_valid_v1(v->'operationRequest')
  when'draw'then app.native_mixed_simulation_draw_request_valid_v1(v->'operationRequest')
  when'review'then app.native_mixed_simulation_review_request_valid_v1(v->'operationRequest')
  when'publish'then app.native_mixed_simulation_publish_request_valid_v1(v->'operationRequest')
  else false end)is true$$;

create table app.native_mixed_simulation_cancellations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,
 action text not null check(action in('plan','draw','review','publish')),
 request_payload jsonb not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 cancellation_reason text not null check(cancellation_reason=trim(cancellation_reason)
  and length(cancellation_reason)between 1 and 500 and cancellation_reason!~'[[:cntrl:]]'),
 cancellation_hash text not null check(cancellation_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check((case action
  when'plan'then app.native_mixed_simulation_plan_request_valid_v1(request_payload)
  when'draw'then app.native_mixed_simulation_draw_request_valid_v1(request_payload)
  when'review'then app.native_mixed_simulation_review_request_valid_v1(request_payload)
  when'publish'then app.native_mixed_simulation_publish_request_valid_v1(request_payload)
  else false end)is true),
 check(request_payload->>'operationId'=operation_id::text),
 check(request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array(
  'native-mixed-simulation-publication-v1',action,actor_id,operation_id,tournament_id,event_id,request_payload))),
 check(cancellation_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array(
  'native-mixed-simulation-cancellation-v1',actor_id,operation_id,tournament_id,event_id,
  action,request_payload,cancellation_reason)))
);
create unique index native_mixed_simulation_one_cancelled_draw_v1
 on app.native_mixed_simulation_cancellations_v1(tournament_id,event_id)where action='draw';
alter table app.native_mixed_simulation_cancellations_v1 owner to postgres;
alter table app.native_mixed_simulation_cancellations_v1 enable row level security;
alter table app.native_mixed_simulation_cancellations_v1 force row level security;
revoke all on table app.native_mixed_simulation_cancellations_v1 from public,anon,authenticated,service_role;
create trigger native_mixed_simulation_cancellations_immutable_v1 before update or delete
 on app.native_mixed_simulation_cancellations_v1 for each row execute function app.reject_immutable_history();
create trigger native_mixed_simulation_cancellations_no_truncate_v1 before truncate
 on app.native_mixed_simulation_cancellations_v1 for each statement execute function app.reject_immutable_history();

create function app.native_mixed_simulation_cancellation_receipt_v1(
 c app.native_mixed_simulation_cancellations_v1,historical boolean default false
)returns jsonb language sql stable security definer set search_path=''as $$select jsonb_build_object(
 'kind','native-mixed-simulation-cancellation-receipt-v1','status','cancelled_no_committed_operation',
 'code','simulation_operation_cancelled','actorId',c.actor_id,'tournamentId',c.tournament_id,
 'eventId',c.event_id,'operationId',c.operation_id,'action',c.action,'request',c.request_payload,
 'requestHash',c.request_hash,'cancellationReason',c.cancellation_reason,
 'notCommitted',true,'executionNotProven',true,'freshDrawAuthorized',false,
 'normalStartAuthorized',false,'currentSourceVerified',false
 )||case when historical then jsonb_build_object('historicalReceipt',true)else'{}'::jsonb end$$;

-- Every affected operation domain takes the same actor/op advisory lock. The
-- simulation draw branch also takes the event-pipeline lock so a cancelled
-- draw blocks every later draw operation ID for that event.
create function app.reject_native_mixed_simulation_cancelled_operation_v1()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if not pg_try_advisory_xact_lock(hashtextextended(new.actor_id::text||':'||new.operation_id::text,0))
 then raise exception using errcode='55P03',message='native mixed simulation cancellation busy';end if;
 if exists(select 1 from app.native_mixed_simulation_cancellations_v1 c
  where c.actor_id=new.actor_id and c.operation_id=new.operation_id)
 then raise exception using errcode='23505',message='native mixed simulation operation cancelled';end if;
 if tg_table_name='native_mixed_simulation_operations_v1'then
  if new.action='draw'then
   if not pg_try_advisory_xact_lock(hashtextextended(
    'native-mixed-simulation:'||new.tournament_id::text||':'||new.event_id::text,0))
   then raise exception using errcode='55P03',message='native mixed simulation cancellation busy';end if;
   if exists(select 1 from app.native_mixed_simulation_cancellations_v1 c
    where c.tournament_id=new.tournament_id and c.event_id=new.event_id and c.action='draw')
   then raise exception using errcode='23505',message='native mixed simulation draw cancelled';end if;
  end if;
 end if;
 return new;
end$$;
create trigger native_mixed_simulation_cancelled_operation_guard_v1 before insert on app.native_mixed_simulation_operations_v1
 for each row execute function app.reject_native_mixed_simulation_cancelled_operation_v1();
create trigger native_mixed_admission_cancelled_operation_guard_v1 before insert on app.native_mixed_admission_operations_v1
 for each row execute function app.reject_native_mixed_simulation_cancelled_operation_v1();
create trigger native_mixed_funding_cancelled_operation_guard_v1 before insert on app.native_mixed_funding_operations_v1
 for each row execute function app.reject_native_mixed_simulation_cancelled_operation_v1();
create trigger native_mixed_attendance_cancelled_operation_guard_v1 before insert on app.native_mixed_attendance_operations_v1
 for each row execute function app.reject_native_mixed_simulation_cancelled_operation_v1();

create function app.cancel_native_mixed_simulation_operation_v1(
 actor uuid,tid uuid,eid uuid,request jsonb
)returns jsonb language plpgsql volatile security definer
set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare op uuid;action_value text;operation_request jsonb;reason_value text;
 o app.native_mixed_simulation_operations_v1%rowtype;
 c app.native_mixed_simulation_cancellations_v1%rowtype;
 p app.native_mixed_simulation_plans_v1%rowtype;
begin
 if app.native_mixed_simulation_cancellation_enabled_v1()is distinct from true
 then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if actor is null or tid is null or eid is null
  or current_setting('transaction_isolation')<>'read committed'
  or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
   (nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'
  or app.native_mixed_simulation_cancellation_request_valid_v1(request)is distinct from true
 then return null;end if;
 op:=(request->>'operationId')::uuid;action_value:=request->>'action';
 operation_request:=request->'operationRequest';reason_value:=request->>'reason';
 -- Actor/op is always first, followed by the shared event-pipeline lock.
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended(
   'native-mixed-simulation:'||tid::text||':'||eid::text,0))
 then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'for update nowait;
 if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'
  for key share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_simulation_sources_v1();
 lock table app.native_mixed_simulation_cancellations_v1 in share row exclusive mode nowait;

 select*into o from app.native_mixed_simulation_operations_v1
  where actor_id=actor and operation_id=op;
 if found then
  if o.tournament_id is distinct from tid or o.event_id is distinct from eid
   or o.action is distinct from action_value or o.request_payload is distinct from operation_request
  then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  -- The existing getter performs the immutable effect/outcome proof and marks
  -- its result historical. Cancellation never rewrites a committed result.
  return app.get_native_mixed_simulation_operation_v1(actor,tid,eid,op);
 end if;
 select*into c from app.native_mixed_simulation_cancellations_v1
  where actor_id=actor and operation_id=op;
 if found then
  if c.tournament_id is distinct from tid or c.event_id is distinct from eid
   or c.action is distinct from action_value or c.request_payload is distinct from operation_request
   or c.cancellation_reason is distinct from reason_value
  then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  return app.native_mixed_simulation_cancellation_receipt_v1(c,false);
 end if;
 if action_value='draw'and exists(select 1 from app.native_mixed_simulation_cancellations_v1 x
  where x.tournament_id=tid and x.event_id=eid and x.action='draw')
 then return jsonb_build_object('status','rejected','code','draw_already_cancelled');end if;
 if action_value='draw'then
  select*into p from app.native_mixed_simulation_plans_v1
   where id=(operation_request->>'planId')::uuid and tournament_id=tid and event_id=eid;
  if p.id is null or p.source_digest is distinct from operation_request->>'expectedPlanDigest'
   or p.attendance_source_digest is distinct from operation_request->>'expectedAttendanceSourceDigest'
   or app.native_mixed_simulation_plan_bound_v1(p.id)is distinct from true
   or exists(select 1 from app.native_mixed_simulation_operations_v1
    where tournament_id=tid and event_id=eid and action='draw')
   or exists(select 1 from app.native_mixed_simulation_draws_v1 where tournament_id=tid and event_id=eid)
   or exists(select 1 from app.native_mixed_simulation_reviews_v1 where tournament_id=tid and event_id=eid)
   or exists(select 1 from app.native_mixed_simulation_publication_contexts_v1 where tournament_id=tid and event_id=eid)
   or exists(select 1 from app.random_seating_draws_v1 where tournament_id=tid)
   or exists(select 1 from app.initial_seating_publications where tournament_id=tid)
   or exists(select 1 from app.event_schedule_publications where tournament_id=tid and event_id=eid)
   or exists(select 1 from app.event_play_starts where tournament_id=tid and event_id=eid)
  then return jsonb_build_object('status','rejected','code','draw_not_cancellable');end if;
 end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true
 then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 insert into app.native_mixed_simulation_cancellations_v1(
  actor_id,operation_id,tournament_id,event_id,action,request_payload,request_hash,
  cancellation_reason,cancellation_hash)
 values(actor,op,tid,eid,action_value,operation_request,
  app.native_mixed_simulation_hash_v1(jsonb_build_array(
   'native-mixed-simulation-publication-v1',action_value,actor,op,tid,eid,operation_request)),
  reason_value,app.native_mixed_simulation_hash_v1(jsonb_build_array(
   'native-mixed-simulation-cancellation-v1',actor,op,tid,eid,action_value,operation_request,reason_value)))
 returning*into c;
 return app.native_mixed_simulation_cancellation_receipt_v1(c,false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;

create function app.get_native_mixed_simulation_cancellation_v1(
 actor uuid,tid uuid,eid uuid,op uuid
)returns jsonb language plpgsql volatile security definer
set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare c app.native_mixed_simulation_cancellations_v1%rowtype;
begin
 if app.native_mixed_simulation_cancellation_recovery_enabled_v1()is distinct from true
 then return jsonb_build_object('status','blocked','code','recovery_unavailable');end if;
 if actor is null or tid is null or eid is null or op is null
  or current_setting('transaction_isolation')<>'read committed'
  or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
   (nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'
 then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended(
   'native-mixed-simulation:'||tid::text||':'||eid::text,0))
 then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'for key share nowait;
 if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'
  for key share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_simulation_sources_v1();
 lock table app.native_mixed_simulation_cancellations_v1 in share mode nowait;
 select*into c from app.native_mixed_simulation_cancellations_v1
  where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
 if not found then return null;end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true
 then return jsonb_build_object('status','blocked','code','cancellation_history_unavailable');end if;
 if c.request_hash is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array(
   'native-mixed-simulation-publication-v1',c.action,actor,op,tid,eid,c.request_payload))
  or c.cancellation_hash is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array(
   'native-mixed-simulation-cancellation-v1',actor,op,tid,eid,c.action,c.request_payload,c.cancellation_reason))
  or(case c.action
   when'plan'then app.native_mixed_simulation_plan_request_valid_v1(c.request_payload)
   when'draw'then app.native_mixed_simulation_draw_request_valid_v1(c.request_payload)
   when'review'then app.native_mixed_simulation_review_request_valid_v1(c.request_payload)
   when'publish'then app.native_mixed_simulation_publish_request_valid_v1(c.request_payload)
   else false end)is distinct from true
 then return jsonb_build_object('status','blocked','code','cancellation_history_unavailable');end if;
 return app.native_mixed_simulation_cancellation_receipt_v1(c,true);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;

alter function app.native_mixed_simulation_cancellation_enabled_v1()owner to postgres;
alter function app.native_mixed_simulation_cancellation_recovery_enabled_v1()owner to postgres;
alter function app.native_mixed_simulation_cancellation_request_valid_v1(jsonb)owner to postgres;
alter function app.native_mixed_simulation_cancellation_receipt_v1(app.native_mixed_simulation_cancellations_v1,boolean)owner to postgres;
alter function app.reject_native_mixed_simulation_cancelled_operation_v1()owner to postgres;
alter function app.cancel_native_mixed_simulation_operation_v1(uuid,uuid,uuid,jsonb)owner to postgres;
alter function app.get_native_mixed_simulation_cancellation_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_simulation_cancellation_enabled_v1(),
 app.native_mixed_simulation_cancellation_recovery_enabled_v1(),
 app.native_mixed_simulation_cancellation_request_valid_v1(jsonb),
 app.native_mixed_simulation_cancellation_receipt_v1(app.native_mixed_simulation_cancellations_v1,boolean),
 app.reject_native_mixed_simulation_cancelled_operation_v1(),
 app.cancel_native_mixed_simulation_operation_v1(uuid,uuid,uuid,jsonb),
 app.get_native_mixed_simulation_cancellation_v1(uuid,uuid,uuid,uuid)
 from public,anon,authenticated,service_role;
commit;
