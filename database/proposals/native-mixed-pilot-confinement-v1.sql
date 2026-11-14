-- LOCAL release candidate only. Installs NO deployment/scope authorization or
-- application grants. Owner must separately verify target and approve a cohort.
begin;
create table app.native_mixed_pilot_deployment_v1(
 project_ref text primary key check(project_ref='nnhcnvksxgxnpvdqjgpg'),
 authorization_reference text not null check(length(trim(authorization_reference))between 1 and 500),
 recorded_by text not null default session_user,recorded_at timestamptz not null default clock_timestamp());
create table app.native_mixed_pilot_scopes_v1(
 id uuid primary key default extensions.gen_random_uuid(),project_ref text not null references app.native_mixed_pilot_deployment_v1,
 tournament_id uuid not null,event_id uuid not null,version integer not null check(version>0),
 actor_ids uuid[] not null check(cardinality(actor_ids)between 1 and 32),protocol text not null check(protocol='native-mixed-signed-pilot-v1'),
 writes_enabled boolean not null,expires_at timestamptz not null,authorization_reference text not null,
 operation_id uuid not null unique,request jsonb not null,recorded_by text not null default session_user,
 recorded_at timestamptz not null default clock_timestamp(),unique(tournament_id,event_id,version),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(length(trim(authorization_reference))between 1 and 500));
do $pilot$declare n text;begin foreach n in array array['native_mixed_pilot_deployment_v1','native_mixed_pilot_scopes_v1']loop
 execute format('alter table app.%I owner to postgres',n);
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',n);
end loop;end$pilot$;

create function app.authorize_native_mixed_pilot_deployment_v1(ref text,reference text)returns void
language plpgsql security definer set search_path=''as $$declare old_ref text;begin
 if ref is distinct from'nnhcnvksxgxnpvdqjgpg'or reference is null or length(trim(reference))not between 1 and 500 then raise exception'invalid_pilot_deployment';end if;
 perform pg_advisory_xact_lock(hashtextextended('native-mixed-pilot-deployment',0));
 select authorization_reference into old_ref from app.native_mixed_pilot_deployment_v1 where project_ref=ref;
 if found then if old_ref is distinct from reference then raise exception'pilot_deployment_conflict';end if;return;end if;
 insert into app.native_mixed_pilot_deployment_v1(project_ref,authorization_reference)values(ref,reference);
end$$;
create function app.record_native_mixed_pilot_scope_v1(tid uuid,eid uuid,actors uuid[],expected integer,writes boolean,expiry timestamptz,reference text,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$declare old app.native_mixed_pilot_scopes_v1%rowtype;v integer;request_value jsonb;begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'pilot_scope_requires_read_committed';end if;
 request_value:=jsonb_build_array(tid,eid,actors,expected,writes,expiry,reference,op);
 perform pg_advisory_xact_lock(hashtextextended('native-mixed-pilot-scope:'||tid::text||':'||eid::text,0));
 select * into old from app.native_mixed_pilot_scopes_v1 where operation_id=op;
 if found then if old.request is distinct from request_value then raise exception'pilot_scope_idempotency_conflict';end if;return to_jsonb(old);end if;
 if tid is null or eid is null or op is null or actors is null or cardinality(actors)not between 1 and 32
  or array_position(actors,null)is not null or(select count(distinct x)from unnest(actors)x)<>cardinality(actors)
  or(select count(*)from app.profiles where id=any(actors))<>cardinality(actors)
  or writes is null or expiry is null or expiry<=clock_timestamp()or expiry>clock_timestamp()+interval'24 hours'
  or reference is null or length(trim(reference))not between 1 and 500
  or not exists(select 1 from app.native_mixed_pilot_deployment_v1 where project_ref='nnhcnvksxgxnpvdqjgpg')then raise exception'invalid_pilot_scope';end if;
 select coalesce(max(version),0)into v from app.native_mixed_pilot_scopes_v1 where tournament_id=tid and event_id=eid;
 if expected is distinct from v then raise exception'pilot_scope_stale_version';end if;
 insert into app.native_mixed_pilot_scopes_v1(project_ref,tournament_id,event_id,version,actor_ids,protocol,writes_enabled,expires_at,authorization_reference,operation_id,request)
 values('nnhcnvksxgxnpvdqjgpg',tid,eid,v+1,actors,'native-mixed-signed-pilot-v1',writes,expiry,reference,op,request_value)returning * into old;
 return to_jsonb(old);
end$$;

-- PostgREST must first verify JWT signatures. User issuer and service token ref
-- additionally fail closed on cross-project use. Marker is an explicit owner
-- authorization, NOT SQL discovery of the physical Supabase project.
create function app.native_mixed_pilot_permitted_v1(actor uuid,tid uuid,eid uuid,writing boolean)returns boolean
language plpgsql security definer set search_path=''as $$declare s app.native_mixed_pilot_scopes_v1%rowtype;r text:=auth.role();begin
 if current_setting('transaction_isolation')<>'read committed'or actor is null or tid is null or eid is null or writing is null then return false;end if;
 if r='authenticated'then
  if auth.jwt()->>'iss'is distinct from'https://nnhcnvksxgxnpvdqjgpg.supabase.co/auth/v1'
   or app.native_mixed_game_own_subject_v1()is distinct from actor then return false;end if;
 elsif r='service_role'then
  if auth.jwt()->>'ref'is distinct from'nnhcnvksxgxnpvdqjgpg'then return false;end if;
 else return false;end if;
 if not pg_try_advisory_xact_lock_shared(hashtextextended('native-mixed-pilot-scope:'||tid::text||':'||eid::text,0))then return false;end if;
 select * into s from app.native_mixed_pilot_scopes_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 return s.id is not null and s.project_ref='nnhcnvksxgxnpvdqjgpg'and actor=any(s.actor_ids)
  and s.expires_at>clock_timestamp()and(not writing or s.writes_enabled)
  and exists(select 1 from app.native_mixed_pilot_deployment_v1 where project_ref=s.project_ref);
end$$;

-- Move original NEW browser entrypoints behind a current bounded permission
-- check. No raw/core/history proof is changed and no JWT is rewritten.
do $pilot$declare n text;args text;decl text;call_args text;writing boolean;private_name text;begin
 foreach n in array array['record_native_mixed_digital_consent_v1','record_native_mixed_simulation_game_evidence_v1',
  'get_native_mixed_simulation_game_operation_v1','resolve_native_mixed_game_operation_v1',
  'get_native_mixed_simulation_game_state_v1','get_native_mixed_own_player_bindings_v1','get_native_mixed_paper_binding_v1']loop
  if n in('get_native_mixed_simulation_game_state_v1','get_native_mixed_paper_binding_v1')then
   args:='uuid,uuid,uuid,uuid';decl:='p_tournament_id uuid,p_event_id uuid,p_start_id uuid,p_game_id uuid';call_args:='p_tournament_id,p_event_id,p_start_id,p_game_id';
  elsif n='get_native_mixed_own_player_bindings_v1'then
   args:='uuid,uuid,uuid';decl:='p_tournament_id uuid,p_event_id uuid,p_start_id uuid';call_args:='p_tournament_id,p_event_id,p_start_id';
  else args:='uuid,uuid,jsonb';decl:='p_tournament_id uuid,p_event_id uuid,p_request jsonb';call_args:='p_tournament_id,p_event_id,p_request';end if;
  private_name:='pilot_unscoped_'||n;if length(private_name)>63 then raise exception'pilot_identifier_too_long';end if;
  writing:=n in('record_native_mixed_digital_consent_v1','record_native_mixed_simulation_game_evidence_v1','resolve_native_mixed_game_operation_v1');
  execute format('alter function public.%I(%s)rename to %I',n,args,private_name);
  execute format('alter function public.%I(%s)set schema app',private_name,args);
  execute format('revoke all on function app.%I(%s)from public,anon,authenticated,service_role',private_name,args);
  execute format($f$create function public.%I(%s)returns jsonb language plpgsql security definer set search_path=''as $body$begin
   if app.native_mixed_pilot_permitted_v1(auth.uid(),p_tournament_id,p_event_id,%L)is distinct from true then return null;end if;
   return app.%I(%s);end;$body$$f$,n,decl,writing,private_name,call_args);
  execute format('alter function public.%I(%s)owner to postgres',n,args);
  execute format('revoke all on function public.%I(%s)from public,anon,authenticated,service_role',n,args);
 end loop;
end$pilot$;

-- Concrete server-only Director dispatcher. It cannot make player consents,
-- create Auth identities, assign roles, change ordinary attendance or move money.
create function public.execute_native_mixed_pilot_director_v1(p_actor_id uuid,p_session_id uuid,p_tournament_id uuid,p_event_id uuid,p_action text,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare writing boolean;begin
 if auth.role()is distinct from'service_role'or auth.jwt()->>'ref'is distinct from'nnhcnvksxgxnpvdqjgpg'then return null;end if;
 if p_action is null or p_action not in('plan','draw','review','publish','source','operation','cancel','cancellation','transition','simulation-start','simulation-start-operation','simulation-start-source')then return null;end if;
 writing:=p_action in('plan','draw','review','publish','cancel','simulation-start');
 if app.native_mixed_pilot_permitted_v1(p_actor_id,p_tournament_id,p_event_id,writing)is distinct from true then return null;end if;
 perform 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=p_session_id and s.user_id=p_actor_id
  and(s.not_after is null or s.not_after>clock_timestamp())and u.deleted_at is null and(u.banned_until is null or u.banned_until<=clock_timestamp())for share of s,u nowait;
 if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director'for share nowait;
 if not found then return null;end if;
 case p_action
 when'plan'then return app.save_native_mixed_simulation_plan_v1(p_actor_id,p_tournament_id,p_event_id,p_request);
 when'draw'then return app.draw_native_mixed_simulation_v1(p_actor_id,p_tournament_id,p_event_id,p_request);
 when'review'then return app.review_native_mixed_simulation_draw_v1(p_actor_id,p_tournament_id,p_event_id,p_request);
 when'publish'then return app.publish_native_mixed_simulation_v1(p_actor_id,p_tournament_id,p_event_id,p_request);
 when'source'then return app.native_mixed_simulation_schedule_source_v1(p_actor_id,p_tournament_id,p_event_id);
 when'operation'then return app.get_native_mixed_simulation_operation_v1(p_actor_id,p_tournament_id,p_event_id,(p_request->>'operationId')::uuid);
 when'cancel'then return app.cancel_native_mixed_simulation_operation_v1(p_actor_id,p_tournament_id,p_event_id,p_request);
 when'cancellation'then return app.get_native_mixed_simulation_cancellation_v1(p_actor_id,p_tournament_id,p_event_id,(p_request->>'operationId')::uuid);
 when'transition'then return app.get_native_mixed_simulation_transition_v1(p_actor_id,p_tournament_id,p_event_id,(p_request->>'operationId')::uuid);
 when'simulation-start'then return app.record_native_mixed_simulation_start_v1(p_actor_id,p_tournament_id,p_event_id,p_request);
 when'simulation-start-operation'then return app.get_native_mixed_simulation_start_operation_v1(p_actor_id,p_tournament_id,p_event_id,(p_request->>'operationId')::uuid);
 when'simulation-start-source'then return app.get_native_mixed_simulation_started_source_v1(p_actor_id,p_tournament_id,p_event_id,(p_request->>'startId')::uuid);
 end case;return null;
exception when invalid_text_representation or lock_not_available then return null;end$$;
do $pilot$declare p regprocedure;begin foreach p in array array[
 'app.authorize_native_mixed_pilot_deployment_v1(text,text)'::regprocedure,
 'app.record_native_mixed_pilot_scope_v1(uuid,uuid,uuid[],integer,boolean,timestamp with time zone,text,uuid)'::regprocedure,
 'app.native_mixed_pilot_permitted_v1(uuid,uuid,uuid,boolean)'::regprocedure,
 'public.execute_native_mixed_pilot_director_v1(uuid,uuid,uuid,uuid,text,jsonb)'::regprocedure]loop
 execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);
end loop;end$pilot$;
commit;
