-- LOCAL ONLY. Extend the existing paid single-Main setup declaration to Side Pools.
-- No data rewrite, backfill, new RPC, table, policy, or privilege grant.
begin;
do $patch$
declare d text; p text; anchor text;
begin
 d:=pg_get_functiondef('public.save_setup_prize_schedule_v1(uuid,uuid,uuid,jsonb,uuid)'::regprocedure);
 anchor:='or (settings->>''qPoolCount'')::integer not between 0 and 2 or settings->>''sidePoolCount'' <> ''0''';
 if position(anchor in d)=0 then raise exception 'Reviewed setup Side eligibility anchor changed';end if;
 p:=replace(d,anchor,'or (settings->>''qPoolCount'')::integer not between 0 and 2 or (settings->>''sidePoolCount'')::integer not between 0 and 6');
 anchor:='if (settings->>''qPoolCount'')::integer>0 and (exists(select 1 from app.roster_payment_events where tournament_id=p_tournament_id) or exists(select 1 from app.q_pool_membership_versions_v1 where tournament_id=p_tournament_id)) then raise exception ''schedule_revision_closed'';end if;';
 if position(anchor in p)=0 then raise exception 'Reviewed setup precollection anchor changed';end if;
 p:=replace(p,anchor,'if ((settings->>''qPoolCount'')::integer>0 or (settings->>''sidePoolCount'')::integer>0) and
      (exists(select 1 from app.roster_payment_events where tournament_id=p_tournament_id)
       or exists(select 1 from app.q_pool_membership_versions_v1 where tournament_id=p_tournament_id)
       or exists(select 1 from app.event_side_pool_election_versions where tournament_id=p_tournament_id)
       or exists(select 1 from app.event_side_pool_team_election_versions where tournament_id=p_tournament_id))
    then raise exception ''schedule_revision_closed'';end if;');
 execute p;
 d:=pg_get_functiondef('app.setup_prize_schedule_workspace_v1(uuid,uuid,uuid)'::regprocedure);
 anchor:='settings->>''sidePoolCount'' = ''0''';
 if position(anchor in d)=0 then raise exception 'Reviewed setup Side workspace anchor changed';end if;
 p:=replace(d,anchor,'(settings->>''sidePoolCount'')::integer between 0 and 6 and (settings->>''entryFeeCents'')::integer > 0');
 execute p;
end $patch$;

-- Legacy individual/team Side writers predate the tournament serialization
-- already used by graduated Side elections. Lock before the role to preserve
-- the shared tournament -> role ordering, without changing their contracts.
do $patch$
declare signature text;d text;anchor text;
begin
 foreach signature in array array[
  'public.set_event_side_pool_election_v1(uuid,uuid,uuid,uuid,uuid,uuid,boolean,integer,text,text,text,uuid)',
  'public.set_event_side_pool_team_election_v1(uuid,uuid,uuid,uuid,uuid,uuid,boolean,integer,text,text,text,uuid)'
 ]loop
  d:=pg_get_functiondef(signature::regprocedure);
  anchor:='perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in(''director'',''co_director'') for update;';
  if position(anchor in d)=0 then raise exception 'Reviewed legacy Side role lock anchor changed: %',signature;end if;
  execute replace(d,anchor,'perform 1 from app.tournaments where id=p_tournament_id for update; '||anchor);
 end loop;
end $patch$;

create or replace function app.bind_prize_schedule_on_activation_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare setup_event app.tournament_setup_event_versions%rowtype;
 schedule app.setup_prize_schedule_versions_v1%rowtype; settings jsonb; require_current boolean;
begin
 -- The same tournament row serializes normal setup saving, initial activation,
 -- schedule revision and collection writers. Existing activation rows are untouched.
 perform 1 from app.tournaments where id=new.tournament_id for update;
 select * into setup_event from app.tournament_setup_event_versions
 where id=new.setup_event_version_id and tournament_id=new.tournament_id;
 settings:=app.prize_schedule_settings_v1(new.tournament_id,setup_event.client_row_id);
 require_current:=not exists(select 1 from app.tournament_setup_activations
   where tournament_id=new.tournament_id and id<>new.id)
  and setup_event.event_kind='main' and setup_event.style_code='Standard'
  and setup_event.format_code='standard_singles' and setup_event.game_count=12 and setup_event.entry_fee_cents>0
  and (select count(*)from app.tournament_setup_event_versions where setup_revision_id=setup_event.setup_revision_id)=1
  and (select count(*)from app.tournament_setup_q_pool_versions where setup_revision_id=setup_event.setup_revision_id) between 0 and 2
  and (select count(*)from app.tournament_setup_side_pool_versions where setup_revision_id=setup_event.setup_revision_id) between 0 and 6;
 select * into schedule from app.setup_prize_schedule_versions_v1
 where tournament_id=new.tournament_id and client_row_id=setup_event.client_row_id order by version desc limit 1;
 if not found then
  if require_current then raise exception 'schedule_revision_required';end if;
  return new;
 end if;
 if settings->>'setupEventVersionId' is distinct from new.setup_event_version_id::text
   or schedule.settings_fingerprint is distinct from app.prize_schedule_settings_fingerprint_v1(settings)
   or (require_current and app.valid_regular_prize_schedule_v3(schedule.schedule_payload) is distinct from true)
 then raise exception 'schedule_revision_required';end if;
 insert into app.event_prize_schedule_bindings_v1(tournament_id,event_id,client_row_id,binding_version,schedule_version_id,binding_source)
 values(new.tournament_id,new.event_id,setup_event.client_row_id,1,schedule.id,'activation');
 return new;
end $$;
-- CREATE OR REPLACE preserves the existing private function identity and ACL.
notify pgrst,'reload schema';
commit;
