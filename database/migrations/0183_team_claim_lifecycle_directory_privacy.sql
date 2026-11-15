-- Team claim/lifecycle/privacy repairs.  This migration is additive and does
-- not rewrite the established singles scoring path.

-- Partner claiming is the one permitted profile binding transition: the
-- roster/team identity fields remain immutable, and a null profile may bind
-- once to the already-linked roster account.  This replaces any earlier
-- broad immutable trigger that blocked the audited claim RPC.
drop trigger if exists event_team_members_immutable on app.event_team_members;
drop trigger if exists event_team_member_rebind_guard on app.event_team_members;
create or replace function app.guard_event_team_member_claim_v2() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.team_id is distinct from new.team_id or old.tournament_id is distinct from new.tournament_id
     or old.event_id is distinct from new.event_id or old.roster_entry_id is distinct from new.roster_entry_id
     or old.acc_number_snapshot is distinct from new.acc_number_snapshot or old.member_role is distinct from new.member_role then
    raise exception 'team member identity is immutable';
  end if;
  if old.profile_id is not null and new.profile_id is distinct from old.profile_id then
    raise exception 'team member binding is append-only';
  end if;
  if old.profile_id is null and new.profile_id is not null then
    if new.profile_id::text<>coalesce(pg_catalog.current_setting('app.team_claim_profile_id',true),'')
       or not exists(select 1 from app.roster_account_links l where l.tournament_id=new.tournament_id and l.roster_entry_id=new.roster_entry_id and l.profile_id=new.profile_id) then
      raise exception 'team member claim must match the linked roster account';
    end if;
    new.claimed_at:=coalesce(new.claimed_at,clock_timestamp());
  elsif new.claimed_at is distinct from old.claimed_at then
    raise exception 'team member claim timestamp is immutable';
  end if;
  return new;
end $$;
create trigger event_team_member_claim_guard before update on app.event_team_members
for each row execute function app.guard_event_team_member_claim_v2();
create trigger event_team_members_delete_immutable before delete on app.event_team_members
for each row execute function app.reject_immutable_history();

-- Team creation is valid only while registration is open and before any
-- seating, schedule, start, or score evidence exists for the event.
create or replace function public.create_event_team_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_team_id uuid,p_team_entry_id uuid,
  p_captain_roster_entry_id uuid,p_partner_roster_entry_id uuid,p_scorecard_type text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text; prior app.operation_receipts%rowtype; rid uuid; captain_profile uuid; captain_name text; partner_name text; response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_scorecard_type not in('digital','paper') or p_captain_roster_entry_id=p_partner_roster_entry_id then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-lifecycle:'||p_event_id::text,0));
  if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director'); end if;
  if not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id and format in('doubles','canadian_doubles') and scoring_method='digital') then return jsonb_build_object('status','rejected','code','event_not_supported'); end if;
  if not exists(select 1 from app.tournaments where id=p_tournament_id and status in('draft','open') and registration_status='open') then return jsonb_build_object('status','rejected','code','registration_closed'); end if;
  if exists(select 1 from app.event_team_seating_publications where event_id=p_event_id) or exists(select 1 from app.event_team_schedule_publications where event_id=p_event_id) or exists(select 1 from app.event_team_starts where event_id=p_event_id) or exists(select 1 from app.event_team_games g where g.event_id=p_event_id) or exists(select 1 from app.event_team_score_submissions s where s.event_id=p_event_id) then return jsonb_build_object('status','rejected','code','event_locked'); end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('create_event_team_v1',p_actor_id,p_tournament_id,p_event_id,p_team_id,p_team_entry_id,p_captain_roster_entry_id,p_partner_roster_entry_id,p_scorecard_type)::text,'utf8'),'sha256'),'hex');
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  select l.profile_id,r.claimed_display_name into captain_profile,captain_name from app.tournament_roster_entries r left join app.roster_account_links l on l.tournament_id=r.tournament_id and l.roster_entry_id=r.id where r.id=p_captain_roster_entry_id and r.tournament_id=p_tournament_id;
  select claimed_display_name into partner_name from app.tournament_roster_entries where id=p_partner_roster_entry_id and tournament_id=p_tournament_id;
  if captain_name is null or partner_name is null or (p_scorecard_type='digital' and captain_profile is null) then return jsonb_build_object('status','rejected','code','team_authority_unavailable'); end if;
  if exists(select 1 from app.event_team_members where event_id=p_event_id and roster_entry_id in(p_captain_roster_entry_id,p_partner_roster_entry_id)) then return jsonb_build_object('status','rejected','code','member_already_teamed'); end if;
  response:=jsonb_build_object('status','team_created','teamId',p_team_id,'teamEntryId',p_team_entry_id,'displayName',captain_name||' / '||partner_name,'scorecardType',p_scorecard_type);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'create_event_team_v1',p_team_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into rid;
  insert into app.event_teams(id,tournament_id,event_id,display_name,created_by_profile_id) values(p_team_id,p_tournament_id,p_event_id,captain_name||' / '||partner_name,p_actor_id);
  insert into app.event_team_members(team_id,tournament_id,event_id,roster_entry_id,profile_id,acc_number_snapshot,member_role,claimed_at)
    select p_team_id,p_tournament_id,p_event_id,r.id,l.profile_id,coalesce(r.claimed_acc_number,''),case when r.id=p_captain_roster_entry_id then 'captain' else 'member' end,case when l.profile_id is null then null else clock_timestamp() end from app.tournament_roster_entries r left join app.roster_account_links l on l.tournament_id=r.tournament_id and l.roster_entry_id=r.id where r.id in(p_captain_roster_entry_id,p_partner_roster_entry_id);
  insert into app.event_team_entries(id,team_id,tournament_id,event_id,entry_fee_minor,scorecard_type,digital_scoring_enabled) values(p_team_entry_id,p_team_id,p_tournament_id,p_event_id,0,p_scorecard_type,p_scorecard_type='digital');
  insert into app.event_team_entry_versions(team_entry_id,tournament_id,event_id,version,scorecard_type,designated_scorer_profile_id,actor_profile_id,operation_receipt_id,reason) values(p_team_entry_id,p_tournament_id,p_event_id,1,p_scorecard_type,case when p_scorecard_type='digital' then captain_profile else null end,p_actor_id,rid,'Captain selected the shared team scorecard');
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,rid,'event_team',p_team_id,'team_created',response);
  return response;
end $$;

-- Participants may read only their own tournament/event membership. Officials
-- retain the full, operationally necessary roster workspace.
alter function public.get_event_team_workspace_v1(uuid,uuid) rename to get_event_team_workspace_unbounded_v1;
create or replace function public.get_event_team_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with base as (select public.get_event_team_workspace_unbounded_v1(p_actor_id,p_tournament_id) value),
ctx as (select exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director','cross_checker','judge')) staff,
              coalesce(array_agg(distinct tm.team_id) filter(where tm.team_id is not null),'{}'::uuid[]) team_ids
        from app.event_team_members tm where tm.profile_id=p_actor_id),
safe_events as (select coalesce(jsonb_agg(jsonb_set(ev,'{teams}',coalesce((select jsonb_agg(t) from jsonb_array_elements(ev->'teams') t where ctx.staff or (t->>'teamId')::uuid=any(ctx.team_ids)),'[]'::jsonb),true) order by ev->>'name'),'[]'::jsonb) value from base,ctx,lateral jsonb_array_elements(coalesce(base.value->'events','[]'::jsonb)) ev)
select case when base.value is null or not(ctx.staff or cardinality(ctx.team_ids)>0) then null else jsonb_set(jsonb_set(base.value,'{events}',safe_events.value,true),'{roster}',case when ctx.staff then coalesce(base.value->'roster','[]'::jsonb) else '[]'::jsonb end,true) end from base,ctx,safe_events
$$;
revoke all on function public.get_event_team_workspace_unbounded_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_event_team_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_event_team_workspace_v1(uuid,uuid) to service_role;

-- A directory is event-specific and requires the actor to be a staff member,
-- linked roster participant, or linked team member in that exact event.
alter function public.get_tournament_seating_directory_v1(uuid,uuid,uuid,text) rename to get_tournament_seating_directory_unbounded_v1;
create or replace function public.get_tournament_seating_directory_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_query text default null)
returns jsonb language sql stable security definer set search_path='' as $$
select case when coalesce(auth.role(),'')='service_role'
 and p_event_id is not null
 and exists(select 1 from app.events e where e.id=p_event_id and e.tournament_id=p_tournament_id)
 and (exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director','cross_checker','judge'))
   or exists(select 1 from app.event_participants ep join app.roster_account_links l on l.tournament_id=ep.tournament_id and l.roster_entry_id=ep.roster_entry_id where ep.event_id=p_event_id and ep.tournament_id=p_tournament_id and l.profile_id=p_actor_id)
   or exists(select 1 from app.event_team_entries te join app.event_team_members tm on tm.team_id=te.team_id where te.event_id=p_event_id and te.tournament_id=p_tournament_id and tm.profile_id=p_actor_id))
 and (exists(select 1 from app.initial_seating_publications p where p.tournament_id=p_tournament_id)
   or exists(select 1 from app.event_team_seating_publications p where p.event_id=p_event_id and p.tournament_id=p_tournament_id))
then public.get_tournament_seating_directory_unbounded_v1(p_actor_id,p_tournament_id,p_event_id,p_query) else null end
$$;
revoke all on function public.get_tournament_seating_directory_unbounded_v1(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.get_tournament_seating_directory_v1(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_tournament_seating_directory_v1(uuid,uuid,uuid,text) to service_role;
drop function if exists public.get_tournament_seating_directory_v2(uuid,uuid,uuid,text);
create or replace function public.get_tournament_seating_directory_v2(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_query text default null)
returns jsonb language sql stable security definer set search_path='' as $$
select case when coalesce(auth.role(),'')='service_role'
 and p_event_id is not null
 and exists(select 1 from app.events e where e.id=p_event_id and e.tournament_id=p_tournament_id)
 and (exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director','cross_checker','judge'))
   or exists(select 1 from app.event_participants ep join app.roster_account_links l on l.tournament_id=ep.tournament_id and l.roster_entry_id=ep.roster_entry_id where ep.event_id=p_event_id and ep.tournament_id=p_tournament_id and l.profile_id=p_actor_id)
   or exists(select 1 from app.event_team_entries te join app.event_team_members tm on tm.team_id=te.team_id where te.event_id=p_event_id and te.tournament_id=p_tournament_id and tm.profile_id=p_actor_id))
 and (exists(select 1 from app.initial_seating_publications p where p.tournament_id=p_tournament_id)
   or exists(select 1 from app.event_team_seating_publications p where p.event_id=p_event_id and p.tournament_id=p_tournament_id))
then public.get_tournament_seating_directory_v1(p_actor_id,p_tournament_id,p_event_id,p_query) else null end
$$;
revoke all on function public.get_tournament_seating_directory_v2(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_tournament_seating_directory_v2(uuid,uuid,uuid,text) to service_role;

notify pgrst,'reload schema';
