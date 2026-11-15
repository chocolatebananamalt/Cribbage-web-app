-- Restricted paper-card evidence intake foundation. This records an immutable
-- capture plus provider-neutral upload reference and original image metadata.
-- It does not authorize an upload, store image bytes, expose a URL, invoke OCR,
-- create a transcription, mutate a score, or select a retention duration.

create table app.paper_card_captures (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  canonical_game_id uuid not null,
  round_id uuid not null,
  card_side text not null check (card_side in ('a', 'b')),
  participant_id uuid not null,
  opponent_participant_id uuid not null,
  verification_id_snapshot text not null check (verification_id_snapshot ~ '^[A-Z]-[1-9][0-9]*$'),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  actor_role text not null check (actor_role = 'cross_checker'),
  capture_state text not null check (capture_state = 'upload_provider_pending'),
  human_review_state text not null check (human_review_state = 'not_started'),
  ocr_state text not null check (ocr_state = 'not_requested'),
  retention_state text not null check (retention_state = 'restricted_hold'),
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (canonical_game_id, tournament_id, event_id)
    references app.canonical_games(id, tournament_id, event_id) on delete restrict,
  foreign key (round_id, tournament_id, event_id)
    references app.rounds(id, tournament_id, event_id) on delete restrict,
  foreign key (participant_id, event_id, tournament_id)
    references app.event_participants(id, event_id, tournament_id) on delete restrict,
  foreign key (opponent_participant_id, event_id, tournament_id)
    references app.event_participants(id, event_id, tournament_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id, actor_profile_id)
    references app.operation_receipts(id, tournament_id, actor_profile_id) on delete restrict,
  check (participant_id <> opponent_participant_id),
  unique (id, tournament_id, event_id, canonical_game_id)
);
alter table app.paper_card_captures enable row level security;
alter table app.paper_card_captures force row level security;
revoke all on table app.paper_card_captures from public, anon, authenticated;
create or replace function app.assert_paper_card_capture_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
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
    select 1 from app.event_participants participant
    join app.event_participants opponent
      on opponent.id = new.opponent_participant_id
      and opponent.event_id = participant.event_id
      and opponent.tournament_id = participant.tournament_id
    join app.roster_account_links link
      on link.tournament_id = participant.tournament_id
      and link.profile_id = participant.profile_id
    join app.initial_seating_assignments seating
      on seating.tournament_id = link.tournament_id
      and seating.roster_entry_id = link.roster_entry_id
    where participant.id = new.participant_id
      and participant.event_id = new.event_id
      and participant.tournament_id = new.tournament_id
      and seating.verification_id = new.verification_id_snapshot
      and new.actor_profile_id not in (participant.profile_id, opponent.profile_id)
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
revoke all on function app.assert_paper_card_capture_identity() from public, anon, authenticated;
create trigger paper_card_captures_identity_guard
before insert on app.paper_card_captures
for each row execute function app.assert_paper_card_capture_identity();
create trigger paper_card_captures_immutable
before update or delete on app.paper_card_captures
for each row execute function app.reject_immutable_history();
create index paper_card_captures_game_side_idx
  on app.paper_card_captures(tournament_id, canonical_game_id, card_side, created_at desc);
create index paper_card_captures_canonical_scope_idx
  on app.paper_card_captures(canonical_game_id, tournament_id, event_id);
create index paper_card_captures_actor_profile_id_idx
  on app.paper_card_captures(actor_profile_id);
create index paper_card_captures_participant_scope_idx
  on app.paper_card_captures(participant_id, event_id, tournament_id);
create index paper_card_captures_opponent_scope_idx
  on app.paper_card_captures(opponent_participant_id, event_id, tournament_id);
create index paper_card_captures_round_scope_idx
  on app.paper_card_captures(round_id, tournament_id, event_id);
create index paper_card_captures_receipt_scope_idx
  on app.paper_card_captures(operation_receipt_id, tournament_id, actor_profile_id);

create table app.paper_card_upload_intents (
  id uuid primary key default extensions.gen_random_uuid(),
  capture_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  object_reference_id uuid not null unique,
  source_kind text not null check (source_kind in ('camera', 'file_upload')),
  original_file_name text not null check (
    length(trim(original_file_name)) between 1 and 255
    and octet_length(original_file_name) <= 1020
    and original_file_name !~ '[\\/[:cntrl:]]'
  ),
  declared_media_type text not null check (
    length(declared_media_type) between 3 and 255
    and declared_media_type ~ '^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$'
  ),
  declared_byte_size bigint not null check (declared_byte_size between 1 and 9007199254740991),
  declared_sha256 text not null check (declared_sha256 ~ '^[0-9a-f]{64}$'),
  client_captured_at text check (
    client_captured_at is null or (
      length(client_captured_at) between 20 and 40
      and client_captured_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2})$'
      and pg_catalog.pg_input_is_valid(client_captured_at, 'timestamp with time zone')
    )
  ),
  upload_state text not null check (upload_state = 'provider_pending'),
  access_scope text not null check (access_scope = 'restricted'),
  created_at timestamptz not null default now(),
  foreign key (capture_id, tournament_id, event_id, canonical_game_id)
    references app.paper_card_captures(id, tournament_id, event_id, canonical_game_id) on delete restrict,
  unique (capture_id)
);
alter table app.paper_card_upload_intents enable row level security;
alter table app.paper_card_upload_intents force row level security;
revoke all on table app.paper_card_upload_intents from public, anon, authenticated;
create trigger paper_card_upload_intents_immutable
before update or delete on app.paper_card_upload_intents
for each row execute function app.reject_immutable_history();
create index paper_card_upload_intents_game_scope_idx
  on app.paper_card_upload_intents(canonical_game_id, tournament_id, event_id);
create index paper_card_upload_intents_capture_scope_idx
  on app.paper_card_upload_intents(capture_id, tournament_id, event_id, canonical_game_id);

create table app.paper_card_capture_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  attempted_game_id uuid not null,
  attempted_card_side text not null,
  attempted_idempotency_key uuid not null,
  attempted_request_hash text not null check (attempted_request_hash ~ '^[0-9a-f]{64}$'),
  prior_receipt_id uuid,
  reason_code text not null check (reason_code = 'idempotency_conflict'),
  created_at timestamptz not null default now(),
  foreign key (prior_receipt_id, tournament_id, actor_profile_id)
    references app.operation_receipts(id, tournament_id, actor_profile_id) on delete restrict
);
alter table app.paper_card_capture_conflicts enable row level security;
alter table app.paper_card_capture_conflicts force row level security;
revoke all on table app.paper_card_capture_conflicts from public, anon, authenticated;
create trigger paper_card_capture_conflicts_immutable
before update or delete on app.paper_card_capture_conflicts
for each row execute function app.reject_immutable_history();
create index paper_card_capture_conflicts_actor_profile_id_idx
  on app.paper_card_capture_conflicts(actor_profile_id);
create index paper_card_capture_conflicts_tournament_id_idx
  on app.paper_card_capture_conflicts(tournament_id);
create index paper_card_capture_conflicts_receipt_scope_idx
  on app.paper_card_capture_conflicts(prior_receipt_id, tournament_id, actor_profile_id);

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

    select participant.profile_id, opponent.profile_id, seating.verification_id
      into v_participant_profile_id, v_opponent_profile_id, v_verification_id
    from app.event_participants participant
    join app.event_participants opponent on opponent.id = v_opponent_participant_id
      and opponent.event_id = participant.event_id
      and opponent.tournament_id = participant.tournament_id
    join app.roster_account_links link on link.tournament_id = participant.tournament_id
      and link.profile_id = participant.profile_id
    join app.initial_seating_assignments seating
      on seating.tournament_id = link.tournament_id and seating.roster_entry_id = link.roster_entry_id
    where participant.id = v_participant_id
      and participant.event_id = v_game.event_id
      and participant.tournament_id = p_tournament_id;
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
