-- Private persistence for the witnessed roster-account activation ceremony.
-- Raw activation values and identity search fields are deliberately absent.

create table app.roster_account_activations (
  id uuid primary key,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  roster_entry_id uuid not null,
  issued_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  token_salt bytea not null check (octet_length(token_salt) = 32),
  token_digest bytea not null check (octet_length(token_digest) = 32),
  state text not null check (state in ('issued', 'pending', 'cancelled', 'rejected', 'approved', 'expired')),
  expires_at timestamptz not null,
  issued_at timestamptz not null default now(),
  terminal_at timestamptz,
  foreign key (roster_entry_id, tournament_id)
    references app.tournament_roster_entries(id, tournament_id) on delete restrict,
  unique (id, tournament_id),
  check (expires_at > issued_at),
  check ((state in ('issued', 'pending') and terminal_at is null) or (state not in ('issued', 'pending') and terminal_at is not null))
);

create unique index roster_account_activations_one_live_roster_idx
  on app.roster_account_activations(tournament_id, roster_entry_id)
  where state in ('issued', 'pending');
create index roster_account_activations_expiry_idx
  on app.roster_account_activations(expires_at) where state in ('issued', 'pending');
create index roster_account_activations_roster_tournament_idx
  on app.roster_account_activations(roster_entry_id, tournament_id);

create table app.roster_account_activation_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  activation_id uuid not null,
  profile_id uuid not null references app.profiles(id) on delete restrict,
  -- Generated when the player requests the link. Approval reuses this distinct
  -- internal operation ID, never the director's approval-operation ID.
  link_operation_id uuid not null default extensions.gen_random_uuid() unique,
  confirmation_phrase text not null check (confirmation_phrase ~ '^[A-Z]{4}-[A-Z]{4}$'),
  state text not null check (state in ('pending', 'rejected', 'approved')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (activation_id, tournament_id)
    references app.roster_account_activations(id, tournament_id) on delete restrict,
  unique (activation_id),
  check ((state = 'pending' and resolved_at is null) or (state <> 'pending' and resolved_at is not null))
);
create index roster_account_activation_requests_activation_tournament_idx
  on app.roster_account_activation_requests(activation_id, tournament_id);
-- A rejected or expired witnessed request must not permanently lock a profile
-- out of a later activation. Only a live request is unique per tournament.
create unique index roster_account_activation_requests_one_live_profile_idx
  on app.roster_account_activation_requests(tournament_id, profile_id)
  where state = 'pending';

create table app.roster_account_activation_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  activation_id uuid not null,
  request_id uuid,
  actor_profile_id uuid references app.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('issued', 'requested', 'cancelled', 'rejected', 'approved', 'expired')),
  operation_receipt_id uuid,
  created_at timestamptz not null default now(),
  foreign key (activation_id, tournament_id)
    references app.roster_account_activations(id, tournament_id) on delete restrict,
  foreign key (request_id) references app.roster_account_activation_requests(id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict
);
create index roster_account_activation_events_activation_tournament_idx
  on app.roster_account_activation_events(activation_id, tournament_id, created_at);
create index roster_account_activation_events_receipt_tournament_idx
  on app.roster_account_activation_events(operation_receipt_id, tournament_id);

do $$ declare table_name text;
begin
  foreach table_name in array array['roster_account_activations', 'roster_account_activation_requests', 'roster_account_activation_events'] loop
    execute format('alter table app.%I enable row level security', table_name);
    execute format('alter table app.%I force row level security', table_name);
    execute format('revoke all on table app.%I from public, anon, authenticated', table_name);
  end loop;
end $$;

create trigger roster_account_activation_events_immutable
before update or delete on app.roster_account_activation_events
for each row execute function app.reject_immutable_history();
