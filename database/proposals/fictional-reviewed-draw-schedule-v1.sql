-- DEFAULT-OFF LOCAL CANDIDATE. Never install on production. No marker or grants
-- are inserted here. Requires the random draw, reviewed native publication and
-- reviewed trial scope proposals, in that order, plus the normal schedule writer.
begin;
create table app.fictional_draw_deployment_v1 (
 project_ref text primary key check (project_ref = 'nnhcnvksxgxnpvdqjgpg'),
 authorization_reference text not null check (length(trim(authorization_reference)) between 1 and 500),
 verified_at timestamptz not null default clock_timestamp()
);
create table app.fictional_draw_schedule_bindings_v1 (
 actor_id uuid not null references app.profiles(id), operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id), event_id uuid not null,
 reviewed_actor_id uuid not null, reviewed_operation_id uuid not null,
 request jsonb not null, matches jsonb not null, response jsonb not null,
 publication_id uuid not null unique references app.event_schedule_publications(id),
 created_at timestamptz not null default clock_timestamp(),
 primary key (actor_id, operation_id),
 foreign key (reviewed_actor_id, reviewed_operation_id) references app.reviewed_initial_seating_publications_v1(actor_id, operation_id)
);
alter table app.fictional_draw_deployment_v1 enable row level security;
alter table app.fictional_draw_deployment_v1 force row level security;
alter table app.fictional_draw_schedule_bindings_v1 enable row level security;
alter table app.fictional_draw_schedule_bindings_v1 force row level security;
revoke all on app.fictional_draw_deployment_v1, app.fictional_draw_schedule_bindings_v1 from public, anon, authenticated, service_role;
create trigger immutable before update or delete on app.fictional_draw_schedule_bindings_v1 for each row execute function app.reject_immutable_history();

-- Called only by a reviewed server boundary after obtaining a verified cookie
-- subject. This does not mark a deployment; the owner must separately insert a
-- genuine verified-fictional marker and the existing deployment authorization.
create function public.admit_fictional_draw_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_project_ref text,p_operation_id uuid,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ref text; expiry timestamptz; prior app.reviewed_seating_trial_scope_versions_v1%rowtype;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','') <> 'service_role'
 or p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null or p_confirmed is distinct from true
 or p_project_ref is distinct from 'nnhcnvksxgxnpvdqjgpg' then return null; end if;
 select authorization_reference into ref from app.fictional_draw_deployment_v1 where project_ref=p_project_ref;
 if ref is null then return null; end if;
 if not pg_try_advisory_xact_lock(hashtextextended('reviewed-seating-trial:'||p_tournament_id::text,0)) then return null; end if;
 perform 1 from app.tournaments where id=p_tournament_id for update nowait;
 if not found then return null; end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in ('director','co_director') for share nowait;
 if not found then return null; end if;
 -- Exact retry retains the original expiry and request; changed scope is refused.
 select * into prior from app.reviewed_seating_trial_scope_versions_v1 where reviewed_by=p_actor_id and operation_id=p_operation_id;
 if found then
  if prior.tournament_id<>p_tournament_id or prior.event_id<>p_event_id or prior.official_ids<>array[p_actor_id] or not prior.writes_enabled or prior.authorization_reference<>ref or prior.expires_at<=clock_timestamp() then return null; end if;
  if not app.reviewed_seating_trial_permitted_v1(p_actor_id,p_tournament_id,true) then return null; end if;
  return jsonb_build_object('status','trial_scope_recorded','version',prior.version,'scopeVersionId',prior.id,'expiresAt',prior.expires_at);
 end if;
 expiry:=clock_timestamp()+interval '24 hours';
 -- The underlying transaction verifies role, event, tournament name, current
 -- version and deployment authorization, and writes the immutable scope journal.
 perform app.record_reviewed_seating_trial_scope_v1(p_tournament_id,p_event_id,p_actor_id,array[p_actor_id],0,true,expiry,ref,p_operation_id);
 select * into prior from app.reviewed_seating_trial_scope_versions_v1 where reviewed_by=p_actor_id and operation_id=p_operation_id;
 return jsonb_build_object('status','trial_scope_recorded','version',prior.version,'scopeVersionId',prior.id,'expiresAt',prior.expires_at);
end$$;

-- No candidate or game rows come from the caller. The immutable accepted draw,
-- plan and native publication are reread under the same trial/tournament locks.
-- The normal schedule writer performs its own role, enrollment, seat and game
-- checks and creates its receipt, publication and canonical games atomically.
create function public.publish_fictional_draw_schedule_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_reviewed_actor_id uuid,p_reviewed_operation_id uuid,p_operation_id uuid,p_confirmed boolean,p_project_ref text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='250ms' as $$
declare b app.reviewed_initial_seating_publications_v1%rowtype; p app.random_seating_plans_v1%rowtype; d app.random_seating_draws_v1%rowtype;
 old app.fictional_draw_schedule_bindings_v1%rowtype; req jsonb; matches jsonb; result jsonb; scope_event uuid;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','') <> 'service_role'
 or p_actor_id is null or p_tournament_id is null or p_event_id is null or p_reviewed_actor_id is null or p_reviewed_operation_id is null or p_operation_id is null
 or p_confirmed is distinct from true or p_project_ref is distinct from 'nnhcnvksxgxnpvdqjgpg'
 or not exists(select 1 from app.fictional_draw_deployment_v1 where project_ref=p_project_ref) then return null; end if;
 if not pg_try_advisory_xact_lock(hashtextextended('reviewed-seating-trial:'||p_tournament_id::text,0)) then return null; end if;
 if not pg_try_advisory_xact_lock(hashtextextended(p_actor_id::text||':'||p_operation_id::text,0)) then return null; end if;
 perform 1 from app.tournaments where id=p_tournament_id for update nowait;
 if not found or not app.reviewed_seating_trial_permitted_v1(p_actor_id,p_tournament_id,false) then return null; end if;
 req:=jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'reviewedActorId',p_reviewed_actor_id,'reviewedOperationId',p_reviewed_operation_id,'confirmed',true,'projectRef',p_project_ref);
 select * into old from app.fictional_draw_schedule_bindings_v1 where actor_id=p_actor_id and operation_id=p_operation_id;
 if found then
  if old.request is distinct from req or not app.reviewed_initial_seating_bound_v1(old.reviewed_actor_id,old.reviewed_operation_id)
   or not exists(select 1 from app.event_schedule_publications s join app.operation_receipts r on r.id=s.operation_receipt_id
     where s.id=old.publication_id and s.event_id=old.event_id and s.tournament_id=old.tournament_id and r.actor_profile_id=old.actor_id
     and r.client_operation_id=old.operation_id and r.outcome='accepted' and r.response_payload=old.response)
   or (select count(*) from app.event_schedule_games where publication_id=old.publication_id)<>108
   then return null; end if;
  return old.response;
 end if;
 if not app.reviewed_seating_trial_permitted_v1(p_actor_id,p_tournament_id,true) then return null; end if;
 select event_id into scope_event from app.reviewed_seating_trial_scope_versions_v1 where tournament_id=p_tournament_id order by version desc limit 1;
 if scope_event is distinct from p_event_id then return null; end if;
 perform 1 from app.tournament_roster_entries where tournament_id=p_tournament_id order by id for update nowait;
 perform 1 from app.event_participants where tournament_id=p_tournament_id and event_id=p_event_id order by id for update nowait;
 select * into b from app.reviewed_initial_seating_publications_v1 where actor_id=p_reviewed_actor_id and operation_id=p_reviewed_operation_id and tournament_id=p_tournament_id;
 if not found or not app.reviewed_initial_seating_bound_v1(p_reviewed_actor_id,p_reviewed_operation_id) then return null; end if;
 select * into p from app.random_seating_plans_v1 where id=b.plan_id and tournament_id=p_tournament_id;
 if not found or p.source_binding is distinct from app.random_seating_binding_v1(p_tournament_id) or p.source_hash<>b.source_hash then return null; end if;
 select * into d from app.random_seating_draws_v1 where actor_id=b.draw_actor_id and operation_id=b.draw_operation_id and plan_id=p.id and tournament_id=p_tournament_id;
 if not found or d.candidate is distinct from b.request->'reviewedCandidate' or not app.reviewed_candidate_a18_valid_v1(p.config,p.source_snapshot,d.candidate) then return null; end if;
 if (select count(*) from app.event_participants where tournament_id=p_tournament_id and event_id=p_event_id and status='checked_in')<>18
 or (select count(*) from app.event_participants where tournament_id=p_tournament_id and event_id=p_event_id)<>18
 or exists(select 1 from app.event_participants ep where ep.tournament_id=p_tournament_id and ep.event_id=p_event_id and not exists
   (select 1 from app.initial_seating_assignments a where a.publication_id=b.publication_id and a.roster_entry_id=ep.roster_entry_id)) then return null; end if;
 select jsonb_agg(jsonb_build_object('gameNumber',(m->>'round')::integer,
  'sideAVerificationId',a->>'tournamentId','sideBVerificationId',z->>'tournamentId',
  'sideATableSeat',m->'sides'->0->>'seatId','sideBTableSeat',m->'sides'->1->>'seatId') order by ord)
 into matches from jsonb_array_elements(d.candidate->'matches') with ordinality x(m,ord)
 join lateral (select value a from jsonb_array_elements(d.candidate->'assignments') where value->>'participantId'=m->'sides'->0->>'participantId') aa on true
 join lateral (select value z from jsonb_array_elements(d.candidate->'assignments') where value->>'participantId'=m->'sides'->1->>'participantId') zz on true;
 if jsonb_array_length(matches) is distinct from 108 then return null; end if;
 result:=public.publish_director_reviewed_event_schedule_v1(p_actor_id,p_tournament_id,p_event_id,matches,true,p_operation_id);
 if result->>'status' is distinct from 'event_schedule_published' or result->>'eventId' is distinct from p_event_id::text
 or (result->>'gameCount')::integer<>12 or (result->>'participantCount')::integer<>18 or (result->>'matchCount')::integer<>108 then
  -- Raising rolls back even the writer's rejected receipt, preserving a single
  -- all-or-nothing outcome for this higher-level operation.
  raise exception 'fictional_schedule_publication_failed';
 end if;
 insert into app.fictional_draw_schedule_bindings_v1(actor_id,operation_id,tournament_id,event_id,reviewed_actor_id,reviewed_operation_id,request,matches,response,publication_id)
 values(p_actor_id,p_operation_id,p_tournament_id,p_event_id,p_reviewed_actor_id,p_reviewed_operation_id,req,matches,result,(result->>'publicationId')::uuid);
 return result;
end$$;
revoke all on function public.admit_fictional_draw_v1(uuid,uuid,uuid,text,uuid,boolean) from public,anon,authenticated,service_role;
revoke all on function public.publish_fictional_draw_schedule_v1(uuid,uuid,uuid,uuid,uuid,uuid,boolean,text) from public,anon,authenticated,service_role;
commit;
