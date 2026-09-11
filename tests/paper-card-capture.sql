-- Rollback-only integration fixture for migration 0109. Execute after the
-- migration SQL in the same transaction on the isolated synthetic backend.

begin;

create temporary table paper_card_capture_test_results (
  label text primary key,
  result jsonb not null
) on commit drop;
grant select, insert on paper_card_capture_test_results to service_role;

insert into auth.users(id, email)
values
  ('a2000000-0000-4000-8000-000000000001', 'paper-director@test.invalid'),
  ('a2000000-0000-4000-8000-000000000002', 'paper-co-director@test.invalid'),
  ('a2000000-0000-4000-8000-000000000003', 'paper-cross-checker@test.invalid'),
  ('a2000000-0000-4000-8000-000000000004', 'paper-player-a@test.invalid'),
  ('a2000000-0000-4000-8000-000000000005', 'paper-player-b@test.invalid'),
  ('a2000000-0000-4000-8000-000000000006', 'paper-outsider@test.invalid');

insert into app.tournaments(id, director_profile_id, name, status, registration_status)
values
  ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Synthetic Paper Capture', 'open', 'closed'),
  ('b2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000003', 'Synthetic Other Tournament', 'open', 'closed');

insert into app.tournament_roles(tournament_id, profile_id, role)
values
  ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'director'),
  ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'co_director'),
  ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003', 'cross_checker'),
  ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 'cross_checker'),
  ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000006', 'viewer'),
  ('b2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000003', 'cross_checker');

insert into app.operation_receipts(
  id, tournament_id, actor_profile_id, operation_type, target_id,
  request_hash, client_operation_id, outcome, response_payload, applied_at
) values (
  'c2000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'synthetic_paper_capture_fixture',
  'b2000000-0000-4000-8000-000000000001',
  repeat('1', 64),
  'c2000000-0000-4000-8000-000000000002',
  'accepted',
  '{}'::jsonb,
  now()
);

insert into app.tournament_registration_links(
  id, tournament_id, token_hash, created_by_profile_id, enabled, lifecycle_state
) values (
  'd2000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  repeat('2', 64),
  'a2000000-0000-4000-8000-000000000001',
  false,
  'retired'
);

insert into app.registration_claims(
  id, tournament_id, registration_link_id, display_name, normalized_name,
  email, normalized_email, intended_payment_method, status,
  client_operation_id, request_fingerprint
) values
  ('e2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Synthetic Player A', 'synthetic player a', 'paper-player-a@test.invalid', 'paper-player-a@test.invalid', 'unspecified', 'accepted', 'e2000000-0000-4000-8000-000000000011', repeat('3', 64)),
  ('e2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Synthetic Player B', 'synthetic player b', 'paper-player-b@test.invalid', 'paper-player-b@test.invalid', 'unspecified', 'accepted', 'e2000000-0000-4000-8000-000000000012', repeat('4', 64));

insert into app.registration_claim_decisions(
  id, tournament_id, claim_id, decision, actor_profile_id, operation_receipt_id
) values
  ('f2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'approved_for_roster', 'a2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001'),
  ('f2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002', 'approved_for_roster', 'a2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001');

insert into app.tournament_roster_entries(
  id, tournament_id, source_claim_id, approval_decision_id,
  claimed_display_name, claimed_normalized_name, claimed_email,
  claimed_normalized_email, creator_profile_id, operation_receipt_id
) values
  ('f2100000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'Synthetic Player A', 'synthetic player a', 'paper-player-a@test.invalid', 'paper-player-a@test.invalid', 'a2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001'),
  ('f2100000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000002', 'Synthetic Player B', 'synthetic player b', 'paper-player-b@test.invalid', 'paper-player-b@test.invalid', 'a2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001');

insert into app.roster_account_links(
  id, tournament_id, roster_entry_id, profile_id, actor_profile_id, operation_receipt_id
) values
  ('f2200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'f2100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001'),
  ('f2200000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'f2100000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001');

insert into app.initial_seating_publications(
  id, tournament_id, table_count, seats_per_table, actor_profile_id, operation_receipt_id
) values (
  'f2300000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
  2, 4, 'a2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001'
);
insert into app.initial_seating_assignments(
  id, publication_id, tournament_id, roster_entry_id, initial_table_seat
) values
  ('f2400000-0000-4000-8000-000000000001', 'f2300000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'f2100000-0000-4000-8000-000000000001', 'A-7'),
  ('f2400000-0000-4000-8000-000000000002', 'f2300000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'f2100000-0000-4000-8000-000000000002', 'B-9');

insert into app.ruleset_versions(id, tournament_id, name, format, source_reference, approved_at)
values ('f2500000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Synthetic sourced scoring core', 'standard_singles', 'synthetic fixture only', now());
insert into app.events(id, tournament_id, ruleset_version_id, name, event_type, format, scoring_method)
values ('f2600000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'f2500000-0000-4000-8000-000000000001', 'Synthetic Main', 'main', 'standard_singles', 'digital');
insert into app.rounds(id, tournament_id, event_id, round_number)
values ('f2700000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'f2600000-0000-4000-8000-000000000001', 1);
insert into app.event_participants(id, tournament_id, event_id, profile_id, status)
values
  ('f2800000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'f2600000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 'checked_in'),
  ('f2800000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'f2600000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000005', 'checked_in');
insert into app.canonical_games(
  id, tournament_id, event_id, round_id, side_a_participant_id,
  side_b_participant_id, side_a_table_seat_snapshot, side_b_table_seat_snapshot
) values (
  'f2900000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
  'f2600000-0000-4000-8000-000000000001', 'f2700000-0000-4000-8000-000000000001',
  'f2800000-0000-4000-8000-000000000001', 'f2800000-0000-4000-8000-000000000002',
  'C-1', 'C-2'
);

set local role service_role;

insert into paper_card_capture_test_results(label, result)
select 'cross_checker', public.create_paper_card_capture_v1(
  'a2000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001',
  'f2900000-0000-4000-8000-000000000001', 'a', 'A-7', 'camera', 'card-a-7.jpg',
  'image/jpeg', 123456, repeat('a', 64), '2026-09-10T09:15:00-10:00',
  '91000000-0000-4000-8000-000000000001'
);
insert into paper_card_capture_test_results(label, result)
select 'exact_replay', public.create_paper_card_capture_v1(
  'a2000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001',
  'f2900000-0000-4000-8000-000000000001', 'a', 'A-7', 'camera', 'card-a-7.jpg',
  'image/jpeg', 123456, repeat('a', 64), '2026-09-10T09:15:00-10:00',
  '91000000-0000-4000-8000-000000000001'
);
insert into paper_card_capture_test_results(label, result)
select 'changed_retry', public.create_paper_card_capture_v1(
  'a2000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001',
  'f2900000-0000-4000-8000-000000000001', 'a', 'A-7', 'camera', 'changed.jpg',
  'image/jpeg', 123456, repeat('a', 64), '2026-09-10T09:15:00-10:00',
  '91000000-0000-4000-8000-000000000001'
);
insert into paper_card_capture_test_results(label, result)
select 'director', public.create_paper_card_capture_v1(
  'a2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
  'f2900000-0000-4000-8000-000000000001', 'b', 'B-9', 'file_upload', 'card-b-9.png',
  'image/png', 234567, repeat('b', 64), null,
  '91000000-0000-4000-8000-000000000002'
);
insert into paper_card_capture_test_results(label, result)
select 'co_director', public.create_paper_card_capture_v1(
  'a2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001',
  'f2900000-0000-4000-8000-000000000001', 'a', 'A-7', 'camera', 'second-card-a-7.jpg',
  'image/jpeg', 345678, repeat('c', 64), null,
  '91000000-0000-4000-8000-000000000003'
);
insert into paper_card_capture_test_results(label, result)
select 'self_capture', public.create_paper_card_capture_v1(
  'a2000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000001',
  'f2900000-0000-4000-8000-000000000001', 'a', 'A-7', 'camera', 'self.jpg',
  'image/jpeg', 456789, repeat('d', 64), null,
  '91000000-0000-4000-8000-000000000004'
);
insert into paper_card_capture_test_results(label, result)
select 'exact_rejected_replay', public.create_paper_card_capture_v1(
  'a2000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000001',
  'f2900000-0000-4000-8000-000000000001', 'a', 'A-7', 'camera', 'self.jpg',
  'image/jpeg', 456789, repeat('d', 64), null,
  '91000000-0000-4000-8000-000000000004'
);
insert into paper_card_capture_test_results(label, result)
select 'verification_mismatch', public.create_paper_card_capture_v1(
  'a2000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001',
  'f2900000-0000-4000-8000-000000000001', 'a', 'B-9', 'camera', 'wrong-id.jpg',
  'image/jpeg', 567890, repeat('e', 64), null,
  '91000000-0000-4000-8000-000000000005'
);
insert into paper_card_capture_test_results(label, result)
select 'cross_tournament', public.create_paper_card_capture_v1(
  'a2000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000002',
  'f2900000-0000-4000-8000-000000000001', 'a', 'A-7', 'camera', 'cross-tournament.jpg',
  'image/jpeg', 678901, repeat('f', 64), null,
  '91000000-0000-4000-8000-000000000006'
);
insert into paper_card_capture_test_results(label, result)
select 'outsider', public.create_paper_card_capture_v1(
  'a2000000-0000-4000-8000-000000000006', 'b2000000-0000-4000-8000-000000000001',
  'f2900000-0000-4000-8000-000000000001', 'a', 'A-7', 'camera', 'outsider.jpg',
  'image/jpeg', 789012, repeat('0', 64), null,
  '91000000-0000-4000-8000-000000000007'
);

reset role;

do $$
declare
  v_capture jsonb;
begin
  select result into v_capture from paper_card_capture_test_results where label = 'cross_checker';
  if v_capture->>'status' <> 'paper_card_capture_created'
     or (select result from paper_card_capture_test_results where label = 'exact_replay') <> v_capture then
    raise exception 'cross-checker capture or exact replay failed';
  end if;
  if (select result->>'code' from paper_card_capture_test_results where label = 'director') <> 'not_capture_official'
     or (select result->>'code' from paper_card_capture_test_results where label = 'co_director') <> 'not_capture_official' then
    raise exception 'director or co-director received cross-checker capture authority';
  end if;
  if (select result->>'code' from paper_card_capture_test_results where label = 'changed_retry') <> 'idempotency_conflict'
     or (select result->>'code' from paper_card_capture_test_results where label = 'self_capture') <> 'self_capture_denied'
     or (select result from paper_card_capture_test_results where label = 'exact_rejected_replay')
        <> (select result from paper_card_capture_test_results where label = 'self_capture')
     or (select result->>'code' from paper_card_capture_test_results where label = 'verification_mismatch') <> 'verification_id_mismatch'
     or (select result->>'code' from paper_card_capture_test_results where label = 'cross_tournament') <> 'game_unavailable'
     or (select result->>'code' from paper_card_capture_test_results where label = 'outsider') <> 'not_capture_official' then
    raise exception 'paper-card capture rejection contract failed';
  end if;
  if (select count(*) from app.paper_card_captures where tournament_id = 'b2000000-0000-4000-8000-000000000001') <> 1
     or (select count(*) from app.paper_card_upload_intents where tournament_id = 'b2000000-0000-4000-8000-000000000001') <> 1
     or (select count(distinct actor_role) from app.paper_card_captures where tournament_id = 'b2000000-0000-4000-8000-000000000001') <> 1
     or (select min(actor_role) from app.paper_card_captures where tournament_id = 'b2000000-0000-4000-8000-000000000001') <> 'cross_checker' then
    raise exception 'capture or upload-intent rows are missing or duplicated';
  end if;
  if exists (
    select 1 from app.paper_card_upload_intents i
    where i.tournament_id = 'b2000000-0000-4000-8000-000000000001'
      and (i.upload_state <> 'provider_pending' or i.access_scope <> 'restricted')
  ) or exists (
    select 1 from app.paper_card_captures c
    where c.tournament_id = 'b2000000-0000-4000-8000-000000000001'
      and (c.capture_state <> 'upload_provider_pending' or c.human_review_state <> 'not_started'
        or c.ocr_state <> 'not_requested' or c.retention_state <> 'restricted_hold')
  ) then
    raise exception 'restricted non-authoritative state was not preserved';
  end if;
  if not exists (
    select 1 from app.paper_card_upload_intents i
    where i.capture_id = (v_capture->>'captureId')::uuid
      and i.original_file_name = 'card-a-7.jpg'
      and i.declared_media_type = 'image/jpeg'
      and i.declared_byte_size = 123456
      and i.declared_sha256 = repeat('a', 64)
      and i.client_captured_at = '2026-09-10T09:15:00-10:00'
  ) then
    raise exception 'original image metadata was not preserved';
  end if;
  if (select count(*) from app.paper_card_capture_conflicts where tournament_id = 'b2000000-0000-4000-8000-000000000001') <> 1
     or (select count(*) from app.score_submissions where canonical_game_id = 'f2900000-0000-4000-8000-000000000001') <> 0
     or (select count(*) from app.score_confirmations where canonical_game_id = 'f2900000-0000-4000-8000-000000000001') <> 0
     or (select count(*) from app.card_scorelines where canonical_game_id = 'f2900000-0000-4000-8000-000000000001') <> 0
     or (select state from app.canonical_games where id = 'f2900000-0000-4000-8000-000000000001') <> 'pending' then
    raise exception 'capture changed scoring authority or conflict persistence failed';
  end if;
  if (select count(*) from app.operation_receipts where tournament_id = 'b2000000-0000-4000-8000-000000000001' and operation_type = 'create_paper_card_capture_v1' and outcome = 'accepted') <> 1
     or (select count(*) from app.operation_receipts where tournament_id = 'b2000000-0000-4000-8000-000000000001' and operation_type = 'create_paper_card_capture_v1' and outcome = 'rejected') < 2
     or not exists (
       select 1 from app.paper_card_captures capture
       join app.operation_receipts receipt on receipt.id = capture.operation_receipt_id
         and receipt.tournament_id = capture.tournament_id
         and receipt.actor_profile_id = capture.actor_profile_id
       join app.audit_events audit on audit.operation_receipt_id = receipt.id
         and audit.tournament_id = capture.tournament_id
         and audit.entity_id = capture.id
       where capture.id = (v_capture->>'captureId')::uuid
         and receipt.outcome = 'accepted'
         and audit.action = 'paper_card_capture_created'
     )
     or (select count(*) from app.audit_events where tournament_id = 'b2000000-0000-4000-8000-000000000001' and action = 'paper_card_capture_rejected') < 2 then
    raise exception 'paper-card receipt or audit evidence is incomplete';
  end if;
  if has_function_privilege('anon', 'public.create_paper_card_capture_v1(uuid,uuid,uuid,text,text,text,text,text,bigint,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.create_paper_card_capture_v1(uuid,uuid,uuid,text,text,text,text,text,bigint,text,text,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.create_paper_card_capture_v1(uuid,uuid,uuid,text,text,text,text,text,bigint,text,text,uuid)', 'EXECUTE') then
    raise exception 'paper-card capture function grants are invalid';
  end if;
end;
$$;

do $$
declare v_capture_id uuid; v_intent_id uuid; v_conflict_id uuid;
begin
  select id into v_capture_id from app.paper_card_captures where tournament_id = 'b2000000-0000-4000-8000-000000000001';
  select id into v_intent_id from app.paper_card_upload_intents where tournament_id = 'b2000000-0000-4000-8000-000000000001';
  select id into v_conflict_id from app.paper_card_capture_conflicts where tournament_id = 'b2000000-0000-4000-8000-000000000001';
  begin
    update app.paper_card_captures set retention_state = 'restricted_hold' where id = v_capture_id;
    raise exception 'capture update unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'capture update unexpectedly succeeded' then raise; end if;
  end;
  begin
    delete from app.paper_card_upload_intents where id = v_intent_id;
    raise exception 'upload intent delete unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'upload intent delete unexpectedly succeeded' then raise; end if;
  end;
  begin
    delete from app.paper_card_capture_conflicts where id = v_conflict_id;
    raise exception 'capture conflict delete unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'capture conflict delete unexpectedly succeeded' then raise; end if;
  end;
end;
$$;

set constraints all immediate;
rollback;
