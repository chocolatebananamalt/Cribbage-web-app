-- One-time, director-reviewed Standard Singles schedule publication.
-- This deliberately does not implement or imply an ACC rotation algorithm.

create table app.event_schedule_publications (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  source_method text not null check (source_method in ('director_csv', 'director_entry')),
  game_count smallint not null check (game_count between 1 and 99),
  participant_count integer not null check (participant_count >= 2 and participant_count <= 10000),
  match_count integer not null check (match_count >= 1 and match_count <= 5000),
  schedule_digest text not null check (length(schedule_digest) = 64),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  published_at timestamptz not null default now(),
  foreign key (event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id) references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (event_id),
  unique (id, tournament_id, event_id)
);
alter table app.event_schedule_publications enable row level security;
alter table app.event_schedule_publications force row level security;
revoke all on table app.event_schedule_publications from public, anon, authenticated;
create trigger event_schedule_publications_immutable before update or delete on app.event_schedule_publications
for each row execute function app.reject_immutable_history();
create index event_schedule_publications_actor_idx on app.event_schedule_publications(actor_profile_id);
create index event_schedule_publications_receipt_idx on app.event_schedule_publications(operation_receipt_id);

create table app.event_schedule_games (
  publication_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  import_row_number integer not null check (import_row_number > 0),
  primary key (publication_id, canonical_game_id),
  foreign key (publication_id, tournament_id, event_id)
    references app.event_schedule_publications(id, tournament_id, event_id) on delete restrict,
  foreign key (canonical_game_id, tournament_id, event_id)
    references app.canonical_games(id, tournament_id, event_id) on delete restrict,
  unique (publication_id, import_row_number),
  unique (canonical_game_id)
);
alter table app.event_schedule_games enable row level security;
alter table app.event_schedule_games force row level security;
revoke all on table app.event_schedule_games from public, anon, authenticated;
create trigger event_schedule_games_immutable before update or delete on app.event_schedule_games
for each row execute function app.reject_immutable_history();

create or replace function app.protect_published_schedule_game()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from app.event_schedule_games sg where sg.canonical_game_id = old.id) then
    if tg_op = 'DELETE' then raise exception 'published schedule game is immutable'; end if;
    if new.tournament_id is distinct from old.tournament_id
       or new.event_id is distinct from old.event_id
       or new.round_id is distinct from old.round_id
       or new.match_instance is distinct from old.match_instance
       or new.side_a_participant_id is distinct from old.side_a_participant_id
       or new.side_b_participant_id is distinct from old.side_b_participant_id
       or new.side_a_table_seat_snapshot is distinct from old.side_a_table_seat_snapshot
       or new.side_b_table_seat_snapshot is distinct from old.side_b_table_seat_snapshot then
      raise exception 'published schedule assignment is immutable';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function app.protect_published_schedule_game() from public, anon, authenticated;
create trigger protect_published_schedule_game before update or delete on app.canonical_games
for each row execute function app.protect_published_schedule_game();

create or replace function app.protect_published_schedule_round()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from app.event_schedule_games sg
    join app.canonical_games cg on cg.id = sg.canonical_game_id
    where cg.round_id = old.id
  ) then raise exception 'published schedule round is immutable'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function app.protect_published_schedule_round() from public, anon, authenticated;
create trigger protect_published_schedule_round before update or delete on app.rounds
for each row execute function app.protect_published_schedule_round();

create table app.event_schedule_publication_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  attempted_event_id uuid,
  attempted_idempotency_key uuid not null,
  attempted_request_hash text not null,
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now()
);
alter table app.event_schedule_publication_conflicts enable row level security;
alter table app.event_schedule_publication_conflicts force row level security;
revoke all on table app.event_schedule_publication_conflicts from public, anon, authenticated;
create trigger event_schedule_publication_conflicts_immutable before update or delete on app.event_schedule_publication_conflicts
for each row execute function app.reject_immutable_history();
create index event_schedule_publication_conflicts_actor_idx on app.event_schedule_publication_conflicts(actor_profile_id);
create index event_schedule_publication_conflicts_tournament_idx on app.event_schedule_publication_conflicts(tournament_id);
create index event_schedule_publication_conflicts_receipt_idx on app.event_schedule_publication_conflicts(prior_receipt_id);

create or replace function public.publish_director_reviewed_event_schedule_v1(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_event_id uuid,
  p_matches jsonb,
  p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_hash text;
  v_existing app.operation_receipts%rowtype;
  v_receipt_id uuid := extensions.gen_random_uuid();
  v_publication_id uuid := extensions.gen_random_uuid();
  v_game_count integer;
  v_participant_count integer;
  v_match_count integer;
  v_response jsonb;
  v_error text;
  v_code text;
begin
  begin
    if p_actor_id is null or p_tournament_id is null or p_event_id is null
       or p_idempotency_key is null or jsonb_typeof(p_matches) <> 'array' then
      raise exception using errcode = 'P0001', message = 'invalid schedule';
    end if;
    v_match_count := jsonb_array_length(p_matches);
    if v_match_count < 1 or v_match_count > 5000 then
      raise exception using errcode = 'P0001', message = 'invalid schedule';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_matches) m
      where jsonb_typeof(m) <> 'object'
        or (select count(*) from jsonb_object_keys(m)) <> 5
        or not (m ? 'gameNumber' and m ? 'sideAVerificationId' and m ? 'sideBVerificationId'
          and m ? 'sideATableSeat' and m ? 'sideBTableSeat')
        or jsonb_typeof(m->'gameNumber') <> 'number'
        or not ((m->>'gameNumber') ~ '^[1-9][0-9]*$')
        or not ((m->>'sideAVerificationId') ~ '^[A-Z]-[1-9][0-9]*$')
        or not ((m->>'sideBVerificationId') ~ '^[A-Z]-[1-9][0-9]*$')
        or not ((m->>'sideATableSeat') ~ '^[A-Z]-[1-9][0-9]*$')
        or not ((m->>'sideBTableSeat') ~ '^[A-Z]-[1-9][0-9]*$')
        or m->>'sideAVerificationId' = m->>'sideBVerificationId'
        or m->>'sideATableSeat' = m->>'sideBTableSeat'
    ) then raise exception using errcode = 'P0001', message = 'invalid schedule'; end if;

    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'publish_director_reviewed_event_schedule_v1', p_actor_id::text, p_tournament_id::text,
      p_event_id::text, p_matches
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || p_idempotency_key::text, 0));

    perform 1 from app.tournaments t where t.id = p_tournament_id and t.status = 'open' for update;
    v_tournament_exists := found;
    if not v_tournament_exists then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
    perform 1 from app.tournament_roles r where r.tournament_id = p_tournament_id and r.profile_id = p_actor_id
      and r.role in ('director', 'co_director') for update;
    if not found then raise exception using errcode = 'P0001', message = 'director role required'; end if;
    v_authorized := true;

    select * into v_existing from app.operation_receipts
    where actor_profile_id = p_actor_id and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
      return v_existing.response_payload;
    end if;

    select sev.game_count into v_game_count
    from app.tournament_setup_activations a
    join app.events e on e.id = a.event_id and e.tournament_id = a.tournament_id
    join app.ruleset_versions rv on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id
    join app.tournament_setup_event_versions sev on sev.id = a.setup_event_version_id and sev.tournament_id = a.tournament_id
    where e.id = p_event_id and e.tournament_id = p_tournament_id
      and e.format = 'standard_singles' and e.scoring_method = 'digital'
      and rv.format = 'standard_singles' and rv.approved_at is not null
    for update of e;
    if v_game_count is null then raise exception using errcode = 'P0001', message = 'event not approved'; end if;
    if exists (select 1 from app.event_schedule_publications p where p.event_id = p_event_id) then
      raise exception using errcode = 'P0001', message = 'schedule already published';
    end if;

    if exists (select 1 from app.rounds r where r.event_id = p_event_id)
       or exists (select 1 from app.canonical_games g where g.event_id = p_event_id) then
      raise exception using errcode = 'P0001', message = 'schedule already published';
    end if;

    select count(*) into v_participant_count from app.event_participants ep
    where ep.event_id = p_event_id and ep.tournament_id = p_tournament_id;
    if v_participant_count < 2 or mod(v_participant_count, 2) <> 0
       or exists (select 1 from app.event_participants ep where ep.event_id = p_event_id and ep.status <> 'checked_in')
       or exists (select 1 from app.event_participants ep
          left join app.initial_seating_assignments s on s.tournament_id = ep.tournament_id and s.roster_entry_id = ep.roster_entry_id
          where ep.event_id = p_event_id and coalesce(s.verification_id, ep.table_seat) is null) then
      raise exception using errcode = 'P0001', message = 'participants unavailable';
    end if;
    if v_match_count <> (v_participant_count / 2) * v_game_count then
      raise exception using errcode = 'P0001', message = 'invalid schedule';
    end if;
    if exists (select 1 from jsonb_array_elements(p_matches) m where (m->>'gameNumber')::integer > v_game_count)
       or (select count(distinct (m->>'gameNumber')::integer) from jsonb_array_elements(p_matches) m) <> v_game_count then
      raise exception using errcode = 'P0001', message = 'invalid schedule';
    end if;
    if exists (
      with sides as (
        select (m->>'gameNumber')::integer game_number, m->>'sideAVerificationId' verification_id, m->>'sideATableSeat' table_seat
        from jsonb_array_elements(p_matches) m
        union all
        select (m->>'gameNumber')::integer, m->>'sideBVerificationId', m->>'sideBTableSeat'
        from jsonb_array_elements(p_matches) m
      )
      select 1 from sides s
      where not exists (
        select 1 from app.event_participants ep2
        left join app.initial_seating_assignments isa2 on isa2.tournament_id = ep2.tournament_id and isa2.roster_entry_id = ep2.roster_entry_id
        where ep2.event_id = p_event_id and coalesce(isa2.verification_id, ep2.table_seat) = s.verification_id
      )
    ) then raise exception using errcode = 'P0001', message = 'invalid schedule'; end if;
    if exists (
      with sides as (
        select (m->>'gameNumber')::integer game_number, m->>'sideAVerificationId' verification_id, m->>'sideATableSeat' table_seat from jsonb_array_elements(p_matches) m
        union all
        select (m->>'gameNumber')::integer, m->>'sideBVerificationId', m->>'sideBTableSeat' from jsonb_array_elements(p_matches) m
      )
      select 1 from sides group by game_number
      having count(*) <> v_participant_count or count(distinct verification_id) <> v_participant_count
        or count(distinct table_seat) <> v_participant_count
    ) then raise exception using errcode = 'P0001', message = 'invalid schedule'; end if;

    v_response := jsonb_build_object('status', 'event_schedule_published', 'eventId', p_event_id,
      'gameCount', v_game_count, 'participantCount', v_participant_count,
      'matchCount', v_match_count, 'publicationId', v_publication_id);
    insert into app.operation_receipts(id, actor_profile_id, tournament_id, operation_type, target_id,
      request_hash, client_operation_id, outcome, response_payload, applied_at)
    values (v_receipt_id, p_actor_id, p_tournament_id, 'publish_director_reviewed_event_schedule_v1',
      v_publication_id, v_hash, p_idempotency_key, 'accepted', v_response, now());
    insert into app.event_schedule_publications(id, tournament_id, event_id, source_method, game_count,
      participant_count, match_count, schedule_digest, actor_profile_id, operation_receipt_id)
    values (v_publication_id, p_tournament_id, p_event_id, 'director_csv', v_game_count,
      v_participant_count, v_match_count, v_hash, p_actor_id, v_receipt_id);
    insert into app.rounds(tournament_id, event_id, round_number)
    select p_tournament_id, p_event_id, n from generate_series(1, v_game_count) n;

    with imported as (
      select ord::integer import_row_number, (m->>'gameNumber')::integer game_number,
        m->>'sideAVerificationId' a_id, m->>'sideBVerificationId' b_id,
        m->>'sideATableSeat' a_seat, m->>'sideBTableSeat' b_seat
      from jsonb_array_elements(p_matches) with ordinality as imported_rows(m, ord)
    ), resolved as (
      select i.*, ra.id a_participant_id, rb.id b_participant_id
      from imported i
      join app.event_participants ra on ra.event_id = p_event_id
      left join app.initial_seating_assignments sa on sa.tournament_id = ra.tournament_id and sa.roster_entry_id = ra.roster_entry_id
      join app.event_participants rb on rb.event_id = p_event_id
      left join app.initial_seating_assignments sb on sb.tournament_id = rb.tournament_id and sb.roster_entry_id = rb.roster_entry_id
      where coalesce(sa.verification_id, ra.table_seat) = i.a_id
        and coalesce(sb.verification_id, rb.table_seat) = i.b_id
    ), created as (
      insert into app.canonical_games(tournament_id, event_id, round_id, match_instance,
        side_a_participant_id, side_b_participant_id, side_a_table_seat_snapshot, side_b_table_seat_snapshot)
      select p_tournament_id, p_event_id, r.id, 1, x.a_participant_id, x.b_participant_id, x.a_seat, x.b_seat
      from resolved x join app.rounds r on r.event_id = p_event_id and r.round_number = x.game_number
      returning id, tournament_id, event_id, round_id, side_a_participant_id, side_b_participant_id
    )
    insert into app.event_schedule_games(publication_id, tournament_id, event_id, canonical_game_id, import_row_number)
    select v_publication_id, p_tournament_id, p_event_id, c.id, i.import_row_number
    from created c
    join app.rounds r on r.id = c.round_id
    join imported i on i.game_number = r.round_number
    join app.event_participants a on a.id = c.side_a_participant_id
    join app.event_participants b on b.id = c.side_b_participant_id
    left join app.initial_seating_assignments sa on sa.tournament_id = a.tournament_id and sa.roster_entry_id = a.roster_entry_id
    left join app.initial_seating_assignments sb on sb.tournament_id = b.tournament_id and sb.roster_entry_id = b.roster_entry_id
    where coalesce(sa.verification_id, a.table_seat) = i.a_id and coalesce(sb.verification_id, b.table_seat) = i.b_id;

    insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
    values (p_tournament_id, p_actor_id, v_receipt_id, 'event_schedule_publication', v_publication_id,
      'director_reviewed_event_schedule_published', v_response);
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'tournament unavailable' then 'tournament_unavailable'
      when 'director role required' then 'not_director'
      when 'idempotency conflict' then 'idempotency_conflict'
      when 'event not approved' then 'event_not_approved'
      when 'participants unavailable' then 'participants_unavailable'
      when 'schedule already published' then 'schedule_already_published'
      else 'invalid_schedule' end;
    v_response := jsonb_build_object('status', 'rejected', 'code', v_code);
    if v_authorized and v_tournament_exists then
      if v_error = 'idempotency conflict' then
        insert into app.event_schedule_publication_conflicts(actor_profile_id, tournament_id, attempted_event_id,
          attempted_idempotency_key, attempted_request_hash, prior_receipt_id, reason_code)
        values (p_actor_id, p_tournament_id, p_event_id, p_idempotency_key, coalesce(v_hash, ''),
          case when v_existing.tournament_id = p_tournament_id then v_existing.id else null end, v_code);
      else
        insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash,
          client_operation_id, outcome, response_payload, applied_at)
        values (p_actor_id, p_tournament_id, 'publish_director_reviewed_event_schedule_v1',
          coalesce(p_event_id, p_tournament_id), coalesce(v_hash, ''), p_idempotency_key, 'rejected', v_response, now());
      end if;
    end if;
    return v_response;
  end;
end;
$$;

create or replace function public.get_event_schedule_workspace_v1(p_actor_id uuid, p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p_actor_id is not null and p_tournament_id is not null and exists (
    select 1 from app.tournament_roles tr where tr.tournament_id = p_tournament_id
      and tr.profile_id = p_actor_id and tr.role in ('director', 'co_director')
  ) then jsonb_build_object(
    'tournamentName', t.name,
    'events', coalesce((select jsonb_agg(jsonb_build_object(
      'eventId', e.id, 'name', e.name, 'format', e.format, 'scoringMethod', e.scoring_method,
      'gameCount', sev.game_count,
      'participantCount', (select count(*) from app.event_participants ep where ep.event_id = e.id),
      'schedulePublished', p.id is not null,
      'publishedMatchCount', coalesce(p.match_count, 0)
    ) order by sev.ordinal)
    from app.tournament_setup_activations a
    join app.events e on e.id = a.event_id and e.tournament_id = a.tournament_id
    join app.tournament_setup_event_versions sev on sev.id = a.setup_event_version_id and sev.tournament_id = a.tournament_id
    left join app.event_schedule_publications p on p.event_id = e.id
    where a.tournament_id = t.id), '[]'::jsonb),
    'participants', coalesce((select jsonb_agg(jsonb_build_object(
      'eventId', ep.event_id, 'participantId', ep.id,
      'displayName', coalesce(r.claimed_display_name, pr.display_name),
      'verificationId', coalesce(s.verification_id, ep.table_seat),
      'profileLinked', ep.profile_id is not null
    ) order by ep.event_id, coalesce(s.verification_id, ep.table_seat))
    from app.event_participants ep
    left join app.tournament_roster_entries r on r.id = ep.roster_entry_id and r.tournament_id = ep.tournament_id
    left join app.profiles pr on pr.id = ep.profile_id
    left join app.initial_seating_assignments s on s.roster_entry_id = ep.roster_entry_id and s.tournament_id = ep.tournament_id
    where ep.tournament_id = t.id and coalesce(s.verification_id, ep.table_seat) is not null), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(jsonb_build_object(
      'canonicalGameId', cg.id, 'gameNumber', ro.round_number,
      'sideAVerificationId', coalesce(sa.verification_id, a.table_seat),
      'sideBVerificationId', coalesce(sb.verification_id, b.table_seat),
      'sideATableSeat', cg.side_a_table_seat_snapshot, 'sideBTableSeat', cg.side_b_table_seat_snapshot,
      'sideADisplayName', coalesce(ra.claimed_display_name, pa.display_name),
      'sideBDisplayName', coalesce(rb.claimed_display_name, pb.display_name), 'state', cg.state
    ) order by ro.round_number, sg.import_row_number)
    from app.event_schedule_games sg
    join app.canonical_games cg on cg.id = sg.canonical_game_id
    join app.rounds ro on ro.id = cg.round_id
    join app.event_participants a on a.id = cg.side_a_participant_id
    join app.event_participants b on b.id = cg.side_b_participant_id
    left join app.tournament_roster_entries ra on ra.id = a.roster_entry_id
    left join app.tournament_roster_entries rb on rb.id = b.roster_entry_id
    left join app.profiles pa on pa.id = a.profile_id
    left join app.profiles pb on pb.id = b.profile_id
    left join app.initial_seating_assignments sa on sa.tournament_id = a.tournament_id and sa.roster_entry_id = a.roster_entry_id
    left join app.initial_seating_assignments sb on sb.tournament_id = b.tournament_id and sb.roster_entry_id = b.roster_entry_id
    where sg.tournament_id = t.id), '[]'::jsonb)
  ) else null end from app.tournaments t where t.id = p_tournament_id
$$;

revoke all on function public.publish_director_reviewed_event_schedule_v1(uuid, uuid, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.publish_director_reviewed_event_schedule_v1(uuid, uuid, uuid, jsonb, uuid) to service_role;
revoke all on function public.get_event_schedule_workspace_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_event_schedule_workspace_v1(uuid, uuid) to service_role;
