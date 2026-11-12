-- Default-revoked local pilot guard. Commit reservation BEFORE sampling.
begin;
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
commit;
