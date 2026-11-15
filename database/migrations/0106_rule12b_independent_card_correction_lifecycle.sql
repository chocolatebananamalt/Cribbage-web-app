-- Unreleased, server-only Rule 12.2(b) correction lifecycle.
--
-- This deliberately supports only the one independent-card disposition that
-- has already been exercised against the disposable database. It does not
-- grant a browser role, alter canonical reciprocal scorelines, update
-- standings, send qualification notices, or enable the application release
-- switch. Those remain separate release gates.

create table app.independent_card_correction_lifecycles (
  correction_id uuid primary key,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  policy_version integer not null check (policy_version >= 0),
  reason_required boolean not null,
  required_approvals smallint not null check (required_approvals in (0, 1)),
  creator_operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (correction_id, canonical_game_id, tournament_id, event_id)
    references app.independent_card_corrections(id, canonical_game_id, tournament_id, event_id) on delete restrict,
  foreign key (tournament_id, policy_version)
    references app.correction_policy_versions(tournament_id, version) on delete restrict,
  foreign key (creator_operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (correction_id, canonical_game_id, tournament_id, event_id)
);

create table app.independent_card_correction_state_events (
  id uuid primary key default extensions.gen_random_uuid(),
  correction_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  actor_role text not null check (actor_role in ('cross_checker', 'director', 'co_director')),
  state text not null check (state in ('pending', 'approved', 'applied', 'rejected')),
  transition_sequence smallint not null check (transition_sequence between 1 and 3),
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (correction_id, canonical_game_id, tournament_id, event_id)
    references app.independent_card_correction_lifecycles(correction_id, canonical_game_id, tournament_id, event_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (correction_id, transition_sequence),
  unique (correction_id, state)
);

create table app.independent_card_correction_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  canonical_game_id uuid,
  correction_id uuid,
  operation_type text not null check (operation_type in ('create_rule12b_correction_v1', 'review_rule12_correction_v1')),
  attempted_operation_id uuid not null,
  attempted_request_hash text not null check (length(attempted_request_hash) = 64),
  prior_receipt_id uuid not null,
  prior_receipt_tournament_id uuid not null,
  reason_code text not null check (reason_code = 'idempotency_conflict'),
  created_at timestamptz not null default now(),
  foreign key (canonical_game_id, tournament_id)
    references app.canonical_games(id, tournament_id) on delete restrict,
  foreign key (prior_receipt_id, prior_receipt_tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'independent_card_correction_lifecycles',
    'independent_card_correction_state_events',
    'independent_card_correction_operation_conflicts'
  ] loop
    execute format('alter table app.%I enable row level security', table_name);
    execute format('alter table app.%I force row level security', table_name);
    execute format('revoke all on table app.%I from public, anon, authenticated', table_name);
  end loop;
end;
$$;

create trigger independent_card_correction_lifecycles_immutable
before update or delete on app.independent_card_correction_lifecycles
for each row execute function app.reject_immutable_history();

create trigger independent_card_correction_state_events_immutable
before update or delete on app.independent_card_correction_state_events
for each row execute function app.reject_immutable_history();

create trigger independent_card_correction_operation_conflicts_immutable
before update or delete on app.independent_card_correction_operation_conflicts
for each row execute function app.reject_immutable_history();

create index independent_card_correction_lifecycles_game_idx
  on app.independent_card_correction_lifecycles(canonical_game_id, correction_id);
create index independent_card_correction_lifecycles_policy_idx
  on app.independent_card_correction_lifecycles(tournament_id, policy_version);
create index independent_card_correction_lifecycles_receipt_idx
  on app.independent_card_correction_lifecycles(creator_operation_receipt_id, tournament_id);
create index independent_card_correction_projections_scope_idx
  on app.independent_card_correction_projections(correction_id, canonical_game_id, tournament_id, event_id);
create index independent_card_correction_state_events_scope_idx
  on app.independent_card_correction_state_events(correction_id, canonical_game_id, tournament_id, event_id);
create index independent_card_correction_state_events_actor_idx
  on app.independent_card_correction_state_events(actor_profile_id);
create index independent_card_correction_state_events_receipt_idx
  on app.independent_card_correction_state_events(operation_receipt_id, tournament_id);
create index independent_card_correction_operation_conflicts_actor_idx
  on app.independent_card_correction_operation_conflicts(actor_profile_id, created_at desc);
create index independent_card_correction_operation_conflicts_tournament_idx
  on app.independent_card_correction_operation_conflicts(tournament_id, created_at desc);
create index independent_card_correction_operation_conflicts_game_idx
  on app.independent_card_correction_operation_conflicts(canonical_game_id, tournament_id) where canonical_game_id is not null;
create index independent_card_correction_operation_conflicts_receipt_idx
  on app.independent_card_correction_operation_conflicts(prior_receipt_id, prior_receipt_tournament_id);
create index independent_card_corrections_editor_idx
  on app.independent_card_corrections(editor_profile_id);

create or replace function app.revalidate_independent_card_correction_lifecycle(p_correction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lifecycle app.independent_card_correction_lifecycles%rowtype;
  v_states text[];
  v_unresolved integer;
begin
  select * into v_lifecycle
  from app.independent_card_correction_lifecycles
  where correction_id = p_correction_id;
  if not found then
    raise exception 'independent correction lifecycle is missing';
  end if;

  select array_agg(e.state order by e.transition_sequence) into v_states
  from app.independent_card_correction_state_events e
  where e.correction_id = p_correction_id;

  if v_lifecycle.required_approvals = 0 then
    if v_states is distinct from array['applied']::text[] then
      raise exception 'immediate independent correction requires exactly applied transition';
    end if;
  elsif v_lifecycle.required_approvals = 1 then
    if v_states is distinct from array['pending']::text[]
       and v_states is distinct from array['pending', 'rejected']::text[]
       and v_states is distinct from array['pending', 'approved', 'applied']::text[] then
      raise exception 'reviewed independent correction has invalid lifecycle';
    end if;
  else
    raise exception 'independent correction has invalid approval policy';
  end if;

  select count(*) into v_unresolved
  from app.independent_card_correction_lifecycles l
  where l.canonical_game_id = v_lifecycle.canonical_game_id
    and l.required_approvals = 1
    and exists (
      select 1 from app.independent_card_correction_state_events e
      where e.correction_id = l.correction_id and e.state = 'pending'
    )
    and not exists (
      select 1 from app.independent_card_correction_state_events e
      where e.correction_id = l.correction_id and e.state in ('approved', 'rejected')
    );
  if v_unresolved > 1 then
    raise exception 'game has multiple unresolved independent corrections';
  end if;
end;
$$;

create or replace function app.revalidate_independent_card_correction_lifecycle_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.revalidate_independent_card_correction_lifecycle(new.correction_id);
  return null;
end;
$$;

create constraint trigger independent_card_correction_lifecycle_complete
after insert on app.independent_card_correction_lifecycles
deferrable initially deferred
for each row execute function app.revalidate_independent_card_correction_lifecycle_trigger();

create constraint trigger independent_card_correction_state_event_complete
after insert on app.independent_card_correction_state_events
deferrable initially deferred
for each row execute function app.revalidate_independent_card_correction_lifecycle_trigger();

revoke all on function app.revalidate_independent_card_correction_lifecycle(uuid) from public, anon, authenticated;
revoke all on function app.revalidate_independent_card_correction_lifecycle_trigger() from public, anon, authenticated;

create or replace function public.create_rule12b_correction_v1(
  p_actor_id uuid,
  p_game_id uuid,
  p_correction_id uuid,
  p_expected_game_version integer,
  p_expected_correction_sequence integer,
  p_original_a_is_winner boolean,
  p_original_a_margin integer,
  p_original_b_is_winner boolean,
  p_original_b_margin integer,
  p_qualification_changed boolean,
  p_reason text,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game app.canonical_games%rowtype;
  v_policy app.correction_policy_versions%rowtype;
  v_existing app.operation_receipts%rowtype;
  v_a_scoreline_id uuid;
  v_b_scoreline_id uuid;
  v_sequence integer;
  v_tournament_status text;
  v_publication_state text;
  v_hash text;
  v_reason text;
  v_receipt_id uuid;
  v_response jsonb;
  v_error text;
  v_code text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only Rule 12 correction lifecycle';
  end if;

  begin
    if p_actor_id is null or p_game_id is null or p_correction_id is null
       or p_expected_game_version is null or p_expected_game_version < 1
       or p_expected_correction_sequence is null or p_expected_correction_sequence < 0
       or p_original_a_is_winner is null or p_original_b_is_winner is null
       or p_original_a_margin is null or p_original_a_margin not between 1 and 121
       or p_original_b_margin is null or p_original_b_margin not between 1 and 121
       or p_qualification_changed is null or p_operation_id is null then
      raise exception using errcode = 'P0001', message = 'invalid Rule 12 correction request';
    end if;
    if char_length(coalesce(p_reason, '')) > 500 then
      raise exception using errcode = 'P0001', message = 'correction reason too long';
    end if;
    if p_original_a_is_winner = p_original_b_is_winner
       or p_original_a_margin = p_original_b_margin then
      raise exception using errcode = 'P0001', message = 'Rule 12.2(b) fixture does not apply';
    end if;
    if p_qualification_changed then
      raise exception using errcode = 'P0001', message = 'qualification notice workflow unavailable';
    end if;

    v_reason := nullif(btrim(coalesce(p_reason, '')), '');
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'create_rule12b_correction_v1', p_actor_id, p_game_id, p_correction_id,
      p_expected_game_version, p_expected_correction_sequence,
      p_original_a_is_winner, p_original_a_margin,
      p_original_b_is_winner, p_original_b_margin,
      p_qualification_changed, coalesce(v_reason, ''), p_operation_id
    )::text, 'utf8'), 'sha256'), 'hex');

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || p_operation_id::text, 0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rule12:' || p_game_id::text, 0));

    select * into v_game from app.canonical_games
    where id = p_game_id
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'game not found';
    end if;

    select t.status into v_tournament_status from app.tournaments t
    where t.id = v_game.tournament_id
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'corrections require an open tournament';
    end if;
    select s.state into v_publication_state from app.event_publication_states s
    where s.event_id = v_game.event_id
      and s.tournament_id = v_game.tournament_id
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'result publication guard blocks correction';
    end if;
    perform 1 from app.tournament_roles r
    where r.tournament_id = v_game.tournament_id
      and r.profile_id = p_actor_id
      and r.role = 'cross_checker'
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'cross checker role required';
    end if;
    if exists (
      select 1 from app.event_participants p
      where p.id in (v_game.side_a_participant_id, v_game.side_b_participant_id)
        and p.profile_id = p_actor_id
    ) then
      raise exception using errcode = 'P0001', message = 'cannot correct own game';
    end if;

    select * into v_existing from app.operation_receipts
    where actor_profile_id = p_actor_id and client_operation_id = p_operation_id;
    if found then
      if v_existing.tournament_id <> v_game.tournament_id
         or v_existing.operation_type <> 'create_rule12b_correction_v1'
         or v_existing.target_id <> p_correction_id
         or v_existing.request_hash <> v_hash then
        insert into app.independent_card_correction_operation_conflicts(
          tournament_id, actor_profile_id, canonical_game_id, correction_id,
          operation_type, attempted_operation_id, attempted_request_hash,
          prior_receipt_id, prior_receipt_tournament_id, reason_code
        ) values (
          v_game.tournament_id, p_actor_id, p_game_id, p_correction_id,
          'create_rule12b_correction_v1', p_operation_id, v_hash,
          v_existing.id, v_existing.tournament_id, 'idempotency_conflict'
        );
        return jsonb_build_object('status', 'rejected', 'code', 'idempotency_conflict', 'correctionId', p_correction_id);
      end if;
      return v_existing.response_payload;
    end if;

    if v_tournament_status <> 'open' then
      raise exception using errcode = 'P0001', message = 'corrections require an open tournament';
    end if;
    if v_publication_state <> 'draft' then
      raise exception using errcode = 'P0001', message = 'result publication guard blocks correction';
    end if;

    if not exists (
      select 1 from app.events e
      join app.ruleset_versions rv
        on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id
      where e.id = v_game.event_id and e.tournament_id = v_game.tournament_id
        and e.format = 'standard_singles' and e.scoring_method = 'digital'
        and rv.format = 'standard_singles' and rv.approved_at is not null
    ) then
      raise exception using errcode = 'P0001', message = 'event is not approved for digital Standard Singles correction';
    end if;
    if v_game.state <> 'verified' then
      raise exception using errcode = 'P0001', message = 'only uncorrected verified games are supported';
    end if;
    if v_game.version <> p_expected_game_version then
      raise exception using errcode = 'P0001', message = 'stale game version';
    end if;
    if exists (select 1 from app.game_corrections c where c.canonical_game_id = p_game_id) then
      raise exception using errcode = 'P0001', message = 'legacy correction history is unsupported';
    end if;
    if exists (
      select 1 from app.independent_card_corrections c
      where c.canonical_game_id = p_game_id
        and not exists (
          select 1 from app.independent_card_correction_lifecycles l
          where l.correction_id = c.id
        )
    ) then
      raise exception using errcode = 'P0001', message = 'incomplete correction history is unsupported';
    end if;
    if exists (
      select 1 from app.independent_card_correction_lifecycles l
      where l.canonical_game_id = p_game_id
        and exists (
          select 1 from app.independent_card_correction_state_events e
          where e.correction_id = l.correction_id and e.state = 'pending'
        )
        and not exists (
          select 1 from app.independent_card_correction_state_events e
          where e.correction_id = l.correction_id and e.state in ('approved', 'rejected')
        )
    ) then
      raise exception using errcode = 'P0001', message = 'pending independent correction already exists';
    end if;

    select coalesce(max(c.correction_sequence), 0) into v_sequence
    from app.independent_card_corrections c
    where c.canonical_game_id = p_game_id;
    if v_sequence <> p_expected_correction_sequence then
      raise exception using errcode = 'P0001', message = 'stale correction sequence';
    end if;
    v_sequence := v_sequence + 1;

    select * into v_policy from app.correction_policy_versions p
    where p.tournament_id = v_game.tournament_id
    order by p.version desc
    limit 1;
    if not found then
      raise exception using errcode = 'P0001', message = 'correction policy unavailable';
    end if;
    if v_policy.reason_required and v_reason is null then
      raise exception using errcode = 'P0001', message = 'correction reason required';
    end if;

    select s.id into v_a_scoreline_id from app.card_scorelines s
    where s.canonical_game_id = p_game_id and s.side = 'a';
    select s.id into v_b_scoreline_id from app.card_scorelines s
    where s.canonical_game_id = p_game_id and s.side = 'b';
    if v_a_scoreline_id is null or v_b_scoreline_id is null then
      raise exception using errcode = 'P0001', message = 'canonical card identities unavailable';
    end if;

    v_response := jsonb_build_object(
      'status', case when v_policy.required_approvals = 0 then 'applied' else 'pending' end,
      'correctionId', p_correction_id,
      'gameId', p_game_id,
      'gameVersion', p_expected_game_version,
      'correctionSequence', v_sequence,
      'policyVersion', v_policy.version,
      'reasonRequired', v_policy.reason_required,
      'requiredApprovals', v_policy.required_approvals,
      'qualificationChanged', false
    );

    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id,
      request_hash, client_operation_id, outcome, response_payload, applied_at
    ) values (
      p_actor_id, v_game.tournament_id, 'create_rule12b_correction_v1', p_correction_id,
      v_hash, p_operation_id, 'accepted', v_response, now()
    ) returning id into v_receipt_id;

    insert into app.independent_card_corrections(
      id, tournament_id, event_id, canonical_game_id, correction_sequence,
      base_game_version, editor_profile_id, rule_case, reason,
      qualification_changed, apparent_qualifier_sides
    ) values (
      p_correction_id, v_game.tournament_id, v_game.event_id, p_game_id, v_sequence,
      p_expected_game_version, p_actor_id, '12.2b', v_reason,
      false, array['a', 'b']::text[]
    );

    insert into app.independent_card_correction_projections(
      correction_id, tournament_id, event_id, canonical_game_id, card_side,
      canonical_scoreline_id, original_is_winner, original_margin,
      original_plus_points, original_minus_points, original_game_points,
      adjudicated_is_winner, adjudicated_margin, adjudicated_plus_points,
      adjudicated_minus_points, adjudicated_game_points
    ) values
    (
      p_correction_id, v_game.tournament_id, v_game.event_id, p_game_id, 'a',
      v_a_scoreline_id, p_original_a_is_winner, p_original_a_margin,
      case when p_original_a_is_winner then p_original_a_margin else 0 end,
      case when p_original_a_is_winner then 0 else p_original_a_margin end,
      case when p_original_a_is_winner then case when p_original_a_margin >= 31 then 3 else 2 end else 0 end,
      p_original_a_is_winner, p_original_b_margin,
      case when p_original_a_is_winner then p_original_b_margin else 0 end,
      case when p_original_a_is_winner then 0 else p_original_b_margin end,
      case when p_original_a_is_winner then case when p_original_b_margin >= 31 then 3 else 2 end else 0 end
    ),
    (
      p_correction_id, v_game.tournament_id, v_game.event_id, p_game_id, 'b',
      v_b_scoreline_id, p_original_b_is_winner, p_original_b_margin,
      case when p_original_b_is_winner then p_original_b_margin else 0 end,
      case when p_original_b_is_winner then 0 else p_original_b_margin end,
      case when p_original_b_is_winner then case when p_original_b_margin >= 31 then 3 else 2 end else 0 end,
      p_original_b_is_winner, p_original_a_margin,
      case when p_original_b_is_winner then p_original_a_margin else 0 end,
      case when p_original_b_is_winner then 0 else p_original_a_margin end,
      case when p_original_b_is_winner then case when p_original_a_margin >= 31 then 3 else 2 end else 0 end
    );

    insert into app.independent_card_correction_lifecycles(
      correction_id, tournament_id, event_id, canonical_game_id,
      policy_version, reason_required, required_approvals,
      creator_operation_receipt_id
    ) values (
      p_correction_id, v_game.tournament_id, v_game.event_id, p_game_id,
      v_policy.version, v_policy.reason_required, v_policy.required_approvals,
      v_receipt_id
    );

    insert into app.independent_card_correction_state_events(
      correction_id, tournament_id, event_id, canonical_game_id,
      actor_profile_id, actor_role, state, transition_sequence,
      operation_receipt_id
    ) values (
      p_correction_id, v_game.tournament_id, v_game.event_id, p_game_id,
      p_actor_id, 'cross_checker',
      case when v_policy.required_approvals = 0 then 'applied' else 'pending' end,
      1, v_receipt_id
    );

    insert into app.audit_events(
      tournament_id, actor_profile_id, canonical_game_id,
      operation_receipt_id, entity_type, entity_id, action,
      before_state, after_state
    ) values (
      v_game.tournament_id, p_actor_id, p_game_id,
      v_receipt_id, 'independent_card_correction', p_correction_id,
      case when v_policy.required_approvals = 0 then 'rule12_correction_applied' else 'rule12_correction_pending' end,
      jsonb_build_object('gameVersion', v_game.version, 'winnerSide', v_game.winner_side, 'margin', v_game.margin),
      v_response
    );
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'invalid Rule 12 correction request' then 'invalid_request'
      when 'correction reason too long' then 'invalid_request'
      when 'Rule 12.2(b) fixture does not apply' then 'fixture_not_applicable'
      when 'qualification notice workflow unavailable' then 'qualification_notice_unavailable'
      when 'game not found' then 'game_not_found'
      when 'cross checker role required' then 'not_cross_checker'
      when 'cannot correct own game' then 'self_correction_denied'
      when 'corrections require an open tournament' then 'tournament_closed'
      when 'result publication guard blocks correction' then 'result_publication_guarded'
      when 'event is not approved for digital Standard Singles correction' then 'event_not_eligible'
      when 'only uncorrected verified games are supported' then 'game_state_unsupported'
      when 'stale game version' then 'stale_game_version'
      when 'legacy correction history is unsupported' then 'correction_history_unsupported'
      when 'incomplete correction history is unsupported' then 'correction_history_unsupported'
      when 'pending independent correction already exists' then 'pending_correction_exists'
      when 'stale correction sequence' then 'stale_correction_sequence'
      when 'correction policy unavailable' then 'policy_unavailable'
      when 'correction reason required' then 'reason_required'
      when 'canonical card identities unavailable' then 'card_identity_unavailable'
      else 'correction_unavailable'
    end;
    v_response := jsonb_build_object('status', 'rejected', 'code', v_code, 'correctionId', p_correction_id);
    if p_actor_id is not null and p_operation_id is not null
       and v_game.tournament_id is not null and v_hash is not null
       and exists (select 1 from app.profiles p where p.id = p_actor_id)
       and not exists (
         select 1 from app.operation_receipts r
         where r.actor_profile_id = p_actor_id and r.client_operation_id = p_operation_id
       ) then
      insert into app.operation_receipts(
        actor_profile_id, tournament_id, operation_type, target_id,
        request_hash, client_operation_id, outcome, response_payload, applied_at
      ) values (
        p_actor_id, v_game.tournament_id, 'create_rule12b_correction_v1', coalesce(p_correction_id, p_game_id),
        v_hash, p_operation_id, 'rejected', v_response, now()
      ) returning id into v_receipt_id;
      insert into app.audit_events(
        tournament_id, actor_profile_id, canonical_game_id,
        operation_receipt_id, entity_type, entity_id, action, after_state
      ) values (
        v_game.tournament_id, p_actor_id, p_game_id,
        v_receipt_id, 'independent_card_correction', coalesce(p_correction_id, p_game_id),
        'rule12_correction_rejected', v_response
      );
    end if;
    return v_response;
  when others then
    raise;
  end;
end;
$$;

create or replace function public.review_rule12_correction_v1(
  p_actor_id uuid,
  p_correction_id uuid,
  p_decision text,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_correction app.independent_card_corrections%rowtype;
  v_lifecycle app.independent_card_correction_lifecycles%rowtype;
  v_game app.canonical_games%rowtype;
  v_existing app.operation_receipts%rowtype;
  v_role text;
  v_tournament_status text;
  v_publication_state text;
  v_hash text;
  v_receipt_id uuid;
  v_response jsonb;
  v_error text;
  v_code text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only Rule 12 correction lifecycle';
  end if;

  begin
    if p_actor_id is null or p_correction_id is null
       or p_decision not in ('approve', 'reject') or p_operation_id is null then
      raise exception using errcode = 'P0001', message = 'invalid Rule 12 review request';
    end if;
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'review_rule12_correction_v1', p_actor_id, p_correction_id,
      p_decision, p_operation_id
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || p_operation_id::text, 0));

    select * into v_correction from app.independent_card_corrections
    where id = p_correction_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'correction not found';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rule12:' || v_correction.canonical_game_id::text, 0));
    select * into v_game from app.canonical_games
    where id = v_correction.canonical_game_id
      and tournament_id = v_correction.tournament_id
      and event_id = v_correction.event_id
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'correction scope invalid';
    end if;
    select * into v_lifecycle from app.independent_card_correction_lifecycles
    where correction_id = p_correction_id
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'correction lifecycle unavailable';
    end if;

    select t.status into v_tournament_status from app.tournaments t
    where t.id = v_correction.tournament_id
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'correction review requires an open tournament';
    end if;
    select s.state into v_publication_state from app.event_publication_states s
    where s.event_id = v_correction.event_id
      and s.tournament_id = v_correction.tournament_id
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'result publication guard blocks correction';
    end if;

    if p_actor_id = v_correction.editor_profile_id
       or exists (
         select 1 from app.event_participants p
         where p.id in (v_game.side_a_participant_id, v_game.side_b_participant_id)
           and p.profile_id = p_actor_id
       ) then
      raise exception using errcode = 'P0001', message = 'reviewer must be independent';
    end if;
    select r.role into v_role from app.tournament_roles r
    where r.tournament_id = v_correction.tournament_id
      and r.profile_id = p_actor_id
      and r.role in ('director', 'co_director', 'cross_checker')
    order by case r.role when 'director' then 1 when 'co_director' then 2 else 3 end
    limit 1
    for update;
    if v_role is null then
      raise exception using errcode = 'P0001', message = 'eligible reviewer role required';
    end if;

    select * into v_existing from app.operation_receipts
    where actor_profile_id = p_actor_id and client_operation_id = p_operation_id;
    if found then
      if v_existing.tournament_id <> v_correction.tournament_id
         or v_existing.operation_type <> 'review_rule12_correction_v1'
         or v_existing.target_id <> p_correction_id
         or v_existing.request_hash <> v_hash then
        insert into app.independent_card_correction_operation_conflicts(
          tournament_id, actor_profile_id, canonical_game_id, correction_id,
          operation_type, attempted_operation_id, attempted_request_hash,
          prior_receipt_id, prior_receipt_tournament_id, reason_code
        ) values (
          v_correction.tournament_id, p_actor_id, v_correction.canonical_game_id, p_correction_id,
          'review_rule12_correction_v1', p_operation_id, v_hash,
          v_existing.id, v_existing.tournament_id, 'idempotency_conflict'
        );
        return jsonb_build_object('status', 'rejected', 'code', 'idempotency_conflict', 'correctionId', p_correction_id);
      end if;
      return v_existing.response_payload;
    end if;

    if v_tournament_status <> 'open' then
      raise exception using errcode = 'P0001', message = 'correction review requires an open tournament';
    end if;
    if v_publication_state <> 'draft' then
      raise exception using errcode = 'P0001', message = 'result publication guard blocks correction';
    end if;

    if v_lifecycle.required_approvals <> 1 then
      raise exception using errcode = 'P0001', message = 'correction does not require review';
    end if;
    if not exists (
      select 1 from app.correction_policy_versions p
      where p.tournament_id = v_lifecycle.tournament_id
        and p.version = v_lifecycle.policy_version
        and p.reason_required = v_lifecycle.reason_required
        and p.required_approvals = v_lifecycle.required_approvals
    ) then
      raise exception using errcode = 'P0001', message = 'correction policy snapshot invalid';
    end if;
    if not exists (
      select 1 from app.independent_card_correction_state_events e
      where e.correction_id = p_correction_id and e.state = 'pending' and e.transition_sequence = 1
    ) or exists (
      select 1 from app.independent_card_correction_state_events e
      where e.correction_id = p_correction_id and e.state in ('approved', 'rejected', 'applied')
    ) then
      raise exception using errcode = 'P0001', message = 'correction is not pending review';
    end if;
    if not exists (
      select 1 from app.events e
      join app.ruleset_versions rv
        on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id
      where e.id = v_correction.event_id and e.tournament_id = v_correction.tournament_id
        and e.format = 'standard_singles' and e.scoring_method = 'digital'
        and rv.format = 'standard_singles' and rv.approved_at is not null
    ) then
      raise exception using errcode = 'P0001', message = 'event is not approved for digital Standard Singles correction';
    end if;
    if v_game.state <> 'verified' or v_game.version <> v_correction.base_game_version then
      raise exception using errcode = 'P0001', message = 'correction source is stale';
    end if;

    v_response := jsonb_build_object(
      'status', case when p_decision = 'approve' then 'applied' else 'rejected' end,
      'decision', p_decision,
      'correctionId', p_correction_id,
      'gameId', v_correction.canonical_game_id,
      'gameVersion', v_correction.base_game_version,
      'correctionSequence', v_correction.correction_sequence
    );
    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id,
      request_hash, client_operation_id, outcome, response_payload, applied_at
    ) values (
      p_actor_id, v_correction.tournament_id, 'review_rule12_correction_v1', p_correction_id,
      v_hash, p_operation_id, 'accepted', v_response, now()
    ) returning id into v_receipt_id;

    if p_decision = 'approve' then
      insert into app.independent_card_correction_state_events(
        correction_id, tournament_id, event_id, canonical_game_id,
        actor_profile_id, actor_role, state, transition_sequence,
        operation_receipt_id
      ) values
      (p_correction_id, v_correction.tournament_id, v_correction.event_id, v_correction.canonical_game_id,
       p_actor_id, v_role, 'approved', 2, v_receipt_id),
      (p_correction_id, v_correction.tournament_id, v_correction.event_id, v_correction.canonical_game_id,
       p_actor_id, v_role, 'applied', 3, v_receipt_id);
    else
      insert into app.independent_card_correction_state_events(
        correction_id, tournament_id, event_id, canonical_game_id,
        actor_profile_id, actor_role, state, transition_sequence,
        operation_receipt_id
      ) values (
        p_correction_id, v_correction.tournament_id, v_correction.event_id, v_correction.canonical_game_id,
        p_actor_id, v_role, 'rejected', 2, v_receipt_id
      );
    end if;

    insert into app.audit_events(
      tournament_id, actor_profile_id, canonical_game_id,
      operation_receipt_id, entity_type, entity_id, action,
      before_state, after_state
    ) values (
      v_correction.tournament_id, p_actor_id, v_correction.canonical_game_id,
      v_receipt_id, 'independent_card_correction', p_correction_id,
      case when p_decision = 'approve' then 'rule12_correction_review_approved' else 'rule12_correction_review_rejected' end,
      jsonb_build_object('status', 'pending'), v_response
    );
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'invalid Rule 12 review request' then 'invalid_request'
      when 'correction not found' then 'correction_not_found'
      when 'correction scope invalid' then 'correction_scope_invalid'
      when 'correction lifecycle unavailable' then 'lifecycle_unavailable'
      when 'reviewer must be independent' then 'reviewer_not_independent'
      when 'eligible reviewer role required' then 'not_eligible_reviewer'
      when 'correction does not require review' then 'review_not_required'
      when 'correction policy snapshot invalid' then 'policy_snapshot_invalid'
      when 'correction is not pending review' then 'not_pending_review'
      when 'correction review requires an open tournament' then 'tournament_closed'
      when 'result publication guard blocks correction' then 'result_publication_guarded'
      when 'event is not approved for digital Standard Singles correction' then 'event_not_eligible'
      when 'correction source is stale' then 'stale_correction_source'
      else 'correction_review_unavailable'
    end;
    v_response := jsonb_build_object('status', 'rejected', 'code', v_code, 'correctionId', p_correction_id);
    if p_actor_id is not null and p_operation_id is not null
       and v_correction.tournament_id is not null and v_hash is not null
       and exists (select 1 from app.profiles p where p.id = p_actor_id)
       and not exists (
         select 1 from app.operation_receipts r
         where r.actor_profile_id = p_actor_id and r.client_operation_id = p_operation_id
       ) then
      insert into app.operation_receipts(
        actor_profile_id, tournament_id, operation_type, target_id,
        request_hash, client_operation_id, outcome, response_payload, applied_at
      ) values (
        p_actor_id, v_correction.tournament_id, 'review_rule12_correction_v1', p_correction_id,
        v_hash, p_operation_id, 'rejected', v_response, now()
      ) returning id into v_receipt_id;
      insert into app.audit_events(
        tournament_id, actor_profile_id, canonical_game_id,
        operation_receipt_id, entity_type, entity_id, action, after_state
      ) values (
        v_correction.tournament_id, p_actor_id, v_correction.canonical_game_id,
        v_receipt_id, 'independent_card_correction', p_correction_id,
        'rule12_correction_review_rejected', v_response
      );
    end if;
    return v_response;
  when others then
    raise;
  end;
end;
$$;

create or replace function public.get_rule12_correction_v1(
  p_actor_id uuid,
  p_correction_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_correction app.independent_card_corrections%rowtype;
  v_lifecycle app.independent_card_correction_lifecycles%rowtype;
  v_game app.canonical_games%rowtype;
  v_status text;
  v_projections jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only Rule 12 correction lifecycle';
  end if;
  if p_actor_id is null or p_correction_id is null then return null; end if;

  select * into v_correction from app.independent_card_corrections
  where id = p_correction_id;
  if not found then return null; end if;
  select * into v_lifecycle from app.independent_card_correction_lifecycles
  where correction_id = p_correction_id;
  if not found then return null; end if;
  select * into v_game from app.canonical_games
  where id = v_correction.canonical_game_id
    and tournament_id = v_correction.tournament_id
    and event_id = v_correction.event_id;
  if not found then return null; end if;

  if not exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = v_correction.tournament_id
      and r.profile_id = p_actor_id
      and r.role in ('director', 'co_director', 'cross_checker')
  ) then return null; end if;
  if exists (
    select 1 from app.event_participants p
    where p.id in (v_game.side_a_participant_id, v_game.side_b_participant_id)
      and p.profile_id = p_actor_id
  ) then return null; end if;

  select e.state into v_status
  from app.independent_card_correction_state_events e
  where e.correction_id = p_correction_id
  order by e.transition_sequence desc
  limit 1;
  if v_status is null then return null; end if;

  select jsonb_agg(jsonb_build_object(
    'cardSide', p.card_side,
    'canonicalScorelineId', p.canonical_scoreline_id,
    'original', jsonb_build_object(
      'isWinner', p.original_is_winner,
      'margin', p.original_margin,
      'plusPoints', p.original_plus_points,
      'minusPoints', p.original_minus_points,
      'gamePoints', p.original_game_points
    ),
    'adjudicated', jsonb_build_object(
      'isWinner', p.adjudicated_is_winner,
      'margin', p.adjudicated_margin,
      'plusPoints', p.adjudicated_plus_points,
      'minusPoints', p.adjudicated_minus_points,
      'gamePoints', p.adjudicated_game_points
    )
  ) order by p.card_side) into v_projections
  from app.independent_card_correction_projections p
  where p.correction_id = p_correction_id;
  if jsonb_array_length(coalesce(v_projections, '[]'::jsonb)) <> 2 then return null; end if;

  return jsonb_build_object(
    'correctionId', v_correction.id,
    'tournamentId', v_correction.tournament_id,
    'eventId', v_correction.event_id,
    'gameId', v_correction.canonical_game_id,
    'correctionSequence', v_correction.correction_sequence,
    'baseGameVersion', v_correction.base_game_version,
    'editorProfileId', v_correction.editor_profile_id,
    'ruleCase', v_correction.rule_case,
    'reason', v_correction.reason,
    'createdAt', v_correction.created_at,
    'qualificationChanged', v_correction.qualification_changed,
    'apparentQualifierSides', v_correction.apparent_qualifier_sides,
    'policyVersion', v_lifecycle.policy_version,
    'reasonRequired', v_lifecycle.reason_required,
    'requiredApprovals', v_lifecycle.required_approvals,
    'status', v_status,
    'projections', v_projections
  );
end;
$$;

revoke all on function public.create_rule12b_correction_v1(uuid, uuid, uuid, integer, integer, boolean, integer, boolean, integer, boolean, text, uuid) from public, anon, authenticated;
revoke all on function public.review_rule12_correction_v1(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.get_rule12_correction_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_rule12b_correction_v1(uuid, uuid, uuid, integer, integer, boolean, integer, boolean, integer, boolean, text, uuid) to service_role;
grant execute on function public.review_rule12_correction_v1(uuid, uuid, text, uuid) to service_role;
grant execute on function public.get_rule12_correction_v1(uuid, uuid) to service_role;

-- The old authenticated correction functions remain suspended and no new
-- browser role receives access. The application release gate remains false.
revoke all on function public.propose_game_correction(uuid, uuid, integer, text, integer, text, uuid) from authenticated;
revoke all on function public.review_game_correction(uuid, text, uuid) from authenticated;
