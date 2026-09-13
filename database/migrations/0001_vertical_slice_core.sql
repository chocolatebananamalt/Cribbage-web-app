-- REVIEWED PILOT DRAFT ONLY. Apply first to a disposable Supabase/Postgres project;
-- never apply to a shared or production database until the server/RLS test gates pass.
-- Private Standard Singles schema contract. Policies/RPCs/auth setup are intentionally absent.

create schema if not exists app;
create extension if not exists pgcrypto with schema extensions;
set search_path = app, public;

create table app.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  created_at timestamptz not null default now()
);

create table app.tournaments (
  id uuid primary key default extensions.gen_random_uuid(),
  director_profile_id uuid not null references app.profiles(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 200),
  status text not null check (status in ('draft', 'open', 'pending_finalization', 'finalized', 'archived')),
  created_at timestamptz not null default now()
);

create table app.tournament_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  profile_id uuid not null references app.profiles(id) on delete restrict,
  role text not null check (role in ('director', 'co_director', 'player', 'cross_checker', 'judge', 'viewer')),
  created_at timestamptz not null default now(),
  unique (tournament_id, profile_id, role)
);

create table app.ruleset_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  name text not null,
  format text not null check (format in ('standard_singles', 'team', 'doubles', 'canadian_doubles', 'custom')),
  source_reference text,
  effective_on date,
  approved_at timestamptz,
  unique (id, tournament_id),
  unique (tournament_id, name)
);

create table app.events (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  ruleset_version_id uuid not null,
  name text not null,
  event_type text not null check (event_type in ('main', 'consolation', 'satellite', 'custom')),
  format text not null check (format in ('standard_singles', 'team', 'doubles', 'canadian_doubles', 'custom')),
  scoring_method text not null check (scoring_method in ('digital', 'manual', 'imported')),
  check ((scoring_method = 'digital' and format = 'standard_singles') or scoring_method in ('manual', 'imported')),
  foreign key (ruleset_version_id, tournament_id) references app.ruleset_versions(id, tournament_id) on delete restrict,
  unique (id, tournament_id),
  unique (tournament_id, name)
);

create table app.rounds (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null,
  event_id uuid not null,
  round_number integer not null check (round_number > 0),
  foreign key (event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  unique (id, tournament_id, event_id),
  unique (id, tournament_id),
  unique (event_id, round_number)
);

create table app.event_participants (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null,
  event_id uuid not null,
  profile_id uuid not null references app.profiles(id) on delete restrict,
  table_seat text check (table_seat ~ '^[A-Za-z0-9]+-[0-9]+$'),
  status text not null check (status in ('registered', 'checked_in', 'withdrawn', 'disqualified')),
  foreign key (event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  unique (id, event_id, tournament_id),
  unique (id, profile_id, event_id, tournament_id),
  unique (event_id, profile_id)
);

create table app.canonical_games (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null,
  event_id uuid not null,
  round_id uuid not null,
  match_instance integer not null default 1 check (match_instance > 0),
  side_a_participant_id uuid not null,
  side_b_participant_id uuid not null,
  side_low_participant_id uuid generated always as (least(side_a_participant_id, side_b_participant_id)) stored,
  side_high_participant_id uuid generated always as (greatest(side_a_participant_id, side_b_participant_id)) stored,
  side_a_table_seat_snapshot text not null check (side_a_table_seat_snapshot ~ '^[A-Za-z0-9]+-[0-9]+$'),
  side_b_table_seat_snapshot text not null check (side_b_table_seat_snapshot ~ '^[A-Za-z0-9]+-[0-9]+$'),
  state text not null default 'pending' check (state in ('pending', 'submitted', 'mismatch', 'confirmation_pending', 'verified', 'corrected')),
  version integer not null default 1 check (version > 0),
  winner_side text check (winner_side in ('a', 'b')),
  margin integer check (margin is null or margin between 1 and 121),
  foreign key (round_id, tournament_id, event_id) references app.rounds(id, tournament_id, event_id) on delete restrict,
  foreign key (event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  foreign key (side_a_participant_id, event_id, tournament_id) references app.event_participants(id, event_id, tournament_id) on delete restrict,
  foreign key (side_b_participant_id, event_id, tournament_id) references app.event_participants(id, event_id, tournament_id) on delete restrict,
  check (side_a_participant_id <> side_b_participant_id),
  unique (id, tournament_id, event_id),
  unique (id, tournament_id),
  unique (event_id, round_id, match_instance, side_low_participant_id, side_high_participant_id)
);

create table app.card_scorelines (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  participant_id uuid not null,
  opponent_participant_id uuid not null,
  side text not null check (side in ('a', 'b')),
  table_seat_snapshot text not null check (table_seat_snapshot ~ '^[A-Za-z0-9]+-[0-9]+$'),
  is_winner boolean not null,
  margin integer not null check (margin between 1 and 121),
  plus_points integer not null default 0 check (plus_points >= 0),
  minus_points integer not null default 0 check (minus_points >= 0),
  game_points smallint not null check (game_points in (0, 2, 3)),
  check ((is_winner and game_points in (2, 3)) or (not is_winner and game_points = 0)),
  foreign key (canonical_game_id, tournament_id, event_id) references app.canonical_games(id, tournament_id, event_id) on delete restrict,
  foreign key (participant_id, event_id, tournament_id) references app.event_participants(id, event_id, tournament_id) on delete restrict,
  foreign key (opponent_participant_id, event_id, tournament_id) references app.event_participants(id, event_id, tournament_id) on delete restrict,
  check (participant_id <> opponent_participant_id),
  unique (id, canonical_game_id),
  unique (canonical_game_id, participant_id)
  -- No client-derived totals; pending games are blocked by the deferred state trigger below.
);

create table app.score_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  submitter_profile_id uuid not null references app.profiles(id) on delete restrict,
  submitter_participant_id uuid not null,
  submission_slot smallint not null check (submission_slot in (1, 2)),
  winner_side text not null check (winner_side in ('a', 'b')),
  margin integer not null check (margin between 1 and 121),
  source_method text not null check (source_method in ('digital', 'paper_transcription', 'manual', 'imported')),
  payload_digest text not null check (length(payload_digest) between 16 and 256),
  submitted_at timestamptz not null default now(),
  foreign key (canonical_game_id, tournament_id, event_id) references app.canonical_games(id, tournament_id, event_id) on delete restrict,
  foreign key (submitter_participant_id, event_id, tournament_id) references app.event_participants(id, event_id, tournament_id) on delete restrict,
  foreign key (submitter_participant_id, submitter_profile_id, event_id, tournament_id) references app.event_participants(id, profile_id, event_id, tournament_id) on delete restrict,
  unique (canonical_game_id, submission_slot),
  unique (canonical_game_id, submitter_profile_id),
  unique (id, canonical_game_id, submitter_profile_id)
  -- Immutable: no updated_at; history is append-only and protected by the trigger below.
);

create table app.score_confirmations (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  submission_id uuid not null,
  submission_actor_id uuid not null,
  confirmation_actor_id uuid not null references app.profiles(id) on delete restrict,
  confirmation_kind text not null check (confirmation_kind in ('player', 'cross_checker', 'judge')),
  confirmed_at timestamptz not null default now(),
  foreign key (canonical_game_id, tournament_id, event_id) references app.canonical_games(id, tournament_id, event_id) on delete restrict,
  foreign key (submission_id, canonical_game_id, submission_actor_id) references app.score_submissions(id, canonical_game_id, submitter_profile_id) on delete restrict,
  unique (canonical_game_id, confirmation_actor_id),
  unique (id, canonical_game_id)
);

create table app.operation_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_type text not null,
  target_id uuid not null,
  request_hash text not null check (length(request_hash) between 16 and 256),
  client_operation_id uuid not null,
  outcome text not null check (outcome in ('accepted', 'rejected', 'quarantined', 'replayed')),
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  response_payload jsonb,
  unique (actor_profile_id, client_operation_id),
  unique (id, tournament_id)
);

create table app.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid references app.profiles(id) on delete restrict,
  canonical_game_id uuid,
  operation_receipt_id uuid,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now(),
  foreign key (canonical_game_id, tournament_id) references app.canonical_games(id, tournament_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id) references app.operation_receipts(id, tournament_id) on delete restrict
);

create or replace function app.reject_immutable_history() returns trigger
language plpgsql security definer set search_path = '' as $$ begin raise exception 'immutable history'; end; $$;

create trigger score_submissions_immutable before update or delete on app.score_submissions
for each row execute function app.reject_immutable_history();

create trigger score_confirmations_immutable before update or delete on app.score_confirmations
for each row execute function app.reject_immutable_history();

create trigger audit_events_immutable before update or delete on app.audit_events
for each row execute function app.reject_immutable_history();

create trigger operation_receipts_immutable before update or delete on app.operation_receipts
for each row execute function app.reject_immutable_history();

create trigger ruleset_versions_immutable before update or delete on app.ruleset_versions
for each row execute function app.reject_immutable_history();

create or replace function app.revalidate_game(game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g app.canonical_games%rowtype;
declare score_count integer;
declare submission_count integer;
declare confirmation_count integer;
declare matching_winner text;
declare matching_margin integer;
begin
  select * into g from app.canonical_games where id = game_id;
  if g.state = 'pending' and exists (select 1 from app.card_scorelines where canonical_game_id = game_id) then
    raise exception 'pending game cannot have canonical scorelines';
  end if;
  if g.state not in ('pending', 'verified', 'corrected') and exists (select 1 from app.card_scorelines where canonical_game_id = game_id) then
    raise exception 'only verified or corrected games can have canonical scorelines';
  end if;
  select count(*) into submission_count from app.score_submissions where canonical_game_id = game_id;
  select count(*) into confirmation_count from app.score_confirmations where canonical_game_id = game_id;
  if confirmation_count > 0 and (g.state not in ('confirmation_pending', 'verified', 'corrected') or submission_count <> 2) then
    raise exception 'confirmations require two submissions and an eligible game state';
  end if;
  if confirmation_count > 0 and (select count(distinct (winner_side, margin)) from app.score_submissions where canonical_game_id = game_id) <> 1 then
    raise exception 'confirmations require matching submission winner and margin';
  end if;
  if g.state = 'submitted' and submission_count <> 1 then
    raise exception 'submitted game requires exactly one submission';
  end if;
  if g.state in ('mismatch', 'confirmation_pending', 'verified', 'corrected') and submission_count <> 2 then
    raise exception 'game requires exactly two submissions';
  end if;
  if g.state = 'confirmation_pending' and confirmation_count not in (0, 1) then
    raise exception 'confirmation-pending game allows zero or one confirmation';
  end if;
  if g.state in ('verified', 'corrected') then
    if confirmation_count <> 2 then raise exception 'verified game requires two confirmations'; end if;
    if (select count(distinct submission_id) from app.score_confirmations where canonical_game_id = game_id) <> 2 then
      raise exception 'confirmations must bind two distinct submissions';
    end if;
    if (select count(*) from app.card_scorelines where canonical_game_id = game_id) <> 2 then
      raise exception 'verified game requires exactly two scorelines';
    end if;
    if (select count(*) from app.card_scorelines where canonical_game_id = game_id and side = 'a' and participant_id = g.side_a_participant_id and opponent_participant_id = g.side_b_participant_id) <> 1
       or (select count(*) from app.card_scorelines where canonical_game_id = game_id and side = 'b' and participant_id = g.side_b_participant_id and opponent_participant_id = g.side_a_participant_id) <> 1 then
      raise exception 'scorelines must map exactly to game sides';
    end if;
    if (select count(*) from app.score_submissions s join app.event_participants p on p.id = s.submitter_participant_id where s.canonical_game_id = game_id and ((s.submission_slot = 1 and p.id <> g.side_a_participant_id) or (s.submission_slot = 2 and p.id <> g.side_b_participant_id))) <> 0 then
      raise exception 'submission slots must map to assigned game sides';
    end if;
    select winner_side, margin into matching_winner, matching_margin
      from app.score_submissions where canonical_game_id = game_id group by winner_side, margin having count(*) = 2;
    if matching_winner is null or g.winner_side <> matching_winner or g.margin <> matching_margin then
      raise exception 'canonical winner and margin must equal matching submissions';
    end if;
    if (select count(*) from app.card_scorelines where canonical_game_id = game_id and margin <> g.margin) <> 0
       or (select count(*) from app.card_scorelines where canonical_game_id = game_id and table_seat_snapshot not in (g.side_a_table_seat_snapshot, g.side_b_table_seat_snapshot)) <> 0
       or (select count(*) from app.card_scorelines where canonical_game_id = game_id and is_winner) <> 1 then
      raise exception 'scorelines must share margin, seats, and one winner';
    end if;
    if (select count(*) from app.card_scorelines where canonical_game_id = game_id and ((side = 'a' and table_seat_snapshot <> g.side_a_table_seat_snapshot) or (side = 'b' and table_seat_snapshot <> g.side_b_table_seat_snapshot) or (is_winner and side <> g.winner_side) or ((not is_winner) and side = g.winner_side) or (is_winner and plus_points <> g.margin) or (is_winner and minus_points <> 0) or (not is_winner and plus_points <> 0) or (not is_winner and minus_points <> g.margin) or (is_winner and game_points <> case when g.margin >= 31 then 3 else 2 end) or (not is_winner and game_points <> 0))) <> 0 then
      raise exception 'reciprocal plus-minus and game points are invalid';
    end if;
  end if;
end; $$;

create or replace function app.revalidate_game_from_scoreline() returns trigger language plpgsql security definer set search_path = '' as $$ begin perform app.revalidate_game(coalesce(new.canonical_game_id, old.canonical_game_id)); return null; end; $$;
create or replace function app.revalidate_game_from_submission() returns trigger language plpgsql security definer set search_path = '' as $$ begin perform app.revalidate_game(coalesce(new.canonical_game_id, old.canonical_game_id)); return null; end; $$;
create or replace function app.revalidate_game_from_confirmation() returns trigger language plpgsql security definer set search_path = '' as $$ begin perform app.revalidate_game(coalesce(new.canonical_game_id, old.canonical_game_id)); return null; end; $$;

create constraint trigger scoreline_revalidation after insert or update or delete on app.card_scorelines deferrable initially deferred for each row execute function app.revalidate_game_from_scoreline();
create constraint trigger submission_revalidation after insert or update or delete on app.score_submissions deferrable initially deferred for each row execute function app.revalidate_game_from_submission();
create constraint trigger confirmation_revalidation after insert or update or delete on app.score_confirmations deferrable initially deferred for each row execute function app.revalidate_game_from_confirmation();

create or replace function app.assert_two_submissions_before_verified() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.revalidate_game(new.id);
  return new;
end; $$;

create constraint trigger game_state_requires_two_submissions
after insert or update on app.canonical_games
deferrable initially deferred for each row execute function app.assert_two_submissions_before_verified();

create or replace function app.assert_digital_event_ruleset() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.scoring_method = 'digital' and not exists (
    select 1 from app.ruleset_versions r
    where r.id = new.ruleset_version_id and r.tournament_id = new.tournament_id
      and r.format = new.format and r.approved_at is not null
  ) then
    raise exception 'digital event requires matching approved ruleset';
  end if;
  return new;
end; $$;

create constraint trigger digital_event_requires_approved_ruleset
after insert or update on app.events
deferrable initially deferred for each row execute function app.assert_digital_event_ruleset();

revoke all on function app.reject_immutable_history() from public, anon, authenticated;
revoke all on function app.revalidate_game(uuid) from public, anon, authenticated;
revoke all on function app.revalidate_game_from_scoreline() from public, anon, authenticated;
revoke all on function app.revalidate_game_from_submission() from public, anon, authenticated;
revoke all on function app.revalidate_game_from_confirmation() from public, anon, authenticated;
revoke all on function app.assert_two_submissions_before_verified() from public, anon, authenticated;
revoke all on function app.assert_digital_event_ruleset() from public, anon, authenticated;

-- Composite foreign keys below deliberately carry scope. Index their source columns
-- so restrictive-delete checks and tournament-scoped reads do not degrade as games grow.
create index on app.tournament_roles (profile_id, tournament_id);
create index on app.events (ruleset_version_id, tournament_id);
create index on app.rounds (event_id, tournament_id);
create index on app.event_participants (profile_id, event_id, tournament_id);
create index event_participants_event_scope_idx on app.event_participants (event_id, tournament_id);
create index on app.canonical_games (event_id, tournament_id);
create index on app.canonical_games (round_id, tournament_id, event_id);
create index on app.canonical_games (side_a_participant_id, event_id, tournament_id);
create index on app.canonical_games (side_b_participant_id, event_id, tournament_id);
create index on app.card_scorelines (canonical_game_id, tournament_id, event_id);
create index on app.card_scorelines (participant_id, event_id, tournament_id);
create index on app.card_scorelines (opponent_participant_id, event_id, tournament_id);
create index on app.score_submissions (canonical_game_id, tournament_id, event_id);
create index on app.score_submissions (submitter_participant_id, event_id, tournament_id);
create index score_submissions_submitter_scope_idx on app.score_submissions (submitter_participant_id, submitter_profile_id, event_id, tournament_id);
create index score_submissions_submitter_profile_id_idx on app.score_submissions (submitter_profile_id);
create index on app.score_confirmations (canonical_game_id, tournament_id, event_id);
create index on app.score_confirmations (submission_id, canonical_game_id, submission_actor_id);
create index score_confirmations_confirmation_actor_id_idx on app.score_confirmations (confirmation_actor_id);
create index on app.operation_receipts (tournament_id);
create index on app.audit_events (tournament_id);
create index audit_events_actor_profile_id_idx on app.audit_events (actor_profile_id);
create index audit_events_canonical_game_scope_idx on app.audit_events (canonical_game_id, tournament_id);
create index audit_events_operation_receipt_scope_idx on app.audit_events (operation_receipt_id, tournament_id);
create index tournaments_director_profile_id_idx on app.tournaments (director_profile_id);

do $$ declare table_name text;
begin
  foreach table_name in array array['profiles','tournaments','tournament_roles','ruleset_versions','events','rounds','event_participants','canonical_games','card_scorelines','score_submissions','score_confirmations','operation_receipts','audit_events'] loop
    execute format('alter table app.%I enable row level security', table_name);
    execute format('alter table app.%I force row level security', table_name);
    execute format('revoke all on table app.%I from anon, authenticated', table_name);
  end loop;
end $$;
