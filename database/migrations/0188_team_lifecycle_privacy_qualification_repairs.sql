-- Final review repairs for supported team events.  This migration is additive
-- and deliberately does not touch Side Pool or offline-capability tables.

-- A digital team may be created before its scorer has linked an account.  The
-- unresolved state is visible to staff and is still a hard start/activation
-- gate in the existing start RPC.
do $$ declare c text; begin
  for c in select conname from pg_constraint
    where conrelid='app.event_team_entry_versions'::regclass and contype='c'
      and pg_get_constraintdef(oid) like '%designated_scorer_profile_id%'
  loop execute format('alter table app.event_team_entry_versions drop constraint %I',c); end loop;
end $$;
alter table app.event_team_entry_versions
  add column if not exists scorer_resolution_status text generated always as
    (case when scorecard_type='paper' then 'not_required'
          when designated_scorer_profile_id is null then 'unresolved'
          else 'resolved' end) stored;
alter table app.event_team_entry_versions
  add constraint event_team_entry_versions_scorer_state_ck
  check ((scorecard_type='paper' and designated_scorer_profile_id is null)
      or scorecard_type='digital');

-- Replace creation only: it remains director/captain authorized and locked
-- after registration/seating/schedule/start, but does not require a linked
-- digital scorer. configure_event_team_v1 and start_event_team_play_v1 retain
-- the deliberate resolution and fail-closed start boundary.
create or replace function public.create_event_team_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_team_id uuid,p_team_entry_id uuid,
  p_captain_roster_entry_id uuid,p_partner_roster_entry_id uuid,p_scorecard_type text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text; prior app.operation_receipts%rowtype; rid uuid; captain_profile uuid; captain_name text; partner_name text; response jsonb; scorer_status text;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_scorecard_type not in('digital','paper') or p_captain_roster_entry_id=p_partner_roster_entry_id then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('create_event_team_v1',p_actor_id,p_tournament_id,p_event_id,p_team_id,p_team_entry_id,p_captain_roster_entry_id,p_partner_roster_entry_id,p_scorecard_type)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-lifecycle:'||p_event_id::text,0));
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  if not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id and format in('doubles','canadian_doubles') and scoring_method='digital') then return jsonb_build_object('status','rejected','code','event_not_supported'); end if;
  if not exists(select 1 from app.tournaments where id=p_tournament_id and status in('draft','open') and registration_status='open') then return jsonb_build_object('status','rejected','code','registration_closed'); end if;
  if exists(select 1 from app.event_team_seating_publications where event_id=p_event_id) or exists(select 1 from app.event_team_schedule_publications where event_id=p_event_id) or exists(select 1 from app.event_team_starts where event_id=p_event_id) or exists(select 1 from app.event_team_games g where g.event_id=p_event_id) or exists(select 1 from app.event_team_score_submissions s where s.event_id=p_event_id) then return jsonb_build_object('status','rejected','code','event_locked'); end if;
  select l.profile_id,r.claimed_display_name into captain_profile,captain_name from app.tournament_roster_entries r left join app.roster_account_links l on l.tournament_id=r.tournament_id and l.roster_entry_id=r.id where r.id=p_captain_roster_entry_id and r.tournament_id=p_tournament_id;
  select claimed_display_name into partner_name from app.tournament_roster_entries where id=p_partner_roster_entry_id and tournament_id=p_tournament_id;
  if captain_name is null or partner_name is null then return jsonb_build_object('status','rejected','code','team_authority_unavailable'); end if;
  if not(exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) or captain_profile=p_actor_id) then return jsonb_build_object('status','rejected','code','team_authority_unavailable'); end if;
  if exists(select 1 from app.event_team_members where event_id=p_event_id and roster_entry_id in(p_captain_roster_entry_id,p_partner_roster_entry_id)) then return jsonb_build_object('status','rejected','code','member_already_teamed'); end if;
  scorer_status:=case when p_scorecard_type='paper' then 'not_required' when captain_profile is null then 'unresolved' else 'resolved' end;
  response:=jsonb_build_object('status','team_created','teamId',p_team_id,'teamEntryId',p_team_entry_id,'displayName',captain_name||' / '||partner_name,'scorecardType',p_scorecard_type,'scorerResolutionStatus',scorer_status);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'create_event_team_v1',p_team_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into rid;
  insert into app.event_teams(id,tournament_id,event_id,display_name,created_by_profile_id) values(p_team_id,p_tournament_id,p_event_id,captain_name||' / '||partner_name,p_actor_id);
  insert into app.event_team_members(team_id,tournament_id,event_id,roster_entry_id,profile_id,acc_number_snapshot,member_role,claimed_at)
    select p_team_id,p_tournament_id,p_event_id,r.id,l.profile_id,coalesce(r.claimed_acc_number,''),case when r.id=p_captain_roster_entry_id then 'captain' else 'member' end,case when l.profile_id is null then null else clock_timestamp() end from app.tournament_roster_entries r left join app.roster_account_links l on l.tournament_id=r.tournament_id and l.roster_entry_id=r.id where r.id in(p_captain_roster_entry_id,p_partner_roster_entry_id);
  insert into app.event_team_entries(id,team_id,tournament_id,event_id,entry_fee_minor,scorecard_type,digital_scoring_enabled) values(p_team_entry_id,p_team_id,p_tournament_id,p_event_id,0,p_scorecard_type,p_scorecard_type='digital');
  insert into app.event_team_entry_versions(team_entry_id,tournament_id,event_id,version,scorecard_type,designated_scorer_profile_id,actor_profile_id,operation_receipt_id,reason) values(p_team_entry_id,p_tournament_id,p_event_id,1,p_scorecard_type,case when p_scorecard_type='digital' then captain_profile else null end,p_actor_id,rid,'Captain selected the shared team scorecard');
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,rid,'event_team',p_team_id,'team_created',response);
  return response;
end $$;
revoke all on function public.create_event_team_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) from public,anon,authenticated; grant execute on function public.create_event_team_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) to service_role;

-- Exact claim retries are resolved before any mutable state or lifecycle gate.
create or replace function public.claim_event_team_partner_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_team_id uuid,
  p_roster_entry_id uuid,p_claim_id uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m app.event_team_members%rowtype; h text; prior app.operation_receipts%rowtype; receipt uuid:=extensions.gen_random_uuid(); response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or p_operation_id is null then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('claim_event_team_partner_v1',p_actor_id,p_tournament_id,p_event_id,p_team_id,p_roster_entry_id)::text,'utf8'),'sha256'),'hex');
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-claim:'||p_team_id::text,0));
  if not exists(select 1 from app.tournaments where id=p_tournament_id and status in('draft','open') and registration_status='open')
     or exists(select 1 from app.event_team_seating_publications where event_id=p_event_id)
     or exists(select 1 from app.event_team_schedule_publications where event_id=p_event_id)
     or exists(select 1 from app.event_team_starts where event_id=p_event_id)
     or exists(select 1 from app.event_team_games where event_id=p_event_id) then return jsonb_build_object('status','rejected','code','claim_locked'); end if;
  select * into m from app.event_team_members where team_id=p_team_id and roster_entry_id=p_roster_entry_id for update;
  if not found or m.event_id<>p_event_id or m.tournament_id<>p_tournament_id then return jsonb_build_object('status','rejected','code','member_unavailable'); end if;
  if m.profile_id is not null then if m.profile_id=p_actor_id then return jsonb_build_object('status','team_partner_already_claimed'); end if; return jsonb_build_object('status','rejected','code','member_already_claimed'); end if;
  if not exists(select 1 from app.roster_account_links l where l.tournament_id=p_tournament_id and l.roster_entry_id=p_roster_entry_id and l.profile_id=p_actor_id) then return jsonb_build_object('status','rejected','code','roster_account_mismatch'); end if;
  if exists(select 1 from app.event_team_members x where x.event_id=p_event_id and x.profile_id=p_actor_id) then return jsonb_build_object('status','rejected','code','profile_already_teamed'); end if;
  response:=jsonb_build_object('status','team_partner_claimed','teamId',p_team_id,'rosterEntryId',p_roster_entry_id,'profileId',p_actor_id);
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(receipt,p_actor_id,p_tournament_id,'claim_event_team_partner_v1',p_claim_id,h,p_operation_id,'accepted',response,clock_timestamp());
  perform pg_catalog.set_config('app.team_claim_profile_id',p_actor_id::text,true);
  update app.event_team_members set profile_id=p_actor_id,claimed_at=clock_timestamp() where id=m.id;
  insert into app.event_team_member_claim_versions(id,team_id,tournament_id,event_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id) values(p_claim_id,p_team_id,p_tournament_id,p_event_id,p_roster_entry_id,p_actor_id,p_actor_id,receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,receipt,'event_team_member',m.id,'team_partner_claimed',response);
  return response;
end $$;
revoke all on function public.claim_event_team_partner_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated; grant execute on function public.claim_event_team_partner_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid) to service_role;

-- Team qualification tie decisions are explicit, append-only, and never use a
-- display-name tiebreak.  The selected subset fills the actual cutoff slots.
create table if not exists app.event_team_qualification_tie_resolutions(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,cutoff_rank integer not null check(cutoff_rank>0),
 tied_team_entry_ids uuid[] not null check(cardinality(tied_team_entry_ids)>1),selected_team_entry_ids uuid[] not null check(cardinality(selected_team_entry_ids)>0),
 rule_basis text not null check(length(trim(rule_basis)) between 1 and 1000),reason text not null check(length(trim(reason)) between 1 and 2000),
 actor_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
 unique(event_id,cutoff_rank),check(tied_team_entry_ids @> selected_team_entry_ids)
);
alter table app.event_team_qualification_tie_resolutions enable row level security; alter table app.event_team_qualification_tie_resolutions force row level security; revoke all on table app.event_team_qualification_tie_resolutions from public,anon,authenticated;
create trigger event_team_qualification_tie_resolutions_immutable before update or delete on app.event_team_qualification_tie_resolutions for each row execute function app.reject_immutable_history();

create or replace function public.resolve_event_team_qualification_tie_v1(
 p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_resolution_id uuid,p_cutoff_rank integer,
 p_tied_team_entry_ids uuid[],p_selected_team_entry_ids uuid[],p_rule_basis text,p_reason text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text;prior app.operation_receipts%rowtype;receipt uuid:=extensions.gen_random_uuid();response jsonb;expected_ids uuid[];expected_slots integer;qual_count integer;event_kind text;required_game_points integer;required_games_won integer;required_net integer;required_plus integer;required_minus integer;selected_count integer;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_operation_id is null or p_cutoff_rank<1 or coalesce(cardinality(p_tied_team_entry_ids),0)<2 or coalesce(cardinality(p_selected_team_entry_ids),0)<1 or nullif(trim(p_rule_basis),'') is null or nullif(trim(p_reason),'') is null then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('resolve_event_team_qualification_tie_v1',p_actor_id,p_tournament_id,p_event_id,p_resolution_id,p_cutoff_rank,p_tied_team_entry_ids,p_selected_team_entry_ids,p_rule_basis,p_reason)::text,'utf8'),'sha256'),'hex');
 select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return prior.response_payload;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-qualification:'||p_event_id::text,0));
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director'); end if;
 select event_type into event_kind from app.events where id=p_event_id and tournament_id=p_tournament_id and format in('doubles','canadian_doubles'); if not found then return jsonb_build_object('status','rejected','code','event_unavailable');end if;
 if event_kind='satellite' then return jsonb_build_object('status','rejected','code','satellite_not_qualifying');end if;
 if exists(select 1 from app.event_team_qualification_tie_resolutions where event_id=p_event_id and cutoff_rank=p_cutoff_rank) then return jsonb_build_object('status','rejected','code','tie_resolution_exists');end if;
 with scores as (select te.id,coalesce(sum(sl.game_points),0)::integer gp,coalesce(count(*) filter(where sl.is_winner),0)::integer gw,coalesce(sum(sl.plus_points-sl.minus_points),0)::integer net,coalesce(sum(sl.plus_points),0)::integer pp,coalesce(sum(sl.minus_points),0)::integer mp from app.event_team_entries te left join app.event_team_scorelines sl on sl.team_entry_id=te.id and exists(select 1 from app.event_team_games g where g.id=sl.team_game_id and g.state in('verified','corrected')) where te.event_id=p_event_id group by te.id), ranked as (select *,rank() over(order by gp desc,gw desc,net desc,pp desc,mp asc) rnk,count(*) over(partition by gp,gw,net,pp,mp) tie_size,count(*) over() total from scores) select max(case when rnk=p_cutoff_rank then gp end),max(case when rnk=p_cutoff_rank then gw end),max(case when rnk=p_cutoff_rank then net end),max(case when rnk=p_cutoff_rank then pp end),max(case when rnk=p_cutoff_rank then mp end),ceil(max(total)::numeric/4.0)::integer into required_game_points,required_games_won,required_net,required_plus,required_minus,qual_count from ranked;
 if required_game_points is null or p_cutoff_rank>qual_count or not exists(select 1 from app.event_team_entries where event_id=p_event_id and id=any(p_tied_team_entry_ids)) then return jsonb_build_object('status','rejected','code','cutoff_not_tied');end if;
 with scores as (select te.id,coalesce(sum(sl.game_points),0)::integer gp,coalesce(count(*) filter(where sl.is_winner),0)::integer gw,coalesce(sum(sl.plus_points-sl.minus_points),0)::integer net,coalesce(sum(sl.plus_points),0)::integer pp,coalesce(sum(sl.minus_points),0)::integer mp from app.event_team_entries te left join app.event_team_scorelines sl on sl.team_entry_id=te.id and exists(select 1 from app.event_team_games g where g.id=sl.team_game_id and g.state in('verified','corrected')) where te.event_id=p_event_id group by te.id), ranked as (select *,rank() over(order by gp desc,gw desc,net desc,pp desc,mp asc) rnk,count(*) over(partition by gp,gw,net,pp,mp) tie_size,count(*) over() total from scores) select coalesce(array_agg(id order by id) filter(where rnk=p_cutoff_rank and rnk+tie_size-1>p_cutoff_rank), '{}'),p_cutoff_rank-count(*) filter(where rnk+tie_size-1<=p_cutoff_rank),count(*) filter(where rnk=p_cutoff_rank and rnk+tie_size-1>p_cutoff_rank) into expected_ids,expected_slots,selected_count from ranked;
 if expected_ids<> (select array_agg(x order by x) from unnest(p_tied_team_entry_ids) x) or cardinality(p_selected_team_entry_ids)<>expected_slots or not(p_selected_team_entry_ids <@ expected_ids) then return jsonb_build_object('status','rejected','code','tie_members_or_slots_invalid');end if;
 response:=jsonb_build_object('status','team_qualification_tie_resolved','eventId',p_event_id,'cutoffRank',p_cutoff_rank,'selectedTeamEntryIds',to_jsonb(p_selected_team_entry_ids),'ruleBasis',trim(p_rule_basis));
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(receipt,p_actor_id,p_tournament_id,'resolve_event_team_qualification_tie_v1',p_resolution_id,h,p_operation_id,'accepted',response,clock_timestamp());
 insert into app.event_team_qualification_tie_resolutions(id,tournament_id,event_id,cutoff_rank,tied_team_entry_ids,selected_team_entry_ids,rule_basis,reason,actor_profile_id,operation_receipt_id) values(p_resolution_id,p_tournament_id,p_event_id,p_cutoff_rank,p_tied_team_entry_ids,p_selected_team_entry_ids,trim(p_rule_basis),trim(p_reason),p_actor_id,receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,receipt,'event_team_qualification_tie',p_resolution_id,'team_qualification_tie_resolved',response);
 return response;
end $$;
revoke all on function public.resolve_event_team_qualification_tie_v1(uuid,uuid,uuid,uuid,integer,uuid[],uuid[],text,text,uuid) from public,anon,authenticated;grant execute on function public.resolve_event_team_qualification_tie_v1(uuid,uuid,uuid,uuid,integer,uuid[],uuid[],text,text,uuid) to service_role;

-- Cross-checkers and judges need operational team rows but not staff profile
-- identifiers. Directors retain the complete staff workspace.
alter function public.get_event_team_workspace_v1(uuid,uuid) rename to get_event_team_workspace_privacy_base_v1;
create or replace function public.get_event_team_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with base as (select public.get_event_team_workspace_privacy_base_v1(p_actor_id,p_tournament_id) value),
ctx as (select exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) director_staff,
               exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('cross_checker','judge')) limited_official,
               coalesce(array_agg(distinct tm.team_id) filter(where tm.team_id is not null),'{}'::uuid[]) team_ids from app.event_team_members tm where tm.profile_id=p_actor_id),
event_rows as (select ev,ctx.director_staff,coalesce((select jsonb_agg(
  team || jsonb_build_object(
    'designatedScorerProfileId',case when ctx.director_staff then team->'designatedScorerProfileId' else 'null'::jsonb end,
    'scorerResolutionStatus',coalesce((select v.scorer_resolution_status from app.event_team_entry_versions v where v.team_entry_id=(team->>'teamEntryId')::uuid order by v.version desc limit 1),'unresolved')
  )
 ) from jsonb_array_elements(ev->'teams') team
  where ctx.director_staff or ctx.limited_official or (team->>'teamId')::uuid=any(ctx.team_ids)), '[]'::jsonb) teams,
  coalesce((select jsonb_agg(item - 'editorProfileId') from jsonb_array_elements(coalesce(ev->'pendingCorrections','[]'::jsonb)) item),'[]'::jsonb) corrections,
  coalesce((select jsonb_agg(item - 'resolverProfileId') from jsonb_array_elements(coalesce(ev->'pendingMismatchResolutions','[]'::jsonb)) item),'[]'::jsonb) mismatches
 from base,ctx,lateral jsonb_array_elements(coalesce(base.value->'events','[]'::jsonb)) ev),
safe_events as (select coalesce(jsonb_agg(jsonb_set(jsonb_set(jsonb_set(ev,'{teams}',teams,true),'{pendingCorrections}',case when director_staff then ev->'pendingCorrections' else corrections end,true),'{pendingMismatchResolutions}',case when director_staff then ev->'pendingMismatchResolutions' else mismatches end,true) order by ev->>'name'),'[]'::jsonb) value from event_rows)
select case when base.value is null or not(ctx.director_staff or ctx.limited_official or cardinality(ctx.team_ids)>0) then null
 else jsonb_set(jsonb_set(base.value,'{events}',safe_events.value,true),'{roster}',case when ctx.director_staff then coalesce(base.value->'roster','[]'::jsonb) else '[]'::jsonb end,true) end
from base cross join ctx cross join safe_events
$$;
revoke all on function public.get_event_team_workspace_privacy_base_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_event_team_workspace_v1(uuid,uuid) from public,anon,authenticated; grant execute on function public.get_event_team_workspace_v1(uuid,uuid) to service_role;

-- Readers consume the audited tie decision.  Until a director resolves the
-- cutoff, no tied team is marked qualified and finalization remains blocked.
create or replace function public.get_event_team_results_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with summaries as (
 select t.name tournament_name,e.id event_id,e.name event_name,e.format,e.event_type,te.id team_entry_id,team.display_name team_name,
  coalesce(sum(sl.game_points),0)::integer game_points,coalesce(count(*) filter(where sl.is_winner),0)::integer games_won,
  coalesce(sum(sl.plus_points),0)::integer plus_points,coalesce(sum(sl.minus_points),0)::integer minus_points,coalesce(sum(sl.plus_points-sl.minus_points),0)::integer net_points
 from app.events e join app.tournaments t on t.id=e.tournament_id join app.event_team_entries te on te.event_id=e.id join app.event_teams team on team.id=te.team_id
 left join app.event_team_scorelines sl on sl.team_entry_id=te.id and exists(select 1 from app.event_team_games g where g.id=sl.team_game_id and g.state in('verified','corrected'))
 where e.id=p_event_id and e.tournament_id=p_tournament_id group by t.name,e.id,e.name,e.format,e.event_type,te.id,team.display_name
), scored as (
 select *,rank() over(order by game_points desc,games_won desc,net_points desc,plus_points desc,minus_points asc) numeric_rank,
  count(*) over(partition by game_points,games_won,net_points,plus_points,minus_points) tie_size,count(*) over() total_count from summaries
), annotated as (
 select *,case when event_type='satellite' then 0 else ceil(total_count::numeric/4.0)::integer end qualification_count,
  event_type<>'satellite' and numeric_rank<=ceil(total_count::numeric/4.0)::integer and numeric_rank+tie_size-1>ceil(total_count::numeric/4.0)::integer boundary_tie from scored
), resolution as (select r.id,r.cutoff_rank,r.selected_team_entry_ids from app.event_team_qualification_tie_resolutions r where r.event_id=p_event_id and r.tournament_id=p_tournament_id), authority as (
 select (exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id) or exists(select 1 from app.event_team_entries te join app.event_team_members tm on tm.team_id=te.team_id where te.event_id=p_event_id and tm.profile_id=p_actor_id)) can_read,
  exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director','cross_checker','judge')) can_see_acc
)
select case when authority.can_read then jsonb_build_object(
 'tournamentName',(array_agg(a.tournament_name))[1],'eventId',(array_agg(a.event_id))[1],'eventName',(array_agg(a.event_name))[1],'format',(array_agg(a.format))[1],'eventType',(array_agg(a.event_type))[1],
 'qualificationCount',max(a.qualification_count),'qualificationBlocked',coalesce(bool_or(a.boundary_tie and resolution.id is null),false),
 'tieResolutionStatus',case when (array_agg(a.event_type))[1]='satellite' or not coalesce(bool_or(a.boundary_tie),false) then 'not_required' when (array_agg(resolution.id))[1] is null then 'pending_director_resolution' else 'resolved' end,
 'tieResolutionId',(array_agg(resolution.id))[1],'mrps',case when (array_agg(a.event_type))[1]='satellite' then 'not_applicable_satellite' else 'eligible_after_review' end,
 'entries',coalesce(jsonb_agg(jsonb_build_object('rank',a.numeric_rank,'teamEntryId',a.team_entry_id,'teamName',a.team_name,
  'members',(select jsonb_agg(jsonb_build_object('name',m.claimed_display_name,'accNumber',case when authority.can_see_acc then m.claimed_acc_number else null end) order by tm.member_role) from app.event_team_members tm join app.tournament_roster_entries m on m.id=tm.roster_entry_id where tm.team_id=(select x.team_id from app.event_team_entries x where x.id=a.team_entry_id)),
  'gamePoints',a.game_points,'gamesWon',a.games_won,'plusSpreadPoints',a.plus_points,'minusSpreadPoints',a.minus_points,'netSpreadPoints',a.net_points,
  'qualifies',a.event_type<>'satellite' and (case when a.boundary_tie then resolution.id is not null and a.team_entry_id=any(resolution.selected_team_entry_ids) else a.numeric_rank<=a.qualification_count end),
  'qualificationStatus',case when a.event_type='satellite' then 'not_applicable' when a.boundary_tie and (resolution.id is null or not(a.team_entry_id=any(resolution.selected_team_entry_ids))) then 'tie_review_required' when a.numeric_rank<=a.qualification_count or (resolution.id is not null and a.team_entry_id=any(resolution.selected_team_entry_ids)) then 'qualified' else 'not_qualified' end
 ) order by a.numeric_rank,a.team_name),'[]'::jsonb)
 ) else null end from annotated a cross join authority left join resolution on resolution.cutoff_rank=a.qualification_count group by authority.can_read
$$;
revoke all on function public.get_event_team_results_v1(uuid,uuid,uuid) from public,anon,authenticated; grant execute on function public.get_event_team_results_v1(uuid,uuid,uuid) to service_role;

notify pgrst,'reload schema';
