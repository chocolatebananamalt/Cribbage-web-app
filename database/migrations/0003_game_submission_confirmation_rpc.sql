-- LOCAL FIRST DRAFT ONLY: do not apply to Supabase or any shared database yet.
-- Atomic Standard Singles submit/confirm RPC boundary. No table grants are added.
-- Expected errors are caught inside each authoritative RPC, rolled back in a
-- subtransaction, then recorded as controlled rejected receipts/audit events.

create table if not exists app.operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid,
  game_id uuid,
  operation_type text not null check (operation_type in ('submit_game_score', 'confirm_game_score')),
  attempted_idempotency_key uuid,
  attempted_request_hash text not null,
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now()
);
alter table app.operation_conflicts enable row level security;
alter table app.operation_conflicts force row level security;
revoke all on table app.operation_conflicts from public, anon, authenticated;
create trigger operation_conflicts_immutable
before update or delete on app.operation_conflicts
for each row execute function app.reject_immutable_history();

create or replace function public.submit_game_score(
  p_game_id uuid,
  p_submission_id uuid,
  p_submission_slot smallint,
  p_winner_side text,
  p_margin integer,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_game app.canonical_games%rowtype;
  v_participant uuid;
  v_existing app.operation_receipts%rowtype;
  v_response jsonb;
  v_request_hash text;
  v_submission_count integer;
  v_matching_count integer;
  v_receipt_id uuid;
  v_error text;
  v_error_code text;
  v_prior_receipt_id uuid;
begin
  begin
  if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
  if p_game_id is null or p_submission_id is null or p_submission_slot is null or p_winner_side is null or p_margin is null or p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'required submission argument is null';
  end if;
  v_request_hash := encode(extensions.digest(convert_to(concat_ws('|', 'submit_game_score', p_game_id::text, p_submission_id::text, p_submission_slot::text, p_winner_side, p_margin::text, p_idempotency_key::text), 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0));
  select * into v_game from app.canonical_games where id = p_game_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'game not found'; end if;
  select * into v_existing from app.operation_receipts where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash then v_prior_receipt_id := v_existing.id; raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
    return coalesce(v_existing.response_payload, jsonb_build_object('status', v_existing.outcome));
  end if;
  if not exists (select 1 from app.tournaments where id = v_game.tournament_id and status = 'open') then raise exception using errcode = 'P0001', message = 'tournament is not open'; end if;
  if not exists (
    select 1 from app.events e
    join app.ruleset_versions rv on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id
    where e.id = v_game.event_id and e.tournament_id = v_game.tournament_id
      and e.format = 'standard_singles' and e.scoring_method = 'digital'
      and rv.format = 'standard_singles' and rv.approved_at is not null
  ) then raise exception using errcode = 'P0001', message = 'event is not approved for digital scoring'; end if;
  if p_submission_slot not in (1, 2) or p_winner_side not in ('a', 'b') or p_margin not between 1 and 121 then
    raise exception using errcode = 'P0001', message = 'invalid Standard Singles score submission';
  end if;
  if not exists (select 1 from app.events e join app.ruleset_versions r on r.id = e.ruleset_version_id and r.tournament_id = e.tournament_id where e.id = v_game.event_id and e.tournament_id = v_game.tournament_id and e.format = 'standard_singles' and e.scoring_method = 'digital' and r.format = 'standard_singles' and r.approved_at is not null) then raise exception using errcode = 'P0001', message = 'game event is not approved digital Standard Singles'; end if;
  select ep.id into v_participant
    from app.event_participants ep
    join app.profiles pr on pr.id = ep.profile_id
    where ep.id = case when p_submission_slot = 1 then v_game.side_a_participant_id else v_game.side_b_participant_id end
      and ep.event_id = v_game.event_id and ep.tournament_id = v_game.tournament_id and ep.status = 'checked_in' and pr.id = v_actor;
  if v_participant is null then raise exception using errcode = 'P0001', message = 'actor is not assigned to this game side'; end if;
  if exists (select 1 from app.score_submissions where id = p_submission_id and canonical_game_id <> p_game_id) then raise exception using errcode = 'P0001', message = 'submission id is bound to another game'; end if;
  insert into app.score_submissions (id, tournament_id, event_id, canonical_game_id, submitter_profile_id, submitter_participant_id, submission_slot, winner_side, margin, source_method, payload_digest)
    values (p_submission_id, v_game.tournament_id, v_game.event_id, p_game_id, v_actor, v_participant, p_submission_slot, p_winner_side, p_margin, 'digital', v_request_hash);
  select count(*) into v_submission_count from app.score_submissions where canonical_game_id = p_game_id;
  select count(distinct (winner_side, margin)) into v_matching_count from app.score_submissions where canonical_game_id = p_game_id;
  if v_submission_count = 2 then
    update app.canonical_games set state = case when v_matching_count = 1 then 'confirmation_pending' else 'mismatch' end, version = version + 1 where id = p_game_id;
  end if;
  v_response := jsonb_build_object('status', case when v_submission_count = 2 and v_matching_count = 1 then 'confirmation_pending' when v_submission_count = 2 then 'mismatch' else 'submitted' end, 'game_id', p_game_id, 'submission_id', p_submission_id);
  insert into app.operation_receipts (actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
    values (v_actor, v_game.tournament_id, 'submit_game_score', p_game_id, v_request_hash, p_idempotency_key, 'accepted', v_response, now()) returning id into v_receipt_id;
  insert into app.audit_events (tournament_id, actor_profile_id, canonical_game_id, operation_receipt_id, entity_type, entity_id, action, after_state)
    values (v_game.tournament_id, v_actor, p_game_id, v_receipt_id, 'canonical_game', p_game_id, case when v_submission_count = 2 then case when v_matching_count = 1 then 'submissions_matched' else 'submissions_mismatch' end else 'submission_accepted' end, v_response);
  return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_error_code := case v_error when 'authentication required' then 'authentication_required' when 'required submission argument is null' then 'invalid_request' when 'game not found' then 'game_not_found' when 'idempotency conflict' then 'idempotency_conflict' when 'invalid Standard Singles score submission' then 'invalid_submission' when 'tournament is not open' then 'tournament_closed' when 'game event is not approved digital Standard Singles' then 'event_not_approved' when 'actor is not assigned to this game side' then 'not_assigned' when 'submission id is bound to another game' then 'submission_conflict' else 'submission_rejected' end;
    insert into app.operation_conflicts (actor_profile_id, game_id, operation_type, attempted_idempotency_key, attempted_request_hash, prior_receipt_id, reason_code)
      values (v_actor, p_game_id, 'submit_game_score', p_idempotency_key, coalesce(v_request_hash, ''), v_prior_receipt_id, v_error_code);
    if v_actor is not null and v_game.tournament_id is not null and v_prior_receipt_id is null then
      v_response := jsonb_build_object('status', 'rejected', 'code', v_error_code, 'game_id', p_game_id);
      select id into v_receipt_id from app.operation_receipts where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
      if v_receipt_id is null then
        insert into app.operation_receipts (actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
          values (v_actor, v_game.tournament_id, 'submit_game_score', p_game_id, v_request_hash, p_idempotency_key, 'rejected', v_response, now()) returning id into v_receipt_id;
      end if;
      insert into app.audit_events (tournament_id, actor_profile_id, canonical_game_id, operation_receipt_id, entity_type, entity_id, action, after_state)
        values (v_game.tournament_id, v_actor, p_game_id, v_receipt_id, 'canonical_game', p_game_id, 'submission_rejected', v_response);
      return v_response;
    end if;
    if v_actor is not null then return jsonb_build_object('status', 'rejected', 'code', v_error_code, 'game_id', p_game_id); end if;
  when others then
    raise;
  end;
end; $$;

create or replace function public.confirm_game_score(
  p_game_id uuid,
  p_submission_id uuid,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_game app.canonical_games%rowtype;
  v_submission app.score_submissions%rowtype;
  v_existing app.operation_receipts%rowtype;
  v_count integer;
  v_matching integer;
  v_response jsonb;
  v_request_hash text;
  v_receipt_id uuid;
  v_error text;
  v_error_code text;
  v_prior_receipt_id uuid;
begin
  begin
  if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
  if p_game_id is null or p_submission_id is null or p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'required confirmation argument is null';
  end if;
  v_request_hash := encode(extensions.digest(convert_to(concat_ws('|', 'confirm_game_score', p_game_id::text, p_submission_id::text, p_idempotency_key::text), 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0));
  select * into v_game from app.canonical_games where id = p_game_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'game not found'; end if;
  select * into v_existing from app.operation_receipts where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash then v_prior_receipt_id := v_existing.id; raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
    return coalesce(v_existing.response_payload, jsonb_build_object('status', v_existing.outcome));
  end if;
  if not exists (select 1 from app.tournaments where id = v_game.tournament_id and status = 'open') then raise exception using errcode = 'P0001', message = 'tournament is not open'; end if;
  if not exists (
    select 1 from app.events e
    join app.ruleset_versions rv on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id
    where e.id = v_game.event_id and e.tournament_id = v_game.tournament_id
      and e.format = 'standard_singles' and e.scoring_method = 'digital'
      and rv.format = 'standard_singles' and rv.approved_at is not null
  ) then raise exception using errcode = 'P0001', message = 'event is not approved for digital scoring'; end if;
  select * into v_submission from app.score_submissions where id = p_submission_id and canonical_game_id = p_game_id;
  if not found then raise exception using errcode = 'P0001', message = 'submission not found for game'; end if;
  if v_submission.submitter_profile_id <> v_actor then raise exception using errcode = 'P0001', message = 'only the assigned player may confirm own submission'; end if;
  if not exists (select 1 from app.event_participants where id = v_submission.submitter_participant_id and event_id = v_game.event_id and tournament_id = v_game.tournament_id and profile_id = v_actor and status = 'checked_in') then raise exception using errcode = 'P0001', message = 'assigned player is not currently checked in'; end if;
  if v_game.state <> 'confirmation_pending' then raise exception using errcode = 'P0001', message = 'game is not awaiting player confirmations'; end if;
  insert into app.score_confirmations (tournament_id, event_id, canonical_game_id, submission_id, submission_actor_id, confirmation_actor_id, confirmation_kind)
    values (v_game.tournament_id, v_game.event_id, p_game_id, p_submission_id, v_submission.submitter_profile_id, v_actor, 'player');
  select count(*) into v_count from app.score_confirmations where canonical_game_id = p_game_id;
  select count(distinct (winner_side, margin)) into v_matching from app.score_submissions where canonical_game_id = p_game_id;
  if v_count = 2 and v_matching = 1 and (select count(*) from app.score_submissions where canonical_game_id = p_game_id) = 2 then
    insert into app.card_scorelines (tournament_id, event_id, canonical_game_id, participant_id, opponent_participant_id, side, table_seat_snapshot, is_winner, margin, plus_points, minus_points, game_points)
      select v_game.tournament_id, v_game.event_id, p_game_id, ep.id, case when ep.id = v_game.side_a_participant_id then v_game.side_b_participant_id else v_game.side_a_participant_id end,
        case when ep.id = v_game.side_a_participant_id then 'a' else 'b' end, case when ep.id = v_game.side_a_participant_id then v_game.side_a_table_seat_snapshot else v_game.side_b_table_seat_snapshot end,
        ((select winner_side from app.score_submissions where canonical_game_id = p_game_id limit 1) = case when ep.id = v_game.side_a_participant_id then 'a' else 'b' end),
        (select margin from app.score_submissions where canonical_game_id = p_game_id limit 1),
        case when ((select winner_side from app.score_submissions where canonical_game_id = p_game_id limit 1) = case when ep.id = v_game.side_a_participant_id then 'a' else 'b' end) then (select margin from app.score_submissions where canonical_game_id = p_game_id limit 1) else 0 end,
        case when ((select winner_side from app.score_submissions where canonical_game_id = p_game_id limit 1) = case when ep.id = v_game.side_a_participant_id then 'a' else 'b' end) then 0 else (select margin from app.score_submissions where canonical_game_id = p_game_id limit 1) end,
        case when ((select winner_side from app.score_submissions where canonical_game_id = p_game_id limit 1) = case when ep.id = v_game.side_a_participant_id then 'a' else 'b' end) then case when (select margin from app.score_submissions where canonical_game_id = p_game_id limit 1) >= 31 then 3 else 2 end else 0 end
      from app.event_participants ep where ep.id in (v_game.side_a_participant_id, v_game.side_b_participant_id) and not exists (select 1 from app.card_scorelines cs where cs.canonical_game_id = p_game_id);
    update app.canonical_games set state = 'verified', winner_side = (select winner_side from app.score_submissions where canonical_game_id = p_game_id limit 1), margin = (select margin from app.score_submissions where canonical_game_id = p_game_id limit 1), version = version + 1 where id = p_game_id;
    v_response := jsonb_build_object('status', 'verified', 'game_id', p_game_id);
  else
    v_response := jsonb_build_object('status', 'confirmation_pending', 'game_id', p_game_id);
  end if;
  insert into app.operation_receipts (actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
    values (v_actor, v_game.tournament_id, 'confirm_game_score', p_game_id, v_request_hash, p_idempotency_key, 'accepted', v_response, now()) returning id into v_receipt_id;
  insert into app.audit_events (tournament_id, actor_profile_id, canonical_game_id, operation_receipt_id, entity_type, entity_id, action, after_state)
    values (v_game.tournament_id, v_actor, p_game_id, v_receipt_id, 'canonical_game', p_game_id, 'confirmation_accepted', v_response);
  if v_response->>'status' = 'verified' then
    insert into app.audit_events (tournament_id, actor_profile_id, canonical_game_id, operation_receipt_id, entity_type, entity_id, action, after_state)
      values (v_game.tournament_id, v_actor, p_game_id, v_receipt_id, 'canonical_game', p_game_id, 'game_verified', v_response);
  end if;
  return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_error_code := case v_error when 'authentication required' then 'authentication_required' when 'required confirmation argument is null' then 'invalid_request' when 'game not found' then 'game_not_found' when 'idempotency conflict' then 'idempotency_conflict' when 'tournament is not open' then 'tournament_closed' when 'event is not approved for digital scoring' then 'event_not_approved' when 'submission not found for game' then 'submission_not_found' when 'only the assigned player may confirm own submission' then 'not_submission_owner' when 'assigned player is not currently checked in' then 'not_checked_in' when 'game is not awaiting player confirmations' then 'invalid_game_state' else 'confirmation_rejected' end;
    insert into app.operation_conflicts (actor_profile_id, game_id, operation_type, attempted_idempotency_key, attempted_request_hash, prior_receipt_id, reason_code)
      values (v_actor, p_game_id, 'confirm_game_score', p_idempotency_key, coalesce(v_request_hash, ''), v_prior_receipt_id, v_error_code);
    if v_actor is not null and v_game.tournament_id is not null and v_prior_receipt_id is null then
      v_response := jsonb_build_object('status', 'rejected', 'code', v_error_code, 'game_id', p_game_id);
      select id into v_receipt_id from app.operation_receipts where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
      if v_receipt_id is null then
        insert into app.operation_receipts (actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
          values (v_actor, v_game.tournament_id, 'confirm_game_score', p_game_id, v_request_hash, p_idempotency_key, 'rejected', v_response, now()) returning id into v_receipt_id;
      end if;
      insert into app.audit_events (tournament_id, actor_profile_id, canonical_game_id, operation_receipt_id, entity_type, entity_id, action, after_state)
        values (v_game.tournament_id, v_actor, p_game_id, v_receipt_id, 'canonical_game', p_game_id, 'confirmation_rejected', v_response);
      return v_response;
    end if;
    if v_actor is not null then return jsonb_build_object('status', 'rejected', 'code', v_error_code, 'game_id', p_game_id); end if;
  when others then
    raise;
  end;
end; $$;

revoke all on function public.submit_game_score(uuid, uuid, smallint, text, integer, uuid) from public, anon;
revoke all on function public.confirm_game_score(uuid, uuid, uuid) from public, anon;
grant execute on function public.submit_game_score(uuid, uuid, smallint, text, integer, uuid) to authenticated;
grant execute on function public.confirm_game_score(uuid, uuid, uuid) to authenticated;
