-- UNAPPLIED INTERNAL SQL PROPOSAL. Requires reconciled v1 subjects/schema and reviewed writers.
-- No public API, actor grants or backfill. Deliberate ROLLBACK.
begin;
create table app.tournament_temporary_id_counters_v1 (
 tournament_id uuid primary key references app.tournaments(id) on delete restrict,
 next_ordinal bigint not null default 1 check(next_ordinal between 1 and 2147483648)
);
create table app.tournament_temporary_player_ids_v1 (
 tournament_id uuid not null references app.tournaments(id) on delete restrict,
 player_identity_id uuid not null references app.player_identity_subjects_v1(id) on delete restrict,
 ordinal integer not null check(ordinal>0),
 allocated_at timestamptz not null default now(),
 primary key(tournament_id,player_identity_id),
 unique(tournament_id,ordinal)
);
create index tournament_temporary_subject_v1 on app.tournament_temporary_player_ids_v1(player_identity_id);
create function app.temporary_id_counter_monotone_v1() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.tournament_id<>old.tournament_id or new.next_ordinal<>old.next_ordinal+1 then raise exception 'temporary counter cannot reset or skip';end if;
 return new;
end $$;
revoke all on function app.temporary_id_counter_monotone_v1() from public,anon,authenticated,service_role;
create trigger temporary_counter_monotone before update on app.tournament_temporary_id_counters_v1 for each row execute function app.temporary_id_counter_monotone_v1();
create trigger temporary_counter_no_delete before delete on app.tournament_temporary_id_counters_v1 for each row execute function app.reject_immutable_history();
create trigger temporary_counter_no_truncate before truncate on app.tournament_temporary_id_counters_v1 for each statement execute function app.reject_immutable_history();
create trigger temporary_assignment_immutable before update or delete on app.tournament_temporary_player_ids_v1 for each row execute function app.reject_immutable_history();
create trigger temporary_assignment_no_truncate before truncate on app.tournament_temporary_player_ids_v1 for each statement execute function app.reject_immutable_history();
alter table app.tournament_temporary_id_counters_v1 enable row level security;
alter table app.tournament_temporary_id_counters_v1 force row level security;
alter table app.tournament_temporary_player_ids_v1 enable row level security;
alter table app.tournament_temporary_player_ids_v1 force row level security;
revoke all on app.tournament_temporary_id_counters_v1,app.tournament_temporary_player_ids_v1 from public,anon,authenticated,service_role;
-- Call ONLY inside approved roster/profile writer after live actor/session/role checks.
-- Outer writer checks exact operation receipt/digest before allocating or mutable intake gates.
-- Both roster/fact/receipt and this counter assignment must commit/rollback together.
create function app.allocate_tournament_temporary_id_v1(p_tournament_id uuid,p_player_identity_id uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_next bigint;v_existing integer;
begin
 if p_tournament_id is null or p_player_identity_id is null then raise exception 'invalid temporary identity scope';end if;
 insert into app.tournament_temporary_id_counters_v1(tournament_id) values(p_tournament_id) on conflict(tournament_id) do nothing;
 select next_ordinal into strict v_next from app.tournament_temporary_id_counters_v1 where tournament_id=p_tournament_id for update;
 -- Recheck under the SAME tournament counter lock: concurrent same-profile retries do not consume numbers.
 select ordinal into v_existing from app.tournament_temporary_player_ids_v1 where tournament_id=p_tournament_id and player_identity_id=p_player_identity_id;
 if found then return v_existing;end if;
 if v_next>2147483647 then raise exception 'temporary identity capacity exhausted';end if;
 update app.tournament_temporary_id_counters_v1 set next_ordinal=next_ordinal+1 where tournament_id=p_tournament_id;
 insert into app.tournament_temporary_player_ids_v1(tournament_id,player_identity_id,ordinal) values(p_tournament_id,p_player_identity_id,v_next::integer);
 return v_next::integer;
end $$;
revoke all on function app.allocate_tournament_temporary_id_v1(uuid,uuid) from public,anon,authenticated,service_role;
-- Private desk differentiation is separate from scorecard/export facts. No birthdate column.
create table app.player_identity_desk_notes_v1 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id) on delete restrict,
 player_identity_id uuid not null references app.player_identity_subjects_v1(id) on delete restrict,
 operation_id uuid not null,
 actor_id uuid not null references app.profiles(id) on delete restrict,
 note text not null check(length(note)<=500),
 recorded_at timestamptz not null default now(),
 unique(tournament_id,actor_id,operation_id)
);
create index player_identity_desk_subject_v1 on app.player_identity_desk_notes_v1(player_identity_id,tournament_id);
create trigger player_identity_desk_immutable before update or delete on app.player_identity_desk_notes_v1 for each row execute function app.reject_immutable_history();
create trigger player_identity_desk_no_truncate before truncate on app.player_identity_desk_notes_v1 for each statement execute function app.reject_immutable_history();
alter table app.player_identity_desk_notes_v1 enable row level security;
alter table app.player_identity_desk_notes_v1 force row level security;
revoke all on app.player_identity_desk_notes_v1 from public,anon,authenticated,service_role;
alter table app.roster_identity_facts_v1 add column display_suffix text not null default '' check(length(display_suffix)<=80);
alter table app.roster_identity_facts_v1 add constraint identity_fact_subject_scope_v2 unique(id,player_identity_id);
create table app.acc_issued_reference_facts_v2 (
 id uuid primary key default extensions.gen_random_uuid(),
 identity_fact_id uuid not null unique,
 player_identity_id uuid not null,
 acc_number text not null check((acc_number like 'ZZ%' and acc_number~'^ZZ[0-9]{4}$') or (acc_number not like 'ZZ%' and acc_number~'^[A-Z]{2}[0-9]+Y?$')),
 evidence_reference text not null check(length(trim(evidence_reference)) between 1 and 500),
 recorded_by uuid not null references app.profiles(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 foreign key(identity_fact_id,player_identity_id) references app.roster_identity_facts_v1(id,player_identity_id) on delete restrict
);
create index acc_issued_subject_v2 on app.acc_issued_reference_facts_v2(player_identity_id);
create trigger acc_issued_reference_immutable before update or delete on app.acc_issued_reference_facts_v2 for each row execute function app.reject_immutable_history();
create trigger acc_issued_reference_no_truncate before truncate on app.acc_issued_reference_facts_v2 for each statement execute function app.reject_immutable_history();
alter table app.acc_issued_reference_facts_v2 enable row level security;
alter table app.acc_issued_reference_facts_v2 force row level security;
revoke all on app.acc_issued_reference_facts_v2 from public,anon,authenticated,service_role;
-- Reader MUST verify matching current fact version/operation/number, unretired reference,
-- authorized viewer and subject; historical/retired evidence must not become current export.
rollback;
