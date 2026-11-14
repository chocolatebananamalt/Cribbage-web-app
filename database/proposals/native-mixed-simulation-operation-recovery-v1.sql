-- LOCAL, UNEXECUTED, PRIVATE READ-ONLY CANDIDATE. No migration/grant.
-- Recovery is independent of write enablement; both remain false by default.
-- Never invokes RNG, a writer, current readiness or a different actor's op.
begin;
create function app.native_mixed_simulation_recovery_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create function app.get_native_mixed_simulation_operation_v1(actor uuid,tid uuid,eid uuid,op uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare o app.native_mixed_simulation_operations_v1%rowtype;r jsonb;bound boolean:=false;
begin
 if app.native_mixed_simulation_recovery_enabled_v1()is distinct from true
 then return jsonb_build_object('status','blocked','code','recovery_unavailable');end if;
 if actor is null or tid is null or eid is null or op is null
  or current_setting('transaction_isolation')<>'read committed'
  or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
   (nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'
 then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;
 if not found then return null;end if;
 lock table app.native_mixed_simulation_operations_v1,app.native_mixed_simulation_outcomes_v1,
  app.native_mixed_simulation_plans_v1,app.native_mixed_simulation_draws_v1,app.native_mixed_simulation_reviews_v1,
  app.native_mixed_simulation_publication_contexts_v1,app.native_mixed_simulation_seating_sidecars_v1,
  app.native_mixed_simulation_schedule_sidecars_v1,app.operation_receipts,app.audit_events,
  app.initial_seating_publications,app.initial_seating_assignments,app.event_schedule_publications,
  app.event_schedule_games,app.rounds,app.canonical_games in share mode nowait;
 select*into o from app.native_mixed_simulation_operations_v1
  where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
 if not found then return null;end if;
 if o.request_hash is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array(
  'native-mixed-simulation-publication-v1',o.action,actor,op,tid,eid,o.request_payload))
  or o.request_payload->>'operationId'is distinct from op::text
  or(case o.action
   when'plan'then app.native_mixed_simulation_plan_request_valid_v1(o.request_payload)
   when'draw'then app.native_mixed_simulation_draw_request_valid_v1(o.request_payload)
   when'review'then app.native_mixed_simulation_review_request_valid_v1(o.request_payload)
   when'publish'then app.native_mixed_simulation_publish_request_valid_v1(o.request_payload)
   else false end)is distinct from true
 then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 select result into r from app.native_mixed_simulation_outcomes_v1
  where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
 if jsonb_typeof(r)is distinct from'object'
  or r->>'kind'is distinct from'native-mixed-simulation-receipt-v1'
  or r->>'action'is distinct from o.action or r->>'actorId'is distinct from actor::text
  or r->>'tournamentId'is distinct from tid::text or r->>'eventId'is distinct from eid::text
  or r->>'operationId'is distinct from op::text or r->'request'is distinct from o.request_payload
 then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 if r->>'status'='accepted'then
  -- The historical view must never forward an unvalidated extra authority
  -- claim from a corrupted outcome, even when effect IDs still bind.
  if(select array_agg(k order by k)from jsonb_object_keys(r)k)is distinct from
   (case o.action
    when'plan'then array['action','actorId','code','eventId','kind','normalDrawAuthorized','normalStartAuthorized','operationId','planId','request','sourceDigest','status','tournamentId','version']
    when'draw'then array['action','actorId','candidate','code','drawId','eventId','kind','operationId','publishAuthorized','request','sourceDigest','status','tournamentId']
    when'review'then array['action','actorId','code','eventId','kind','operationId','publishAuthorized','request','reviewId','sourceDigest','status','tournamentId']
    when'publish'then array['action','actorId','assignmentCount','code','contextId','currentSourceVerified','eventId','kind','matchCount','normalStartAuthorized','operationId','ordinaryAttendanceUsed','request','roundCount','schedulePublicationId','seatingPublicationId','status','tournamentId']
    else null end)
  then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  case o.action
  when'plan'then select exists(select 1 from app.native_mixed_simulation_plans_v1 p
   where p.actor_id=actor and p.operation_id=op and p.tournament_id=tid and p.event_id=eid
    and r->>'code'='simulation_plan_saved'and r->>'planId'=p.id::text and r->'version'='1'::jsonb
    and r->>'sourceDigest'=p.source_digest and r->'normalDrawAuthorized'='false'::jsonb
    and r->'normalStartAuthorized'='false'::jsonb and app.native_mixed_simulation_plan_bound_v1(p.id)is true)into bound;
  when'draw'then select exists(select 1 from app.native_mixed_simulation_draws_v1 d
   where d.actor_id=actor and d.operation_id=op and d.tournament_id=tid and d.event_id=eid
    and r->>'code'='simulation_draw_recorded'and r->>'drawId'=d.id::text
    and r->>'sourceDigest'=d.source_digest and r->'candidate'is not distinct from d.candidate
    and r->'publishAuthorized'='false'::jsonb and app.native_mixed_simulation_draw_bound_v1(d.id)is true)into bound;
  when'review'then select exists(select 1 from app.native_mixed_simulation_reviews_v1 v
   where v.actor_id=actor and v.operation_id=op and v.tournament_id=tid and v.event_id=eid
    and r->>'code'='simulation_draw_reviewed'and r->>'reviewId'=v.id::text
    and r->>'sourceDigest'=v.source_digest and r->'publishAuthorized'='false'::jsonb
    and app.native_mixed_simulation_review_bound_v1(v.id)is true)into bound;
  when'publish'then select exists(select 1 from app.native_mixed_simulation_publication_contexts_v1 c
   where c.actor_id=actor and c.operation_id=op and c.tournament_id=tid and c.event_id=eid
    and r->>'code'='native_mixed_simulation_published'and r->>'contextId'=c.id::text
    and r->>'seatingPublicationId'=c.seating_publication_id::text
    and r->>'schedulePublicationId'=c.schedule_publication_id::text
    and r->'assignmentCount'='18'::jsonb and r->'roundCount'='12'::jsonb and r->'matchCount'='108'::jsonb
    and r->'ordinaryAttendanceUsed'='false'::jsonb and r->'normalStartAuthorized'='false'::jsonb
    and r->'currentSourceVerified'='true'::jsonb
    and app.native_mixed_simulation_publication_bound_v1(c.id)is true)into bound;
  else bound:=false;end case;
 elsif r->>'status'='rejected'and o.action='draw'then
  bound:=r->>'code'in('bounded_search_exhausted','simulation_draw_failed')
   and r->'entropyConsumed'='true'::jsonb and r->'retryWithNewOperationAuthorized'='false'::jsonb
   and(select array_agg(k order by k)from jsonb_object_keys(r)k)=array[
    'action','actorId','code','entropyConsumed','eventId','kind','operationId','request',
    'retryWithNewOperationAuthorized','status','tournamentId']
   and not exists(select 1 from app.native_mixed_simulation_draws_v1 where tournament_id=tid and event_id=eid);
 end if;
 if bound is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 -- Derived read view only. Stored point-in-time receipt is never rewritten.
 r:=r||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 return jsonb_build_object('kind','native-mixed-simulation-operation-v1','actorId',actor,
  'tournamentId',tid,'eventId',eid,'operationId',op,'action',o.action,'request',o.request_payload,
  'receipt',r,'historicalReceipt',true,'currentSourceVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
alter function app.native_mixed_simulation_recovery_enabled_v1()owner to postgres;
alter function app.get_native_mixed_simulation_operation_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_simulation_recovery_enabled_v1(),
 app.get_native_mixed_simulation_operation_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
