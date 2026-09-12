-- Minimal event-scoped dispute register for the Standard Singles pilot.
-- Disputes never create or change scores. They remain an immutable release
-- gate until an authorized official, independent of both players, resolves
-- the recorded issue.

create table app.event_disputes (
  id uuid primary key,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  opened_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  summary text not null check (
    length(trim(summary)) between 1 and 500
    and octet_length(summary) <= 2000
    and summary !~ '[[:cntrl:]]'
  ),
  open_operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (canonical_game_id, tournament_id, event_id)
    references app.canonical_games(id, tournament_id, event_id) on delete restrict,
  foreign key (open_operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (id, tournament_id, event_id, canonical_game_id)
);

create table app.event_dispute_state_events (
  id uuid primary key default extensions.gen_random_uuid(),
  dispute_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  transition_sequence integer not null check (transition_sequence in (1, 2)),
  state text not null check (state in ('open', 'resolved')),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  actor_role text not null check (actor_role in ('participant', 'director', 'co_director', 'cross_checker', 'judge')),
  resolution_note text,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (dispute_id, tournament_id, event_id, canonical_game_id)
    references app.event_disputes(id, tournament_id, event_id, canonical_game_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  check (
    (state = 'open' and transition_sequence = 1 and resolution_note is null)
    or (state = 'resolved' and transition_sequence = 2
      and length(trim(resolution_note)) between 1 and 500
      and octet_length(resolution_note) <= 2000
      and resolution_note !~ '[[:cntrl:]]')
  ),
  unique (dispute_id, transition_sequence),
  unique (operation_receipt_id, dispute_id)
);

create table app.event_dispute_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  attempted_dispute_id uuid not null,
  attempted_operation_id uuid not null,
  attempted_request_hash text not null check (length(attempted_request_hash) = 64),
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null check (reason_code = 'idempotency_conflict'),
  created_at timestamptz not null default now()
);

create index event_disputes_game_scope_idx
  on app.event_disputes(canonical_game_id, tournament_id, event_id);
create index event_disputes_opened_by_idx
  on app.event_disputes(opened_by_profile_id);
create index event_disputes_receipt_scope_idx
  on app.event_disputes(open_operation_receipt_id, tournament_id);
create index event_dispute_state_latest_idx
  on app.event_dispute_state_events(dispute_id, transition_sequence desc);
create index event_dispute_state_scope_idx
  on app.event_dispute_state_events(dispute_id, tournament_id, event_id, canonical_game_id);
create index event_dispute_state_actor_idx
  on app.event_dispute_state_events(actor_profile_id);
create index event_dispute_state_receipt_scope_idx
  on app.event_dispute_state_events(operation_receipt_id, tournament_id);
create index event_dispute_conflicts_tournament_idx
  on app.event_dispute_operation_conflicts(tournament_id);
create index event_dispute_conflicts_actor_idx
  on app.event_dispute_operation_conflicts(actor_profile_id, created_at desc);
create index event_dispute_conflicts_receipt_idx
  on app.event_dispute_operation_conflicts(prior_receipt_id);

alter table app.event_disputes enable row level security;
alter table app.event_disputes force row level security;
alter table app.event_dispute_state_events enable row level security;
alter table app.event_dispute_state_events force row level security;
alter table app.event_dispute_operation_conflicts enable row level security;
alter table app.event_dispute_operation_conflicts force row level security;

revoke all on table app.event_disputes, app.event_dispute_state_events,
  app.event_dispute_operation_conflicts from public, anon, authenticated;

create trigger event_disputes_immutable before update or delete on app.event_disputes
for each row execute function app.reject_immutable_history();
create trigger event_dispute_state_events_immutable before update or delete on app.event_dispute_state_events
for each row execute function app.reject_immutable_history();
create trigger event_dispute_conflicts_immutable before update or delete on app.event_dispute_operation_conflicts
for each row execute function app.reject_immutable_history();

create or replace function app.event_dispute_is_open(p_dispute_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select state_event.state = 'open'
    from app.event_dispute_state_events state_event
    where state_event.dispute_id = p_dispute_id
    order by state_event.transition_sequence desc limit 1
  ), false)
$$;

revoke all on function app.event_dispute_is_open(uuid) from public, anon, authenticated;

create or replace function public.open_event_dispute_v1(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_event_id uuid,
  p_game_id uuid,
  p_dispute_id uuid,
  p_summary text,
  p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_game app.canonical_games%rowtype;
  v_actor_role text;
  v_existing app.operation_receipts%rowtype;
  v_hash text;
  v_receipt_id uuid;
  v_response jsonb;
  v_error text;
  v_code text;
  v_authorized boolean := false;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only event dispute';
  end if;
  begin
    if p_actor_id is null or p_tournament_id is null or p_event_id is null
       or p_game_id is null or p_dispute_id is null or p_operation_id is null
       or p_summary is null or length(trim(p_summary)) not between 1 and 500
       or octet_length(p_summary) > 2000 or p_summary ~ '[[:cntrl:]]' then
      raise exception using errcode = 'P0001', message = 'invalid event dispute request';
    end if;
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'open_event_dispute_v1', p_actor_id, p_tournament_id, p_event_id,
      p_game_id, p_dispute_id, trim(p_summary)
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || p_operation_id::text, 0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qualification-finalization:' || p_event_id::text, 0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-dispute-game:' || p_game_id::text, 0));

    select game.* into v_game from app.canonical_games game
    join app.events event_row on event_row.id = game.event_id and event_row.tournament_id = game.tournament_id
    where game.id = p_game_id and game.tournament_id = p_tournament_id and game.event_id = p_event_id
      and event_row.format = 'standard_singles' and event_row.scoring_method = 'digital'
      and exists (select 1 from app.event_schedule_games schedule_game
        where schedule_game.canonical_game_id = game.id and schedule_game.tournament_id = game.tournament_id
          and schedule_game.event_id = game.event_id)
    for update of game;
    if not found then raise exception using errcode = 'P0001', message = 'event dispute game unavailable'; end if;
    if not exists (select 1 from app.tournaments tournament_row
      where tournament_row.id = p_tournament_id and tournament_row.status = 'open' for update) then
      raise exception using errcode = 'P0001', message = 'event dispute lifecycle unavailable';
    end if;

    select role_row.role into v_actor_role from app.tournament_roles role_row
    where role_row.tournament_id = p_tournament_id and role_row.profile_id = p_actor_id
      and role_row.role in ('director', 'co_director', 'cross_checker', 'judge')
    order by case role_row.role when 'director' then 1 when 'co_director' then 2 when 'judge' then 3 else 4 end limit 1;
    if v_actor_role is null and exists (select 1 from app.event_participants participant
      where participant.profile_id = p_actor_id and participant.tournament_id = p_tournament_id
        and participant.event_id = p_event_id
        and participant.id in (v_game.side_a_participant_id, v_game.side_b_participant_id)) then
      v_actor_role := 'participant';
    end if;
    if v_actor_role is null then raise exception using errcode = 'P0001', message = 'event dispute opener unauthorized'; end if;
    v_authorized := true;

    select * into v_existing from app.operation_receipts receipt
    where receipt.actor_profile_id = p_actor_id and receipt.client_operation_id = p_operation_id;
    if found then
      if v_existing.tournament_id <> p_tournament_id
         or v_existing.operation_type <> 'open_event_dispute_v1'
         or v_existing.target_id <> p_dispute_id or v_existing.request_hash <> v_hash then
        insert into app.event_dispute_operation_conflicts(
          tournament_id, actor_profile_id, attempted_dispute_id, attempted_operation_id,
          attempted_request_hash, prior_receipt_id, reason_code
        ) values (p_tournament_id, p_actor_id, p_dispute_id, p_operation_id, v_hash,
          case when v_existing.tournament_id = p_tournament_id then v_existing.id end,
          'idempotency_conflict');
        return jsonb_build_object('status','rejected','code','idempotency_conflict',
          'disputeId',p_dispute_id,'eventId',p_event_id,'gameId',p_game_id);
      end if;
      return v_existing.response_payload;
    end if;

    if exists (select 1 from app.qualification_result_versions result where result.event_id = p_event_id) then
      raise exception using errcode = 'P0001', message = 'qualification already finalized';
    end if;
    if exists (select 1 from app.event_disputes dispute where dispute.id = p_dispute_id) then
      raise exception using errcode = 'P0001', message = 'event dispute id unavailable';
    end if;
    if exists (select 1 from app.event_disputes dispute
      where dispute.canonical_game_id = p_game_id and app.event_dispute_is_open(dispute.id)) then
      raise exception using errcode = 'P0001', message = 'open event dispute already exists';
    end if;

    v_response := jsonb_build_object('status','open','disputeId',p_dispute_id,
      'tournamentId',p_tournament_id,'eventId',p_event_id,'gameId',p_game_id);
    insert into app.operation_receipts(
      tournament_id, actor_profile_id, operation_type, target_id, request_hash,
      client_operation_id, outcome, response_payload, applied_at
    ) values (p_tournament_id,p_actor_id,'open_event_dispute_v1',p_dispute_id,v_hash,
      p_operation_id,'accepted',v_response,clock_timestamp()) returning id into v_receipt_id;
    insert into app.event_disputes(
      id,tournament_id,event_id,canonical_game_id,opened_by_profile_id,summary,open_operation_receipt_id
    ) values (p_dispute_id,p_tournament_id,p_event_id,p_game_id,p_actor_id,trim(p_summary),v_receipt_id);
    insert into app.event_dispute_state_events(
      dispute_id,tournament_id,event_id,canonical_game_id,transition_sequence,state,
      actor_profile_id,actor_role,resolution_note,operation_receipt_id
    ) values (p_dispute_id,p_tournament_id,p_event_id,p_game_id,1,'open',
      p_actor_id,v_actor_role,null,v_receipt_id);
    insert into app.audit_events(
      tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,
      entity_type,entity_id,action,after_state
    ) values (p_tournament_id,p_actor_id,p_game_id,v_receipt_id,
      'event_dispute',p_dispute_id,'event_dispute_opened',v_response);
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'invalid event dispute request' then 'invalid_request'
      when 'event dispute game unavailable' then 'game_unavailable'
      when 'event dispute lifecycle unavailable' then 'lifecycle_unavailable'
      when 'event dispute opener unauthorized' then 'not_authorized'
      when 'qualification already finalized' then 'qualification_finalized'
      when 'event dispute id unavailable' then 'dispute_id_unavailable'
      when 'open event dispute already exists' then 'open_dispute_exists'
      else 'dispute_unavailable' end;
    v_response := jsonb_build_object('status','rejected','code',v_code,
      'disputeId',p_dispute_id,'eventId',p_event_id,'gameId',p_game_id);
    -- The expected-error subtransaction releases advisory locks acquired
    -- inside it. Re-take the actor/operation lock before recording a durable
    -- rejection so concurrent identical retries cannot race the receipt key.
    if p_actor_id is not null and p_operation_id is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        p_actor_id::text || ':' || p_operation_id::text, 0));
    end if;
    if v_authorized and v_hash is not null and p_operation_id is not null then
      select * into v_existing from app.operation_receipts receipt
      where receipt.actor_profile_id = p_actor_id and receipt.client_operation_id = p_operation_id;
      if found then
        if v_existing.tournament_id <> p_tournament_id
           or v_existing.operation_type <> 'open_event_dispute_v1'
           or v_existing.target_id <> p_dispute_id or v_existing.request_hash <> v_hash then
          insert into app.event_dispute_operation_conflicts(
            tournament_id, actor_profile_id, attempted_dispute_id, attempted_operation_id,
            attempted_request_hash, prior_receipt_id, reason_code
          ) values (p_tournament_id, p_actor_id, p_dispute_id, p_operation_id, v_hash,
            case when v_existing.tournament_id = p_tournament_id then v_existing.id end,
            'idempotency_conflict');
          return jsonb_build_object('status','rejected','code','idempotency_conflict',
            'disputeId',p_dispute_id,'eventId',p_event_id,'gameId',p_game_id);
        end if;
        return v_existing.response_payload;
      end if;
      insert into app.operation_receipts(
        tournament_id,actor_profile_id,operation_type,target_id,request_hash,
        client_operation_id,outcome,response_payload,applied_at
      ) values (p_tournament_id,p_actor_id,'open_event_dispute_v1',p_dispute_id,v_hash,
        p_operation_id,'rejected',v_response,clock_timestamp()) returning id into v_receipt_id;
      insert into app.audit_events(
        tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,
        entity_type,entity_id,action,after_state
      ) values (p_tournament_id,p_actor_id,p_game_id,v_receipt_id,
        'event_dispute',p_dispute_id,'event_dispute_open_rejected',v_response);
    end if;
    return v_response;
  end;
end;
$$;

create or replace function public.resolve_event_dispute_v1(
  p_actor_id uuid,
  p_dispute_id uuid,
  p_resolution_note text,
  p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_dispute app.event_disputes%rowtype;
  v_game app.canonical_games%rowtype;
  v_actor_role text;
  v_latest_state text;
  v_existing app.operation_receipts%rowtype;
  v_hash text;
  v_receipt_id uuid;
  v_response jsonb;
  v_error text;
  v_code text;
  v_authorized boolean := false;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only event dispute';
  end if;
  begin
    if p_actor_id is null or p_dispute_id is null or p_operation_id is null
       or p_resolution_note is null or length(trim(p_resolution_note)) not between 1 and 500
       or octet_length(p_resolution_note) > 2000 or p_resolution_note ~ '[[:cntrl:]]' then
      raise exception using errcode = 'P0001', message = 'invalid event dispute resolution';
    end if;
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'resolve_event_dispute_v1', p_actor_id, p_dispute_id, trim(p_resolution_note)
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || p_operation_id::text, 0));
    select * into v_dispute from app.event_disputes dispute where dispute.id = p_dispute_id;
    if not found then
      return jsonb_build_object('status','rejected','code','dispute_unavailable','disputeId',p_dispute_id);
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qualification-finalization:' || v_dispute.event_id::text, 0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-dispute:' || p_dispute_id::text, 0));
    select * into v_dispute from app.event_disputes dispute where dispute.id = p_dispute_id for update;
    select * into v_game from app.canonical_games game where game.id = v_dispute.canonical_game_id for update;

    select role_row.role into v_actor_role from app.tournament_roles role_row
    where role_row.tournament_id = v_dispute.tournament_id and role_row.profile_id = p_actor_id
      and role_row.role in ('director','co_director','cross_checker','judge')
    order by case role_row.role when 'director' then 1 when 'co_director' then 2 when 'judge' then 3 else 4 end limit 1;
    if v_actor_role is null then raise exception using errcode = 'P0001', message = 'event dispute resolver unauthorized'; end if;
    v_authorized := true;
    select * into v_existing from app.operation_receipts receipt
    where receipt.actor_profile_id = p_actor_id and receipt.client_operation_id = p_operation_id;
    if found then
      if v_existing.tournament_id <> v_dispute.tournament_id
         or v_existing.operation_type <> 'resolve_event_dispute_v1'
         or v_existing.target_id <> p_dispute_id or v_existing.request_hash <> v_hash then
        insert into app.event_dispute_operation_conflicts(
          tournament_id,actor_profile_id,attempted_dispute_id,attempted_operation_id,
          attempted_request_hash,prior_receipt_id,reason_code
        ) values (v_dispute.tournament_id,p_actor_id,p_dispute_id,p_operation_id,v_hash,
          case when v_existing.tournament_id = v_dispute.tournament_id then v_existing.id end,
          'idempotency_conflict');
        return jsonb_build_object('status','rejected','code','idempotency_conflict','disputeId',p_dispute_id);
      end if;
      return v_existing.response_payload;
    end if;

    if exists (select 1 from app.event_participants participant
      where participant.id in (v_game.side_a_participant_id,v_game.side_b_participant_id)
        and participant.profile_id = p_actor_id) then
      raise exception using errcode = 'P0001', message = 'event dispute resolver not independent';
    end if;

    select state_event.state into v_latest_state from app.event_dispute_state_events state_event
    where state_event.dispute_id = p_dispute_id order by state_event.transition_sequence desc limit 1;
    if v_latest_state <> 'open' then raise exception using errcode = 'P0001', message = 'event dispute already resolved'; end if;
    if not exists (select 1 from app.tournaments tournament_row
      where tournament_row.id = v_dispute.tournament_id and tournament_row.status = 'open' for update)
      or exists (select 1 from app.qualification_result_versions result where result.event_id = v_dispute.event_id) then
      raise exception using errcode = 'P0001', message = 'event dispute lifecycle unavailable';
    end if;

    v_response := jsonb_build_object('status','resolved','disputeId',p_dispute_id,
      'eventId',v_dispute.event_id,'gameId',v_dispute.canonical_game_id);
    insert into app.operation_receipts(
      tournament_id,actor_profile_id,operation_type,target_id,request_hash,
      client_operation_id,outcome,response_payload,applied_at
    ) values (v_dispute.tournament_id,p_actor_id,'resolve_event_dispute_v1',p_dispute_id,v_hash,
      p_operation_id,'accepted',v_response,clock_timestamp()) returning id into v_receipt_id;
    insert into app.event_dispute_state_events(
      dispute_id,tournament_id,event_id,canonical_game_id,transition_sequence,state,
      actor_profile_id,actor_role,resolution_note,operation_receipt_id
    ) values (p_dispute_id,v_dispute.tournament_id,v_dispute.event_id,v_dispute.canonical_game_id,
      2,'resolved',p_actor_id,v_actor_role,trim(p_resolution_note),v_receipt_id);
    insert into app.audit_events(
      tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,
      entity_type,entity_id,action,before_state,after_state
    ) values (v_dispute.tournament_id,p_actor_id,v_dispute.canonical_game_id,v_receipt_id,
      'event_dispute',p_dispute_id,'event_dispute_resolved',
      jsonb_build_object('status','open'),v_response);
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'invalid event dispute resolution' then 'invalid_request'
      -- Do not turn a guessed dispute UUID into a cross-tournament existence
      -- oracle for a signed-in user without current authority in its scope.
      when 'event dispute resolver unauthorized' then 'dispute_unavailable'
      when 'event dispute resolver not independent' then 'resolver_not_independent'
      when 'event dispute already resolved' then 'already_resolved'
      when 'event dispute lifecycle unavailable' then 'lifecycle_unavailable'
      else 'resolution_unavailable' end;
    v_response := jsonb_build_object('status','rejected','code',v_code,'disputeId',p_dispute_id);
    if p_actor_id is not null and p_operation_id is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        p_actor_id::text || ':' || p_operation_id::text, 0));
    end if;
    if v_authorized and v_hash is not null and p_operation_id is not null then
      select * into v_existing from app.operation_receipts receipt
      where receipt.actor_profile_id = p_actor_id and receipt.client_operation_id = p_operation_id;
      if found then
        if v_existing.tournament_id <> v_dispute.tournament_id
           or v_existing.operation_type <> 'resolve_event_dispute_v1'
           or v_existing.target_id <> p_dispute_id or v_existing.request_hash <> v_hash then
          insert into app.event_dispute_operation_conflicts(
            tournament_id,actor_profile_id,attempted_dispute_id,attempted_operation_id,
            attempted_request_hash,prior_receipt_id,reason_code
          ) values (v_dispute.tournament_id,p_actor_id,p_dispute_id,p_operation_id,v_hash,
            case when v_existing.tournament_id = v_dispute.tournament_id then v_existing.id end,
            'idempotency_conflict');
          return jsonb_build_object('status','rejected','code','idempotency_conflict','disputeId',p_dispute_id);
        end if;
        return v_existing.response_payload;
      end if;
      insert into app.operation_receipts(
        tournament_id,actor_profile_id,operation_type,target_id,request_hash,
        client_operation_id,outcome,response_payload,applied_at
      ) values (v_dispute.tournament_id,p_actor_id,'resolve_event_dispute_v1',p_dispute_id,v_hash,
        p_operation_id,'rejected',v_response,clock_timestamp()) returning id into v_receipt_id;
      insert into app.audit_events(
        tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,
        entity_type,entity_id,action,after_state
      ) values (v_dispute.tournament_id,p_actor_id,v_dispute.canonical_game_id,v_receipt_id,
        'event_dispute',p_dispute_id,'event_dispute_resolution_rejected',v_response);
    end if;
    return v_response;
  end;
end;
$$;

create or replace function public.get_event_dispute_workspace_v1(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_event_id uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_role text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then return null; end if;
  select role_row.role into v_role from app.tournament_roles role_row
  where role_row.tournament_id = p_tournament_id and role_row.profile_id = p_actor_id
    and role_row.role in ('director','co_director','cross_checker','judge')
  order by case role_row.role when 'director' then 1 when 'co_director' then 2 when 'judge' then 3 else 4 end limit 1;
  if v_role is null or not exists (select 1 from app.events event_row
    where event_row.id = p_event_id and event_row.tournament_id = p_tournament_id) then return null; end if;
  return jsonb_build_object(
    'tournamentId',p_tournament_id,'eventId',p_event_id,'actorRole',v_role,
    'games',coalesce((select jsonb_agg(jsonb_build_object(
      'gameId',game.id,'roundNumber',round_row.round_number,
      'matchInstance',game.match_instance,
      'sideAName',coalesce(roster_a.claimed_display_name,profile_a.display_name),
      'sideBName',coalesce(roster_b.claimed_display_name,profile_b.display_name),
      'state',game.state,
      'canOpen',not exists (select 1 from app.event_disputes existing
        where existing.canonical_game_id = game.id and app.event_dispute_is_open(existing.id))
        and not exists (select 1 from app.qualification_result_versions result
          where result.event_id = p_event_id)
        and exists (select 1 from app.tournaments tournament_row
          where tournament_row.id = p_tournament_id and tournament_row.status = 'open')
    ) order by round_row.round_number,game.match_instance,game.id)
    from app.event_schedule_games schedule_game
    join app.canonical_games game on game.id = schedule_game.canonical_game_id
      and game.tournament_id = schedule_game.tournament_id and game.event_id = schedule_game.event_id
    join app.rounds round_row on round_row.id = game.round_id
    join app.event_participants participant_a on participant_a.id = game.side_a_participant_id
    join app.event_participants participant_b on participant_b.id = game.side_b_participant_id
    left join app.tournament_roster_entries roster_a on roster_a.id = participant_a.roster_entry_id
    left join app.tournament_roster_entries roster_b on roster_b.id = participant_b.roster_entry_id
    left join app.profiles profile_a on profile_a.id = participant_a.profile_id
    left join app.profiles profile_b on profile_b.id = participant_b.profile_id
    where schedule_game.tournament_id = p_tournament_id and schedule_game.event_id = p_event_id), '[]'::jsonb),
    'openDisputes',coalesce((select jsonb_agg(jsonb_build_object(
      'disputeId',dispute.id,'gameId',dispute.canonical_game_id,
      'matchInstance',game.match_instance,'summary',dispute.summary,
      'openedAt',dispute.created_at,'openedBy',opener.display_name,
      'sideAName',coalesce(roster_a.claimed_display_name,profile_a.display_name),
      'sideBName',coalesce(roster_b.claimed_display_name,profile_b.display_name),
      'canResolve',p_actor_id is distinct from participant_a.profile_id
        and p_actor_id is distinct from participant_b.profile_id
    ) order by dispute.created_at,dispute.id)
    from app.event_disputes dispute
    join app.canonical_games game on game.id = dispute.canonical_game_id
    join app.event_participants participant_a on participant_a.id = game.side_a_participant_id
    join app.event_participants participant_b on participant_b.id = game.side_b_participant_id
    left join app.tournament_roster_entries roster_a on roster_a.id = participant_a.roster_entry_id
    left join app.tournament_roster_entries roster_b on roster_b.id = participant_b.roster_entry_id
    left join app.profiles profile_a on profile_a.id = participant_a.profile_id
    left join app.profiles profile_b on profile_b.id = participant_b.profile_id
    join app.profiles opener on opener.id = dispute.opened_by_profile_id
    where dispute.tournament_id = p_tournament_id and dispute.event_id = p_event_id
      and app.event_dispute_is_open(dispute.id)), '[]'::jsonb)
  );
end;
$$;

-- Preserve the reviewed 0131 implementation behind a new guard without
-- copying its ranking/locking algorithm into a second migration.
alter function public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid) set schema app;
alter function app.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid)
  rename to finalize_standard_singles_qualification_without_event_dispute_guard_v1;

revoke all on function app.finalize_standard_singles_qualification_without_event_dispute_guard_v1(uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;

create or replace function app.block_qualification_finalization_with_open_disputes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from app.event_disputes dispute
    where dispute.tournament_id = new.tournament_id and dispute.event_id = new.event_id
      and app.event_dispute_is_open(dispute.id)) then
    raise exception using errcode = 'P0001', message = 'event dispute open';
  end if;
  return new;
end;
$$;

create trigger qualification_result_open_dispute_guard
before insert on app.qualification_result_versions
for each row execute function app.block_qualification_finalization_with_open_disputes();

revoke all on function app.block_qualification_finalization_with_open_disputes()
  from public, anon, authenticated;

create or replace function public.finalize_standard_singles_qualification_v1(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_event_id uuid,
  p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_existing app.operation_receipts%rowtype;
  v_response jsonb;
  v_receipt_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only qualification finalization';
  end if;
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null then
    return jsonb_build_object('status','rejected','code','invalid_request','eventId',p_event_id);
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'finalize_standard_singles_qualification_v1',p_actor_id,p_tournament_id,p_event_id
  )::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || p_operation_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qualification-finalization:' || p_event_id::text,0));
  if not exists (select 1 from app.tournaments tournament_row
    where tournament_row.id = p_tournament_id and tournament_row.status = 'open' for update) then
    return jsonb_build_object('status','rejected','code','tournament_unavailable','eventId',p_event_id);
  end if;
  if not exists (select 1 from app.tournament_roles role_row
    where role_row.tournament_id = p_tournament_id and role_row.profile_id = p_actor_id
      and role_row.role in ('director','co_director') for update) then
    return jsonb_build_object('status','rejected','code','not_director','eventId',p_event_id);
  end if;
  select * into v_existing from app.operation_receipts receipt
  where receipt.actor_profile_id = p_actor_id and receipt.client_operation_id = p_operation_id;
  if found then
    return app.finalize_standard_singles_qualification_without_event_dispute_guard_v1(
      p_actor_id,p_tournament_id,p_event_id,p_operation_id);
  end if;
  if exists (select 1 from app.event_disputes dispute
    where dispute.tournament_id = p_tournament_id and dispute.event_id = p_event_id
      and app.event_dispute_is_open(dispute.id)) then
    v_response := jsonb_build_object('status','rejected','code','dispute_open','eventId',p_event_id);
    insert into app.operation_receipts(
      tournament_id,actor_profile_id,operation_type,target_id,request_hash,
      client_operation_id,outcome,response_payload,applied_at
    ) values (p_tournament_id,p_actor_id,'finalize_standard_singles_qualification_v1',p_event_id,v_hash,
      p_operation_id,'rejected',v_response,clock_timestamp()) returning id into v_receipt_id;
    insert into app.audit_events(
      tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state
    ) values (p_tournament_id,p_actor_id,v_receipt_id,'event',p_event_id,
      'qualification_finalization_rejected_open_dispute',v_response);
    return v_response;
  end if;
  return app.finalize_standard_singles_qualification_without_event_dispute_guard_v1(
    p_actor_id,p_tournament_id,p_event_id,p_operation_id);
end;
$$;

revoke all on function public.open_event_dispute_v1(uuid,uuid,uuid,uuid,uuid,text,uuid)
  from public, anon, authenticated;
revoke all on function public.resolve_event_dispute_v1(uuid,uuid,text,uuid)
  from public, anon, authenticated;
revoke all on function public.get_event_dispute_workspace_v1(uuid,uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.open_event_dispute_v1(uuid,uuid,uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.resolve_event_dispute_v1(uuid,uuid,text,uuid) to service_role;
grant execute on function public.get_event_dispute_workspace_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid) to service_role;
