-- CLI scaffold 20261101073645_simulated_player_links_v1.sql. LOCAL PROPOSAL.
-- No enrollment or role/link rows are seeded. Staging enrollment needs approval.
begin;
create table app.simulated_player_link_scopes_v1 (
 tournament_id uuid primary key references app.tournaments(id),
 project_ref text not null references app.synthetic_paper_deployments_v1(project_ref)
   check(project_ref='nnhcnvksxgxnpvdqjgpg'),
 operator_profile_id uuid not null references app.profiles(id)
   check(operator_profile_id='de0f27a1-60d0-4449-af83-fdf360a9bc08'),
 authorization_reference text not null check(length(trim(authorization_reference)) between 1 and 500),
 enrolled_at timestamptz not null default clock_timestamp(),
 check(tournament_id='3c58ef91-010c-4769-af20-5cfa2ffe98a9')
);
create table app.simulated_player_link_provenance_v1 (
 link_id uuid primary key references app.roster_account_links(id),
 tournament_id uuid not null references app.simulated_player_link_scopes_v1(tournament_id),
 request_id uuid not null unique references app.roster_account_activation_requests(id),
 decision_receipt_id uuid not null unique references app.operation_receipts(id),
 operator_profile_id uuid not null references app.profiles(id),
 approving_profile_id uuid not null references app.profiles(id),
 player_profile_id uuid not null references app.profiles(id),
 method text not null default 'single_operator_two_accounts_v1' check(method='single_operator_two_accounts_v1'),
 independent_human_witness boolean not null default false check(not independent_human_witness),
 recorded_at timestamptz not null default clock_timestamp(),
 check(approving_profile_id<>player_profile_id),
 check(operator_profile_id='de0f27a1-60d0-4449-af83-fdf360a9bc08'),
 check(approving_profile_id in('de0f27a1-60d0-4449-af83-fdf360a9bc08','986c7f24-1d42-4115-8532-053fc4bef59a')),
 check(player_profile_id in('de0f27a1-60d0-4449-af83-fdf360a9bc08','986c7f24-1d42-4115-8532-053fc4bef59a'))
);
create index simulated_player_link_provenance_scope_v1 on app.simulated_player_link_provenance_v1(tournament_id);
create index simulated_player_link_provenance_operator_v1 on app.simulated_player_link_provenance_v1(operator_profile_id);
create index simulated_player_link_provenance_actor_v1 on app.simulated_player_link_provenance_v1(approving_profile_id);
create index simulated_player_link_provenance_player_v1 on app.simulated_player_link_provenance_v1(player_profile_id);
do $$declare t text;begin foreach t in array array['simulated_player_link_scopes_v1','simulated_player_link_provenance_v1']loop
 execute format('alter table app.%I enable row level security',t);
 execute format('alter table app.%I force row level security',t);
 execute format('revoke all on table app.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',t||'_immutable',t);
end loop;end$$;

create function app.guard_simulated_link_enrollment_v1() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('simulated-player-link-scope:'||new.tournament_id::text,0));
 if exists(select 1 from app.roster_account_links where tournament_id=new.tournament_id)
 then raise exception 'simulation_requires_fresh_unlinked_fixture';end if;
 return new;
end$$;
create trigger simulated_link_enrollment_guard_v1 before insert on app.simulated_player_link_scopes_v1
 for each row execute function app.guard_simulated_link_enrollment_v1();

create function public.get_simulated_player_link_scope_v1(p_actor_id uuid,p_tournament_id uuid)
returns boolean language sql security definer set search_path='' as $$
 select coalesce(auth.role(),'')='service_role'
 and p_actor_id in('de0f27a1-60d0-4449-af83-fdf360a9bc08'::uuid,'986c7f24-1d42-4115-8532-053fc4bef59a'::uuid)
 and exists(select 1 from app.simulated_player_link_scopes_v1 s
 join app.synthetic_paper_deployments_v1 d using(project_ref)
 join app.tournament_roles r on r.tournament_id=s.tournament_id
 where s.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director'))
$$;

-- All authorized viewers see the fixture label, including a player after an
-- official role is removed. This reader grants no link-decision authority.
create function public.get_simulated_player_link_label_v1(p_actor_id uuid,p_tournament_id uuid)
returns boolean language sql security definer set search_path='' as $$
 select coalesce(auth.role(),'')='service_role' and exists(
 select 1 from app.simulated_player_link_scopes_v1 s join app.synthetic_paper_deployments_v1 d using(project_ref)
 join app.tournament_roles_effective r on r.tournament_id=s.tournament_id
 where s.tournament_id=p_tournament_id and r.profile_id=p_actor_id)
$$;

create function app.guard_simulated_player_link_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare req app.roster_account_activation_requests%rowtype;
begin
 if new.tournament_id='3c58ef91-010c-4769-af20-5cfa2ffe98a9' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('simulated-player-link-scope:'||new.tournament_id::text,0));
 end if;
 if not exists(select 1 from app.simulated_player_link_scopes_v1 where tournament_id=new.tournament_id)then return new;end if;
 select * into req from app.roster_account_activation_requests
 where id::text=current_setting('app.simulated_player_link_request',true) and tournament_id=new.tournament_id;
 if not found or req.profile_id<>new.profile_id
 or not public.get_simulated_player_link_scope_v1(new.actor_profile_id,new.tournament_id)
 or new.profile_id not in('de0f27a1-60d0-4449-af83-fdf360a9bc08','986c7f24-1d42-4115-8532-053fc4bef59a')
 or not exists(select 1 from app.roster_account_activations where id=req.activation_id and roster_entry_id=new.roster_entry_id)
 then raise exception 'explicit_simulated_link_required';end if;
 return new;
end$$;
create trigger simulated_player_link_guard_v1 before insert on app.roster_account_links
 for each row execute function app.guard_simulated_player_link_v1();

-- A missing/failed provenance insertion rolls the entire link transaction back.
create function app.require_simulated_link_provenance_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from app.simulated_player_link_scopes_v1 where tournament_id=new.tournament_id)
 and not exists(select 1 from app.simulated_player_link_provenance_v1 p
 where p.link_id=new.id and p.tournament_id=new.tournament_id and p.approving_profile_id=new.actor_profile_id and p.player_profile_id=new.profile_id)
 then raise exception 'simulated_link_provenance_required';end if;
 return new;
end$$;
create constraint trigger simulated_link_provenance_required_v1 after insert on app.roster_account_links
 deferrable initially deferred for each row execute function app.require_simulated_link_provenance_v1();

create function public.decide_simulated_player_link_v1(
 p_actor_id uuid,p_tournament_id uuid,p_request_id uuid,p_decision text,p_confirmation_phrase text,p_operation_id uuid
)returns jsonb language plpgsql security definer set search_path='' as $$
declare req app.roster_account_activation_requests%rowtype;result jsonb;prior text;receipt uuid;
begin
 if p_decision is distinct from 'approve' or not public.get_simulated_player_link_scope_v1(p_actor_id,p_tournament_id)
 then return jsonb_build_object('status','rejected');end if;
 select * into req from app.roster_account_activation_requests where id=p_request_id and tournament_id=p_tournament_id;
 if not found or req.profile_id=p_actor_id or req.profile_id not in('de0f27a1-60d0-4449-af83-fdf360a9bc08','986c7f24-1d42-4115-8532-053fc4bef59a')
 then return jsonb_build_object('status','rejected');end if;
 prior:=current_setting('app.simulated_player_link_request',true);
 perform set_config('app.simulated_player_link_request',p_request_id::text,true);
 result:=public.decide_roster_account_activation_v1(p_actor_id,p_tournament_id,p_request_id,p_decision,p_confirmation_phrase,p_operation_id);
 perform set_config('app.simulated_player_link_request',coalesce(prior,''),true);
 if result->>'status'='approved' then
  select id into strict receipt from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id
   and operation_type='roster_account_activation_decision_v1' and response_payload=result;
  insert into app.simulated_player_link_provenance_v1(link_id,tournament_id,request_id,decision_receipt_id,operator_profile_id,approving_profile_id,player_profile_id)
   values((result->>'linkId')::uuid,p_tournament_id,p_request_id,receipt,'de0f27a1-60d0-4449-af83-fdf360a9bc08',p_actor_id,req.profile_id)
   on conflict(link_id)do nothing;
  if not exists(select 1 from app.simulated_player_link_provenance_v1 where link_id=(result->>'linkId')::uuid and request_id=p_request_id and decision_receipt_id=receipt)
  then raise exception 'simulation_replay_mismatch';end if;
 end if;
 return result;
end$$;
revoke all on function app.guard_simulated_link_enrollment_v1(),app.guard_simulated_player_link_v1(),app.require_simulated_link_provenance_v1() from public,anon,authenticated,service_role;
revoke all on function public.get_simulated_player_link_scope_v1(uuid,uuid),public.get_simulated_player_link_label_v1(uuid,uuid),public.decide_simulated_player_link_v1(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.get_simulated_player_link_scope_v1(uuid,uuid),public.get_simulated_player_link_label_v1(uuid,uuid),public.decide_simulated_player_link_v1(uuid,uuid,uuid,text,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
