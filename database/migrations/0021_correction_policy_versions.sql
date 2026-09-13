-- Versioned correction policy is append-only. A correction snapshots its policy
-- so later director changes cannot change a proposal already under review.
create table app.correction_policy_versions (
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  version integer not null check (version >= 0),
  reason_required boolean not null default false,
  required_approvals smallint not null default 0 check (required_approvals between 0 and 1),
  created_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (tournament_id, version)
);

alter table app.correction_policy_versions enable row level security;
alter table app.correction_policy_versions force row level security;
revoke all on table app.correction_policy_versions from public, anon, authenticated;
create trigger correction_policy_versions_immutable before update or delete on app.correction_policy_versions
for each row execute function app.reject_immutable_history();

insert into app.correction_policy_versions(tournament_id, version, reason_required, required_approvals, created_by_profile_id)
select t.id, 0, false, 0, t.director_profile_id from app.tournaments t
on conflict (tournament_id, version) do nothing;

create or replace function app.provision_default_correction_policy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into app.correction_policy_versions(tournament_id, version, reason_required, required_approvals, created_by_profile_id)
  values (new.id, 0, false, 0, new.director_profile_id);
  return new;
end;
$$;
revoke all on function app.provision_default_correction_policy() from public, anon, authenticated;
drop trigger if exists provision_default_correction_policy on app.tournaments;
create trigger provision_default_correction_policy after insert on app.tournaments
for each row execute function app.provision_default_correction_policy();

alter table app.game_corrections
  add constraint game_corrections_policy_version_fk
  foreign key (tournament_id, policy_version)
  references app.correction_policy_versions(tournament_id, version) on delete restrict;

create index correction_policy_versions_tournament_version_idx
  on app.correction_policy_versions(tournament_id, version desc);
