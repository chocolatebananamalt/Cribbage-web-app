-- Event-specific Side Pools are separate from the two configured Q Pools.
-- Definitions and all later money evidence are versioned/append-only.

create table app.event_side_pools(id uuid primary key,tournament_id uuid not null references app.tournaments(id) on delete restrict,event_id uuid not null,created_at timestamptz not null default clock_timestamp(),foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,unique(id,tournament_id,event_id));
alter table app.event_side_pools enable row level security;alter table app.event_side_pools force row level security;revoke all on table app.event_side_pools from public,anon,authenticated;

create table app.event_side_pool_definition_versions(
  id uuid primary key default extensions.gen_random_uuid(),pool_id uuid not null,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,event_id uuid not null,
  version integer not null check(version>0),category_code text not null check(category_code in('10','20','50','100')),
  display_name text not null check(length(trim(display_name)) between 1 and 100),entry_fee_minor integer not null check(entry_fee_minor between 0 and 100000000),
  active boolean not null,actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,created_at timestamptz not null default clock_timestamp(),
  foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
  foreign key(pool_id,tournament_id,event_id) references app.event_side_pools(id,tournament_id,event_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(pool_id,version),unique(id,tournament_id,event_id)
);
alter table app.event_side_pool_definition_versions enable row level security;
alter table app.event_side_pool_definition_versions force row level security;
revoke all on table app.event_side_pool_definition_versions from public,anon,authenticated;
create trigger event_side_pool_definitions_immutable before update or delete on app.event_side_pool_definition_versions
for each row execute function app.reject_immutable_history();
create index event_side_pool_definitions_event_idx on app.event_side_pool_definition_versions(event_id,pool_id,version desc);

create table app.event_side_pool_election_versions(
  id uuid primary key default extensions.gen_random_uuid(),election_id uuid not null,pool_id uuid not null,
  tournament_id uuid not null,event_id uuid not null,participant_id uuid not null,version integer not null check(version>0),
  elected boolean not null,amount_due_minor integer not null check(amount_due_minor between 0 and 100000000),
  amount_received_minor integer not null check(amount_received_minor between 0 and amount_due_minor),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(participant_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id) on delete restrict,
  foreign key(pool_id,tournament_id,event_id) references app.event_side_pools(id,tournament_id,event_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(election_id,version)
);
alter table app.event_side_pool_election_versions enable row level security;alter table app.event_side_pool_election_versions force row level security;
revoke all on table app.event_side_pool_election_versions from public,anon,authenticated;
create trigger event_side_pool_elections_immutable before update or delete on app.event_side_pool_election_versions for each row execute function app.reject_immutable_history();
create index event_side_pool_elections_scope_idx on app.event_side_pool_election_versions(event_id,pool_id,participant_id,version desc);

create table app.event_side_pool_payout_versions(
  id uuid primary key default extensions.gen_random_uuid(),payout_id uuid not null,pool_id uuid not null,
  tournament_id uuid not null,event_id uuid not null,participant_id uuid not null,version integer not null check(version>0),
  placement integer check(placement>0),amount_minor integer not null check(amount_minor between 0 and 100000000),voided boolean not null default false,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(participant_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id) on delete restrict,
  foreign key(pool_id,tournament_id,event_id) references app.event_side_pools(id,tournament_id,event_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(payout_id,version)
);
alter table app.event_side_pool_payout_versions enable row level security;alter table app.event_side_pool_payout_versions force row level security;
revoke all on table app.event_side_pool_payout_versions from public,anon,authenticated;
create trigger event_side_pool_payouts_immutable before update or delete on app.event_side_pool_payout_versions for each row execute function app.reject_immutable_history();
create index event_side_pool_payouts_scope_idx on app.event_side_pool_payout_versions(event_id,pool_id,participant_id,version desc);

-- Reserved normalized identity/finance model for later team activation. No
-- digital-team RPC is exposed by this migration.
create table app.event_teams(id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.tournaments(id) on delete restrict,event_id uuid not null,display_name text not null check(length(trim(display_name)) between 1 and 400),created_by_profile_id uuid not null references app.profiles(id) on delete restrict,created_at timestamptz not null default clock_timestamp(),foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,unique(id,tournament_id,event_id));
create table app.event_team_members(id uuid primary key default extensions.gen_random_uuid(),team_id uuid not null,tournament_id uuid not null,event_id uuid not null,roster_entry_id uuid not null,profile_id uuid references app.profiles(id) on delete restrict,acc_number_snapshot text not null default '',member_role text not null check(member_role in('captain','member')),claimed_at timestamptz,foreign key(team_id,tournament_id,event_id) references app.event_teams(id,tournament_id,event_id) on delete restrict,foreign key(roster_entry_id,tournament_id) references app.tournament_roster_entries(id,tournament_id) on delete restrict,unique(team_id,roster_entry_id),unique(event_id,roster_entry_id));
create table app.event_team_entries(id uuid primary key default extensions.gen_random_uuid(),team_id uuid not null,tournament_id uuid not null,event_id uuid not null,entry_fee_minor integer not null check(entry_fee_minor between 0 and 100000000),scorecard_type text not null check(scorecard_type='paper'),digital_scoring_enabled boolean not null default false check(digital_scoring_enabled=false),created_at timestamptz not null default clock_timestamp(),foreign key(team_id,tournament_id,event_id) references app.event_teams(id,tournament_id,event_id) on delete restrict,unique(team_id));
create table app.event_team_financial_contributions(id uuid primary key default extensions.gen_random_uuid(),team_entry_id uuid not null references app.event_team_entries(id) on delete restrict,roster_entry_id uuid not null,tournament_id uuid not null,amount_minor integer not null check(amount_minor between 0 and 100000000),contribution_type text not null check(contribution_type in('entry_fee','q_pool','side_pool','award')),recorded_at timestamptz not null default clock_timestamp(),foreign key(roster_entry_id,tournament_id) references app.tournament_roster_entries(id,tournament_id) on delete restrict);
do $$ declare table_name text;begin foreach table_name in array array['event_teams','event_team_members','event_team_entries','event_team_financial_contributions'] loop execute format('alter table app.%I enable row level security',table_name);execute format('alter table app.%I force row level security',table_name);execute format('revoke all on table app.%I from public,anon,authenticated',table_name);end loop;end $$;

create or replace function public.get_event_side_pool_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then jsonb_build_object(
    'tournamentName',tournament.name,'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',event_row.id,'name',event_row.name,'eventType',event_row.event_type,'pools',coalesce((select jsonb_agg(jsonb_build_object('poolId',current.pool_id,'version',current.version,'categoryCode',current.category_code,'displayName',current.display_name,'entryFeeMinor',current.entry_fee_minor) order by current.entry_fee_minor) from(select distinct on(definition.pool_id) definition.* from app.event_side_pool_definition_versions definition where definition.event_id=event_row.id order by definition.pool_id,definition.version desc) current where current.active),'[]'::jsonb)) order by event_row.event_type,event_row.name) from app.events event_row where event_row.tournament_id=tournament.id),'[]'::jsonb)
  ) else null end from app.tournaments tournament where tournament.id=p_tournament_id
$$;
revoke all on function public.get_event_side_pool_workspace_v1(uuid,uuid) from public,anon,authenticated;grant execute on function public.get_event_side_pool_workspace_v1(uuid,uuid) to service_role;

create or replace function public.add_event_side_pool_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_category_code text,p_display_name text,p_entry_fee_minor integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_prior app.operation_receipts%rowtype;v_receipt uuid:=extensions.gen_random_uuid();v_response jsonb;
begin
 if p_actor_id is null or p_pool_id is null or p_idempotency_key is null or p_category_code not in('10','20','50','100') or length(trim(p_display_name)) not between 1 and 100 or p_entry_fee_minor not between 0 and 100000000 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('add_event_side_pool_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_pool_id::text,p_category_code,p_display_name,p_entry_fee_minor)::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('side-pools:'||p_event_id::text,0));
 perform 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director') for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior.response_payload;end if;
 if not exists(select 1 from app.events event_row where event_row.id=p_event_id and event_row.tournament_id=p_tournament_id) then return jsonb_build_object('status','rejected','code','event_unavailable');end if;
 if exists(select 1 from(select distinct on(definition.pool_id) definition.* from app.event_side_pool_definition_versions definition where definition.event_id=p_event_id order by definition.pool_id,definition.version desc) current where current.active and current.category_code=p_category_code) then return jsonb_build_object('status','rejected','code','category_exists');end if;
 if (select count(*) from(select distinct on(definition.pool_id) definition.* from app.event_side_pool_definition_versions definition where definition.event_id=p_event_id order by definition.pool_id,definition.version desc) current where current.active)>=4 then return jsonb_build_object('status','rejected','code','side_pool_limit');end if;
 v_response:=jsonb_build_object('status','side_pool_added','eventId',p_event_id,'poolId',p_pool_id,'version',1);
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt,p_actor_id,p_tournament_id,'add_event_side_pool_v1',p_pool_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
 insert into app.event_side_pools(id,tournament_id,event_id) values(p_pool_id,p_tournament_id,p_event_id);
 insert into app.event_side_pool_definition_versions(pool_id,tournament_id,event_id,version,category_code,display_name,entry_fee_minor,active,actor_profile_id,operation_receipt_id) values(p_pool_id,p_tournament_id,p_event_id,1,p_category_code,trim(p_display_name),p_entry_fee_minor,true,p_actor_id,v_receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'event_side_pool',p_pool_id,'side_pool_added',v_response);
 return v_response;
end $$;
revoke all on function public.add_event_side_pool_v1(uuid,uuid,uuid,uuid,text,text,integer,uuid) from public,anon,authenticated;grant execute on function public.add_event_side_pool_v1(uuid,uuid,uuid,uuid,text,text,integer,uuid) to service_role;
notify pgrst,'reload schema';
