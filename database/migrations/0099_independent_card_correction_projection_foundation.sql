-- Inert Rule 12.2 replacement foundation. A canonical game remains the shared
-- match identity, but an ACC cross-check correction may require two distinct
-- adjudicated card projections. Do not add a writer or grant access here: the
-- correction feature remains suspended until all Rule 12.2 fixtures and the
-- complete lifecycle are reviewed.

create table app.independent_card_corrections (
  id uuid primary key,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  correction_sequence integer not null check (correction_sequence > 0),
  base_game_version integer not null check (base_game_version > 0),
  editor_profile_id uuid not null references app.profiles(id) on delete restrict,
  rule_case text not null check (rule_case in ('12.2a', '12.2b', '12.2c', '12.2d', '12.2e', '12.2f', '12.2g', '12.2h', '12.2i')),
  reason text,
  created_at timestamptz not null default now(),
  foreign key (canonical_game_id, tournament_id, event_id)
    references app.canonical_games(id, tournament_id, event_id) on delete restrict,
  unique (canonical_game_id, correction_sequence),
  unique (id, canonical_game_id, tournament_id, event_id)
);

create table app.independent_card_correction_projections (
  id uuid primary key default extensions.gen_random_uuid(),
  correction_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  card_side text not null check (card_side in ('a', 'b')),
  original_scoreline_id uuid not null,
  original_is_winner boolean not null,
  original_margin integer not null check (original_margin between 1 and 121),
  original_plus_points integer not null check (original_plus_points >= 0),
  original_minus_points integer not null check (original_minus_points >= 0),
  original_game_points smallint not null check (original_game_points in (0, 2, 3)),
  adjudicated_is_winner boolean not null,
  adjudicated_margin integer not null check (adjudicated_margin between 1 and 121),
  adjudicated_plus_points integer not null check (adjudicated_plus_points >= 0),
  adjudicated_minus_points integer not null check (adjudicated_minus_points >= 0),
  adjudicated_game_points smallint not null check (adjudicated_game_points in (0, 2, 3)),
  check ((original_is_winner and original_game_points in (2, 3)) or (not original_is_winner and original_game_points = 0)),
  check ((adjudicated_is_winner and adjudicated_game_points in (2, 3)) or (not adjudicated_is_winner and adjudicated_game_points = 0)),
  foreign key (correction_id, canonical_game_id, tournament_id, event_id)
    references app.independent_card_corrections(id, canonical_game_id, tournament_id, event_id) on delete restrict,
  foreign key (original_scoreline_id, canonical_game_id)
    references app.card_scorelines(id, canonical_game_id) on delete restrict,
  unique (correction_id, card_side),
  unique (id, correction_id)
);

alter table app.independent_card_corrections enable row level security;
alter table app.independent_card_corrections force row level security;
alter table app.independent_card_correction_projections enable row level security;
alter table app.independent_card_correction_projections force row level security;
revoke all on table app.independent_card_corrections, app.independent_card_correction_projections from public, anon, authenticated;

create trigger independent_card_corrections_immutable
before update or delete on app.independent_card_corrections
for each row execute function app.reject_immutable_history();

create trigger independent_card_correction_projections_immutable
before update or delete on app.independent_card_correction_projections
for each row execute function app.reject_immutable_history();

create index independent_card_corrections_game_scope_idx
  on app.independent_card_corrections(canonical_game_id, tournament_id, event_id, correction_sequence);
create index independent_card_correction_projections_scoreline_idx
  on app.independent_card_correction_projections(original_scoreline_id, canonical_game_id);
