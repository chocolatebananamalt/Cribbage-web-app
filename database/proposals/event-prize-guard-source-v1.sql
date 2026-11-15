-- LOCAL-TESTED SOURCE FOUNDATION, NOT A MIGRATION OR RELEASE.
-- No RPC writer or trigger attachment is supplied by this file. Applying this
-- alone would not enable prize saves. Do not attach the guard before a reviewed
-- atomic V4-backed writer and recovery reader exist and pass runtime acceptance.
-- Depends on event-settings-transaction-v3.sql and existing private core tables.
begin;
create table app.event_prize_reservations_v1(
 actor_id uuid not null references app.profiles(id),
 operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id),
 nested_operation_id uuid not null,
 request_text text not null check(octet_length(request_text)<=1000000),
 request_payload jsonb not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 reserved_xid bigint not null default txid_current(),
 primary key(actor_id,operation_id),
 unique(actor_id,nested_operation_id),
 unique(actor_id,operation_id,tournament_id),
 check(operation_id<>nested_operation_id),
 check(request_payload=request_text::jsonb),
 check(request_hash=encode(extensions.digest(convert_to(request_text,'utf8'),'sha256'),'hex')),
 check((request_payload->>'kind'='event-prize-settings-setup-v1')is true),
 check((request_payload->>'operationId'=operation_id::text)is true),
 check((request_payload#>>'{setup,setup,request,idempotencyKey}'=nested_operation_id::text)is true),
 check((request_payload#>>'{setup,setup,base,tournamentId}'=tournament_id::text)is true)
);
-- Immutable evidence is sufficient for the compatibility barrier. The complete
-- snapshot/head/outcome schema and writer are still a separate implementation gate.
create table app.event_prize_revision_bindings_v1(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,
 setup_revision_id uuid not null,settings_snapshot_id uuid not null,
 primary key(tournament_id,setup_revision_id),
 foreign key(actor_id,operation_id,tournament_id)
  references app.event_prize_reservations_v1(actor_id,operation_id,tournament_id),
 foreign key(setup_revision_id,tournament_id)
  references app.tournament_setup_revisions(id,tournament_id),
 foreign key(settings_snapshot_id)references app.event_settings_snapshots_v3(id)
);
alter table app.event_prize_reservations_v1 owner to postgres;
alter table app.event_prize_revision_bindings_v1 owner to postgres;
alter table app.event_prize_reservations_v1 enable row level security;
alter table app.event_prize_reservations_v1 force row level security;
alter table app.event_prize_revision_bindings_v1 enable row level security;
alter table app.event_prize_revision_bindings_v1 force row level security;
revoke all on app.event_prize_reservations_v1,app.event_prize_revision_bindings_v1
 from public,anon,authenticated,service_role;
create trigger event_prize_reservations_v1_immutable before update or delete
 on app.event_prize_reservations_v1 for each row execute function app.reject_immutable_history();
create trigger event_prize_revision_bindings_v1_immutable before update or delete
 on app.event_prize_revision_bindings_v1 for each row execute function app.reject_immutable_history();

-- An ID-only foreign key is insufficient: pin the snapshot to this exact
-- tournament/revision and this reservation's nested operation and actor.
create function app.guard_event_prize_binding_source_v1()returns trigger
language plpgsql security definer set search_path=''as $$
begin
 perform 1 from app.event_settings_snapshots_v3 s
 join app.event_prize_reservations_v1 r on r.actor_id=new.actor_id
  and r.operation_id=new.operation_id and r.tournament_id=new.tournament_id
 where s.id=new.settings_snapshot_id and s.tournament_id=new.tournament_id
  and s.setup_revision_id=new.setup_revision_id and s.actor_id=new.actor_id
  and s.operation_id=r.nested_operation_id
 for key share of s,r nowait;
 if not found then raise exception 'event_prize_binding_source_mismatch';end if;
 return new;
end$$;
alter function app.guard_event_prize_binding_source_v1()owner to postgres;
revoke all on function app.guard_event_prize_binding_source_v1()
 from public,anon,authenticated,service_role;
create trigger event_prize_binding_source_v1 before insert
 on app.event_prize_revision_bindings_v1 for each row
 execute function app.guard_event_prize_binding_source_v1();

create function app.guard_event_prize_carry_source_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare receipt app.operation_receipts%rowtype;
 outer_row app.event_prize_reservations_v1%rowtype;
 inner_row app.event_settings_save_reservations_v3%rowtype;
 previous_id uuid;previous_version integer;
begin
 -- No GUC, actor argument, posted null head or presence boolean authorizes carry.
 select * into receipt from app.operation_receipts where id=new.operation_receipt_id
  and tournament_id=new.tournament_id;
 select * into outer_row from app.event_prize_reservations_v1
  where actor_id=new.actor_profile_id and nested_operation_id=receipt.client_operation_id;
 if outer_row.actor_id is null and not exists(
  select 1 from app.event_prize_revision_bindings_v1 where tournament_id=new.tournament_id
 )then return new;end if;
 if outer_row.actor_id is null then raise exception 'event_prize_requires_versioned_save';end if;
 -- The top-level transaction ID cannot be replayed by an older writer in a later
 -- transaction. Only the private future writer may insert this reservation.
 if outer_row.reserved_xid is distinct from txid_current()
 or outer_row.tournament_id is distinct from new.tournament_id
 or auth.uid() is distinct from new.actor_profile_id
 or receipt.actor_profile_id is distinct from new.actor_profile_id
 or receipt.outcome is distinct from 'accepted'
 or receipt.operation_type is distinct from 'save_tournament_setup_version'
 then raise exception 'event_prize_requires_versioned_save';end if;
 perform 1 from app.tournament_roles where tournament_id=new.tournament_id
  and profile_id=new.actor_profile_id and role in('director','co_director')
  order by role for key share nowait;
 if not found then raise exception 'event_prize_requires_director';end if;
 select * into inner_row from app.event_settings_save_reservations_v3
  where actor_id=new.actor_profile_id and operation_id=outer_row.nested_operation_id;
 select id,version into previous_id,previous_version from app.tournament_setup_revisions
  where tournament_id=new.tournament_id order by version desc limit 1;
 if inner_row.actor_id is null
 or inner_row.tournament_id is distinct from new.tournament_id
 or inner_row.request_payload is distinct from outer_row.request_payload->'setup'
 or outer_row.request_payload#>>'{setup,setup,request,expectedVersion}'
    is distinct from(new.version-1)::text
 or outer_row.request_payload#>>'{setup,setup,base,setupVersion}'
    is distinct from coalesce(previous_version,0)::text
 or (outer_row.request_payload#>>'{setup,setup,base,setupRevisionId}')::uuid
    is distinct from previous_id
 or new.version is distinct from coalesce(previous_version,0)+1
 then raise exception 'event_prize_requires_exact_nested_save';end if;
 return new;
end$$;
alter function app.guard_event_prize_carry_source_v1()owner to postgres;
revoke all on function app.guard_event_prize_carry_source_v1()
 from public,anon,authenticated,service_role;
-- INTENTIONALLY NO TRIGGER ATTACHMENT TO tournament_setup_revisions.
-- Future writer must acquire both operation advisory locks in consistent order
-- BEFORE the tournament lock; require a fresh nested reservation; reserve outer;
-- call V4 within a savepoint; validate its exact ACK; insert snapshot/binding and
-- CAS head; journal; commit. A rejected nested JSON reply must RAISE within the
-- savepoint. Lock/retry/error paths must never return a fabricated accepted ACK.
commit;
