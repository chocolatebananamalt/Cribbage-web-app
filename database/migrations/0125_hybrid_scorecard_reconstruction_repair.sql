-- Preserve verified hybrid scorecard lines when the opponent is represented by
-- a roster entry without an Auth profile. Reuse that roster identity for the
-- default-off, non-authoritative paper capture foundation as well.

create or replace function public.get_player_scorecard(
  p_tournament_id uuid,
  p_event_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tournamentId', t.id,
    'eventId', e.id,
    'tournamentName', t.name,
    'eventName', e.name,
    'player', jsonb_build_object(
      'displayName', player_profile.display_name,
      'verificationId', player_seating.verification_id
    ),
    'lines', scorecard.lines,
    'totals', jsonb_build_object(
      'gamePoints', scorecard.game_points,
      'plusPoints', scorecard.plus_points,
      'minusPoints', scorecard.minus_points,
      'gamesWon', scorecard.games_won,
      'netSpreadPoints', scorecard.plus_points - scorecard.minus_points
    ),
    'pendingGames', pending.pending_games
  )
  from app.tournaments t
  join app.events e on e.id = p_event_id and e.tournament_id = t.id
  join app.ruleset_versions rv on rv.id = e.ruleset_version_id
    and rv.tournament_id = e.tournament_id and rv.format = 'standard_singles'
    and rv.approved_at is not null
  join app.event_participants player_participant on player_participant.event_id = e.id
    and player_participant.tournament_id = t.id and player_participant.profile_id = auth.uid()
  join app.profiles player_profile on player_profile.id = player_participant.profile_id
  join app.roster_account_links player_link on player_link.tournament_id = t.id
    and player_link.profile_id = player_participant.profile_id
  join app.initial_seating_assignments player_seating on player_seating.tournament_id = t.id
    and player_seating.roster_entry_id = player_link.roster_entry_id
  join lateral (
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'roundNumber', r.round_number,
        'matchInstance', cg.match_instance,
        'gamePoints', coalesce(projection.adjudicated_game_points, cs.game_points),
        'plusPoints', coalesce(projection.adjudicated_plus_points, cs.plus_points),
        'minusPoints', coalesce(projection.adjudicated_minus_points, cs.minus_points),
        'opponentName', coalesce(opponent_roster.claimed_display_name, opponent_profile.display_name),
        'opponentVerificationId', coalesce(opponent_seating.verification_id, opponent_participant.table_seat)
      ) order by r.round_number, cg.match_instance), '[]'::jsonb) as lines,
      coalesce(sum(coalesce(projection.adjudicated_game_points, cs.game_points)), 0)::integer as game_points,
      coalesce(sum(coalesce(projection.adjudicated_plus_points, cs.plus_points)), 0)::integer as plus_points,
      coalesce(sum(coalesce(projection.adjudicated_minus_points, cs.minus_points)), 0)::integer as minus_points,
      count(*) filter (where coalesce(projection.adjudicated_is_winner, cs.is_winner))::integer as games_won
    from app.card_scorelines cs
    join app.canonical_games cg on cg.id = cs.canonical_game_id
      and cg.tournament_id = cs.tournament_id and cg.event_id = cs.event_id
    join app.rounds r on r.id = cg.round_id and r.tournament_id = cg.tournament_id
      and r.event_id = cg.event_id
    join app.event_participants opponent_participant on opponent_participant.id = cs.opponent_participant_id
      and opponent_participant.tournament_id = cs.tournament_id and opponent_participant.event_id = cs.event_id
    left join app.roster_account_links opponent_link
      on opponent_link.tournament_id = opponent_participant.tournament_id
      and opponent_link.profile_id = opponent_participant.profile_id
    left join app.tournament_roster_entries opponent_roster
      on opponent_roster.id = coalesce(opponent_participant.roster_entry_id, opponent_link.roster_entry_id)
      and opponent_roster.tournament_id = opponent_participant.tournament_id
    left join app.profiles opponent_profile on opponent_profile.id = opponent_participant.profile_id
    left join app.initial_seating_assignments opponent_seating
      on opponent_seating.tournament_id = opponent_participant.tournament_id
      and opponent_seating.roster_entry_id = coalesce(opponent_participant.roster_entry_id, opponent_link.roster_entry_id)
    left join lateral (
      select candidate.adjudicated_is_winner,
        candidate.adjudicated_game_points,
        candidate.adjudicated_plus_points,
        candidate.adjudicated_minus_points
      from app.independent_card_correction_projections candidate
      join app.independent_card_corrections correction
        on correction.id = candidate.correction_id
        and correction.canonical_game_id = cs.canonical_game_id
        and correction.tournament_id = cs.tournament_id
        and correction.event_id = cs.event_id
      where candidate.canonical_scoreline_id = cs.id
        and exists (
          select 1 from app.independent_card_correction_state_events state_event
          where state_event.correction_id = correction.id
            and state_event.canonical_game_id = correction.canonical_game_id
            and state_event.tournament_id = correction.tournament_id
            and state_event.event_id = correction.event_id
            and state_event.state = 'applied'
        )
      order by correction.correction_sequence desc
      limit 1
    ) projection on true
    where cs.tournament_id = t.id and cs.event_id = e.id
      and cs.participant_id = player_participant.id and cg.state in ('verified', 'corrected')
  ) scorecard on true
  join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'roundNumber', r.round_number,
      'matchInstance', cg.match_instance,
      'state', cg.state
    ) order by r.round_number, cg.match_instance), '[]'::jsonb) as pending_games
    from app.canonical_games cg
    join app.rounds r on r.id = cg.round_id and r.tournament_id = cg.tournament_id
      and r.event_id = cg.event_id
    where cg.tournament_id = t.id and cg.event_id = e.id
      and player_participant.id in (cg.side_a_participant_id, cg.side_b_participant_id)
      and cg.state in ('pending', 'submitted', 'confirmation_pending', 'mismatch')
  ) pending on true
  where t.id = p_tournament_id and auth.uid() is not null
    and e.format = 'standard_singles' and e.scoring_method = 'digital'
  limit 1
$$;

revoke all on function public.get_player_scorecard(uuid, uuid) from public, anon;
grant execute on function public.get_player_scorecard(uuid, uuid) to authenticated;

-- Resolve both legacy profile-only and current roster-backed participants.
-- The linked profile is returned when a roster-only participant later gains an
-- account so no-self enforcement remains effective.
create or replace function app.resolve_paper_card_participant_identity(
  p_participant_id uuid,
  p_event_id uuid,
  p_tournament_id uuid
) returns table(profile_id uuid, verification_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(participant.profile_id, roster_link.profile_id), seating.verification_id
  from app.event_participants participant
  left join app.roster_account_links roster_link
    on roster_link.tournament_id = participant.tournament_id
    and (
      (participant.roster_entry_id is not null
        and roster_link.roster_entry_id = participant.roster_entry_id)
      or (participant.roster_entry_id is null
        and roster_link.profile_id = participant.profile_id)
    )
  join app.initial_seating_assignments seating
    on seating.tournament_id = participant.tournament_id
    and seating.roster_entry_id = coalesce(participant.roster_entry_id, roster_link.roster_entry_id)
  where participant.id = p_participant_id
    and participant.event_id = p_event_id
    and participant.tournament_id = p_tournament_id
  limit 1
$$;

revoke all on function app.resolve_paper_card_participant_identity(uuid, uuid, uuid)
  from public, anon, authenticated;

create or replace function app.assert_paper_card_capture_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from app.canonical_games g
    where g.id = new.canonical_game_id and g.tournament_id = new.tournament_id
      and g.event_id = new.event_id and g.round_id = new.round_id
      and ((new.card_side = 'a' and new.participant_id = g.side_a_participant_id
        and new.opponent_participant_id = g.side_b_participant_id)
        or (new.card_side = 'b' and new.participant_id = g.side_b_participant_id
        and new.opponent_participant_id = g.side_a_participant_id))
  ) or not exists (
    select 1
    from app.resolve_paper_card_participant_identity(
      new.participant_id, new.event_id, new.tournament_id
    ) participant_identity
    cross join app.resolve_paper_card_participant_identity(
      new.opponent_participant_id, new.event_id, new.tournament_id
    ) opponent_identity
    where participant_identity.verification_id = new.verification_id_snapshot
      and new.actor_profile_id is distinct from participant_identity.profile_id
      and new.actor_profile_id is distinct from opponent_identity.profile_id
  ) or not exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = new.tournament_id
      and r.profile_id = new.actor_profile_id and r.role = 'cross_checker'
  ) then
    raise exception 'invalid paper card capture identity';
  end if;
  return new;
end;
$$;

revoke all on function app.assert_paper_card_capture_identity()
  from public, anon, authenticated;

create or replace function public.create_paper_card_capture_v1(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_game_id uuid,
  p_card_side text,
  p_verification_id text,
  p_source_kind text,
  p_original_file_name text,
  p_declared_media_type text,
  p_declared_byte_size bigint,
  p_declared_sha256 text,
  p_client_captured_at text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament app.tournaments%rowtype;
  v_game app.canonical_games%rowtype;
  v_actor_role text;
  v_participant_id uuid;
  v_opponent_participant_id uuid;
  v_participant_profile_id uuid;
  v_opponent_profile_id uuid;
  v_verification_id text;
  v_authorized boolean := false;
  v_tournament_exists boolean := false;
  v_game_exists boolean := false;
  v_hash text;
  v_existing app.operation_receipts%rowtype;
  v_receipt_id uuid;
  v_capture_id uuid := extensions.gen_random_uuid();
  v_upload_intent_id uuid := extensions.gen_random_uuid();
  v_object_reference_id uuid := extensions.gen_random_uuid();
  v_response jsonb;
  v_error text;
  v_code text;
begin
  begin
    if p_actor_id is null or p_tournament_id is null or p_game_id is null
       or p_card_side is null or p_card_side not in ('a', 'b') or p_verification_id is null
       or p_verification_id !~ '^[A-Z]-[1-9][0-9]*$'
       or p_source_kind is null or p_source_kind not in ('camera', 'file_upload')
       or p_original_file_name is null or length(trim(p_original_file_name)) not between 1 and 255
       or octet_length(p_original_file_name) > 1020 or p_original_file_name ~ '[\\/[:cntrl:]]'
       or p_declared_media_type is null or length(p_declared_media_type) not between 3 and 255
       or p_declared_media_type !~ '^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$'
       or p_declared_byte_size is null or p_declared_byte_size not between 1 and 9007199254740991
       or p_declared_sha256 is null or p_declared_sha256 !~ '^[0-9a-f]{64}$'
       or (p_client_captured_at is not null and (
         length(p_client_captured_at) not between 20 and 40
         or p_client_captured_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2})$'
         or not pg_catalog.pg_input_is_valid(p_client_captured_at, 'timestamp with time zone')
       )) or p_idempotency_key is null then
      raise exception using errcode = 'P0001', message = 'invalid paper card capture request';
    end if;

    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'create_paper_card_capture_v1', p_actor_id::text, p_tournament_id::text,
      p_game_id::text, p_card_side, p_verification_id, p_source_kind,
      p_original_file_name, p_declared_media_type, p_declared_byte_size,
      p_declared_sha256, coalesce(p_client_captured_at, ''), p_idempotency_key::text
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_actor_id::text || ':' || p_idempotency_key::text, 0)
    );

    select * into v_tournament from app.tournaments
    where id = p_tournament_id for update;
    v_tournament_exists := found;
    if not v_tournament_exists then
      raise exception using errcode = 'P0001', message = 'tournament unavailable';
    end if;

    select r.role into v_actor_role from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = p_actor_id
      and r.role = 'cross_checker'
    limit 1 for update;
    if v_actor_role is null then
      raise exception using errcode = 'P0001', message = 'capture role required';
    end if;
    v_authorized := true;

    select * into v_existing from app.operation_receipts
    where actor_profile_id = p_actor_id and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.tournament_id <> p_tournament_id
         or v_existing.operation_type <> 'create_paper_card_capture_v1'
         or v_existing.request_hash <> v_hash
         or not (
           (v_existing.outcome = 'accepted'
             and v_existing.response_payload->>'status' = 'paper_card_capture_created')
           or (v_existing.outcome = 'rejected'
             and v_existing.response_payload->>'status' = 'rejected'
             and v_existing.response_payload->>'code' in (
               'capture_lifecycle_closed', 'game_unavailable', 'unsupported_event',
               'card_identity_unavailable', 'self_capture_denied',
               'verification_id_mismatch', 'invalid_request'
             ))
         ) then
        raise exception using errcode = 'P0001', message = 'idempotency conflict';
      end if;
      return v_existing.response_payload;
    end if;

    if v_tournament.status not in ('open', 'pending_finalization') then
      raise exception using errcode = 'P0001', message = 'capture lifecycle closed';
    end if;

    select g.* into v_game from app.canonical_games g
    where g.id = p_game_id and g.tournament_id = p_tournament_id for update;
    v_game_exists := found;
    if not v_game_exists then
      raise exception using errcode = 'P0001', message = 'game unavailable';
    end if;
    if not exists (
      select 1 from app.events e
      join app.ruleset_versions r on r.id = e.ruleset_version_id
        and r.tournament_id = e.tournament_id
      where e.id = v_game.event_id and e.tournament_id = p_tournament_id
        and e.format = 'standard_singles' and e.scoring_method = 'digital'
        and r.format = 'standard_singles' and r.approved_at is not null
    ) then
      raise exception using errcode = 'P0001', message = 'unsupported capture event';
    end if;

    v_participant_id := case when p_card_side = 'a'
      then v_game.side_a_participant_id else v_game.side_b_participant_id end;
    v_opponent_participant_id := case when p_card_side = 'a'
      then v_game.side_b_participant_id else v_game.side_a_participant_id end;

    select participant_identity.profile_id, opponent_identity.profile_id,
           participant_identity.verification_id
      into v_participant_profile_id, v_opponent_profile_id, v_verification_id
    from app.resolve_paper_card_participant_identity(
      v_participant_id, v_game.event_id, p_tournament_id
    ) participant_identity
    cross join app.resolve_paper_card_participant_identity(
      v_opponent_participant_id, v_game.event_id, p_tournament_id
    ) opponent_identity;
    if not found then
      raise exception using errcode = 'P0001', message = 'card identity unavailable';
    end if;
    if p_actor_id in (v_participant_profile_id, v_opponent_profile_id) then
      raise exception using errcode = 'P0001', message = 'self capture denied';
    end if;
    if v_verification_id <> p_verification_id then
      raise exception using errcode = 'P0001', message = 'verification id mismatch';
    end if;

    v_response := jsonb_build_object(
      'status', 'paper_card_capture_created',
      'captureId', v_capture_id,
      'uploadIntentId', v_upload_intent_id,
      'objectReferenceId', v_object_reference_id,
      'gameId', p_game_id,
      'cardSide', p_card_side,
      'verificationId', v_verification_id,
      'captureState', 'upload_provider_pending',
      'humanReviewState', 'not_started',
      'retentionState', 'restricted_hold',
      'originalMetadata', jsonb_build_object(
        'sourceKind', p_source_kind,
        'fileName', p_original_file_name,
        'mediaType', p_declared_media_type,
        'byteSize', p_declared_byte_size,
        'sha256', p_declared_sha256,
        'clientCapturedAt', p_client_captured_at
      ),
      'uploadProviderConfigured', false,
      'uploadAuthorized', false,
      'imageStored', false,
      'publicUrlCreated', false,
      'ocrRequested', false,
      'transcriptionCreated', false,
      'scoreChanged', false,
      'gameVerified', false
    );

    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id, request_hash,
      client_operation_id, outcome, response_payload, applied_at
    ) values (
      p_actor_id, p_tournament_id, 'create_paper_card_capture_v1',
      v_capture_id, v_hash, p_idempotency_key, 'accepted', v_response, now()
    ) returning id into v_receipt_id;

    insert into app.paper_card_captures(
      id, tournament_id, event_id, canonical_game_id, round_id, card_side,
      participant_id, opponent_participant_id, verification_id_snapshot,
      actor_profile_id, actor_role, capture_state, human_review_state,
      ocr_state, retention_state, operation_receipt_id
    ) values (
      v_capture_id, p_tournament_id, v_game.event_id, v_game.id, v_game.round_id,
      p_card_side, v_participant_id, v_opponent_participant_id, v_verification_id,
      p_actor_id, v_actor_role, 'upload_provider_pending', 'not_started',
      'not_requested', 'restricted_hold', v_receipt_id
    );

    insert into app.paper_card_upload_intents(
      id, capture_id, tournament_id, event_id, canonical_game_id,
      object_reference_id, source_kind, original_file_name, declared_media_type,
      declared_byte_size, declared_sha256, client_captured_at,
      upload_state, access_scope
    ) values (
      v_upload_intent_id, v_capture_id, p_tournament_id, v_game.event_id, v_game.id,
      v_object_reference_id, p_source_kind, p_original_file_name,
      p_declared_media_type, p_declared_byte_size, p_declared_sha256,
      p_client_captured_at, 'provider_pending', 'restricted'
    );

    insert into app.audit_events(
      tournament_id, actor_profile_id, canonical_game_id, operation_receipt_id,
      entity_type, entity_id, action, after_state
    ) values (
      p_tournament_id, p_actor_id, v_game.id, v_receipt_id,
      'paper_card_capture', v_capture_id, 'paper_card_capture_created', v_response
    );
    return v_response;
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_error = message_text;
      v_code := case v_error
        when 'tournament unavailable' then 'tournament_unavailable'
        when 'capture role required' then 'not_capture_official'
        when 'idempotency conflict' then 'idempotency_conflict'
        when 'capture lifecycle closed' then 'capture_lifecycle_closed'
        when 'game unavailable' then 'game_unavailable'
        when 'unsupported capture event' then 'unsupported_event'
        when 'card identity unavailable' then 'card_identity_unavailable'
        when 'self capture denied' then 'self_capture_denied'
        when 'verification id mismatch' then 'verification_id_mismatch'
        else 'invalid_request'
      end;
      v_response := jsonb_build_object('status', 'rejected', 'code', v_code);
      if v_authorized and v_tournament_exists then
        if v_error = 'idempotency conflict' then
          insert into app.paper_card_capture_conflicts(
            actor_profile_id, tournament_id, attempted_game_id,
            attempted_card_side, attempted_idempotency_key,
            attempted_request_hash, prior_receipt_id, reason_code
          ) values (
            p_actor_id, p_tournament_id, p_game_id, p_card_side,
            p_idempotency_key, v_hash,
            case when v_existing.tournament_id = p_tournament_id then v_existing.id else null end,
            v_code
          );
        else
          insert into app.operation_receipts(
            actor_profile_id, tournament_id, operation_type, target_id,
            request_hash, client_operation_id, outcome, response_payload, applied_at
          ) values (
            p_actor_id, p_tournament_id, 'create_paper_card_capture_v1',
            p_game_id, coalesce(v_hash, ''), p_idempotency_key,
            'rejected', v_response, now()
          ) returning id into v_receipt_id;
          insert into app.audit_events(
            tournament_id, actor_profile_id, canonical_game_id,
            operation_receipt_id, entity_type, entity_id, action, after_state
          ) values (
            p_tournament_id, p_actor_id,
            case when v_game_exists then v_game.id else null end,
            v_receipt_id, 'paper_card_capture', p_game_id,
            'paper_card_capture_rejected', v_response
          );
        end if;
      end if;
      return v_response;
    when others then
      raise;
  end;
end;
$$;

revoke all on function public.create_paper_card_capture_v1(
  uuid, uuid, uuid, text, text, text, text, text, bigint, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.create_paper_card_capture_v1(
  uuid, uuid, uuid, text, text, text, text, text, bigint, text, text, uuid
) to service_role;
