-- CLOSED native-play prerequisites. Official runner supplies one transaction.
-- Adds seven revoked functions, one private immutable seed table/index; guards one existing draw body.
-- No cohort, feature enablement, application grant, ordinary attendance or financial write.
set local lock_timeout='5s';
set local statement_timeout='30s';
do $play_pre$begin
 if to_regprocedure('app.draw_native_mixed_simulation_v1(uuid,uuid,uuid,jsonb)')is null or to_regprocedure('public.execute_native_mixed_pilot_director_v1(uuid,uuid,uuid,uuid,text,jsonb)')is null then raise exception 'native play prerequisite missing';end if;
 if app.native_mixed_simulation_publication_enabled_v1()or app.native_mixed_simulation_start_enabled_v1()or app.native_mixed_game_writer_enabled_v1()then raise exception 'native play must remain closed';end if;
end $play_pre$;

-- FROZEN_PLAY_SOURCE_1_BEGIN c646b5dd5cb6875cce8a9e74abff74322038df312ad32efff955562c372cdbd9
-- Local pilot Director lease. No grants or owner scope authorization.

create function public.get_native_mixed_pilot_director_session_v1(p_tournament_id uuid,p_event_id uuid,p_action text)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;scope app.native_mixed_pilot_scopes_v1%rowtype;expiry timestamptz;token_exp numeric;writing boolean;
begin
 if auth.role()is distinct from'authenticated'or p_action is null or p_action<>all(array['plan','draw','review','publish','source','operation','cancel','cancellation','transition','simulation-start','simulation-start-operation','simulation-start-source'])then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();writing:=p_action=any(array['plan','draw','review','publish','cancel','simulation-start']);
 if app.native_mixed_pilot_permitted_v1(actor,p_tournament_id,p_event_id,writing)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=actor and role='director'for share nowait;if not found then return null;end if;
 select * into scope from app.native_mixed_pilot_scopes_v1 where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
 if jsonb_typeof(auth.jwt()->'exp')is distinct from'number'then return null;end if;token_exp:=(auth.jwt()->>'exp')::numeric;
 expiry:=least(scope.expires_at,to_timestamp(token_exp::double precision),clock_timestamp()+interval'5 minutes');if expiry<=clock_timestamp()then return null;end if;
 return jsonb_build_object('kind','native-mixed-director-session-v1','subjectId',actor,'sessionId',auth.jwt()->>'session_id','actorId',actor,
  'tournamentId',p_tournament_id,'eventId',p_event_id,'projectUrl','https://nnhcnvksxgxnpvdqjgpg.supabase.co','projectRef','nnhcnvksxgxnpvdqjgpg','allowedActions',jsonb_build_array(p_action),
  'expiresAt',to_char(expiry at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
exception when lock_not_available or numeric_value_out_of_range then return null;end$$;
alter function public.get_native_mixed_pilot_director_session_v1(uuid,uuid,text)owner to postgres;
revoke all on function public.get_native_mixed_pilot_director_session_v1(uuid,uuid,text)from public,anon,authenticated,service_role;


-- FROZEN_PLAY_SOURCE_1_END

-- FROZEN_PLAY_SOURCE_2_BEGIN cf15ab56b0cc6c8d67df12e3f9b0fab37687f4fd84ecb51bfb5b343f20912694
-- Read-only preparation for the bounded TEST ONLY pilot. No grants.

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


-- FROZEN_PLAY_SOURCE_2_END

-- FROZEN_PLAY_SOURCE_3_BEGIN 491adfa47570bf5dba0a09ca0fb460a05cc28e0718e86494cb0f0da2a5a3ff20
-- Default-revoked local pilot guard. Commit reservation BEFORE sampling.

create unique index native_mixed_pilot_one_draw_attempt_v1 on app.native_mixed_simulation_operations_v1(tournament_id,event_id)where action='draw';
create table app.native_mixed_pilot_draw_seeds_v1(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 seed bytea not null check(octet_length(seed)=32),method text not null default'hmac-sha256-counter-rejection-v1'check(method='hmac-sha256-counter-rejection-v1'),
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),unique(tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_mixed_simulation_operations_v1(actor_id,operation_id,tournament_id,event_id));
alter table app.native_mixed_pilot_draw_seeds_v1 owner to postgres;
alter table app.native_mixed_pilot_draw_seeds_v1 enable row level security;
alter table app.native_mixed_pilot_draw_seeds_v1 force row level security;
revoke all on app.native_mixed_pilot_draw_seeds_v1 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.native_mixed_pilot_draw_seeds_v1 for each row execute function app.reject_immutable_history();
create trigger no_truncate before truncate on app.native_mixed_pilot_draw_seeds_v1 for each statement execute function app.reject_immutable_history();

-- Private seed is never returned. Rejection removes modulo bias. One counter
-- continues across rejected bytes, shuffles and bounded constraint attempts.
create function app.native_mixed_pilot_integer_v1(seed_value bytea,bound_value integer,counter_value bigint,out value integer,out next_counter bigint)returns record
language plpgsql immutable set search_path=''as $$declare b integer;begin
 if seed_value is null or bound_value is null or counter_value is null or octet_length(seed_value)<>32 or bound_value not between 2 and 18 or counter_value<0 then raise exception'invalid_pilot_random_input';end if;
 next_counter:=counter_value;loop
  b:=get_byte(extensions.hmac(convert_to('native-mixed-pilot-draw-v1:'||next_counter::text,'UTF8'),seed_value,'sha256'),0);next_counter:=next_counter+1;
  if b<(256/bound_value)*bound_value then value:=b%bound_value;return;end if;
 end loop;end$$;

-- Exact original circle/movement implementation, with only the byte source
-- replaced. This does not change qualification, match count or movement rules.
create function app.native_mixed_pilot_seeded_candidate_v1(seed_value bytea,p_config jsonb,p_snapshot jsonb)returns jsonb language plpgsql volatile set search_path=''as $$
declare v_counter bigint:=0;v_people text[];v_ring text[];v_initial text[];v_pairs text[];v_pair text;v_temp text;v_seat_a text;v_seat_b text;v_anchor_pair integer;
 v_i integer;v_j integer;v_round integer;v_board integer;v_attempt integer;v_limit integer;v_matches jsonb;v_assign jsonb;v_ok boolean;v_anchor text;v_selection text;
begin
 select array_agg(r->>'rosterEntryId'order by r->>'rosterEntryId')into v_people from jsonb_array_elements(p_snapshot->'roster')r;
 select array_agg(x#>>'{}'order by n)into v_pairs from jsonb_array_elements(p_config->'activePairIds')with ordinality a(x,n);
 for v_i in 1..9 loop
 v_pair:=v_pairs[v_i];if p_config->'anchor'->>'seatId'in(split_part(v_pair,':',1)||'-'||split_part(split_part(v_pair,':',2),'-',1),split_part(v_pair,':',1)||'-'||split_part(split_part(v_pair,':',2),'-',2))then v_anchor_pair:=v_i;end if;end loop;
 v_temp:=v_pairs[1];v_pairs[1]:=v_pairs[v_anchor_pair];v_pairs[v_anchor_pair]:=v_temp;
 v_limit:=case when jsonb_array_length(p_config->'constraints')=0 then 1 else(p_config->>'maxAttempts')::integer end;
 for v_attempt in 1..v_limit loop
 v_anchor:=p_config->'anchor'->>'participantId';v_selection:=case when v_anchor is null then 'blind-draw'else'approved-person'end;
 v_ring:=case when v_anchor is null then v_people else array_remove(v_people,v_anchor)end;
 for v_i in reverse cardinality(v_ring)..2 loop select r.value,r.next_counter into v_j,v_counter from app.native_mixed_pilot_integer_v1(seed_value,v_i,v_counter)r;v_j:=v_j+1;v_temp:=v_ring[v_i];v_ring[v_i]:=v_ring[v_j];v_ring[v_j]:=v_temp;end loop;
 if v_anchor is not null then v_ring:=array_prepend(v_anchor,v_ring);end if;v_initial:=v_ring;v_anchor:=v_ring[1];v_matches:='[]';v_assign:='[]';
 for v_round in 1..12 loop
 for v_board in 1..9 loop v_pair:=v_pairs[v_board];v_seat_a:=split_part(v_pair,':',1)||'-'||split_part(split_part(v_pair,':',2),'-',1);v_seat_b:=split_part(v_pair,':',1)||'-'||split_part(split_part(v_pair,':',2),'-',2);
 if v_board=1 and p_config->'anchor'->>'seatId'=v_seat_b then v_temp:=v_seat_a;v_seat_a:=v_seat_b;v_seat_b:=v_temp;end if;
 v_matches:=v_matches||jsonb_build_array(jsonb_build_object('round',v_round,'pairId',v_pair,'sides',jsonb_build_array(jsonb_build_object('participantId',v_ring[v_board],'seatId',v_seat_a),jsonb_build_object('participantId',v_ring[19-v_board],'seatId',v_seat_b))));
 if v_round=1 then v_assign:=v_assign||jsonb_build_array(jsonb_build_object('participantId',v_ring[v_board],'tournamentId',v_seat_a,'logicalSlot',v_board-1),jsonb_build_object('participantId',v_ring[19-v_board],'tournamentId',v_seat_b,'logicalSlot',18-v_board));end if;
 end loop;v_ring:=array[v_ring[1],v_ring[18]]||v_ring[2:17];end loop;
 select not exists(select 1 from jsonb_array_elements(p_config->'constraints')c join jsonb_array_elements(v_matches)m on(m->>'round')::integer=(c->>'round')::integer where(m->'sides'->0->>'participantId')in(c->'participantIds'->>0,c->'participantIds'->>1)and(m->'sides'->1->>'participantId')in(c->'participantIds'->>0,c->'participantIds'->>1))into v_ok;
 if v_ok then return jsonb_build_object('algorithmVersion','local-circle-18-v1','attempts',v_attempt,'anchor',jsonb_build_object('seatId',p_config->'anchor'->>'seatId','participantId',v_anchor,'selection',v_selection),'assignments',v_assign,'matches',v_matches,'physicalReviewRequired',true,'publishable',false);end if;
 end loop;return jsonb_build_object('status','blocked','code','bounded_search_exhausted','attempts',v_limit,'infeasibilityEstablished',false);
end$$;
create function app.native_mixed_pilot_reserved_candidate_v1(actor uuid,tid uuid,eid uuid,request jsonb,config jsonb,snapshot jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$declare seed_value bytea;begin
 select s.seed into seed_value from app.native_mixed_pilot_draw_seeds_v1 s join app.native_mixed_simulation_operations_v1 o using(actor_id,operation_id,tournament_id,event_id)
 where s.actor_id=actor and s.operation_id=(request->>'operationId')::uuid and s.tournament_id=tid and s.event_id=eid and o.action='draw'and o.request_payload=request for share of s,o;
 if seed_value is null then raise exception'committed_draw_reservation_required';end if;
 return app.native_mixed_pilot_seeded_candidate_v1(seed_value,config,snapshot);
end$$;

create function public.reserve_native_mixed_pilot_draw_v1(p_actor_id uuid,p_session_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare op uuid;o app.native_mixed_simulation_operations_v1%rowtype;p app.native_mixed_simulation_plans_v1%rowtype;h jsonb;proof jsonb;response jsonb;
begin
 if public.execute_native_mixed_pilot_director_v1(p_actor_id,p_session_id,p_tournament_id,p_event_id,'source','{}')is null
  or app.native_mixed_pilot_permitted_v1(p_actor_id,p_tournament_id,p_event_id,true)is distinct from true
  or app.native_mixed_simulation_publication_enabled_v1()is distinct from true
  or app.native_mixed_simulation_draw_request_valid_v1(p_request)is distinct from true then return null;end if;
 op:=(p_request->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(p_actor_id::text||':'||op::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||p_tournament_id::text||':'||p_event_id::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 response:=jsonb_build_object('kind','native-mixed-pilot-draw-reservation-v1','actorId',p_actor_id,'tournamentId',p_tournament_id,'eventId',p_event_id,'operationId',op,'request',p_request);
 select *into o from app.native_mixed_simulation_operations_v1 where actor_id=p_actor_id and operation_id=op;
 if found then
  if o.tournament_id<>p_tournament_id or o.event_id<>p_event_id or o.action<>'draw'or o.request_payload is distinct from p_request then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  h:=app.get_native_mixed_simulation_operation_v1(p_actor_id,p_tournament_id,p_event_id,op);
  if h->>'kind'='native-mixed-simulation-operation-v1'then return response||jsonb_build_object('status','committed','receipt',h->'receipt');end if;
  return response||jsonb_build_object('status','reserved_unknown');
 end if;
 if exists(select 1 from app.native_mixed_simulation_operations_v1 where tournament_id=p_tournament_id and event_id=p_event_id and action='draw')
  or exists(select 1 from app.native_mixed_simulation_cancellations_v1 where tournament_id=p_tournament_id and event_id=p_event_id and action='draw')then return jsonb_build_object('status','rejected','code','draw_already_attempted');end if;
 select *into p from app.native_mixed_simulation_plans_v1 where id=(p_request->>'planId')::uuid and tournament_id=p_tournament_id and event_id=p_event_id and actor_id=p_actor_id;
 if p.id is null then return null;end if;
 proof:=app.get_native_mixed_simulation_transition_v1(p_actor_id,p_tournament_id,p_event_id,p.operation_id);
 if proof->>'kind'is distinct from'native-mixed-director-transition-v1'or proof->>'nextAction'is distinct from'draw'
  or proof->>'parentId'is distinct from p_request->>'planId'or proof->>'parentDigest'is distinct from p_request->>'expectedPlanDigest'
  or proof->>'attendanceDigest'is distinct from p_request->>'expectedAttendanceSourceDigest'then return null;end if;
 if app.native_mixed_simulation_insert_operation_v1(p_actor_id,op,p_tournament_id,p_event_id,'draw',p_request)is distinct from true then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 insert into app.native_mixed_pilot_draw_seeds_v1(actor_id,operation_id,tournament_id,event_id,seed)values(p_actor_id,op,p_tournament_id,p_event_id,extensions.gen_random_bytes(32));
 return response||jsonb_build_object('status','newly_reserved');
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Fail closed unless every precise source anchor is present. Historical outcomes
-- still replay unchanged. Pending reservations may only sample the pinned seed.
do $patch$declare source text;old text;begin
 source:=pg_get_functiondef('app.draw_native_mixed_simulation_v1(uuid,uuid,uuid,jsonb)'::regprocedure);
 old:='return r||jsonb_build_object(''currentSourceVerified'',false,''historicalReceipt'',true);end if;';
 if position(old in source)=0 then raise exception'pilot_draw_replay_anchor_missing';end if;
 source:=replace(source,old,'if r is not null then return r||jsonb_build_object(''currentSourceVerified'',false,''historicalReceipt'',true);end if;if not exists(select 1 from app.native_mixed_pilot_draw_seeds_v1 where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''draw_already_attempted'');end if;end if;');
 source:=replace(source,$old$if o.action<>'draw'or o.request_payload$old$,$new$if o.tournament_id<>tid or o.event_id<>eid or o.action<>'draw'or o.request_payload$new$);
 old:='event_id=eid and action=''draw'')then';if position(old in source)=0 then raise exception'pilot_draw_scope_anchor_missing';end if;
 source:=replace(source,old,'event_id=eid and action=''draw''and not(actor_id=actor and operation_id=op))then');
 old:='if app.native_mixed_simulation_insert_operation_v1(actor,op,tid,eid,''draw'',request)is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;';
 if position(old in source)=0 then raise exception'pilot_draw_insert_anchor_missing';end if;
 source:=replace(source,old,'if not exists(select 1 from app.native_mixed_pilot_draw_seeds_v1 where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''draw_already_attempted'');end if;');
 old:='c:=app.random_seating_candidate_v1(p.config,p.roster_snapshot);';if position(old in source)=0 then raise exception'pilot_sampler_anchor_missing';end if;
 source:=replace(source,old,'c:=app.native_mixed_pilot_reserved_candidate_v1(actor,tid,eid,request,p.config,p.roster_snapshot);');execute source;
end$patch$;
do $acl$declare p regprocedure;begin foreach p in array array[
'app.native_mixed_pilot_integer_v1(bytea,integer,bigint)'::regprocedure,
'app.native_mixed_pilot_seeded_candidate_v1(bytea,jsonb,jsonb)'::regprocedure,
'app.native_mixed_pilot_reserved_candidate_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure,
'public.reserve_native_mixed_pilot_draw_v1(uuid,uuid,uuid,uuid,jsonb)'::regprocedure]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$acl$;


-- FROZEN_PLAY_SOURCE_3_END

-- FROZEN_PLAY_SOURCE_4_BEGIN 350c79236274fb586e4920b57872f07e9fd10da486bd06dcf4be7a870beaf0f7
-- Read-only, default-revoked Director projection. No enrollment or consent writes.

create function public.get_native_mixed_pilot_bootstrap_v1(p_actor_id uuid,p_session_id uuid,p_tournament_id uuid,p_event_id uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare authorized jsonb;v_scope_id uuid;v_decl_id uuid;ready jsonb;funding jsonb;consents integer;
begin
 authorized:=public.execute_native_mixed_pilot_director_v1(p_actor_id,p_session_id,p_tournament_id,p_event_id,'source','{}');if authorized is null then return null;end if;
 if app.native_mixed_attendance_enabled_v1()is distinct from true or app.native_mixed_funding_enabled_v1()is distinct from true then return null;end if;
 perform app.lock_native_mixed_attendance_sources_v1();perform app.lock_native_mixed_funding_sources_v1();
 select id into v_scope_id from app.native_mixed_attendance_scopes_v1 where tournament_id=p_tournament_id and event_id=p_event_id;
 select id into v_decl_id from app.native_mixed_paper_declarations_v1 where scope_id=v_scope_id and tournament_id=p_tournament_id and event_id=p_event_id;
 select count(*)into consents from(select distinct on(roster_entry_id)decision from app.native_mixed_digital_consent_decisions_v1 c where c.scope_id=v_scope_id and c.tournament_id=p_tournament_id and c.event_id=p_event_id order by roster_entry_id,version desc)c where decision='granted';
 ready:=app.native_mixed_simulation_lifecycle_v1(p_actor_id,p_tournament_id,p_event_id);funding:=app.native_mixed_funding_seal_source_v1(p_tournament_id,p_event_id);
 return jsonb_build_object('kind','native-mixed-bootstrap-status-v1','actorId',p_actor_id,'tournamentId',p_tournament_id,'eventId',p_event_id,
  'observedAt',to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'readOnly',true,'simulationStarted',exists(select 1 from app.native_mixed_simulation_starts_v1 where tournament_id=p_tournament_id and event_id=p_event_id),'currentReadinessVerified',coalesce(ready->>'status'='source_available',false),'humanPresenceVerified',false,'actualMoneyReceived',false,
  'records',jsonb_build_object('admissionIntent',exists(select 1 from app.native_mixed_admission_intents_v1 where tournament_id=p_tournament_id and event_id=p_event_id),
  'simulatedFundingVerified',coalesce(funding->>'status'='source_available',false),'attendanceScope',v_scope_id is not null,'grantedConsentCount',consents,
  'paperDeclaration',v_decl_id is not null,'paperReview',exists(select 1 from app.native_mixed_paper_reviews_v1 where declaration_id=v_decl_id and reviewer_id<>preparer_id),
  'attendanceSeal',exists(select 1 from app.native_mixed_attendance_seals_v1 s where s.scope_id=v_scope_id and s.tournament_id=p_tournament_id and s.event_id=p_event_id),
  'registrationClosed',exists(select 1 from app.tournaments where id=p_tournament_id and registration_status='closed')));
exception when lock_not_available then return null;end$$;
alter function public.get_native_mixed_pilot_bootstrap_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function public.get_native_mixed_pilot_bootstrap_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;


-- FROZEN_PLAY_SOURCE_4_END

do $play_closed$declare signature text;p regprocedure;role_name text;c pg_class;begin
 foreach signature in array array['public.get_native_mixed_pilot_director_session_v1(uuid,uuid,text)','public.get_native_mixed_pilot_preparation_v1(uuid,uuid,uuid,uuid)','app.native_mixed_pilot_integer_v1(bytea,integer,bigint)','app.native_mixed_pilot_seeded_candidate_v1(bytea,jsonb,jsonb)','app.native_mixed_pilot_reserved_candidate_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb)','public.reserve_native_mixed_pilot_draw_v1(uuid,uuid,uuid,uuid,jsonb)','public.get_native_mixed_pilot_bootstrap_v1(uuid,uuid,uuid,uuid)']loop
 p:=to_regprocedure(signature);if p is null or(select proowner::regrole::text from pg_proc where oid=p)<>'postgres'then raise exception 'new function missing or wrong owner: %',signature;end if;
 if exists(select 1 from pg_proc x,aclexplode(coalesce(x.proacl,acldefault('f',x.proowner)))a where x.oid=p and a.grantee=0 and a.privilege_type='EXECUTE')then raise exception 'PUBLIC execute: %',signature;end if;
 foreach role_name in array array['anon','authenticated','service_role']loop if has_function_privilege(role_name,p,'EXECUTE')then raise exception 'new function access: %',signature;end if;end loop;end loop;
 select *into c from pg_class where oid='app.native_mixed_pilot_draw_seeds_v1'::regclass;if c.relowner::regrole::text<>'postgres'or not c.relrowsecurity or not c.relforcerowsecurity then raise exception 'seed table security mismatch';end if;
 foreach role_name in array array['anon','authenticated','service_role']loop if has_table_privilege(role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')or has_any_column_privilege(role_name,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')then raise exception 'seed table access';end if;end loop;
 if app.native_mixed_simulation_publication_enabled_v1()or app.native_mixed_simulation_start_enabled_v1()or app.native_mixed_game_writer_enabled_v1()then raise exception 'native play must remain closed';end if;
end $play_closed$;
