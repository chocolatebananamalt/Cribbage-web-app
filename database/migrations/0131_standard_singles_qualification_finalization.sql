-- Immutable Standard Singles qualifying-round finalization. This snapshot is
-- deliberately separate from playoff placements, MRPs, Q-pools, payouts, and
-- ACC export authority.

create table app.qualification_result_versions (
  id uuid primary key,
  tournament_id uuid not null,
  event_id uuid not null,
  version integer not null check (version > 0),
  supersedes_result_version_id uuid,
  ruleset_version_id uuid not null,
  schedule_publication_id uuid not null,
  participant_count integer not null check (participant_count >= 2),
  qualifier_count integer not null check (qualifier_count >= 1 and qualifier_count <= participant_count),
  high_non_qualifier_participant_id uuid not null,
  standings_digest text not null check (length(standings_digest) = 64),
  finalized_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  finalized_at timestamptz not null,
  foreign key (event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  foreign key (ruleset_version_id, tournament_id) references app.ruleset_versions(id, tournament_id) on delete restrict,
  foreign key (schedule_publication_id, tournament_id, event_id)
    references app.event_schedule_publications(id, tournament_id, event_id) on delete restrict,
  foreign key (high_non_qualifier_participant_id, event_id, tournament_id)
    references app.event_participants(id, event_id, tournament_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  foreign key (supersedes_result_version_id) references app.qualification_result_versions(id) on delete restrict,
  unique (event_id, version),
  unique (id, tournament_id, event_id)
);

create table app.qualification_result_rows (
  result_version_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  participant_id uuid not null,
  ranking_ordinal integer not null check (ranking_ordinal > 0),
  numeric_rank integer not null check (numeric_rank > 0),
  tied boolean not null,
  display_name_snapshot text not null check (length(trim(display_name_snapshot)) between 1 and 160),
  verified_games integer not null check (verified_games > 0),
  game_points integer not null check (game_points >= 0),
  games_won integer not null check (games_won >= 0 and games_won <= verified_games),
  plus_points integer not null check (plus_points >= 0),
  minus_points integer not null check (minus_points >= 0),
  net_spread_points integer not null,
  qualification_status text not null check (qualification_status in ('qualified', 'high_non_qualifier', 'not_qualified')),
  primary key (result_version_id, participant_id),
  foreign key (result_version_id, tournament_id, event_id)
    references app.qualification_result_versions(id, tournament_id, event_id) on delete restrict,
  foreign key (participant_id, event_id, tournament_id)
    references app.event_participants(id, event_id, tournament_id) on delete restrict,
  unique (result_version_id, ranking_ordinal),
  check (net_spread_points = plus_points - minus_points),
  check (game_points between 2 * games_won and 3 * games_won)
);

create table app.qualification_finalization_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  attempted_event_id uuid not null,
  attempted_operation_id uuid not null,
  attempted_request_hash text not null check (length(attempted_request_hash) = 64),
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null check (reason_code = 'idempotency_conflict'),
  created_at timestamptz not null default now()
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'qualification_result_versions', 'qualification_result_rows',
    'qualification_finalization_conflicts'
  ] loop
    execute format('alter table app.%I enable row level security', table_name);
    execute format('alter table app.%I force row level security', table_name);
    execute format('revoke all on table app.%I from public, anon, authenticated', table_name);
  end loop;
end;
$$;

create trigger qualification_result_versions_immutable before update or delete on app.qualification_result_versions
for each row execute function app.reject_immutable_history();
create trigger qualification_result_rows_immutable before update or delete on app.qualification_result_rows
for each row execute function app.reject_immutable_history();
create trigger qualification_finalization_conflicts_immutable before update or delete on app.qualification_finalization_conflicts
for each row execute function app.reject_immutable_history();
create index qualification_result_versions_tournament_idx on app.qualification_result_versions(tournament_id, finalized_at desc);
create index qualification_result_versions_actor_idx on app.qualification_result_versions(finalized_by_profile_id);
create index qualification_result_versions_receipt_idx on app.qualification_result_versions(operation_receipt_id);
create index qualification_result_rows_event_idx on app.qualification_result_rows(event_id, ranking_ordinal);
create index qualification_result_rows_participant_idx on app.qualification_result_rows(participant_id, event_id, tournament_id);
create index qualification_finalization_conflicts_actor_idx on app.qualification_finalization_conflicts(actor_profile_id, created_at desc);
create index qualification_finalization_conflicts_receipt_idx on app.qualification_finalization_conflicts(prior_receipt_id);

create or replace function app.block_finalized_qualification_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_event_id uuid;
begin
  v_event_id := coalesce((to_jsonb(new)->>'event_id')::uuid, (to_jsonb(old)->>'event_id')::uuid);
  if exists (select 1 from app.qualification_result_versions result where result.event_id = v_event_id) then
    raise exception 'finalized qualification snapshot blocks event mutation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function app.block_finalized_qualification_mutation() from public, anon, authenticated;

create trigger qualification_freeze_event_participants before insert or update or delete on app.event_participants
for each row execute function app.block_finalized_qualification_mutation();
create trigger qualification_freeze_canonical_games before insert or update or delete on app.canonical_games
for each row execute function app.block_finalized_qualification_mutation();
create trigger qualification_freeze_score_submissions before insert on app.score_submissions
for each row execute function app.block_finalized_qualification_mutation();
create trigger qualification_freeze_score_confirmations before insert on app.score_confirmations
for each row execute function app.block_finalized_qualification_mutation();
create trigger qualification_freeze_scorelines before insert on app.card_scorelines
for each row execute function app.block_finalized_qualification_mutation();
create trigger qualification_freeze_corrections before insert on app.independent_card_corrections
for each row execute function app.block_finalized_qualification_mutation();
create trigger qualification_freeze_recoveries before insert on app.device_failure_recoveries
for each row execute function app.block_finalized_qualification_mutation();

create or replace function public.finalize_standard_singles_qualification_v1(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_event_id uuid,
  p_operation_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_existing app.operation_receipts%rowtype;
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_event app.events%rowtype;
  v_schedule app.event_schedule_publications%rowtype;
  v_participant_count integer;
  v_qualifier_count integer;
  v_result_id uuid := extensions.gen_random_uuid();
  v_receipt_id uuid := extensions.gen_random_uuid();
  v_finalized_at timestamptz := clock_timestamp();
  v_digest text;
  v_response jsonb;
  v_error text;
  v_code text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only qualification finalization';
  end if;
  begin
    if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null then
      raise exception using errcode = 'P0001', message = 'invalid qualification finalization request';
    end if;
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'finalize_standard_singles_qualification_v1', p_actor_id, p_tournament_id, p_event_id
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || p_operation_id::text, 0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qualification-finalization:' || p_event_id::text, 0));

    select * into v_existing from app.operation_receipts
    where actor_profile_id = p_actor_id and client_operation_id = p_operation_id;
    if found then
      if v_existing.tournament_id <> p_tournament_id
         or v_existing.operation_type <> 'finalize_standard_singles_qualification_v1'
         or v_existing.target_id <> p_event_id or v_existing.request_hash <> v_hash then
        insert into app.qualification_finalization_conflicts(
          tournament_id, actor_profile_id, attempted_event_id, attempted_operation_id,
          attempted_request_hash, prior_receipt_id, reason_code
        ) values (p_tournament_id, p_actor_id, p_event_id, p_operation_id, v_hash,
          case when v_existing.tournament_id = p_tournament_id then v_existing.id end,
          'idempotency_conflict');
        return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
      end if;
      return v_existing.response_payload;
    end if;

    perform 1 from app.tournaments tournament_row
      where tournament_row.id = p_tournament_id and tournament_row.status = 'open' for update;
    v_tournament_exists := found;
    if not v_tournament_exists then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
    perform 1 from app.tournament_roles role_row
      where role_row.tournament_id = p_tournament_id and role_row.profile_id = p_actor_id
        and role_row.role in ('director','co_director') for update;
    if not found then raise exception using errcode = 'P0001', message = 'director role required'; end if;
    v_authorized := true;

    select * into v_event from app.events event_row
      where event_row.id = p_event_id and event_row.tournament_id = p_tournament_id for update;
    if not found or v_event.format <> 'standard_singles' or v_event.scoring_method <> 'digital'
       or not exists (select 1 from app.ruleset_versions ruleset
         where ruleset.id = v_event.ruleset_version_id and ruleset.tournament_id = p_tournament_id
           and ruleset.format = 'standard_singles' and ruleset.approved_at is not null
           and nullif(trim(ruleset.source_reference), '') is not null)
       or not exists (select 1 from app.tournament_setup_activations activation
         where activation.tournament_id = p_tournament_id and activation.event_id = p_event_id)
       or not exists (select 1 from app.event_publication_states publication_state
         where publication_state.tournament_id = p_tournament_id
           and publication_state.event_id = p_event_id and publication_state.state = 'draft') then
      raise exception using errcode = 'P0001', message = 'event unavailable for Standard Singles finalization';
    end if;
    if exists (select 1 from app.qualification_result_versions result where result.event_id = p_event_id) then
      raise exception using errcode = 'P0001', message = 'qualification already finalized';
    end if;
    select * into v_schedule from app.event_schedule_publications publication
      where publication.tournament_id = p_tournament_id and publication.event_id = p_event_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'schedule incomplete'; end if;

    -- Share the same row-lock boundary used by score, correction, and recovery
    -- writers so the snapshot cannot race an in-flight event mutation.
    perform 1 from app.canonical_games game
      where game.tournament_id = p_tournament_id and game.event_id = p_event_id
      order by game.id for update;

    select count(*)::integer into v_participant_count from app.event_participants participant
      where participant.tournament_id = p_tournament_id and participant.event_id = p_event_id;
    v_qualifier_count := (v_participant_count + 3) / 4;
    if v_participant_count <> v_schedule.participant_count
       or v_schedule.match_count <> (v_participant_count * v_schedule.game_count) / 2
       or exists (select 1 from app.event_participants participant
         where participant.tournament_id = p_tournament_id and participant.event_id = p_event_id
           and participant.status <> 'checked_in')
       or (select count(*) from app.canonical_games game
         where game.tournament_id = p_tournament_id and game.event_id = p_event_id) <> v_schedule.match_count
       or (select count(*) from app.current_effective_scorelines(p_tournament_id, p_event_id)) <> v_schedule.match_count * 2
       or exists (select 1 from app.event_participants participant
         where participant.tournament_id = p_tournament_id and participant.event_id = p_event_id
           and (select count(*) from app.current_effective_scorelines(p_tournament_id, p_event_id) line
             where line.participant_id = participant.id) <> v_schedule.game_count) then
      raise exception using errcode = 'P0001', message = 'schedule incomplete';
    end if;
    if exists (select 1 from app.canonical_games game
      where game.tournament_id = p_tournament_id and game.event_id = p_event_id
        and game.state in ('pending','submitted','mismatch','confirmation_pending')
        and not exists (select 1 from app.device_failure_recoveries recovery
          where recovery.canonical_game_id = game.id and app.device_recovery_is_approved(recovery.id))) then
      raise exception using errcode = 'P0001', message = 'scorecards unresolved';
    end if;
    if exists (select 1 from app.device_failure_recoveries recovery
      cross join lateral (select state_event.state from app.device_failure_recovery_state_events state_event
        where state_event.recovery_id = recovery.id order by state_event.transition_sequence desc limit 1) latest
      where recovery.tournament_id = p_tournament_id and recovery.event_id = p_event_id
        and latest.state in ('pending_review','disputed')) then
      raise exception using errcode = 'P0001', message = 'device recovery pending';
    end if;
    if exists (select 1 from app.independent_card_correction_lifecycles lifecycle
      cross join lateral (select state_event.state from app.independent_card_correction_state_events state_event
        where state_event.correction_id = lifecycle.correction_id order by state_event.transition_sequence desc limit 1) latest
      where lifecycle.tournament_id = p_tournament_id and lifecycle.event_id = p_event_id
        and latest.state not in ('applied','rejected'))
      or exists (select 1 from app.game_corrections correction
        where correction.tournament_id = p_tournament_id and correction.event_id = p_event_id
          and not exists (select 1 from app.correction_state_events state_event
            where state_event.correction_id = correction.id and state_event.state in ('applied','rejected'))) then
      raise exception using errcode = 'P0001', message = 'correction pending';
    end if;
    if exists (select 1 from app.independent_card_corrections correction
      where correction.tournament_id = p_tournament_id and correction.event_id = p_event_id
        and correction.qualification_changed) then
      raise exception using errcode = 'P0001', message = 'qualification notice pending';
    end if;

    if exists (
      with totals as (
        select participant.id,
          coalesce(sum(line.game_points),0)::integer game_points,
          count(*) filter(where line.is_winner)::integer games_won,
          coalesce(sum(line.plus_points),0)::integer plus_points,
          coalesce(sum(line.minus_points),0)::integer minus_points
        from app.event_participants participant
        left join lateral (select effective.* from app.current_effective_scorelines(p_tournament_id,p_event_id) effective
          where effective.participant_id=participant.id) line on true
        where participant.tournament_id=p_tournament_id and participant.event_id=p_event_id group by participant.id
      )
      select 1 from totals
      group by game_points,games_won,(plus_points-minus_points),plus_points
      having count(*) > 1
    ) then raise exception using errcode = 'P0001', message = 'ranking tie unresolved'; end if;

    with totals as (
      select participant.id,
        coalesce(nullif(trim(roster.claimed_display_name),''),nullif(trim(profile.display_name),'')) display_name,
        count(line.line_id)::integer verified_games, coalesce(sum(line.game_points),0)::integer game_points,
        count(*) filter(where line.is_winner)::integer games_won,
        coalesce(sum(line.plus_points),0)::integer plus_points,
        coalesce(sum(line.minus_points),0)::integer minus_points
      from app.event_participants participant
      left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id and roster.tournament_id=participant.tournament_id
      left join app.profiles profile on profile.id=participant.profile_id
      left join lateral (select effective.* from app.current_effective_scorelines(p_tournament_id,p_event_id) effective where effective.participant_id=participant.id) line on true
      where participant.tournament_id=p_tournament_id and participant.event_id=p_event_id
      group by participant.id,coalesce(nullif(trim(roster.claimed_display_name),''),nullif(trim(profile.display_name),''))
    ), ranked as (
      select totals.*,
        row_number() over(order by game_points desc,games_won desc,(plus_points-minus_points) desc,plus_points desc,id)::integer ordinal,
        rank() over(order by game_points desc,games_won desc,(plus_points-minus_points) desc,plus_points desc)::integer numeric_rank,
        count(*) over(partition by game_points,games_won,(plus_points-minus_points),plus_points)>1 tied
      from totals
    )
    select encode(extensions.digest(convert_to(jsonb_agg(to_jsonb(ranked) order by ordinal)::text,'utf8'),'sha256'),'hex')
      into v_digest from ranked;

    v_response := jsonb_build_object('status','qualification_finalized','tournamentId',p_tournament_id,
      'eventId',p_event_id,'resultVersionId',v_result_id,'version',1,
      'participantCount',v_participant_count,'qualifierCount',v_qualifier_count,
      'finalizedAt',v_finalized_at);
    insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,
      client_operation_id,outcome,response_payload,applied_at)
    values(v_receipt_id,p_tournament_id,p_actor_id,'finalize_standard_singles_qualification_v1',p_event_id,
      v_hash,p_operation_id,'accepted',v_response,v_finalized_at);
    insert into app.qualification_result_versions(id,tournament_id,event_id,version,ruleset_version_id,
      schedule_publication_id,participant_count,qualifier_count,high_non_qualifier_participant_id,
      standings_digest,finalized_by_profile_id,operation_receipt_id,finalized_at)
    select v_result_id,p_tournament_id,p_event_id,1,v_event.ruleset_version_id,v_schedule.id,
      v_participant_count,v_qualifier_count,ranked.id,v_digest,p_actor_id,v_receipt_id,v_finalized_at
    from (
      select participant.id,row_number() over(order by sum(line.game_points) desc,
        count(*) filter(where line.is_winner) desc,(sum(line.plus_points)-sum(line.minus_points)) desc,
        sum(line.plus_points) desc,participant.id)::integer ordinal
      from app.event_participants participant
      join lateral (select effective.* from app.current_effective_scorelines(p_tournament_id,p_event_id) effective where effective.participant_id=participant.id) line on true
      where participant.tournament_id=p_tournament_id and participant.event_id=p_event_id group by participant.id
    ) ranked where ranked.ordinal=v_qualifier_count+1;

    with totals as (
      select participant.id,
        coalesce(nullif(trim(roster.claimed_display_name),''),nullif(trim(profile.display_name),'')) display_name,
        count(line.line_id)::integer verified_games,sum(line.game_points)::integer game_points,
        count(*) filter(where line.is_winner)::integer games_won,sum(line.plus_points)::integer plus_points,sum(line.minus_points)::integer minus_points
      from app.event_participants participant
      left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id and roster.tournament_id=participant.tournament_id
      left join app.profiles profile on profile.id=participant.profile_id
      join lateral (select effective.* from app.current_effective_scorelines(p_tournament_id,p_event_id) effective where effective.participant_id=participant.id) line on true
      where participant.tournament_id=p_tournament_id and participant.event_id=p_event_id
      group by participant.id,coalesce(nullif(trim(roster.claimed_display_name),''),nullif(trim(profile.display_name),''))
    ), ranked as (
      select totals.*,row_number() over(order by game_points desc,games_won desc,(plus_points-minus_points) desc,plus_points desc,id)::integer ordinal,
        rank() over(order by game_points desc,games_won desc,(plus_points-minus_points) desc,plus_points desc)::integer numeric_rank,
        count(*) over(partition by game_points,games_won,(plus_points-minus_points),plus_points)>1 tied from totals
    )
    insert into app.qualification_result_rows(result_version_id,tournament_id,event_id,participant_id,
      ranking_ordinal,numeric_rank,tied,display_name_snapshot,verified_games,game_points,games_won,
      plus_points,minus_points,net_spread_points,qualification_status)
    select v_result_id,p_tournament_id,p_event_id,id,ordinal,numeric_rank,tied,display_name,verified_games,
      game_points,games_won,plus_points,minus_points,plus_points-minus_points,
      case when ordinal<=v_qualifier_count then 'qualified'
        when ordinal=v_qualifier_count+1 then 'high_non_qualifier' else 'not_qualified' end
    from ranked;
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,v_receipt_id,'qualification_result_version',v_result_id,
      'standard_singles_qualification_finalized',v_response);
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error=message_text;
    v_code := case v_error
      when 'tournament unavailable' then 'tournament_unavailable'
      when 'director role required' then 'not_director'
      when 'event unavailable for Standard Singles finalization' then 'event_unavailable'
      when 'qualification already finalized' then 'already_finalized'
      when 'schedule incomplete' then 'schedule_incomplete'
      when 'scorecards unresolved' then 'scorecards_unresolved'
      when 'device recovery pending' then 'recovery_pending'
      when 'correction pending' then 'correction_pending'
      when 'qualification notice pending' then 'qualification_notice_pending'
      when 'ranking tie unresolved' then 'ranking_tie_unresolved'
      else 'invalid_request' end;
    v_response := jsonb_build_object('status','rejected','code',v_code,'eventId',p_event_id);
    if v_authorized and v_tournament_exists then
      insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,
        client_operation_id,outcome,response_payload,applied_at)
      values(p_tournament_id,p_actor_id,'finalize_standard_singles_qualification_v1',coalesce(p_event_id,p_tournament_id),
        coalesce(v_hash,repeat('0',64)),p_operation_id,'rejected',v_response,clock_timestamp());
    end if;
    return v_response;
  end;
end;
$$;

create or replace function public.get_standard_singles_qualification_result_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
  select case when p_actor_id is not null and exists(select 1 from app.tournament_roles role_row
    where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id
      and role_row.role in ('director','co_director','player','cross_checker','judge','viewer')) then
    jsonb_build_object('status','qualification_finalized','tournamentId',result.tournament_id,
      'eventId',result.event_id,'resultVersionId',result.id,'version',result.version,
      'tournamentName',tournament_row.name,'eventName',event_row.name,
      'participantCount',result.participant_count,'qualifierCount',result.qualifier_count,
      'finalizedAt',result.finalized_at,'finalizedBy',profile.display_name,
      'qualifiers',coalesce((select jsonb_agg(jsonb_build_object('participantId',row_data.participant_id,
        'displayName',row_data.display_name_snapshot,'qualificationRank',row_data.ranking_ordinal,
        'numericRank',row_data.numeric_rank,'tied',row_data.tied,'verifiedGames',row_data.verified_games,
        'gamePoints',row_data.game_points,'gamesWon',row_data.games_won,'plusPoints',row_data.plus_points,
        'minusPoints',row_data.minus_points,'netSpreadPoints',row_data.net_spread_points)
        order by row_data.ranking_ordinal) from app.qualification_result_rows row_data
        where row_data.result_version_id=result.id and row_data.qualification_status='qualified'),'[]'::jsonb),
      'highNonQualifier',(select jsonb_build_object('participantId',row_data.participant_id,
        'displayName',row_data.display_name_snapshot,'numericRank',row_data.numeric_rank,
        'verifiedGames',row_data.verified_games,'gamePoints',row_data.game_points,'gamesWon',row_data.games_won,
        'plusPoints',row_data.plus_points,'minusPoints',row_data.minus_points,'netSpreadPoints',row_data.net_spread_points)
        from app.qualification_result_rows row_data where row_data.result_version_id=result.id
          and row_data.qualification_status='high_non_qualifier'),
      'playoffResultsAvailable',false,'financialAwardsCalculated',false,'officialAccExportAvailable',false)
    else null end
  from app.qualification_result_versions result
  join app.tournaments tournament_row on tournament_row.id=result.tournament_id
  join app.events event_row on event_row.id=result.event_id
  join app.profiles profile on profile.id=result.finalized_by_profile_id
  where result.tournament_id=p_tournament_id and result.event_id=p_event_id
  order by result.version desc limit 1
$$;

revoke all on function public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid) to service_role;
revoke all on function public.get_standard_singles_qualification_result_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_standard_singles_qualification_result_v1(uuid,uuid,uuid) to service_role;
