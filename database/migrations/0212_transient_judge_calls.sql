-- Live Judge Calls are intentionally transient coordination state. They are
-- not a dispute register, a ruling history, or a score/correction workflow.

create table app.active_judge_calls (
  game_id uuid primary key,
  game_kind text not null check (game_kind in ('singles','team')),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  requested_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  table_seat text not null check (table_seat ~ '^[A-Za-z0-9]+-[0-9]+$'),
  accepted_judge_profile_ids uuid[] not null default '{}'::uuid[] check (cardinality(accepted_judge_profile_ids) between 0 and 2),
  created_at timestamptz not null default clock_timestamp()
);
create index active_judge_calls_tournament_event_idx on app.active_judge_calls(tournament_id,event_id,created_at);
alter table app.active_judge_calls enable row level security;
alter table app.active_judge_calls force row level security;
revoke all on table app.active_judge_calls from public, anon, authenticated;

create or replace function public.open_live_judge_call_v1(
  p_actor_id uuid,p_tournament_id uuid,p_game_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_game app.canonical_games%rowtype; v_team_game app.event_team_games%rowtype; v_kind text; v_event_id uuid; v_table_seat text; v_response jsonb;
begin
  if p_actor_id is null or p_tournament_id is null or p_game_id is null then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('live-judge-call:'||p_game_id::text,0));
  select game.* into v_game from app.canonical_games game
    where game.id=p_game_id and game.tournament_id=p_tournament_id
      and game.state in('pending','submitted','mismatch','confirmation_pending') for update;
  if found then
    v_kind := 'singles'; v_event_id := v_game.event_id; v_table_seat := v_game.side_a_table_seat_snapshot;
    if app.event_play_state_v1(v_game.event_id)<>'in_progress'
      or not exists(select 1 from app.event_participants participant where participant.tournament_id=p_tournament_id
      and participant.event_id=v_game.event_id and participant.profile_id=p_actor_id
      and participant.id in(v_game.side_a_participant_id,v_game.side_b_participant_id)
      and app.participant_game_progression_v1(p_game_id,participant.id)='current') then
      return jsonb_build_object('status','rejected','code','game_unavailable');
    end if;
  else
    select game.* into v_team_game from app.event_team_games game
      where game.id=p_game_id and game.tournament_id=p_tournament_id
        and game.state in('pending','submitted','mismatch','confirmation_pending') for update;
    if not found or not exists(select 1 from app.event_team_starts started where started.event_id=v_team_game.event_id)
      or not exists(select 1 from app.event_team_games game join app.event_team_entries entry on entry.id in(game.side_a_team_entry_id,game.side_b_team_entry_id)
        join app.event_team_members member on member.team_id=entry.team_id
        where game.id=p_game_id and member.profile_id=p_actor_id)
      or exists(select 1 from app.event_team_games earlier where earlier.event_id=v_team_game.event_id
        and earlier.game_number<v_team_game.game_number and earlier.state not in('verified','corrected')
        and (earlier.side_a_team_entry_id in(v_team_game.side_a_team_entry_id,v_team_game.side_b_team_entry_id)
          or earlier.side_b_team_entry_id in(v_team_game.side_a_team_entry_id,v_team_game.side_b_team_entry_id))) then
      return jsonb_build_object('status','rejected','code','game_unavailable');
    end if;
    v_kind := 'team'; v_event_id := v_team_game.event_id; v_table_seat := v_team_game.side_a_table_seat;
  end if;
  if v_event_id is null then
    return jsonb_build_object('status','rejected','code','game_unavailable');
  end if;
  insert into app.active_judge_calls(game_id,game_kind,tournament_id,event_id,requested_by_profile_id,table_seat)
  values(p_game_id,v_kind,p_tournament_id,v_event_id,p_actor_id,v_table_seat)
  on conflict(game_id) do nothing;
  select jsonb_build_object('status',case when cardinality(accepted_judge_profile_ids)>=2 then 'judges_assigned' else 'called' end,
    'gameId',game_id,'acceptedJudgeCount',cardinality(accepted_judge_profile_ids)) into v_response
  from app.active_judge_calls where game_id=p_game_id;
  return v_response;
end $$;

create or replace function public.accept_live_judge_call_v1(
  p_actor_id uuid,p_tournament_id uuid,p_game_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_call app.active_judge_calls%rowtype; v_game app.canonical_games%rowtype; v_count integer;
begin
  if p_actor_id is null or p_tournament_id is null or p_game_id is null then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('live-judge-call:'||p_game_id::text,0));
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role='judge') then return jsonb_build_object('status','rejected','code','not_judge'); end if;
  select * into v_call from app.active_judge_calls where game_id=p_game_id and tournament_id=p_tournament_id for update;
  if not found then return jsonb_build_object('status','rejected','code','call_unavailable'); end if;
  if v_call.game_kind='singles' then
    select * into v_game from app.canonical_games where id=p_game_id and tournament_id=p_tournament_id for update;
    if p_actor_id in(select profile_id from app.event_participants where id in(v_game.side_a_participant_id,v_game.side_b_participant_id)) then return jsonb_build_object('status','rejected','code','judge_is_player'); end if;
  elsif exists(select 1 from app.event_team_games game join app.event_team_entries entry on entry.id in(game.side_a_team_entry_id,game.side_b_team_entry_id)
    join app.event_team_members member on member.team_id=entry.team_id where game.id=p_game_id and member.profile_id=p_actor_id) then
    return jsonb_build_object('status','rejected','code','judge_is_player');
  end if;
  if p_actor_id=any(v_call.accepted_judge_profile_ids) then return jsonb_build_object('status','accepted','gameId',p_game_id,'acceptedJudgeCount',cardinality(v_call.accepted_judge_profile_ids)); end if;
  v_count:=cardinality(v_call.accepted_judge_profile_ids);
  if v_count>=2 then return jsonb_build_object('status','rejected','code','two_judges_already_assigned'); end if;
  update app.active_judge_calls set accepted_judge_profile_ids=array_append(accepted_judge_profile_ids,p_actor_id) where game_id=p_game_id returning cardinality(accepted_judge_profile_ids) into v_count;
  return jsonb_build_object('status','accepted','gameId',p_game_id,'acceptedJudgeCount',v_count);
end $$;

create or replace function public.resolve_live_judge_call_v1(
  p_actor_id uuid,p_tournament_id uuid,p_game_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_call app.active_judge_calls%rowtype;
begin
  if p_actor_id is null or p_tournament_id is null or p_game_id is null then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('live-judge-call:'||p_game_id::text,0));
  select * into v_call from app.active_judge_calls where game_id=p_game_id and tournament_id=p_tournament_id for update;
  if not found then return jsonb_build_object('status','already_resolved','gameId',p_game_id); end if;
  if not p_actor_id=any(v_call.accepted_judge_profile_ids) then return jsonb_build_object('status','rejected','code','not_assigned_judge'); end if;
  delete from app.active_judge_calls where game_id=p_game_id;
  return jsonb_build_object('status','resolved','gameId',p_game_id);
end $$;

create or replace function public.get_live_judge_calls_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role='judge') then jsonb_build_object(
    'calls',coalesce((select jsonb_agg(jsonb_build_object(
      'gameId',call_row.game_id,'eventId',call_row.event_id,'tableSeat',call_row.table_seat,
      'acceptedJudgeCount',cardinality(call_row.accepted_judge_profile_ids),
      'assignedToMe',p_actor_id=any(call_row.accepted_judge_profile_ids),
      'availableToAccept',cardinality(call_row.accepted_judge_profile_ids)<2 and not p_actor_id=any(call_row.accepted_judge_profile_ids)
    ) order by call_row.created_at) from app.active_judge_calls call_row where call_row.tournament_id=p_tournament_id),'[]'::jsonb)
  ) else null end
$$;

revoke all on function public.open_live_judge_call_v1(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.accept_live_judge_call_v1(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.resolve_live_judge_call_v1(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_live_judge_calls_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.open_live_judge_call_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.accept_live_judge_call_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.resolve_live_judge_call_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.get_live_judge_calls_v1(uuid,uuid) to service_role;
notify pgrst,'reload schema';
