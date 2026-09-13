-- Private, append-only tournament setup drafts. These rows are deliberately
-- separate from operational app.events, rulesets, scores, finance, and results.

create table app.tournament_setup_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  version integer not null check (version > 0),
  tournament_name text not null check (length(trim(tournament_name)) between 1 and 200),
  city text not null check (length(trim(city)) between 1 and 160),
  venue text not null check (length(trim(venue)) between 1 and 240),
  starts_at timestamp not null,
  ends_at timestamp not null,
  timezone_name text not null check (length(timezone_name) between 1 and 128),
  contact_details text not null default '' check (length(contact_details) <= 1000),
  sanctioning_fee_cents integer check (sanctioning_fee_cents between 0 and 100000000),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (tournament_id, version),
  unique (id, tournament_id),
  check (ends_at >= starts_at)
);
alter table app.tournament_setup_revisions enable row level security;
alter table app.tournament_setup_revisions force row level security;
revoke all on table app.tournament_setup_revisions from public, anon, authenticated;
create trigger tournament_setup_revisions_immutable before update or delete on app.tournament_setup_revisions
for each row execute function app.reject_immutable_history();
create index tournament_setup_revisions_actor_profile_id_idx on app.tournament_setup_revisions(actor_profile_id);
create index tournament_setup_revisions_operation_receipt_id_idx on app.tournament_setup_revisions(operation_receipt_id);

create table app.tournament_setup_official_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null,
  setup_revision_id uuid not null,
  profile_id uuid not null references app.profiles(id) on delete restrict,
  role text not null check (role in ('director', 'co_director')),
  foreign key (setup_revision_id, tournament_id)
    references app.tournament_setup_revisions(id, tournament_id) on delete restrict,
  unique (setup_revision_id, profile_id),
  unique (setup_revision_id, role, profile_id)
);
alter table app.tournament_setup_official_versions enable row level security;
alter table app.tournament_setup_official_versions force row level security;
revoke all on table app.tournament_setup_official_versions from public, anon, authenticated;
create trigger tournament_setup_official_versions_immutable before update or delete on app.tournament_setup_official_versions
for each row execute function app.reject_immutable_history();
create index tournament_setup_official_versions_profile_id_idx on app.tournament_setup_official_versions(profile_id);

create table app.tournament_setup_event_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null,
  setup_revision_id uuid not null,
  client_row_id uuid not null,
  ordinal smallint not null check (ordinal between 1 and 32),
  event_kind text not null check (event_kind in ('main', 'consolation', 'satellite', 'custom')),
  display_name text not null check (length(trim(display_name)) between 1 and 200),
  starts_at timestamp not null,
  timezone_name text not null check (length(timezone_name) between 1 and 128),
  style_code text not null check (length(trim(style_code)) between 1 and 160),
  format_code text not null check (format_code in ('standard_singles', 'team', 'doubles', 'canadian_doubles', 'custom')),
  game_count smallint not null check (game_count between 1 and 99),
  entry_fee_cents integer not null check (entry_fee_cents between 0 and 100000000),
  fee_includes_note text not null default '' check (length(fee_includes_note) <= 1000),
  payout_note text not null default '' check (length(payout_note) <= 2000),
  eligibility_note text not null default '' check (length(eligibility_note) <= 2000),
  muggins_status text not null check (muggins_status in ('unset', 'in_effect', 'not_in_effect')),
  source_status text not null default 'director_configured_unverified'
    check (source_status = 'director_configured_unverified'),
  foreign key (setup_revision_id, tournament_id)
    references app.tournament_setup_revisions(id, tournament_id) on delete restrict,
  unique (setup_revision_id, client_row_id),
  unique (setup_revision_id, ordinal),
  unique (setup_revision_id, display_name),
  unique (id, tournament_id, setup_revision_id)
);
alter table app.tournament_setup_event_versions enable row level security;
alter table app.tournament_setup_event_versions force row level security;
revoke all on table app.tournament_setup_event_versions from public, anon, authenticated;
create trigger tournament_setup_event_versions_immutable before update or delete on app.tournament_setup_event_versions
for each row execute function app.reject_immutable_history();
create unique index tournament_setup_event_versions_one_main_idx
  on app.tournament_setup_event_versions(setup_revision_id) where event_kind='main';
create unique index tournament_setup_event_versions_one_consolation_idx
  on app.tournament_setup_event_versions(setup_revision_id) where event_kind='consolation';
create index tournament_setup_event_versions_tournament_id_idx on app.tournament_setup_event_versions(tournament_id);

create table app.tournament_setup_q_pool_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null,
  setup_revision_id uuid not null,
  setup_event_version_id uuid not null,
  slot smallint not null check (slot in (1, 2)),
  pool_type_code text not null check (length(trim(pool_type_code)) between 1 and 160),
  entry_fee_cents integer not null check (entry_fee_cents between 0 and 100000000),
  note text not null default '' check (length(note) <= 1000),
  source_status text not null default 'director_configured_unverified'
    check (source_status = 'director_configured_unverified'),
  foreign key (setup_event_version_id, tournament_id, setup_revision_id)
    references app.tournament_setup_event_versions(id, tournament_id, setup_revision_id) on delete restrict,
  unique (setup_event_version_id, slot)
);
alter table app.tournament_setup_q_pool_versions enable row level security;
alter table app.tournament_setup_q_pool_versions force row level security;
revoke all on table app.tournament_setup_q_pool_versions from public, anon, authenticated;
create trigger tournament_setup_q_pool_versions_immutable before update or delete on app.tournament_setup_q_pool_versions
for each row execute function app.reject_immutable_history();
create index tournament_setup_q_pool_versions_tournament_id_idx on app.tournament_setup_q_pool_versions(tournament_id);

create or replace function app.assert_tournament_setup_official_set_for_revision(
  p_setup_revision_id uuid, p_tournament_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_director uuid; v_director_count integer; v_co_director_count integer;
begin
  select director_profile_id into v_director from app.tournaments
  where id=p_tournament_id;
  select count(*) into v_director_count from app.tournament_setup_official_versions
  where setup_revision_id=p_setup_revision_id and role='director';
  select count(*) into v_co_director_count from app.tournament_setup_official_versions
  where setup_revision_id=p_setup_revision_id and role='co_director';
  if v_director_count <> 1 or v_co_director_count > 2 then
    raise exception using errcode='P0001', message='invalid setup official count';
  end if;
  if not exists(
    select 1 from app.tournament_setup_official_versions o
    where o.setup_revision_id=p_setup_revision_id and o.role='director'
      and o.profile_id=v_director
  ) then
    raise exception using errcode='P0001', message='setup director must match tournament director';
  end if;
  if exists(
    select 1 from app.tournament_setup_official_versions o
    where o.setup_revision_id=p_setup_revision_id
      and not exists(
        select 1 from app.tournament_roles r
        where r.tournament_id=o.tournament_id and r.profile_id=o.profile_id
          and r.role=o.role
      )
  ) then
    raise exception using errcode='P0001', message='setup official role unavailable';
  end if;
end; $$;
revoke all on function app.assert_tournament_setup_official_set_for_revision(uuid, uuid) from public, anon, authenticated;

create or replace function app.assert_tournament_setup_official_set() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_tournament_setup_official_set_for_revision(
    new.setup_revision_id, new.tournament_id
  );
  return new;
end; $$;
revoke all on function app.assert_tournament_setup_official_set() from public, anon, authenticated;
create constraint trigger tournament_setup_official_set_guard
after insert on app.tournament_setup_official_versions
deferrable initially deferred for each row execute function app.assert_tournament_setup_official_set();

create or replace function app.assert_tournament_setup_revision_official_set() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_tournament_setup_official_set_for_revision(new.id, new.tournament_id);
  return new;
end; $$;
revoke all on function app.assert_tournament_setup_revision_official_set() from public, anon, authenticated;
create constraint trigger tournament_setup_revision_official_set_guard
after insert on app.tournament_setup_revisions
deferrable initially deferred for each row execute function app.assert_tournament_setup_revision_official_set();

create or replace function app.assert_tournament_setup_q_pool_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_kind text;
begin
  select event_kind into v_kind from app.tournament_setup_event_versions
  where id=new.setup_event_version_id and tournament_id=new.tournament_id
    and setup_revision_id=new.setup_revision_id;
  if v_kind not in ('main', 'consolation') then
    raise exception using errcode='P0001', message='q pools require main or consolation setup event';
  end if;
  return new;
end; $$;
revoke all on function app.assert_tournament_setup_q_pool_parent() from public, anon, authenticated;
create trigger tournament_setup_q_pool_parent_guard before insert on app.tournament_setup_q_pool_versions
for each row execute function app.assert_tournament_setup_q_pool_parent();

create table app.tournament_setup_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  expected_version integer not null check (expected_version >= 0),
  attempted_idempotency_key uuid not null,
  attempted_request_hash text not null,
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now()
);
alter table app.tournament_setup_operation_conflicts enable row level security;
alter table app.tournament_setup_operation_conflicts force row level security;
revoke all on table app.tournament_setup_operation_conflicts from public, anon, authenticated;
create trigger tournament_setup_operation_conflicts_immutable before update or delete on app.tournament_setup_operation_conflicts
for each row execute function app.reject_immutable_history();
create index tournament_setup_operation_conflicts_actor_profile_id_idx on app.tournament_setup_operation_conflicts(actor_profile_id);
create index tournament_setup_operation_conflicts_tournament_id_idx on app.tournament_setup_operation_conflicts(tournament_id);
create index tournament_setup_operation_conflicts_prior_receipt_id_idx on app.tournament_setup_operation_conflicts(prior_receipt_id);

alter table app.operation_receipts
  add constraint operation_receipts_id_tournament_actor_key unique (id, tournament_id, actor_profile_id);
alter table app.tournament_setup_revisions
  add constraint tournament_setup_revisions_receipt_actor_scope_fkey
  foreign key (operation_receipt_id, tournament_id, actor_profile_id)
  references app.operation_receipts(id, tournament_id, actor_profile_id) on delete restrict;
alter table app.tournament_setup_operation_conflicts
  add constraint tournament_setup_operation_conflicts_prior_receipt_scope_fkey
  foreign key (prior_receipt_id, tournament_id, actor_profile_id)
  references app.operation_receipts(id, tournament_id, actor_profile_id) on delete restrict;
