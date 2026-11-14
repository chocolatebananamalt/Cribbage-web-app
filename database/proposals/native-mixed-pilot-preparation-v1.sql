-- Read-only preparation for the bounded TEST ONLY pilot. No grants.
begin;
create function public.get_native_mixed_pilot_preparation_v1(p_actor_id uuid,p_session_id uuid,p_tournament_id uuid,p_event_id uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare authorized jsonb;a jsonb;h jsonb:='{}';o record;n integer;phase text:='plan';prior jsonb;transition jsonb;scope app.native_mixed_pilot_scopes_v1%rowtype;
begin
 -- Reuse the independent service-project/session/Director/scope checks. A source
 -- may be unpublished; NULL alone means this actor/target is not authorized.
 authorized:=public.execute_native_mixed_pilot_director_v1(p_actor_id,p_session_id,p_tournament_id,p_event_id,'source','{}');if authorized is null then return null;end if;
 if app.native_mixed_simulation_publication_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 a:=app.native_mixed_simulation_lifecycle_v1(p_actor_id,p_tournament_id,p_event_id);
 if a->>'status'is distinct from'source_available'then return jsonb_build_object('status','blocked','code','readiness_seal_required');end if;
 perform app.lock_native_mixed_simulation_sources_v1();
 if exists(select 1 from app.native_mixed_simulation_cancellations_v1 where tournament_id=p_tournament_id and event_id=p_event_id)then return jsonb_build_object('status','blocked','code','attempt_closed_no_redraw');end if;
 select count(*)into n from app.native_mixed_simulation_operations_v1 where tournament_id=p_tournament_id and event_id=p_event_id;
 if n>4 or exists(select 1 from app.native_mixed_simulation_operations_v1 where tournament_id=p_tournament_id and event_id=p_event_id and actor_id<>p_actor_id)
  or exists(select 1 from app.native_mixed_simulation_operations_v1 where tournament_id=p_tournament_id and event_id=p_event_id group by action having count(*)>1)
 then return jsonb_build_object('status','blocked','code','existing_attempt_requires_recovery');end if;
 for o in select * from app.native_mixed_simulation_operations_v1 where tournament_id=p_tournament_id and event_id=p_event_id loop
  prior:=app.get_native_mixed_simulation_operation_v1(p_actor_id,p_tournament_id,p_event_id,o.operation_id);
  if prior->>'kind'is distinct from'native-mixed-simulation-operation-v1'or prior#>>'{receipt,status}'is distinct from'accepted'then return jsonb_build_object('status','blocked','code','existing_attempt_requires_recovery');end if;
  h:=h||jsonb_build_object(o.action,prior);
 end loop;
 if n=0 then
  if exists(select 1 from app.native_mixed_simulation_plans_v1 where tournament_id=p_tournament_id and event_id=p_event_id)
   or exists(select 1 from app.native_mixed_simulation_draws_v1 where tournament_id=p_tournament_id and event_id=p_event_id)
   or exists(select 1 from app.native_mixed_simulation_publication_contexts_v1 where tournament_id=p_tournament_id and event_id=p_event_id)
   or exists(select 1 from app.initial_seating_publications where tournament_id=p_tournament_id)
   or exists(select 1 from app.event_schedule_publications where event_id=p_event_id)
   or exists(select 1 from app.rounds where event_id=p_event_id)
   or exists(select 1 from app.canonical_games where event_id=p_event_id)
  then return jsonb_build_object('status','blocked','code','existing_attempt_requires_recovery');end if;
 elsif n=1 and h?'plan'then phase:='draw';prior:=h->'plan';
 elsif n=2 and h?&array['plan','draw']then phase:='review';prior:=h->'draw';
 elsif n=3 and h?&array['plan','draw','review']then phase:='publish';prior:=h->'review';
 elsif n=4 and h?&array['plan','draw','review','publish']and authorized->>'status'='source_available'then phase:='published';
 else return jsonb_build_object('status','blocked','code','existing_attempt_requires_recovery');end if;
 if phase in('draw','review','publish')then
  transition:=app.get_native_mixed_simulation_transition_v1(p_actor_id,p_tournament_id,p_event_id,(prior->>'operationId')::uuid);
  if transition->>'kind'is distinct from'native-mixed-director-transition-v1'or transition->>'nextAction'is distinct from phase then return jsonb_build_object('status','blocked','code','current_transition_required');end if;
 end if;
 select *into scope from app.native_mixed_pilot_scopes_v1 where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
 return jsonb_build_object('kind','native-mixed-pilot-preparation-v1','actorId',p_actor_id,'tournamentId',p_tournament_id,'eventId',p_event_id,
  'tournamentName',(select name from app.tournaments where id=p_tournament_id),'eventName',(select name from app.events where id=p_event_id and tournament_id=p_tournament_id),'phase',phase,'attendance',jsonb_build_object('sealId',a->>'sealId','sourceDigest',a->>'sourceDigest'),
  'geometry',jsonb_build_object('tableId','A','seatCount',18,'fixedSeat','A-1'),'history',h,'transition',transition,
  'observedAt',to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'writesEnabled',scope.writes_enabled,
  'currentSourceVerified',true,'writeAuthorized',false,'humanPresenceVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
alter function public.get_native_mixed_pilot_preparation_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function public.get_native_mixed_pilot_preparation_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
