-- LOCAL DDL PROPOSAL ONLY. Not an installed migration; no API/writer/grants supplied.
-- Backend must reconcile real catalog, transaction/role/audit contracts before promotion.
-- Ends ROLLBACK intentionally: do not turn into an installer by deleting it casually.
begin;
alter table app.tournament_roster_entries add constraint roster_identity_scope_v1 unique(id,tournament_id);
create table app.player_identity_subjects_v1 (
 id uuid primary key default extensions.gen_random_uuid(),
 created_by uuid not null references app.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create table app.roster_identity_facts_v1 (
 id uuid primary key default extensions.gen_random_uuid(),
 player_identity_id uuid not null references app.player_identity_subjects_v1(id) on delete restrict,
 tournament_id uuid not null references app.tournaments(id) on delete restrict,
 roster_entry_id uuid not null,
 actor_id uuid not null references app.profiles(id) on delete restrict,
 operation_id uuid not null,
 identity_version integer not null check(identity_version>0),
 first_name text not null check(length(trim(first_name)) between 1 and 80),
 last_name text not null check(length(trim(last_name)) between 1 and 80),
 email text not null default '' check(length(email)<=320),
 city text not null default '' check(length(city)<=160),
 state text not null default '' check(length(state)<=80),
 acc_number text not null default '' check(acc_number='' or (acc_number like 'ZZ%' and acc_number~'^ZZ[0-9]{4}$') or (acc_number not like 'ZZ%' and acc_number~'^[A-Z]{2}[0-9]+Y?$')),
 nonmember_without_number boolean not null,
 joining_claim_status text not null check(joining_claim_status in('none','claimed_pending')),
 joining_claim_reference text not null default '' check(length(joining_claim_reference)<=500),
 request_digest text not null check(request_digest~'^[0-9a-f]{64}$'),
 recorded_at timestamptz not null default now(),
 foreign key(roster_entry_id,tournament_id) references app.tournament_roster_entries(id,tournament_id) on delete restrict,
 unique(tournament_id,actor_id,operation_id),
 unique(player_identity_id,tournament_id,roster_entry_id,identity_version),
 unique(tournament_id,roster_entry_id,identity_version),
 check(not nonmember_without_number or acc_number=''),
 check(joining_claim_status<>'none' or joining_claim_reference=''),
 check(length(trim(first_name)||' '||trim(last_name))<=160)
);
-- Lifetime registry: records ACC-supplied assignment evidence, NEVER allocates ZZ numbers.
create table app.acc_zz_assignments_v1 (
 id uuid primary key default extensions.gen_random_uuid(),
 player_identity_id uuid not null references app.player_identity_subjects_v1(id) on delete restrict,
 zz_number text not null unique check(zz_number~'^ZZ[0-9]{4}$'),
 evidence_reference text not null check(length(trim(evidence_reference)) between 1 and 500),
 recorded_by uuid not null references app.profiles(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(id,player_identity_id)
);
create index acc_zz_subject_v1 on app.acc_zz_assignments_v1(player_identity_id);
-- Retirement retains assignment forever; pending same-day joining does not retire it.
create table app.acc_zz_retirements_v1 (
 assignment_id uuid primary key,
 player_identity_id uuid not null,
 evidence_reference text not null check(length(trim(evidence_reference)) between 1 and 500),
 recorded_by uuid not null references app.profiles(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 foreign key(assignment_id,player_identity_id) references app.acc_zz_assignments_v1(id,player_identity_id) on delete restrict
);
create index roster_identity_subject_v1 on app.roster_identity_facts_v1(player_identity_id);
create index roster_identity_roster_v1 on app.roster_identity_facts_v1(roster_entry_id,tournament_id,identity_version desc);
-- Every row is append-only; existing app immutable trigger is reused, no update bypass.
create trigger player_identity_subjects_immutable before update or delete on app.player_identity_subjects_v1 for each row execute function app.reject_immutable_history();
create trigger roster_identity_facts_immutable before update or delete on app.roster_identity_facts_v1 for each row execute function app.reject_immutable_history();
create trigger acc_zz_assignments_immutable before update or delete on app.acc_zz_assignments_v1 for each row execute function app.reject_immutable_history();
create trigger acc_zz_retirements_immutable before update or delete on app.acc_zz_retirements_v1 for each row execute function app.reject_immutable_history();
alter table app.player_identity_subjects_v1 enable row level security;
alter table app.player_identity_subjects_v1 force row level security;
alter table app.roster_identity_facts_v1 enable row level security;
alter table app.roster_identity_facts_v1 force row level security;
alter table app.acc_zz_assignments_v1 enable row level security;
alter table app.acc_zz_assignments_v1 force row level security;
alter table app.acc_zz_retirements_v1 enable row level security;
alter table app.acc_zz_retirements_v1 force row level security;
revoke all on app.player_identity_subjects_v1,app.roster_identity_facts_v1,app.acc_zz_assignments_v1,app.acc_zz_retirements_v1 from public,anon,authenticated,service_role;
-- NO table policies, PUBLIC functions, EXECUTE grants, membership awards or identifier generator.
create trigger player_identity_subjects_no_truncate before truncate on app.player_identity_subjects_v1 for each statement execute function app.reject_immutable_history();
create trigger roster_identity_facts_no_truncate before truncate on app.roster_identity_facts_v1 for each statement execute function app.reject_immutable_history();
create trigger acc_zz_assignments_no_truncate before truncate on app.acc_zz_assignments_v1 for each statement execute function app.reject_immutable_history();
create trigger acc_zz_retirements_no_truncate before truncate on app.acc_zz_retirements_v1 for each statement execute function app.reject_immutable_history();
rollback;
