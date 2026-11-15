-- LOCAL PROPOSAL ONLY. Candidate planning, never ID or schedule publication.
-- Atomic DB receipts survive lost responses. Uncommitted process crashes expose
-- no result; they do not constitute a promise of exactly-once physical entropy.
begin;
create table app.random_seating_operations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null references app.tournaments(id),
 operation_kind text not null check(operation_kind in('plan','draw')),request_hash text not null,request jsonb not null,created_at timestamptz not null default now(),
 operation_sequence bigint generated always as identity unique,primary key(actor_id,operation_id));
create table app.random_seating_outcomes_v1(
 actor_id uuid not null,operation_id uuid not null,response jsonb not null,created_at timestamptz not null default now(),
 primary key(actor_id,operation_id),foreign key(actor_id,operation_id)references app.random_seating_operations_v1);
create table app.random_seating_plans_v1(
 id uuid primary key,tournament_id uuid not null references app.tournaments(id),revision integer not null check(revision>0),actor_id uuid not null,
 operation_id uuid not null,source_hash text not null,source_snapshot jsonb not null,source_binding jsonb not null,config jsonb not null,created_at timestamptz not null default now(),
 unique(tournament_id,revision),foreign key(actor_id,operation_id)references app.random_seating_operations_v1);
create table app.random_seating_draws_v1(
 id uuid primary key,tournament_id uuid not null references app.tournaments(id),plan_id uuid not null references app.random_seating_plans_v1,
 actor_id uuid not null,operation_id uuid not null,reason text not null,candidate jsonb not null,created_at timestamptz not null default now(),
 foreign key(actor_id,operation_id)references app.random_seating_operations_v1);
do $$declare v_table text;begin
 foreach v_table in array array['random_seating_operations_v1','random_seating_outcomes_v1','random_seating_plans_v1','random_seating_draws_v1'] loop
 execute format('alter table app.%I enable row level security',v_table);execute format('alter table app.%I force row level security',v_table);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',v_table);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',v_table);
 end loop;end$$;

create function app.random_seating_authorized_v1(p_actor uuid,p_tid uuid)returns boolean language sql stable security definer set search_path=''as $$
 select p_actor is not null and coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')='service_role'
 and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tid and r.profile_id=p_actor and r.role in('director','co_director'))
$$;
create function app.random_seating_snapshot_v1(p_tid uuid)returns jsonb language sql stable security definer set search_path=''as $$
 select jsonb_build_object('status',t.status,'registrationStatus',t.registration_status,'roster',coalesce((
 select jsonb_agg(jsonb_build_object('rosterEntryId',r.id,'displayName',r.claimed_display_name,'scorecardType',r.scorecard_type,
 'checkInEventId',c.id,'checkInVersion',c.version,'state',coalesce(c.check_in_state,'not_checked_in'))order by r.id)
 from app.tournament_roster_entries r left join lateral(select x.id,x.version,x.check_in_state from app.roster_check_in_events x where x.roster_entry_id=r.id and x.tournament_id=p_tid order by x.version desc limit 1)c on true where r.tournament_id=p_tid and c.check_in_state='checked_in' and coalesce((select l.event_type from app.roster_entry_lifecycle_events l where l.roster_entry_id=r.id order by l.version desc limit 1),'active')<>'withdrawn'),'[]'::jsonb))
 from app.tournaments t where t.id=p_tid
$$;
create function app.random_seating_hash_v1(p_value jsonb)returns text language sql immutable set search_path=''as $$select encode(extensions.digest(convert_to(p_value::text,'utf8'),'sha256'),'hex')$$;
create function app.random_seating_binding_v1(p_tid uuid)returns jsonb language sql stable security definer set search_path=''as $$
 select jsonb_build_object('projection',app.random_seating_snapshot_v1(p_tid),
 'rosterVersions',coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId',r.id,'scorecardType',r.scorecard_type,'preferenceVersion',r.scorecard_preference_version,
 'checkIn',(select to_jsonb(c) from(select x.id,x.version,x.check_in_state from app.roster_check_in_events x where x.roster_entry_id=r.id order by x.version desc limit 1)c),
 'lifecycle',(select to_jsonb(l)from(select x.id,x.version,x.event_type from app.roster_entry_lifecycle_events x where x.roster_entry_id=r.id order by x.version desc limit 1)l),
 'preference',(select to_jsonb(e)from(select x.id,x.version,x.scorecard_type from app.roster_scorecard_preference_events x where x.roster_entry_id=r.id order by x.version desc limit 1)e),
 'link',(select jsonb_build_object('id',x.id,'profileId',x.profile_id)from app.roster_account_links x where x.roster_entry_id=r.id))order by r.id)from app.tournament_roster_entries r where r.tournament_id=p_tid),'[]'::jsonb),
 'setup',coalesce((select jsonb_agg(to_jsonb(a)order by a.id)from app.tournament_setup_activations a where a.tournament_id=p_tid),'[]'::jsonb),
 'latestSetup',(select jsonb_build_object('id',s.id,'version',s.version)from app.tournament_setup_revisions s where s.tournament_id=p_tid order by s.version desc limit 1))
$$;
create function app.random_seating_source_hash_v1(p_tid uuid)returns text language sql stable security definer set search_path=''as $$select app.random_seating_hash_v1(app.random_seating_binding_v1(p_tid))$$;
create function app.random_seating_source_error_v1(p_tid uuid,p_snapshot jsonb)returns text language plpgsql stable security definer set search_path=''as $$
begin
 if p_snapshot is null or p_snapshot->>'status'<>'open' then return 'tournament_not_open';end if;
 if p_snapshot->>'registrationStatus'<>'closed' then return 'registration_not_closed';end if;
 if exists(select 1 from app.initial_seating_publications p where p.tournament_id=p_tid)or exists(select 1 from app.initial_seating_assignments a where a.tournament_id=p_tid)then return 'fixed_ids_readonly';end if;
 if not exists(select 1 from app.tournament_setup_activations a join app.tournament_setup_event_versions e on e.id=a.setup_event_version_id where a.tournament_id=p_tid and e.event_kind='main' and e.style_code='Standard' and e.game_count=12)then return 'requires_activated_standard_12_main';end if;
 if jsonb_array_length(p_snapshot->'roster')<>18 or exists(select 1 from jsonb_array_elements(p_snapshot->'roster')r where r->>'state'<>'checked_in')then return 'requires_exactly_18_checked_in_roster';end if;
 return null;
end$$;
-- Exact, explicitly director-approved local inputs, not historical family data.
create function app.random_seating_config_error_v1(p_config jsonb,p_snapshot jsonb)returns text language plpgsql immutable set search_path=''as $$
declare v_t jsonb;v_d jsonb;v_c jsonb;v_id text;v_pair text;v_seats jsonb:='[]';v_pairs jsonb:='[]';v_n integer;v_a text;v_b text;
begin
 if jsonb_typeof(p_config)is distinct from'object'or(select array_agg(k order by k)from jsonb_object_keys(p_config)k)is distinct from array['activePairIds','anchor','constraints','maxAttempts','stationaryDecisions','stationaryRequests','tables']then return 'invalid_config_shape';end if;
 if jsonb_typeof(p_config->'tables')is distinct from'array'or jsonb_array_length(p_config->'tables')not between 1 and 26
 or jsonb_typeof(p_config->'activePairIds')is distinct from'array'or jsonb_array_length(p_config->'activePairIds')<>9
 or jsonb_typeof(p_config->'stationaryRequests')is distinct from'array'or jsonb_array_length(p_config->'stationaryRequests')>18
 or jsonb_typeof(p_config->'stationaryDecisions')is distinct from'array'or jsonb_array_length(p_config->'stationaryDecisions')>18
 or jsonb_typeof(p_config->'constraints')is distinct from'array'or jsonb_array_length(p_config->'constraints')>36
 or jsonb_typeof(p_config->'maxAttempts')is distinct from'number'or(p_config->>'maxAttempts')!~'^[0-9]{1,3}$'or(p_config->>'maxAttempts')::integer not between 1 and 256 then return 'invalid_config_values';end if;
 for v_t in select value from jsonb_array_elements(p_config->'tables')loop
 if jsonb_typeof(v_t)is distinct from'object'or(select array_agg(k order by k)from jsonb_object_keys(v_t)k)is distinct from array['seatCount','tableId']or coalesce(v_t->>'tableId','')!~'^[A-Z]$'or jsonb_typeof(v_t->'seatCount')is distinct from'number'or coalesce(v_t->>'seatCount','')!~'^[0-9]{1,2}$'or(v_t->>'seatCount')::integer not between 1 and 20 then return 'invalid_table';end if;
 if exists(select 1 from jsonb_array_elements(p_config->'tables')x where x<>v_t and x->>'tableId'=v_t->>'tableId')then return 'duplicate_table';end if;
 for v_n in 1..(v_t->>'seatCount')::integer loop
 if v_n%2=1 and v_n<(v_t->>'seatCount')::integer then v_pairs:=v_pairs||jsonb_build_array((v_t->>'tableId')||':'||v_n||'-'||(v_n+1));end if;end loop;
 end loop;
 if(select count(distinct x->>'tableId')from jsonb_array_elements(p_config->'tables')x)<>jsonb_array_length(p_config->'tables')then return 'duplicate_table';end if;
 if(select count(distinct x)from jsonb_array_elements(p_config->'activePairIds')x)<>9 then return 'duplicate_active_pair';end if;
 for v_t in select value from jsonb_array_elements(p_config->'activePairIds')loop
 if jsonb_typeof(v_t)is distinct from'string'or not(v_pairs@>jsonb_build_array(v_t))then return 'incomplete_active_pair';end if;
 v_pair:=v_t#>>'{}';v_seats:=v_seats||jsonb_build_array(split_part(v_pair,':',1)||'-'||split_part(split_part(v_pair,':',2),'-',1),split_part(v_pair,':',1)||'-'||split_part(split_part(v_pair,':',2),'-',2));end loop;
 v_t:=p_config->'anchor';
 if jsonb_typeof(v_t)is distinct from'object'or(select array_agg(k order by k)from jsonb_object_keys(v_t)k)is distinct from array['directorApproved','participantId','seatId']or v_t->'directorApproved'is distinct from'true'::jsonb or not(v_seats@>jsonb_build_array(v_t->'seatId'))then return 'unapproved_anchor_slot';end if;
 if v_t->'participantId'<>'null'::jsonb and not exists(select 1 from jsonb_array_elements(p_snapshot->'roster')r where r->>'rosterEntryId'=v_t->>'participantId')then return 'unknown_anchor_person';end if;
 for v_d in select value from jsonb_array_elements(p_config->'stationaryDecisions')loop
 if jsonb_typeof(v_d)is distinct from'object'or(select array_agg(k order by k)from jsonb_object_keys(v_d)k)is distinct from array['decision','participantId']or coalesce(v_d->>'decision','')not in('selected-anchor','not-accommodated')or not exists(select 1 from jsonb_array_elements(p_snapshot->'roster')r where r->>'rosterEntryId'=v_d->>'participantId')or(v_d->>'decision'='selected-anchor'and v_d->'participantId'is distinct from v_t->'participantId')or(v_d->>'decision'='not-accommodated'and v_d->'participantId'=v_t->'participantId')then return 'invalid_stationary_decision';end if;end loop;
 if(select count(distinct x->>'participantId')from jsonb_array_elements(p_config->'stationaryDecisions')x)<>jsonb_array_length(p_config->'stationaryDecisions')then return 'duplicate_stationary_decision';end if;
 for v_d in select value from jsonb_array_elements(p_config->'stationaryRequests')loop
 if jsonb_typeof(v_d)is distinct from'string'or not exists(select 1 from jsonb_array_elements(p_snapshot->'roster')r where r->>'rosterEntryId'=v_d#>>'{}')or not exists(select 1 from jsonb_array_elements(p_config->'stationaryDecisions')x where x->'participantId'=v_d)then return 'unresolved_stationary_request';end if;end loop;
 if(select count(distinct x)from jsonb_array_elements(p_config->'stationaryRequests')x)<>jsonb_array_length(p_config->'stationaryRequests')then return 'duplicate_stationary_request';end if;
 for v_c in select value from jsonb_array_elements(p_config->'constraints')loop
 if jsonb_typeof(v_c)is distinct from'object'or(select array_agg(k order by k)from jsonb_object_keys(v_c)k)is distinct from array['kind','participantIds','round','sourceReference','verified']or v_c->>'kind'is distinct from'avoid-pair-in-round'or v_c->'verified'is distinct from'true'::jsonb or jsonb_typeof(v_c->'participantIds')is distinct from'array'or jsonb_array_length(v_c->'participantIds')<>2 or jsonb_typeof(v_c->'round')is distinct from'number'or coalesce(v_c->>'round','')!~'^[0-9]{1,2}$'or(v_c->>'round')::integer not between 1 and 12 or coalesce(v_c->>'sourceReference','')!~'^LOCAL-PLAN-[A-Z0-9_-]{1,40}$'then return 'unknown_constraint_scope';end if;
 v_a:=v_c->'participantIds'->>0;v_b:=v_c->'participantIds'->>1;
 if v_a=v_b or not exists(select 1 from jsonb_array_elements(p_snapshot->'roster')r where r->>'rosterEntryId'=v_a)or not exists(select 1 from jsonb_array_elements(p_snapshot->'roster')r where r->>'rosterEntryId'=v_b)then return 'unknown_constraint_participant';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_config->'constraints')c group by c->>'round',least(c->'participantIds'->>0,c->'participantIds'->>1),greatest(c->'participantIds'->>0,c->'participantIds'->>1)having count(*)>1)then return 'duplicate_pair_round_constraint';end if;
 if exists(select 1 from(select c->>'round' r,c->'participantIds'->>0 p,c->'participantIds'->>1 o from jsonb_array_elements(p_config->'constraints')c union all select c->>'round',c->'participantIds'->>1,c->'participantIds'->>0 from jsonb_array_elements(p_config->'constraints')c)x group by r,p having count(distinct o)=17)then return 'no_permitted_opponent';end if;
 return null;
exception when invalid_text_representation or numeric_value_out_of_range then return 'invalid_config_values';
end$$;
create function public.get_random_seating_workspace_v1(p_actor_id uuid,p_tournament_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare v_s jsonb;v_binding jsonb;v_source_hash text;v_e text;v_latest jsonb;v_draw jsonb;
begin if not app.random_seating_authorized_v1(p_actor_id,p_tournament_id)then return null;end if;
 v_binding:=app.random_seating_binding_v1(p_tournament_id);v_s:=v_binding->'projection';v_source_hash:=app.random_seating_hash_v1(v_binding);v_e:=app.random_seating_source_error_v1(p_tournament_id,v_s);
 select jsonb_build_object('planId',p.id,'revision',p.revision,'sourceHash',p.source_hash,'config',p.config)into v_latest from app.random_seating_plans_v1 p where p.tournament_id=p_tournament_id order by p.revision desc limit 1;
 select jsonb_build_object('receipt',o.response,'plan',po.response)into v_draw from app.random_seating_operations_v1 d join app.random_seating_outcomes_v1 o using(actor_id,operation_id)join app.random_seating_plans_v1 p on p.id=(o.response->>'planId')::uuid join app.random_seating_outcomes_v1 po on po.actor_id=p.actor_id and po.operation_id=p.operation_id where d.tournament_id=p_tournament_id and d.operation_kind='draw' and(o.response->>'status'='accepted'or o.response->>'code'in('bounded_search_exhausted','draw_failed'))order by d.operation_sequence desc limit 1;
 return jsonb_build_object('kind','random-seating-workspace-v1','actorId',p_actor_id,'tournamentId',p_tournament_id,'sourceHash',v_source_hash,'sourceSnapshot',v_s,'eligible',v_e is null,'reason',v_e,'latestPlan',v_latest,'latestDraw',v_draw);
end$$;
create function public.get_random_seating_operation_v1(p_actor_id uuid,p_tournament_id uuid,p_operation_id uuid)returns jsonb language sql stable security definer set search_path=''as $$
 select jsonb_build_object('kind','random-seating-operation-record-v1','actorId',r.actor_id,'tournamentId',r.tournament_id,'operationId',r.operation_id,'phase',r.operation_kind,'request',r.request,'response',o.response)from app.random_seating_operations_v1 r join app.random_seating_outcomes_v1 o using(actor_id,operation_id)
 where app.random_seating_authorized_v1(p_actor_id,p_tournament_id)and r.actor_id=p_actor_id and r.operation_id=p_operation_id and r.tournament_id=p_tournament_id
$$;
create function public.get_random_seating_plan_v1(p_actor_id uuid,p_tournament_id uuid,p_plan_id uuid)returns jsonb language sql stable security definer set search_path=''as $$
 select o.response from app.random_seating_plans_v1 p join app.random_seating_outcomes_v1 o on o.actor_id=p.actor_id and o.operation_id=p.operation_id where app.random_seating_authorized_v1(p_actor_id,p_tournament_id)and p.id=p_plan_id and p.tournament_id=p_tournament_id
$$;
create function public.save_random_seating_plan_v1(p_actor_id uuid,p_tournament_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare v_hash text;v_old app.random_seating_operations_v1%rowtype;v_s jsonb;v_binding jsonb;v_source_hash text;v_error text;v_rev integer;v_id uuid:=extensions.gen_random_uuid();v_r jsonb;
begin
 if not app.random_seating_authorized_v1(p_actor_id,p_tournament_id)then return null;end if;
 if p_operation_id is null then return jsonb_build_object('status','rejected','code','invalid_operation');end if;
 v_hash:=app.random_seating_hash_v1(jsonb_build_array('plan',p_tournament_id,p_request));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('random-seating-operation:'||p_actor_id::text||':'||p_operation_id::text,0));
 perform 1 from app.tournaments where id=p_tournament_id for update;
 perform 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director') for key share;
 if not found then return null;end if;
 select * into v_old from app.random_seating_operations_v1 where actor_id=p_actor_id and operation_id=p_operation_id;
 if found then if v_old.request_hash=v_hash and v_old.tournament_id=p_tournament_id then return(select o.response from app.random_seating_outcomes_v1 o where o.actor_id=p_actor_id and o.operation_id=p_operation_id);end if;return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 insert into app.random_seating_operations_v1(actor_id,operation_id,tournament_id,operation_kind,request_hash,request,created_at)values(p_actor_id,p_operation_id,p_tournament_id,'plan',v_hash,p_request,now());
 v_binding:=app.random_seating_binding_v1(p_tournament_id);v_s:=v_binding->'projection';v_source_hash:=app.random_seating_hash_v1(v_binding);v_error:=app.random_seating_source_error_v1(p_tournament_id,v_s);
 select coalesce(max(revision),0)into v_rev from app.random_seating_plans_v1 where tournament_id=p_tournament_id;
 if jsonb_typeof(p_request)is distinct from'object'or(select array_agg(k order by k)from jsonb_object_keys(p_request)k)is distinct from array['config','expectedRevision','expectedSourceHash']or jsonb_typeof(p_request->'expectedRevision')is distinct from'number'or coalesce(p_request->>'expectedRevision','')!~'^[0-9]{1,8}$'then v_error:='invalid_request';
 elsif p_request->>'expectedSourceHash'is distinct from v_source_hash then v_error:='source_changed';
 elsif(p_request->>'expectedRevision')::integer<>v_rev then v_error:='plan_revision_changed';
 elsif v_error is null then v_error:=app.random_seating_config_error_v1(p_request->'config',v_s);end if;
 v_r:=jsonb_build_object('kind','random-seating-plan-receipt-v1','actorId',p_actor_id,'tournamentId',p_tournament_id,'operationId',p_operation_id,'idsWritten',false);
 if v_error is null then
 insert into app.random_seating_plans_v1 values(v_id,p_tournament_id,v_rev+1,p_actor_id,p_operation_id,v_source_hash,v_s,v_binding,p_request->'config',now());
 v_r:=v_r||jsonb_build_object('status','accepted','planId',v_id,'revision',v_rev+1,'sourceHash',v_source_hash,'config',p_request->'config','sourceSnapshot',v_s);
 else v_r:=v_r||jsonb_build_object('status','rejected','code',v_error);end if;
 insert into app.random_seating_outcomes_v1 values(p_actor_id,p_operation_id,v_r,now());return v_r;
end$$;
-- Unbiased bounded integer using byte rejection; no modulo bias and no names.
create function app.random_seating_integer_v1(p_n integer)returns integer language plpgsql volatile set search_path=''as $$
declare v_byte integer;begin if p_n not between 2 and 18 then raise exception 'invalid random bound';end if;
 loop v_byte:=get_byte(extensions.gen_random_bytes(1),0);if v_byte<(256/p_n)*p_n then return v_byte%p_n;end if;end loop;
end$$;
create function app.random_seating_candidate_v1(p_config jsonb,p_snapshot jsonb)returns jsonb language plpgsql volatile set search_path=''as $$
declare v_people text[];v_ring text[];v_initial text[];v_pairs text[];v_pair text;v_temp text;v_seat_a text;v_seat_b text;v_anchor_pair integer;
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
 for v_i in reverse cardinality(v_ring)..2 loop v_j:=app.random_seating_integer_v1(v_i)+1;v_temp:=v_ring[v_i];v_ring[v_i]:=v_ring[v_j];v_ring[v_j]:=v_temp;end loop;
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
create function public.draw_random_seating_candidate_v1(p_actor_id uuid,p_tournament_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare v_hash text;v_old app.random_seating_operations_v1%rowtype;v_plan app.random_seating_plans_v1%rowtype;v_s jsonb;v_binding jsonb;v_source_hash text;v_error text;v_r jsonb;v_candidate jsonb;v_plan_id uuid;v_prior uuid;v_entropy_started boolean:=false;
begin
 if not app.random_seating_authorized_v1(p_actor_id,p_tournament_id)then return null;end if;
 if p_operation_id is null then return jsonb_build_object('status','rejected','code','invalid_operation');end if;
 v_hash:=app.random_seating_hash_v1(jsonb_build_array('draw',p_tournament_id,p_request));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('random-seating-operation:'||p_actor_id::text||':'||p_operation_id::text,0));
 perform 1 from app.tournaments where id=p_tournament_id for update;
 perform 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director') for key share;
 if not found then return null;end if;
 select * into v_old from app.random_seating_operations_v1 where actor_id=p_actor_id and operation_id=p_operation_id;
 if found then if v_old.request_hash=v_hash and v_old.tournament_id=p_tournament_id then return(select o.response from app.random_seating_outcomes_v1 o where o.actor_id=p_actor_id and o.operation_id=p_operation_id);end if;return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 insert into app.random_seating_operations_v1(actor_id,operation_id,tournament_id,operation_kind,request_hash,request,created_at)values(p_actor_id,p_operation_id,p_tournament_id,'draw',v_hash,p_request,now());
 v_binding:=app.random_seating_binding_v1(p_tournament_id);v_s:=v_binding->'projection';v_source_hash:=app.random_seating_hash_v1(v_binding);v_error:=app.random_seating_source_error_v1(p_tournament_id,v_s);
 begin
 if jsonb_typeof(p_request)is distinct from'object'or(select array_agg(k order by k)from jsonb_object_keys(p_request)k)is distinct from array['expectedPriorDraw','expectedSourceHash','planId','reason']or coalesce(p_request->>'planId','')!~'^[a-f0-9-]{36}$'or coalesce(p_request->>'reason','')not in('initial-draw','changed-room-layout','changed-stationary-assumptions','changed-constraint-assumptions','compare-another-draw','previous-result-unavailable')then v_error:='invalid_request';
 else v_plan_id:=(p_request->>'planId')::uuid;select * into v_plan from app.random_seating_plans_v1 where id=v_plan_id and tournament_id=p_tournament_id;
 if not found then v_error:='plan_unavailable';
 elsif p_request->>'expectedSourceHash'is distinct from v_plan.source_hash or v_plan.source_hash is distinct from v_source_hash then v_error:='source_changed';
 elsif v_plan.revision<>(select max(revision)from app.random_seating_plans_v1 where tournament_id=p_tournament_id)then v_error:='plan_revision_changed';
 end if;end if;
 select d.operation_id into v_prior from app.random_seating_operations_v1 d join app.random_seating_outcomes_v1 o using(actor_id,operation_id)where d.tournament_id=p_tournament_id and d.operation_kind='draw' and(o.response->>'status'='accepted'or o.response->>'code'in('bounded_search_exhausted','draw_failed'))order by d.operation_sequence desc limit 1;
 if p_request->'expectedPriorDraw' is distinct from coalesce(to_jsonb(v_prior),'null'::jsonb)then v_error:='prior_draw_changed';elsif(v_prior is null and p_request->>'reason'<>'initial-draw')or(v_prior is not null and p_request->>'reason'='initial-draw')then v_error:='redraw_reason_required';end if;
 if v_error is null then
 v_entropy_started:=true;v_candidate:=app.random_seating_candidate_v1(v_plan.config,v_plan.source_snapshot);
 if v_candidate->>'status'='blocked'then v_error:='bounded_search_exhausted';else insert into app.random_seating_draws_v1 values(extensions.gen_random_uuid(),p_tournament_id,v_plan.id,p_actor_id,p_operation_id,p_request->>'reason',v_candidate,now());end if;
 end if;
 exception when others then v_error:=case when v_entropy_started then 'draw_failed'else'invalid_request'end;v_candidate:=null;end;
 v_r:=jsonb_build_object('kind','random-seating-draw-receipt-v1','actorId',p_actor_id,'tournamentId',p_tournament_id,'operationId',p_operation_id,'planId',v_plan_id,'sourceHash',v_plan.source_hash,'idsWritten',false);
 if v_error is null then v_r:=v_r||jsonb_build_object('status','accepted','candidate',v_candidate);else v_r:=v_r||jsonb_build_object('status','rejected','code',v_error);end if;
 v_r:=jsonb_strip_nulls(v_r);insert into app.random_seating_outcomes_v1 values(p_actor_id,p_operation_id,v_r,now());return v_r;
end$$;
do $$declare v_f record;begin for v_f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='app'and p.proname like'random_seating_%_v1')or(n.nspname='public'and p.proname in('get_random_seating_workspace_v1','get_random_seating_plan_v1','get_random_seating_operation_v1','save_random_seating_plan_v1','draw_random_seating_candidate_v1'))loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',v_f.signature);
 if v_f.signature::text like'get_random_seating_%'or v_f.signature::text like'save_random_seating_%'or v_f.signature::text like'draw_random_seating_%'then execute format('grant execute on function %s to service_role',v_f.signature);end if;end loop;end$$;
commit;
