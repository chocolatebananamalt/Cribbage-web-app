-- Append-only Standard Singles correction foundation. This migration is safe to
-- apply only with the private schema/RPC baseline already in place.

create table app.game_corrections (
  id uuid primary key,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  correction_sequence integer not null check (correction_sequence > 0),
  base_game_version integer not null check (base_game_version > 0),
  editor_profile_id uuid not null references app.profiles(id) on delete restrict,
  previous_winner_side text not null check (previous_winner_side in ('a', 'b')),
  previous_margin integer not null check (previous_margin between 1 and 121),
  corrected_winner_side text not null check (corrected_winner_side in ('a', 'b')),
  corrected_margin integer not null check (corrected_margin between 1 and 121),
  reason text,
  policy_version integer not null default 0,
  reason_required boolean not null default false,
  required_approvals smallint not null default 0 check (required_approvals between 0 and 1),
  created_at timestamptz not null default now(),
  check (previous_winner_side <> corrected_winner_side or previous_margin <> corrected_margin),
  foreign key (canonical_game_id, tournament_id, event_id) references app.canonical_games(id, tournament_id, event_id) on delete restrict,
  unique (canonical_game_id, correction_sequence),
  unique (id, canonical_game_id, tournament_id),
  unique (id, canonical_game_id, tournament_id, event_id)
);

create table app.correction_state_events (
  id uuid primary key default extensions.gen_random_uuid(),
  correction_id uuid not null,
  canonical_game_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  state text not null check (state in ('pending', 'approved', 'applied', 'rejected')),
  created_at timestamptz not null default now(),
  foreign key (correction_id, canonical_game_id, tournament_id, event_id) references app.game_corrections(id, canonical_game_id, tournament_id, event_id) on delete restrict,
  unique (correction_id, state)
);

create table app.correction_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid references app.profiles(id) on delete restrict,
  canonical_game_id uuid,
  attempted_idempotency_key uuid,
  attempted_request_hash text not null,
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now()
);

alter table app.game_corrections enable row level security;
alter table app.game_corrections force row level security;
alter table app.correction_state_events enable row level security;
alter table app.correction_state_events force row level security;
alter table app.correction_operation_conflicts enable row level security;
alter table app.correction_operation_conflicts force row level security;
revoke all on table app.game_corrections, app.correction_state_events, app.correction_operation_conflicts from public, anon, authenticated;
create trigger game_corrections_immutable before update or delete on app.game_corrections for each row execute function app.reject_immutable_history();
create trigger correction_state_events_immutable before update or delete on app.correction_state_events for each row execute function app.reject_immutable_history();
create trigger correction_operation_conflicts_immutable before update or delete on app.correction_operation_conflicts for each row execute function app.reject_immutable_history();

create or replace function public.propose_game_correction(
  p_game_id uuid, p_correction_id uuid, p_expected_game_version integer,
  p_winner_side text, p_margin integer, p_reason text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_game app.canonical_games%rowtype; v_role boolean;
  v_hash text; v_existing app.operation_receipts%rowtype; v_sequence integer; v_receipt uuid; v_response jsonb; v_error text; v_code text;
begin
  begin
  if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
  if p_game_id is null or p_correction_id is null or p_expected_game_version is null or p_winner_side is null or p_margin is null or p_winner_side not in ('a','b') or p_margin not between 1 and 121 or p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'invalid correction request';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array('propose_game_correction', p_game_id::text, p_correction_id::text, p_expected_game_version::text, p_winner_side, p_margin::text, coalesce(p_reason, ''), p_idempotency_key::text)::text, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0));
  select * into v_game from app.canonical_games where id = p_game_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'game not found'; end if;
  select * into v_existing from app.operation_receipts where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
    return v_existing.response_payload;
  end if;
  if not exists (select 1 from app.tournaments where id = v_game.tournament_id and status = 'open') then raise exception using errcode = 'P0001', message = 'corrections require an open tournament'; end if;
  if not exists (select 1 from app.events e join app.ruleset_versions rv on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id where e.id = v_game.event_id and e.tournament_id = v_game.tournament_id and e.format = 'standard_singles' and e.scoring_method = 'digital' and rv.format = 'standard_singles' and rv.approved_at is not null) then raise exception using errcode = 'P0001', message = 'event is not approved for digital Standard Singles correction'; end if;
  select exists(select 1 from app.tournament_roles where tournament_id = v_game.tournament_id and profile_id = v_actor and role = 'cross_checker') into v_role;
  if not v_role then raise exception using errcode = 'P0001', message = 'cross checker role required'; end if;
  if exists(select 1 from app.event_participants where id in (v_game.side_a_participant_id, v_game.side_b_participant_id) and profile_id = v_actor) then raise exception using errcode = 'P0001', message = 'cannot correct own game'; end if;
  if v_game.state not in ('verified','corrected') then raise exception using errcode = 'P0001', message = 'only verified games may be corrected'; end if;
  if v_game.version <> p_expected_game_version then raise exception using errcode = 'P0001', message = 'stale game version'; end if;
  if v_game.winner_side = p_winner_side and v_game.margin = p_margin then raise exception using errcode = 'P0001', message = 'correction must change result'; end if;
  select coalesce(max(correction_sequence),0)+1 into v_sequence from app.game_corrections where canonical_game_id = p_game_id;
  insert into app.game_corrections(id,tournament_id,event_id,canonical_game_id,correction_sequence,base_game_version,editor_profile_id,previous_winner_side,previous_margin,corrected_winner_side,corrected_margin,reason)
    values(p_correction_id,v_game.tournament_id,v_game.event_id,p_game_id,v_sequence,p_expected_game_version,v_actor,v_game.winner_side,v_game.margin,p_winner_side,p_margin,nullif(trim(p_reason),''));
  insert into app.correction_state_events(correction_id,canonical_game_id,tournament_id,event_id,actor_profile_id,state)
    values(p_correction_id,p_game_id,v_game.tournament_id,v_game.event_id,v_actor,'applied');
  update app.card_scorelines set
    is_winner = (side = p_winner_side), margin = p_margin,
    plus_points = case when side = p_winner_side then p_margin else 0 end,
    minus_points = case when side = p_winner_side then 0 else p_margin end,
    game_points = case when side = p_winner_side then case when p_margin >= 31 then 3 else 2 end else 0 end
    where canonical_game_id = p_game_id;
  update app.canonical_games set state='corrected', winner_side=p_winner_side, margin=p_margin, version=version+1 where id=p_game_id;
  v_response := jsonb_build_object('status','applied','game_id',p_game_id,'correction_id',p_correction_id,'version',p_expected_game_version+1);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(v_actor,v_game.tournament_id,'propose_game_correction',p_game_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
    values(v_game.tournament_id,v_actor,p_game_id,v_receipt,'canonical_game',p_game_id,'correction_applied',jsonb_build_object('winnerSide',v_game.winner_side,'margin',v_game.margin,'version',v_game.version),v_response);
  return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error when 'authentication required' then 'authentication_required' when 'invalid correction request' then 'invalid_request' when 'game not found' then 'game_not_found' when 'corrections require an open tournament' then 'tournament_closed' when 'idempotency conflict' then 'idempotency_conflict' when 'cross checker role required' then 'not_cross_checker' when 'cannot correct own game' then 'self_correction_denied' when 'only verified games may be corrected' then 'invalid_game_state' when 'stale game version' then 'stale_game_version' when 'correction must change result' then 'unchanged_correction' else 'correction_rejected' end;
    v_response := jsonb_build_object('status','rejected','code',v_code,'game_id',p_game_id);
    if v_error = 'idempotency conflict' then
      insert into app.correction_operation_conflicts(actor_profile_id,canonical_game_id,attempted_idempotency_key,attempted_request_hash,prior_receipt_id,reason_code)
      values(v_actor,p_game_id,p_idempotency_key,coalesce(v_hash,''),v_existing.id,'idempotency_conflict');
    elsif v_actor is not null and v_game.tournament_id is not null then
      insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(v_actor,v_game.tournament_id,'propose_game_correction',p_game_id,coalesce(v_hash,''),p_idempotency_key,'rejected',v_response,now()) returning id into v_receipt;
      insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state)
      values(v_game.tournament_id,v_actor,p_game_id,v_receipt,'canonical_game',p_game_id,'correction_rejected',v_response);
    end if;
    return v_response;
  when others then raise;
  end;
end; $$;

revoke all on function public.propose_game_correction(uuid,uuid,integer,text,integer,text,uuid) from public, anon;
grant execute on function public.propose_game_correction(uuid,uuid,integer,text,integer,text,uuid) to authenticated;

-- Corrected games retain the original verification evidence, but their effective
-- canonical projection must match the latest applied append-only correction.
create or replace function app.revalidate_game(game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g app.canonical_games%rowtype; submission_count integer; confirmation_count integer;
begin
  select * into g from app.canonical_games where id = game_id;
  select count(*) into submission_count from app.score_submissions where canonical_game_id = game_id;
  select count(*) into confirmation_count from app.score_confirmations where canonical_game_id = game_id;
  if confirmation_count > 0 and (g.state not in ('confirmation_pending','verified','corrected') or submission_count <> 2) then raise exception 'confirmations require two submissions and an eligible game state'; end if;
  if confirmation_count > 0 and (select count(distinct (winner_side,margin)) from app.score_submissions where canonical_game_id = game_id) <> 1 then raise exception 'confirmations require matching submission winner and margin'; end if;
  if g.state not in ('verified','corrected') and exists (select 1 from app.card_scorelines where canonical_game_id = game_id) then raise exception 'only final games can have scorelines'; end if;
  if g.state = 'submitted' and submission_count <> 1 then raise exception 'submitted game requires exactly one submission'; end if;
  if g.state in ('mismatch','confirmation_pending','verified','corrected') and submission_count <> 2 then raise exception 'game requires exactly two submissions'; end if;
  if g.state = 'confirmation_pending' and confirmation_count not in (0,1) then raise exception 'confirmation-pending game allows zero or one confirmation'; end if;
  if g.state in ('verified','corrected') and (confirmation_count <> 2 or (select count(*) from app.card_scorelines where canonical_game_id = game_id) <> 2) then raise exception 'final game requires two confirmations and scorelines'; end if;
  if g.state in ('verified','corrected') and (select count(distinct submission_id) from app.score_confirmations where canonical_game_id = game_id) <> 2 then raise exception 'confirmations must bind two distinct submissions'; end if;
  if g.state in ('verified','corrected') and exists (select 1 from app.score_submissions s join app.event_participants p on p.id = s.submitter_participant_id where s.canonical_game_id = game_id and ((s.submission_slot = 1 and p.id <> g.side_a_participant_id) or (s.submission_slot = 2 and p.id <> g.side_b_participant_id))) then raise exception 'submission slots must map to assigned game sides'; end if;
  if g.state in ('verified','corrected') and ((select count(*) from app.card_scorelines where canonical_game_id = game_id and side = 'a' and participant_id = g.side_a_participant_id and opponent_participant_id = g.side_b_participant_id) <> 1 or (select count(*) from app.card_scorelines where canonical_game_id = game_id and side = 'b' and participant_id = g.side_b_participant_id and opponent_participant_id = g.side_a_participant_id) <> 1) then raise exception 'scorelines must map exactly to game sides'; end if;
  if g.state = 'verified' and not exists (select 1 from app.score_submissions where canonical_game_id = game_id group by winner_side,margin having count(*) = 2 and winner_side = g.winner_side and margin = g.margin) then raise exception 'verified game must equal matching submissions'; end if;
  if g.state = 'corrected' and not exists (
    select 1 from (
      select c.corrected_winner_side, c.corrected_margin from app.game_corrections c
      join app.correction_state_events e on e.correction_id = c.id and e.state = 'applied'
      where c.canonical_game_id = game_id order by c.correction_sequence desc limit 1
    ) latest where latest.corrected_winner_side = g.winner_side and latest.corrected_margin = g.margin
  ) then raise exception 'corrected game must equal latest applied correction'; end if;
  if g.state in ('verified','corrected') and exists (select 1 from app.card_scorelines where canonical_game_id = game_id and ((side = 'a' and table_seat_snapshot <> g.side_a_table_seat_snapshot) or (side = 'b' and table_seat_snapshot <> g.side_b_table_seat_snapshot) or (is_winner and side <> g.winner_side) or ((not is_winner) and side = g.winner_side) or (margin <> g.margin) or (is_winner and (plus_points <> g.margin or minus_points <> 0 or game_points <> case when g.margin >= 31 then 3 else 2 end)) or (not is_winner and (plus_points <> 0 or minus_points <> g.margin or game_points <> 0)))) then raise exception 'reciprocal corrected scorelines are invalid'; end if;
end; $$;

revoke all on function app.revalidate_game(uuid) from public, anon, authenticated;
