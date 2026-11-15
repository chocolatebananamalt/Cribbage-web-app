-- LOCAL UNEXECUTED PRIVATE READ-ONLY PROPOSAL. Install only after reviewed
-- publication, recovery and cancellation dependencies; no application grant.
begin;
create function app.native_mixed_simulation_transition_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create function app.get_native_mixed_simulation_transition_v1(actor uuid,tid uuid,eid uuid,op uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare h jsonb;r jsonb;a jsonb;p app.native_mixed_simulation_plans_v1%rowtype;
 d app.native_mixed_simulation_draws_v1%rowtype;v app.native_mixed_simulation_reviews_v1%rowtype;
 next_action text;parent_id uuid;parent_digest text;
begin
 if app.native_mixed_simulation_transition_enabled_v1()is distinct from true
 then return jsonb_build_object('status','blocked','code','transition_unavailable');end if;
 if actor is null or tid is null or eid is null or op is null
  or current_setting('transaction_isolation')<>'read committed'
  or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
   (nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'
 then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;
 if not found then return null;end if;
 perform app.lock_native_mixed_simulation_sources_v1();
 -- A canceled uncertain draw is terminal, even if its transaction consumed
 -- entropy and then aborted. Absence of a committed op is not a redraw right.
 lock table app.native_mixed_simulation_cancellations_v1 in share mode nowait;
 if exists(select 1 from app.native_mixed_simulation_cancellations_v1 where tournament_id=tid and event_id=eid and action='draw')
 then return jsonb_build_object('status','blocked','code','draw_terminal');end if;
 h:=app.get_native_mixed_simulation_operation_v1(actor,tid,eid,op);
 if h->>'kind'is distinct from'native-mixed-simulation-operation-v1'
  or h->'historicalReceipt'is distinct from'true'::jsonb or h->'currentSourceVerified'is distinct from'false'::jsonb
 then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
 r:=h->'receipt';
 if r->>'status'is distinct from'accepted'or r->>'action'not in('plan','draw','review')
 then return jsonb_build_object('status','blocked','code','phase_terminal');end if;
 a:=app.native_mixed_simulation_lifecycle_v1(actor,tid,eid);
 if a->>'status'is distinct from'source_available'
 then return jsonb_build_object('status','blocked','code','current_source_unavailable');end if;
 if exists(select 1 from app.native_mixed_simulation_publication_contexts_v1 where tournament_id=tid and event_id=eid)
 then return jsonb_build_object('status','blocked','code','phase_terminal');end if;
 case r->>'action'
 when'plan'then
  select*into p from app.native_mixed_simulation_plans_v1 where id=(r->>'planId')::uuid and actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
  if p.id is null or exists(select 1 from app.native_mixed_simulation_operations_v1 where tournament_id=tid and event_id=eid and action='draw')
  then return jsonb_build_object('status','blocked','code','draw_terminal');end if;
  next_action:='draw';parent_id:=p.id;parent_digest:=p.source_digest;
 when'draw'then
  select*into d from app.native_mixed_simulation_draws_v1 where id=(r->>'drawId')::uuid and actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
  if d.id is null or exists(select 1 from app.native_mixed_simulation_reviews_v1 where draw_id=d.id)
  then return jsonb_build_object('status','blocked','code','phase_already_advanced');end if;
  select*into p from app.native_mixed_simulation_plans_v1 where id=d.plan_id and tournament_id=tid and event_id=eid;
  next_action:='review';parent_id:=d.id;parent_digest:=d.source_digest;
 when'review'then
  select*into v from app.native_mixed_simulation_reviews_v1 where id=(r->>'reviewId')::uuid and actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
  if v.id is null then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
  select*into p from app.native_mixed_simulation_plans_v1 where id=v.plan_id and tournament_id=tid and event_id=eid;
  next_action:='publish';parent_id:=v.id;parent_digest:=v.source_digest;
 end case;
 if p.id is null or p.attendance_source_digest is distinct from a->>'sourceDigest'
  or p.attendance_capture is distinct from a-'actorId'
  or r->>'sourceDigest'is distinct from parent_digest
 then return jsonb_build_object('status','blocked','code','current_source_changed');end if;
 return jsonb_build_object('kind','native-mixed-director-transition-v1','actorId',actor,'tournamentId',tid,'eventId',eid,
  'prior',h,'nextAction',next_action,'parentId',parent_id,'parentDigest',parent_digest,
  'attendanceDigest',a->>'sourceDigest','observedAt',to_char(clock_timestamp(),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'currentSourceVerified',true,'writeAuthorized',false,'normalStartAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

alter function app.native_mixed_simulation_transition_enabled_v1()owner to postgres;
alter function app.get_native_mixed_simulation_transition_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_simulation_transition_enabled_v1()from public,anon,authenticated,service_role;
revoke all on function app.get_native_mixed_simulation_transition_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
