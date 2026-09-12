-- October-pilot path for one cross checker to transcribe two matching original
-- paper scorecards and a second distinct official to confirm them. Only the
-- second exact confirmation creates authoritative scorelines; player accounts,
-- submissions, and confirmations are never fabricated.

create table app.paper_game_completions (
  id uuid primary key,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  round_id uuid not null,
  case_sequence integer not null check (case_sequence > 0),
  base_game_version integer not null check (base_game_version > 0),
  base_game_state text not null check (base_game_state in ('pending','submitted','mismatch','confirmation_pending')),
  winner_side text not null check (winner_side in ('a','b')),
  margin integer not null check (margin between 1 and 121),
  cross_checker_profile_id uuid not null references app.profiles(id) on delete restrict,
  official_identity_binding_id uuid not null,
  operation_receipt_id uuid not null,
  completed_at timestamptz not null default now(),
  foreign key (canonical_game_id,tournament_id,event_id)
    references app.canonical_games(id,tournament_id,event_id) on delete restrict,
  foreign key (round_id,tournament_id,event_id)
    references app.rounds(id,tournament_id,event_id) on delete restrict,
  foreign key (operation_receipt_id,tournament_id)
    references app.operation_receipts(id,tournament_id) on delete restrict,
  unique (canonical_game_id,case_sequence),
  unique (id,canonical_game_id),
  unique (id,tournament_id,event_id)
);

create table app.paper_game_completion_evidence (
  id uuid primary key default extensions.gen_random_uuid(),
  completion_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  card_side text not null check (card_side in ('a','b')),
  participant_id uuid not null,
  opponent_participant_id uuid not null,
  verification_id_snapshot text not null check (verification_id_snapshot ~ '^[A-Z]-[1-9][0-9]*$'),
  claimed_winner_side text not null check (claimed_winner_side in ('a','b')),
  claimed_margin integer not null check (claimed_margin between 1 and 121),
  claimed_game_points smallint not null check (claimed_game_points in (0,2,3)),
  claimed_plus_points integer not null check (claimed_plus_points between 0 and 121),
  claimed_minus_points integer not null check (claimed_minus_points between 0 and 121),
  evidence_reference text not null check (length(trim(evidence_reference)) between 1 and 200),
  recorded_at timestamptz not null default now(),
  foreign key (completion_id,canonical_game_id)
    references app.paper_game_completions(id,canonical_game_id) on delete restrict,
  foreign key (completion_id,tournament_id,event_id)
    references app.paper_game_completions(id,tournament_id,event_id) on delete restrict,
  foreign key (participant_id,event_id,tournament_id)
    references app.event_participants(id,event_id,tournament_id) on delete restrict,
  foreign key (opponent_participant_id,event_id,tournament_id)
    references app.event_participants(id,event_id,tournament_id) on delete restrict,
  check (participant_id <> opponent_participant_id),
  check ((card_side = claimed_winner_side and claimed_game_points in (2,3)
      and claimed_plus_points = claimed_margin and claimed_minus_points = 0)
    or (card_side <> claimed_winner_side and claimed_game_points = 0
      and claimed_plus_points = 0 and claimed_minus_points = claimed_margin)),
  check ((claimed_margin >= 31 and card_side = claimed_winner_side and claimed_game_points = 3)
    or (claimed_margin < 31 and card_side = claimed_winner_side and claimed_game_points = 2)
    or (card_side <> claimed_winner_side and claimed_game_points = 0)),
  unique (completion_id,card_side),
  unique (completion_id,participant_id)
);

create table app.paper_game_completion_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  completion_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  decision text not null check (decision in ('approve','reject')),
  side_a_claim jsonb not null,
  side_b_claim jsonb not null,
  reviewer_profile_id uuid not null references app.profiles(id) on delete restrict,
  official_identity_binding_id uuid not null,
  reviewer_role text not null check (reviewer_role in ('director','co_director','cross_checker')),
  operation_receipt_id uuid not null,
  reviewed_at timestamptz not null default now(),
  foreign key (completion_id,canonical_game_id)
    references app.paper_game_completions(id,canonical_game_id) on delete restrict,
  foreign key (completion_id,tournament_id,event_id)
    references app.paper_game_completions(id,tournament_id,event_id) on delete restrict,
  foreign key (operation_receipt_id,tournament_id)
    references app.operation_receipts(id,tournament_id) on delete restrict,
  unique (completion_id),
  unique (operation_receipt_id,completion_id)
);

create table app.paper_game_completion_state_events (
  id uuid primary key default extensions.gen_random_uuid(),
  completion_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  state text not null check (state in ('pending_review','approved','rejected')),
  transition_sequence smallint not null check (transition_sequence in (1,2)),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  actor_role text not null check (actor_role in ('director','co_director','cross_checker')),
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (completion_id,canonical_game_id)
    references app.paper_game_completions(id,canonical_game_id) on delete restrict,
  foreign key (completion_id,tournament_id,event_id)
    references app.paper_game_completions(id,tournament_id,event_id) on delete restrict,
  foreign key (operation_receipt_id,tournament_id)
    references app.operation_receipts(id,tournament_id) on delete restrict,
  unique (completion_id,transition_sequence),
  unique (operation_receipt_id,completion_id)
);

create table app.paper_official_identity_bindings (
  id uuid primary key,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  official_profile_id uuid not null references app.profiles(id) on delete restrict,
  binding_version integer not null check (binding_version>0),
  supersedes_binding_id uuid,
  binding_kind text not null check (binding_kind in ('roster_entry','nonparticipant')),
  roster_entry_id uuid,
  confirming_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  confirmed_at timestamptz not null default now(),
  foreign key (roster_entry_id,tournament_id) references app.tournament_roster_entries(id,tournament_id) on delete restrict,
  foreign key (operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  foreign key (supersedes_binding_id,tournament_id,official_profile_id) references app.paper_official_identity_bindings(id,tournament_id,official_profile_id) on delete restrict,
  check (official_profile_id<>confirming_profile_id),
  check ((binding_kind='roster_entry' and roster_entry_id is not null) or (binding_kind='nonparticipant' and roster_entry_id is null)),
  check ((binding_version=1 and supersedes_binding_id is null) or (binding_version>1 and supersedes_binding_id is not null)),
  unique (tournament_id,official_profile_id,binding_version),
  unique (id,tournament_id,official_profile_id)
);

alter table app.paper_game_completions add constraint paper_completion_official_identity_fk
  foreign key (official_identity_binding_id,tournament_id,cross_checker_profile_id)
  references app.paper_official_identity_bindings(id,tournament_id,official_profile_id) on delete restrict;
alter table app.paper_game_completion_reviews add constraint paper_review_official_identity_fk
  foreign key (official_identity_binding_id,tournament_id,reviewer_profile_id)
  references app.paper_official_identity_bindings(id,tournament_id,official_profile_id) on delete restrict;

create table app.paper_game_completion_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  attempted_completion_id uuid not null,
  attempted_game_id uuid,
  attempted_operation_id uuid not null,
  attempted_request_hash text not null check (length(attempted_request_hash)=64),
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null check (reason_code='idempotency_conflict'),
  created_at timestamptz not null default now()
);

create index paper_game_completions_scope_idx on app.paper_game_completions(tournament_id,event_id,canonical_game_id);
create index paper_game_completions_actor_idx on app.paper_game_completions(cross_checker_profile_id);
create index paper_game_completions_receipt_idx on app.paper_game_completions(operation_receipt_id);
create index paper_game_completions_identity_idx on app.paper_game_completions(official_identity_binding_id,tournament_id,cross_checker_profile_id);
create index paper_game_evidence_scope_idx on app.paper_game_completion_evidence(tournament_id,event_id,canonical_game_id);
create index paper_game_evidence_participant_idx on app.paper_game_completion_evidence(participant_id,event_id,tournament_id);
create index paper_game_evidence_opponent_idx on app.paper_game_completion_evidence(opponent_participant_id,event_id,tournament_id);
create index paper_game_reviews_actor_idx on app.paper_game_completion_reviews(reviewer_profile_id);
create index paper_game_reviews_receipt_idx on app.paper_game_completion_reviews(operation_receipt_id,tournament_id);
create index paper_game_reviews_identity_idx on app.paper_game_completion_reviews(official_identity_binding_id,tournament_id,reviewer_profile_id);
create index paper_game_state_latest_idx on app.paper_game_completion_state_events(completion_id,transition_sequence desc);
create index paper_game_state_actor_idx on app.paper_game_completion_state_events(actor_profile_id);
create index paper_official_identity_roster_idx on app.paper_official_identity_bindings(roster_entry_id,tournament_id);
create index paper_official_identity_confirmer_idx on app.paper_official_identity_bindings(confirming_profile_id,tournament_id);
create index paper_official_identity_receipt_idx on app.paper_official_identity_bindings(operation_receipt_id,tournament_id);
create index paper_game_conflicts_actor_idx on app.paper_game_completion_conflicts(actor_profile_id,created_at desc);
create index paper_game_conflicts_receipt_idx on app.paper_game_completion_conflicts(prior_receipt_id);

do $$ declare table_name text;
begin
  foreach table_name in array array['paper_game_completions','paper_game_completion_evidence','paper_game_completion_reviews','paper_game_completion_state_events','paper_official_identity_bindings','paper_game_completion_conflicts'] loop
    execute format('alter table app.%I enable row level security',table_name);
    execute format('alter table app.%I force row level security',table_name);
    execute format('revoke all on table app.%I from public,anon,authenticated',table_name);
  end loop;
end $$;

create trigger paper_game_completions_immutable before update or delete on app.paper_game_completions
for each row execute function app.reject_immutable_history();
create trigger paper_game_completion_evidence_immutable before update or delete on app.paper_game_completion_evidence
for each row execute function app.reject_immutable_history();
create trigger paper_game_completion_reviews_immutable before update or delete on app.paper_game_completion_reviews
for each row execute function app.reject_immutable_history();
create trigger paper_game_completion_state_events_immutable before update or delete on app.paper_game_completion_state_events
for each row execute function app.reject_immutable_history();
create trigger paper_official_identity_bindings_immutable before update or delete on app.paper_official_identity_bindings
for each row execute function app.reject_immutable_history();
create trigger paper_game_completion_conflicts_immutable before update or delete on app.paper_game_completion_conflicts
for each row execute function app.reject_immutable_history();
create trigger qualification_freeze_paper_game_completions before insert on app.paper_game_completions
for each row execute function app.block_finalized_qualification_mutation();

-- Keep "nonparticipant official" and tournament participation mutually
-- exclusive even when account linking or enrollment races the identity binder.
create or replace function app.guard_paper_nonparticipant_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_latest_kind text;
begin
  if new.profile_id is null then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-official:'||new.tournament_id::text||':'||new.profile_id::text,0));
  select binding.binding_kind into v_latest_kind from app.paper_official_identity_bindings binding
  where binding.tournament_id=new.tournament_id and binding.official_profile_id=new.profile_id
  order by binding.binding_version desc limit 1;
  if v_latest_kind='nonparticipant' then raise exception 'profile has a current nonparticipant official binding'; end if;
  return new;
end; $$;
revoke all on function app.guard_paper_nonparticipant_identity() from public,anon,authenticated;
create trigger roster_account_link_blocks_nonparticipant_official before insert or update of tournament_id,profile_id on app.roster_account_links
for each row execute function app.guard_paper_nonparticipant_identity();
create trigger event_participant_blocks_nonparticipant_official before insert or update of tournament_id,profile_id on app.event_participants
for each row execute function app.guard_paper_nonparticipant_identity();

create or replace function app.paper_game_completion_latest_state(p_completion_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select state_event.state from app.paper_game_completion_state_events state_event
  where state_event.completion_id=p_completion_id
  order by state_event.transition_sequence desc limit 1
$$;
revoke all on function app.paper_game_completion_latest_state(uuid) from public,anon,authenticated;

create or replace function app.paper_game_has_active_case(p_game_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.paper_game_completions completion
    where completion.canonical_game_id=p_game_id
      and app.paper_game_completion_latest_state(completion.id)<>'rejected')
$$;
revoke all on function app.paper_game_has_active_case(uuid) from public,anon,authenticated;

create or replace function app.device_recovery_has_active_case(p_game_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.device_failure_recoveries recovery
    cross join lateral (select state_event.state from app.device_failure_recovery_state_events state_event
      where state_event.recovery_id=recovery.id order by state_event.transition_sequence desc limit 1) latest
    where recovery.canonical_game_id=p_game_id and latest.state<>'rejected')
$$;
revoke all on function app.device_recovery_has_active_case(uuid) from public,anon,authenticated;

create or replace function app.paper_official_identity_is_current_valid(p_profile_id uuid,p_tournament_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select count(*)=1 and bool_and(
    (binding.binding_kind='nonparticipant'
      and not exists(select 1 from app.roster_account_links link where link.tournament_id=p_tournament_id and link.profile_id=p_profile_id)
      and not exists(select 1 from app.event_participants participant where participant.tournament_id=p_tournament_id and participant.profile_id=p_profile_id))
    or (binding.binding_kind='roster_entry'
      and not exists(select 1 from app.roster_account_links link where link.tournament_id=p_tournament_id and link.profile_id=p_profile_id and link.roster_entry_id<>binding.roster_entry_id)
      and not exists(select 1 from app.event_participants participant where participant.tournament_id=p_tournament_id and participant.profile_id=p_profile_id and participant.roster_entry_id<>binding.roster_entry_id))
  )
  from (select binding_row.* from app.paper_official_identity_bindings binding_row
    where binding_row.tournament_id=p_tournament_id and binding_row.official_profile_id=p_profile_id
    order by binding_row.binding_version desc limit 1) binding
$$;
revoke all on function app.paper_official_identity_is_current_valid(uuid,uuid) from public,anon,authenticated;

create or replace function app.paper_official_is_independent(p_profile_id uuid,p_tournament_id uuid,p_game_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select app.paper_official_identity_is_current_valid(p_profile_id,p_tournament_id)
    and count(*)=1 and bool_and(binding.binding_kind='nonparticipant' or binding.roster_entry_id not in (participant_a.roster_entry_id,participant_b.roster_entry_id))
  from (select binding_row.* from app.paper_official_identity_bindings binding_row where binding_row.tournament_id=p_tournament_id and binding_row.official_profile_id=p_profile_id order by binding_row.binding_version desc limit 1) binding
  join app.canonical_games game on game.id=p_game_id and game.tournament_id=p_tournament_id
  join app.event_participants participant_a on participant_a.id=game.side_a_participant_id and participant_a.tournament_id=game.tournament_id and participant_a.event_id=game.event_id
  join app.event_participants participant_b on participant_b.id=game.side_b_participant_id and participant_b.tournament_id=game.tournament_id and participant_b.event_id=game.event_id
  where binding.tournament_id=p_tournament_id and binding.official_profile_id=p_profile_id
$$;
revoke all on function app.paper_official_is_independent(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function app.guard_manual_game_evidence_case() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('manual-game-evidence:'||new.canonical_game_id::text,0));
  if tg_table_name='paper_game_completions' and app.device_recovery_has_active_case(new.canonical_game_id) then
    raise exception using errcode='P0001',message='device recovery case already open';
  end if;
  if tg_table_name='device_failure_recoveries' and app.paper_game_has_active_case(new.canonical_game_id) then
    raise exception using errcode='P0001',message='paper completion case already open';
  end if;
  return new;
end; $$;
revoke all on function app.guard_manual_game_evidence_case() from public,anon,authenticated;
create trigger paper_completion_excludes_device_recovery before insert on app.paper_game_completions
for each row execute function app.guard_manual_game_evidence_case();
create trigger device_recovery_excludes_paper_completion before insert on app.device_failure_recoveries
for each row execute function app.guard_manual_game_evidence_case();

create or replace function app.assert_paper_game_evidence_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(
    select 1 from app.paper_game_completions completion
    join app.canonical_games game on game.id=completion.canonical_game_id
      and game.tournament_id=completion.tournament_id and game.event_id=completion.event_id
    join app.event_participants participant on participant.id=new.participant_id
      and participant.tournament_id=new.tournament_id and participant.event_id=new.event_id
    join app.initial_seating_assignments seat on seat.tournament_id=participant.tournament_id
      and seat.roster_entry_id=participant.roster_entry_id
    where completion.id=new.completion_id and completion.canonical_game_id=new.canonical_game_id
      and completion.tournament_id=new.tournament_id and completion.event_id=new.event_id
      and completion.winner_side=new.claimed_winner_side and completion.margin=new.claimed_margin
      and ((new.card_side='a' and new.participant_id=game.side_a_participant_id
        and new.opponent_participant_id=game.side_b_participant_id)
        or (new.card_side='b' and new.participant_id=game.side_b_participant_id
        and new.opponent_participant_id=game.side_a_participant_id))
      and seat.verification_id=new.verification_id_snapshot
  ) then raise exception 'paper evidence identity or scope invalid'; end if;
  return new;
end; $$;
revoke all on function app.assert_paper_game_evidence_identity() from public,anon,authenticated;
create trigger paper_game_evidence_identity before insert on app.paper_game_completion_evidence
for each row execute function app.assert_paper_game_evidence_identity();

create or replace function app.paper_game_completion_is_approved(p_completion_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select state='approved' from app.paper_game_completion_state_events
    where completion_id=p_completion_id order by transition_sequence desc limit 1),false)
$$;
revoke all on function app.paper_game_completion_is_approved(uuid) from public,anon,authenticated;

create or replace function app.revalidate_game(game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g app.canonical_games%rowtype;
declare score_count integer;
declare submission_count integer;
declare confirmation_count integer;
declare matching_winner text;
declare matching_margin integer;
declare paper_completion app.paper_game_completions%rowtype;
declare paper_completed boolean := false;
begin
  select * into g from app.canonical_games where id=game_id;
  select * into paper_completion from app.paper_game_completions where canonical_game_id=game_id
    and app.paper_game_completion_is_approved(id);
  paper_completed := found;
  if g.state='pending' and exists(select 1 from app.card_scorelines where canonical_game_id=game_id) then raise exception 'pending game cannot have canonical scorelines'; end if;
  if g.state not in ('pending','verified','corrected') and exists(select 1 from app.card_scorelines where canonical_game_id=game_id) then raise exception 'only verified or corrected games can have canonical scorelines'; end if;
  select count(*) into submission_count from app.score_submissions where canonical_game_id=game_id;
  select count(*) into confirmation_count from app.score_confirmations where canonical_game_id=game_id;
  if confirmation_count>0 and (g.state not in ('confirmation_pending','verified','corrected') or submission_count<>2) then raise exception 'confirmations require two submissions and an eligible game state'; end if;
  if confirmation_count>0 and (select count(distinct (winner_side,margin)) from app.score_submissions where canonical_game_id=game_id)<>1 then raise exception 'confirmations require matching submission winner and margin'; end if;
  if g.state='submitted' and submission_count<>1 then raise exception 'submitted game requires exactly one submission'; end if;
  if g.state in ('mismatch','confirmation_pending') and submission_count<>2 then raise exception 'game requires exactly two submissions'; end if;
  if g.state='confirmation_pending' and confirmation_count not in (0,1) then raise exception 'confirmation-pending game allows zero or one confirmation'; end if;
  if g.state in ('verified','corrected') then
    if paper_completed then
      if submission_count<>0 or confirmation_count<>0 then raise exception 'paper completion cannot fabricate player submissions or confirmations'; end if;
      if (select count(*) from app.paper_game_completion_evidence where completion_id=paper_completion.id)<>2 then raise exception 'paper completion requires both original card claims'; end if;
      matching_winner:=paper_completion.winner_side; matching_margin:=paper_completion.margin;
    else
      if submission_count<>2 or confirmation_count<>2 then raise exception 'verified game requires two submissions and two confirmations'; end if;
      if (select count(distinct submission_id) from app.score_confirmations where canonical_game_id=game_id)<>2 then raise exception 'confirmations must bind two distinct submissions'; end if;
      select winner_side,margin into matching_winner,matching_margin from app.score_submissions where canonical_game_id=game_id group by winner_side,margin having count(*)=2;
    end if;
    if (select count(*) from app.card_scorelines where canonical_game_id=game_id)<>2 then raise exception 'verified game requires exactly two scorelines'; end if;
    if (select count(*) from app.card_scorelines where canonical_game_id=game_id and side='a' and participant_id=g.side_a_participant_id and opponent_participant_id=g.side_b_participant_id)<>1
      or (select count(*) from app.card_scorelines where canonical_game_id=game_id and side='b' and participant_id=g.side_b_participant_id and opponent_participant_id=g.side_a_participant_id)<>1 then raise exception 'scorelines must map exactly to game sides'; end if;
    if not paper_completed and (select count(*) from app.score_submissions s join app.event_participants p on p.id=s.submitter_participant_id where s.canonical_game_id=game_id and ((s.submission_slot=1 and p.id<>g.side_a_participant_id) or (s.submission_slot=2 and p.id<>g.side_b_participant_id)))<>0 then raise exception 'submission slots must map to assigned game sides'; end if;
    if matching_winner is null or g.winner_side<>matching_winner or g.margin<>matching_margin then raise exception 'canonical winner and margin must equal verified evidence'; end if;
    if (select count(*) from app.card_scorelines where canonical_game_id=game_id and margin<>g.margin)<>0
      or (select count(*) from app.card_scorelines where canonical_game_id=game_id and table_seat_snapshot not in (g.side_a_table_seat_snapshot,g.side_b_table_seat_snapshot))<>0
      or (select count(*) from app.card_scorelines where canonical_game_id=game_id and is_winner)<>1 then raise exception 'scorelines must share margin, seats, and one winner'; end if;
    if (select count(*) from app.card_scorelines where canonical_game_id=game_id and ((side='a' and table_seat_snapshot<>g.side_a_table_seat_snapshot) or (side='b' and table_seat_snapshot<>g.side_b_table_seat_snapshot) or (is_winner and side<>g.winner_side) or ((not is_winner) and side=g.winner_side) or (is_winner and plus_points<>g.margin) or (is_winner and minus_points<>0) or (not is_winner and plus_points<>0) or (not is_winner and minus_points<>g.margin) or (is_winner and game_points<>case when g.margin>=31 then 3 else 2 end) or (not is_winner and game_points<>0)))<>0 then raise exception 'reciprocal plus-minus and game points are invalid'; end if;
  end if;
end; $$;

create or replace function app.block_history_after_paper_completion() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_game_id uuid;
begin
  v_game_id:=case when tg_op='DELETE' then old.canonical_game_id else new.canonical_game_id end;
  if app.paper_game_has_active_case(v_game_id) then
    raise exception 'authoritative paper completion blocks duplicate game history';
  end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
revoke all on function app.block_history_after_paper_completion() from public,anon,authenticated;
create trigger score_submissions_block_paper_completion before insert on app.score_submissions for each row execute function app.block_history_after_paper_completion();
create trigger score_confirmations_block_paper_completion before insert on app.score_confirmations for each row execute function app.block_history_after_paper_completion();
create trigger paper_completed_scorelines_immutable before update or delete on app.card_scorelines for each row execute function app.block_history_after_paper_completion();

create or replace function public.bind_paper_official_identity_v1(
  p_actor_id uuid,p_tournament_id uuid,p_binding_id uuid,p_official_profile_id uuid,
  p_binding_kind text,p_roster_entry_id uuid,p_expected_binding_version integer,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text; v_target_role text; v_tournament_status text; v_hash text; v_existing app.operation_receipts%rowtype; v_current app.paper_official_identity_bindings%rowtype; v_receipt_id uuid:=extensions.gen_random_uuid(); v_response jsonb; v_next_version integer; v_rejection_code text;
begin
  if p_actor_id is null or p_tournament_id is null or p_binding_id is null or p_official_profile_id is null or p_operation_id is null
    or p_expected_binding_version is null or p_expected_binding_version<0 or p_binding_kind not in ('roster_entry','nonparticipant') or (p_binding_kind='roster_entry')<>(p_roster_entry_id is not null)
  then return jsonb_build_object('status','rejected','code','invalid_request','bindingId',p_binding_id); end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('bind_paper_official_identity_v1',p_actor_id,p_tournament_id,p_binding_id,p_official_profile_id,p_binding_kind,p_roster_entry_id,p_expected_binding_version)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select status into v_tournament_status from app.tournaments where id=p_tournament_id for update;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-official:'||p_tournament_id::text||':'||p_official_profile_id::text,0));
  select role into v_role from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in ('director','co_director') order by case role when 'director' then 1 else 2 end limit 1 for update;
  if v_role is null then return jsonb_build_object('status','rejected','code','director_required','bindingId',p_binding_id); end if;
  if p_actor_id=p_official_profile_id then
    v_rejection_code:='self_confirmation_denied';
  else
    select role into v_target_role from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_official_profile_id and role in ('director','co_director','cross_checker') order by case role when 'director' then 1 when 'co_director' then 2 else 3 end limit 1 for update;
    if v_target_role is null then v_rejection_code:='official_unavailable'; end if;
  end if;
  if v_rejection_code is null and p_binding_kind='nonparticipant' and (
    exists(select 1 from app.roster_account_links link where link.tournament_id=p_tournament_id and link.profile_id=p_official_profile_id)
    or exists(select 1 from app.event_participants participant where participant.tournament_id=p_tournament_id and participant.profile_id=p_official_profile_id)
  ) then
    v_rejection_code:='profile_is_tournament_participant';
  end if;
  select * into v_current from app.paper_official_identity_bindings where tournament_id=p_tournament_id and official_profile_id=p_official_profile_id order by binding_version desc limit 1 for update;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then
    if v_existing.tournament_id=p_tournament_id and v_existing.operation_type='bind_paper_official_identity_v1' and v_existing.target_id=p_binding_id and v_existing.request_hash=v_hash then
      if v_existing.response_payload->>'status'='bound' and (v_rejection_code is not null or v_current.id is distinct from p_binding_id) then
        return jsonb_build_object('status','rejected','code',coalesce(v_rejection_code,'stale_binding_version'),'bindingId',p_binding_id);
      end if;
      return v_existing.response_payload;
    end if;
    insert into app.paper_game_completion_conflicts(tournament_id,actor_profile_id,attempted_completion_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code) values(p_tournament_id,p_actor_id,p_binding_id,p_operation_id,v_hash,case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
    return jsonb_build_object('status','rejected','code','idempotency_conflict','bindingId',p_binding_id);
  end if;
  if v_tournament_status is distinct from 'open' then v_rejection_code:='tournament_unavailable'; end if;
  if v_rejection_code is null and p_binding_kind='roster_entry' and not exists(select 1 from app.tournament_roster_entries where id=p_roster_entry_id and tournament_id=p_tournament_id) then
    v_rejection_code:='roster_entry_unavailable';
  end if;
  if v_rejection_code is null then
    if coalesce(v_current.binding_version,0)<>p_expected_binding_version then v_rejection_code:='stale_binding_version'; end if;
  end if;
  if v_rejection_code is not null then
    v_response:=jsonb_build_object('status','rejected','code',v_rejection_code,'bindingId',p_binding_id);
    insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt_id,p_tournament_id,p_actor_id,'bind_paper_official_identity_v1',p_binding_id,v_hash,p_operation_id,'rejected',v_response,now());
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt_id,'paper_official_identity',p_binding_id,'paper_official_identity_binding_rejected',v_response);
    return v_response;
  end if;
  v_next_version:=p_expected_binding_version+1;
  v_response:=jsonb_build_object('status','bound','bindingId',p_binding_id,'tournamentId',p_tournament_id,'officialProfileId',p_official_profile_id,'bindingKind',p_binding_kind,'rosterEntryId',p_roster_entry_id,'bindingVersion',v_next_version);
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt_id,p_tournament_id,p_actor_id,'bind_paper_official_identity_v1',p_binding_id,v_hash,p_operation_id,'accepted',v_response,now());
  insert into app.paper_official_identity_bindings(id,tournament_id,official_profile_id,binding_version,supersedes_binding_id,binding_kind,roster_entry_id,confirming_profile_id,operation_receipt_id) values(p_binding_id,p_tournament_id,p_official_profile_id,v_next_version,v_current.id,p_binding_kind,p_roster_entry_id,p_actor_id,v_receipt_id);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt_id,'paper_official_identity',p_binding_id,'paper_official_identity_bound',v_response);
  return v_response;
end; $$;

create or replace function public.complete_paper_vs_paper_game_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_game_id uuid,p_completion_id uuid,
  p_expected_game_version integer,p_side_a_claim jsonb,p_side_b_claim jsonb,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_hash text; v_existing app.operation_receipts%rowtype; v_game app.canonical_games%rowtype;
  v_receipt_id uuid:=extensions.gen_random_uuid(); v_response jsonb; v_error text; v_code text;
  v_game_exists boolean:=false; v_tournament_status text;
  v_a_verification text; v_b_verification text; v_winner text; v_margin integer; v_game_points smallint; v_case_sequence integer; v_role text; v_identity_binding app.paper_official_identity_bindings%rowtype;
begin
  begin
    if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_game_id is null
      or p_completion_id is null or p_operation_id is null or p_expected_game_version is null or p_expected_game_version<1
      or jsonb_typeof(p_side_a_claim)<>'object' or jsonb_typeof(p_side_b_claim)<>'object'
      or (select count(*) from jsonb_object_keys(p_side_a_claim))<>3 or (select count(*) from jsonb_object_keys(p_side_b_claim))<>3
      or not (p_side_a_claim?'winnerSide' and p_side_a_claim?'margin' and p_side_a_claim?'evidenceReference')
      or not (p_side_b_claim?'winnerSide' and p_side_b_claim?'margin' and p_side_b_claim?'evidenceReference')
      or p_side_a_claim->>'winnerSide' not in ('a','b') or p_side_b_claim->>'winnerSide' not in ('a','b')
      or not ((p_side_a_claim->>'margin')~'^[1-9][0-9]{0,2}$') or not ((p_side_b_claim->>'margin')~'^[1-9][0-9]{0,2}$')
      or (p_side_a_claim->>'margin')::integer not between 1 and 121 or (p_side_b_claim->>'margin')::integer not between 1 and 121
      or length(trim(p_side_a_claim->>'evidenceReference')) not between 1 and 200
      or length(trim(p_side_b_claim->>'evidenceReference')) not between 1 and 200
      or (p_side_a_claim->>'evidenceReference')~'[[:cntrl:]]' or (p_side_b_claim->>'evidenceReference')~'[[:cntrl:]]'
      or lower(trim(p_side_a_claim->>'evidenceReference'))=lower(trim(p_side_b_claim->>'evidenceReference'))
    then raise exception using errcode='P0001',message='invalid paper completion request'; end if;
    v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('complete_paper_vs_paper_game_v1',p_actor_id,p_tournament_id,p_event_id,p_game_id,p_completion_id,p_expected_game_version,p_side_a_claim,p_side_b_claim)::text,'utf8'),'sha256'),'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
    select status into v_tournament_status from app.tournaments where id=p_tournament_id for update;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-official:'||p_tournament_id::text||':'||p_actor_id::text,0));
    select role into v_role from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='cross_checker' limit 1 for update;
    if v_role is null then raise exception using errcode='P0001',message='cross checker role required'; end if;
    select * into v_identity_binding from app.paper_official_identity_bindings where tournament_id=p_tournament_id and official_profile_id=p_actor_id order by binding_version desc limit 1 for update;
    if not found or not app.paper_official_is_independent(p_actor_id,p_tournament_id,p_game_id) then raise exception using errcode='P0001',message='official identity unconfirmed'; end if;
    select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
    if found then
      if v_existing.tournament_id<>p_tournament_id or v_existing.operation_type<>'complete_paper_vs_paper_game_v1'
        or v_existing.target_id<>p_completion_id or v_existing.request_hash<>v_hash then
        insert into app.paper_game_completion_conflicts(tournament_id,actor_profile_id,attempted_completion_id,attempted_game_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)
        values(p_tournament_id,p_actor_id,p_completion_id,p_game_id,p_operation_id,v_hash,case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
        return jsonb_build_object('status','rejected','code','idempotency_conflict','completionId',p_completion_id);
      end if;
      return v_existing.response_payload;
    end if;
    if v_tournament_status is distinct from 'open' then raise exception using errcode='P0001',message='tournament unavailable'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-score:'||p_event_id::text,0));
    perform 1 from app.events e join app.ruleset_versions r on r.id=e.ruleset_version_id and r.tournament_id=e.tournament_id
      where e.id=p_event_id and e.tournament_id=p_tournament_id and e.format='standard_singles' and e.scoring_method='digital'
      and r.format='standard_singles' and r.approved_at is not null and exists(select 1 from app.event_schedule_publications s where s.event_id=e.id and s.tournament_id=e.tournament_id) for update of e;
    if not found then raise exception using errcode='P0001',message='event unavailable'; end if;
    select * into v_game from app.canonical_games where id=p_game_id and tournament_id=p_tournament_id and event_id=p_event_id for update;
    v_game_exists:=found;
    if not found then raise exception using errcode='P0001',message='game unavailable'; end if;
    if not exists(select 1 from app.event_schedule_games schedule_game join app.event_schedule_publications publication on publication.id=schedule_game.publication_id and publication.tournament_id=schedule_game.tournament_id and publication.event_id=schedule_game.event_id where schedule_game.canonical_game_id=p_game_id and schedule_game.tournament_id=p_tournament_id and schedule_game.event_id=p_event_id)
      then raise exception using errcode='P0001',message='game not scheduled'; end if;
    if v_game.version<>p_expected_game_version then raise exception using errcode='P0001',message='stale game version'; end if;
    if v_game.state not in ('pending','submitted','mismatch','confirmation_pending') or exists(select 1 from app.card_scorelines where canonical_game_id=p_game_id)
      or exists(select 1 from app.device_failure_recoveries r where r.canonical_game_id=p_game_id and app.device_recovery_is_approved(r.id))
      or app.paper_game_has_active_case(p_game_id) then raise exception using errcode='P0001',message='game already authoritative'; end if;
    if app.device_recovery_has_active_case(p_game_id) then raise exception using errcode='P0001',message='device recovery case already open'; end if;
    if exists(select 1 from app.score_submissions where canonical_game_id=p_game_id) or exists(select 1 from app.score_confirmations where canonical_game_id=p_game_id) then raise exception using errcode='P0001',message='not paper pair'; end if;
    select seat.verification_id into v_a_verification from app.event_participants participant join app.initial_seating_assignments seat on seat.tournament_id=participant.tournament_id and seat.roster_entry_id=participant.roster_entry_id where participant.id=v_game.side_a_participant_id and participant.event_id=p_event_id and participant.tournament_id=p_tournament_id;
    select seat.verification_id into v_b_verification from app.event_participants participant join app.initial_seating_assignments seat on seat.tournament_id=participant.tournament_id and seat.roster_entry_id=participant.roster_entry_id where participant.id=v_game.side_b_participant_id and participant.event_id=p_event_id and participant.tournament_id=p_tournament_id;
    if v_a_verification is null or v_b_verification is null then raise exception using errcode='P0001',message='card identity unavailable'; end if;
    if p_side_a_claim->>'winnerSide'<>p_side_b_claim->>'winnerSide' or (p_side_a_claim->>'margin')::integer<>(p_side_b_claim->>'margin')::integer then raise exception using errcode='P0001',message='nonreciprocal card claims'; end if;
    v_winner:=p_side_a_claim->>'winnerSide'; v_margin:=(p_side_a_claim->>'margin')::integer; v_game_points:=case when v_margin>=31 then 3 else 2 end;
    select coalesce(max(completion.case_sequence),0)+1 into v_case_sequence from app.paper_game_completions completion where completion.canonical_game_id=p_game_id;
    v_response:=jsonb_build_object('status','pending_review','completionId',p_completion_id,'tournamentId',p_tournament_id,'eventId',p_event_id,'gameId',p_game_id,'gameVersion',v_game.version,'winnerSide',v_winner,'margin',v_margin,'evidenceCount',2,'authoritative',false);
    insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt_id,p_tournament_id,p_actor_id,'complete_paper_vs_paper_game_v1',p_completion_id,v_hash,p_operation_id,'accepted',v_response,now());
    insert into app.paper_game_completions(id,tournament_id,event_id,canonical_game_id,round_id,case_sequence,base_game_version,base_game_state,winner_side,margin,cross_checker_profile_id,official_identity_binding_id,operation_receipt_id) values(p_completion_id,p_tournament_id,p_event_id,p_game_id,v_game.round_id,v_case_sequence,v_game.version,v_game.state,v_winner,v_margin,p_actor_id,v_identity_binding.id,v_receipt_id);
    insert into app.paper_game_completion_evidence(completion_id,tournament_id,event_id,canonical_game_id,card_side,participant_id,opponent_participant_id,verification_id_snapshot,claimed_winner_side,claimed_margin,claimed_game_points,claimed_plus_points,claimed_minus_points,evidence_reference) values
      (p_completion_id,p_tournament_id,p_event_id,p_game_id,'a',v_game.side_a_participant_id,v_game.side_b_participant_id,v_a_verification,v_winner,v_margin,case when v_winner='a' then v_game_points else 0 end,case when v_winner='a' then v_margin else 0 end,case when v_winner='b' then v_margin else 0 end,trim(p_side_a_claim->>'evidenceReference')),
      (p_completion_id,p_tournament_id,p_event_id,p_game_id,'b',v_game.side_b_participant_id,v_game.side_a_participant_id,v_b_verification,v_winner,v_margin,case when v_winner='b' then v_game_points else 0 end,case when v_winner='b' then v_margin else 0 end,case when v_winner='a' then v_margin else 0 end,trim(p_side_b_claim->>'evidenceReference'));
    insert into app.paper_game_completion_state_events(completion_id,tournament_id,event_id,canonical_game_id,state,transition_sequence,actor_profile_id,actor_role,operation_receipt_id)
      values(p_completion_id,p_tournament_id,p_event_id,p_game_id,'pending_review',1,p_actor_id,'cross_checker',v_receipt_id);
    insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state) values(p_tournament_id,p_actor_id,p_game_id,v_receipt_id,'paper_game_completion',p_completion_id,'paper_vs_paper_cards_recorded',jsonb_build_object('gameVersion',v_game.version,'gameState',v_game.state),v_response);
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error=message_text;
    v_code:=case v_error when 'invalid paper completion request' then 'invalid_request' when 'tournament unavailable' then 'tournament_unavailable' when 'cross checker role required' then 'not_cross_checker' when 'event unavailable' then 'event_unavailable' when 'game unavailable' then 'game_unavailable' when 'game not scheduled' then 'game_not_scheduled' when 'stale game version' then 'stale_game_version' when 'game already authoritative' then 'game_already_authoritative' when 'device recovery case already open' then 'device_recovery_case_exists' when 'not paper pair' then 'not_paper_pair' when 'official identity unconfirmed' then 'official_identity_unconfirmed' when 'card identity unavailable' then 'card_identity_unavailable' when 'nonreciprocal card claims' then 'nonreciprocal_card_claims' else 'invalid_request' end;
    v_response:=jsonb_build_object('status','rejected','code',v_code,'completionId',p_completion_id);
    if p_actor_id is not null and p_tournament_id is not null and p_operation_id is not null and v_hash is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
      perform 1 from app.tournaments where id=p_tournament_id for update;
      if found then
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-official:'||p_tournament_id::text||':'||p_actor_id::text,0));
        select role into v_role from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='cross_checker' limit 1 for update;
        if v_role='cross_checker' and p_game_id is not null then
          select * into v_identity_binding from app.paper_official_identity_bindings where tournament_id=p_tournament_id and official_profile_id=p_actor_id order by binding_version desc limit 1 for update;
          if found and app.paper_official_is_independent(p_actor_id,p_tournament_id,p_game_id) then
          select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
          if found then
            if v_existing.tournament_id=p_tournament_id and v_existing.operation_type='complete_paper_vs_paper_game_v1' and v_existing.target_id=p_completion_id and v_existing.request_hash=v_hash then return v_existing.response_payload; end if;
            insert into app.paper_game_completion_conflicts(tournament_id,actor_profile_id,attempted_completion_id,attempted_game_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code) values(p_tournament_id,p_actor_id,p_completion_id,p_game_id,p_operation_id,v_hash,case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
            return jsonb_build_object('status','rejected','code','idempotency_conflict','completionId',p_completion_id);
          end if;
          insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_tournament_id,p_actor_id,'complete_paper_vs_paper_game_v1',coalesce(p_completion_id,p_game_id,p_tournament_id),v_hash,p_operation_id,'rejected',v_response,now()) returning id into v_receipt_id;
          insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,case when v_game_exists then p_game_id end,v_receipt_id,'paper_game_completion',coalesce(p_completion_id,p_game_id,p_tournament_id),'paper_vs_paper_game_completion_rejected',v_response);
        end if;
      end if;
    end if;
    end if;
    return v_response;
  end;
end; $$;

create or replace function public.review_paper_vs_paper_game_v1(
  p_actor_id uuid,p_completion_id uuid,p_expected_game_version integer,
  p_side_a_claim jsonb,p_side_b_claim jsonb,p_decision text,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_hash text; v_existing app.operation_receipts%rowtype; v_completion app.paper_game_completions%rowtype;
  v_game app.canonical_games%rowtype; v_role text; v_receipt_id uuid:=extensions.gen_random_uuid();
  v_response jsonb; v_error text; v_code text; v_tournament_status text;
  v_latest_state text; v_game_points smallint; v_identity_binding app.paper_official_identity_bindings%rowtype; v_first_identity_binding app.paper_official_identity_bindings%rowtype; v_first_role text;
begin
  begin
    if p_actor_id is null or p_completion_id is null or p_operation_id is null
      or p_expected_game_version is null or p_expected_game_version<1 or p_decision not in ('approve','reject')
      or jsonb_typeof(p_side_a_claim)<>'object' or jsonb_typeof(p_side_b_claim)<>'object'
      or (select count(*) from jsonb_object_keys(p_side_a_claim))<>3 or (select count(*) from jsonb_object_keys(p_side_b_claim))<>3
      or not (p_side_a_claim?'winnerSide' and p_side_a_claim?'margin' and p_side_a_claim?'evidenceReference')
      or not (p_side_b_claim?'winnerSide' and p_side_b_claim?'margin' and p_side_b_claim?'evidenceReference')
      or p_side_a_claim->>'winnerSide' not in ('a','b') or p_side_b_claim->>'winnerSide' not in ('a','b')
      or not ((p_side_a_claim->>'margin')~'^[1-9][0-9]{0,2}$') or not ((p_side_b_claim->>'margin')~'^[1-9][0-9]{0,2}$')
      or (p_side_a_claim->>'margin')::integer not between 1 and 121 or (p_side_b_claim->>'margin')::integer not between 1 and 121
      or length(trim(p_side_a_claim->>'evidenceReference')) not between 1 and 200 or length(trim(p_side_b_claim->>'evidenceReference')) not between 1 and 200
      or (p_side_a_claim->>'evidenceReference')~'[[:cntrl:]]' or (p_side_b_claim->>'evidenceReference')~'[[:cntrl:]]'
      or lower(trim(p_side_a_claim->>'evidenceReference'))=lower(trim(p_side_b_claim->>'evidenceReference'))
    then raise exception using errcode='P0001',message='invalid paper review request'; end if;
    v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('review_paper_vs_paper_game_v1',p_actor_id,p_completion_id,p_expected_game_version,p_side_a_claim,p_side_b_claim,p_decision)::text,'utf8'),'sha256'),'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-completion:'||p_completion_id::text,0));
    select * into v_completion from app.paper_game_completions where id=p_completion_id;
    if not found then raise exception using errcode='P0001',message='completion unavailable'; end if;
    select status into v_tournament_status from app.tournaments where id=v_completion.tournament_id for update;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-official:'||v_completion.tournament_id::text||':'||least(p_actor_id::text,v_completion.cross_checker_profile_id::text),0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-official:'||v_completion.tournament_id::text||':'||greatest(p_actor_id::text,v_completion.cross_checker_profile_id::text),0));
    select role into v_role from app.tournament_roles where tournament_id=v_completion.tournament_id and profile_id=p_actor_id and role in ('director','co_director','cross_checker') order by case role when 'director' then 1 when 'co_director' then 2 else 3 end limit 1 for update;
    if v_role is null then raise exception using errcode='P0001',message='eligible reviewer required'; end if;
    if p_actor_id=v_completion.cross_checker_profile_id then raise exception using errcode='P0001',message='reviewer not independent'; end if;
    select role into v_first_role from app.tournament_roles where tournament_id=v_completion.tournament_id and profile_id=v_completion.cross_checker_profile_id and role='cross_checker' limit 1 for update;
    select * into v_first_identity_binding from app.paper_official_identity_bindings where tournament_id=v_completion.tournament_id and official_profile_id=v_completion.cross_checker_profile_id order by binding_version desc limit 1 for update;
    if p_decision='approve' and (v_first_role is distinct from 'cross_checker' or not found or v_first_identity_binding.id<>v_completion.official_identity_binding_id
      or not app.paper_official_is_independent(v_completion.cross_checker_profile_id,v_completion.tournament_id,v_completion.canonical_game_id)
    ) then raise exception using errcode='P0001',message='first official identity changed'; end if;
    select * into v_identity_binding from app.paper_official_identity_bindings where tournament_id=v_completion.tournament_id and official_profile_id=p_actor_id order by binding_version desc limit 1 for update;
    if not found or not app.paper_official_is_independent(p_actor_id,v_completion.tournament_id,v_completion.canonical_game_id) then raise exception using errcode='P0001',message='official identity unconfirmed'; end if;
    select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
    if found then
      if v_existing.tournament_id<>v_completion.tournament_id or v_existing.operation_type<>'review_paper_vs_paper_game_v1' or v_existing.target_id<>p_completion_id or v_existing.request_hash<>v_hash then
        insert into app.paper_game_completion_conflicts(tournament_id,actor_profile_id,attempted_completion_id,attempted_game_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code) values(v_completion.tournament_id,p_actor_id,p_completion_id,v_completion.canonical_game_id,p_operation_id,v_hash,case when v_existing.tournament_id=v_completion.tournament_id then v_existing.id end,'idempotency_conflict');
        return jsonb_build_object('status','rejected','code','idempotency_conflict','completionId',p_completion_id);
      end if;
      return v_existing.response_payload;
    end if;
    if v_tournament_status is distinct from 'open' then raise exception using errcode='P0001',message='tournament unavailable'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-score:'||v_completion.event_id::text,0));
    select * into v_game from app.canonical_games where id=v_completion.canonical_game_id and tournament_id=v_completion.tournament_id and event_id=v_completion.event_id for update;
    if not found then raise exception using errcode='P0001',message='game unavailable'; end if;
    if not exists(select 1 from app.event_schedule_games schedule_game join app.event_schedule_publications publication on publication.id=schedule_game.publication_id and publication.tournament_id=schedule_game.tournament_id and publication.event_id=schedule_game.event_id where schedule_game.canonical_game_id=v_game.id and schedule_game.tournament_id=v_completion.tournament_id and schedule_game.event_id=v_completion.event_id)
      then raise exception using errcode='P0001',message='game not scheduled'; end if;
    select state into v_latest_state from app.paper_game_completion_state_events where completion_id=p_completion_id order by transition_sequence desc limit 1;
    if v_latest_state<>'pending_review' then raise exception using errcode='P0001',message='review closed'; end if;
    if v_game.version<>p_expected_game_version or v_game.version<>v_completion.base_game_version or v_game.state<>v_completion.base_game_state
      or exists(select 1 from app.card_scorelines where canonical_game_id=v_game.id)
      or exists(select 1 from app.score_submissions where canonical_game_id=v_game.id)
      or exists(select 1 from app.score_confirmations where canonical_game_id=v_game.id)
      or exists(select 1 from app.device_failure_recoveries recovery where recovery.canonical_game_id=v_game.id and app.device_recovery_is_approved(recovery.id))
    then raise exception using errcode='P0001',message='stale game version'; end if;
    if p_side_a_claim->>'winnerSide'<>p_side_b_claim->>'winnerSide' or (p_side_a_claim->>'margin')::integer<>(p_side_b_claim->>'margin')::integer then
      if p_decision='approve' then raise exception using errcode='P0001',message='review claims mismatch'; end if;
    end if;
    if p_decision='approve' and (
      p_side_a_claim->>'winnerSide'<>v_completion.winner_side or (p_side_a_claim->>'margin')::integer<>v_completion.margin
      or p_side_b_claim->>'winnerSide'<>v_completion.winner_side or (p_side_b_claim->>'margin')::integer<>v_completion.margin
      or trim(p_side_a_claim->>'evidenceReference')<>(select evidence_reference from app.paper_game_completion_evidence where completion_id=p_completion_id and card_side='a')
      or trim(p_side_b_claim->>'evidenceReference')<>(select evidence_reference from app.paper_game_completion_evidence where completion_id=p_completion_id and card_side='b')
    ) then raise exception using errcode='P0001',message='review claims mismatch'; end if;
    v_response:=jsonb_build_object('status',case when p_decision='approve' then 'approved' else 'rejected' end,'decision',p_decision,'completionId',p_completion_id,'gameId',v_game.id,'gameVersion',v_game.version+case when p_decision='approve' then 1 else 0 end,'authoritative',p_decision='approve','scorelinesCreated',p_decision='approve');
    insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt_id,v_completion.tournament_id,p_actor_id,'review_paper_vs_paper_game_v1',p_completion_id,v_hash,p_operation_id,'accepted',v_response,now());
    insert into app.paper_game_completion_reviews(completion_id,tournament_id,event_id,canonical_game_id,decision,side_a_claim,side_b_claim,reviewer_profile_id,official_identity_binding_id,reviewer_role,operation_receipt_id) values(p_completion_id,v_completion.tournament_id,v_completion.event_id,v_completion.canonical_game_id,p_decision,p_side_a_claim,p_side_b_claim,p_actor_id,v_identity_binding.id,v_role,v_receipt_id);
    insert into app.paper_game_completion_state_events(completion_id,tournament_id,event_id,canonical_game_id,state,transition_sequence,actor_profile_id,actor_role,operation_receipt_id) values(p_completion_id,v_completion.tournament_id,v_completion.event_id,v_completion.canonical_game_id,case when p_decision='approve' then 'approved' else 'rejected' end,2,p_actor_id,v_role,v_receipt_id);
    if p_decision='approve' then
      v_game_points:=case when v_completion.margin>=31 then 3 else 2 end;
      insert into app.card_scorelines(tournament_id,event_id,canonical_game_id,participant_id,opponent_participant_id,side,table_seat_snapshot,is_winner,margin,plus_points,minus_points,game_points) values
        (v_completion.tournament_id,v_completion.event_id,v_game.id,v_game.side_a_participant_id,v_game.side_b_participant_id,'a',v_game.side_a_table_seat_snapshot,v_completion.winner_side='a',v_completion.margin,case when v_completion.winner_side='a' then v_completion.margin else 0 end,case when v_completion.winner_side='b' then v_completion.margin else 0 end,case when v_completion.winner_side='a' then v_game_points else 0 end),
        (v_completion.tournament_id,v_completion.event_id,v_game.id,v_game.side_b_participant_id,v_game.side_a_participant_id,'b',v_game.side_b_table_seat_snapshot,v_completion.winner_side='b',v_completion.margin,case when v_completion.winner_side='b' then v_completion.margin else 0 end,case when v_completion.winner_side='a' then v_completion.margin else 0 end,case when v_completion.winner_side='b' then v_game_points else 0 end);
      update app.canonical_games set state='verified',winner_side=v_completion.winner_side,margin=v_completion.margin,version=version+1 where id=v_game.id;
    end if;
      insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state) values(v_completion.tournament_id,p_actor_id,v_game.id,v_receipt_id,'paper_game_completion',p_completion_id,case when p_decision='approve' then 'paper_vs_paper_game_completed' else 'paper_vs_paper_game_rejected' end,jsonb_build_object('state','pending_review','gameVersion',v_game.version),v_response);
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error=message_text;
    v_code:=case v_error when 'invalid paper review request' then 'invalid_request' when 'completion unavailable' then 'completion_unavailable' when 'tournament unavailable' then 'tournament_unavailable' when 'eligible reviewer required' then 'not_eligible_reviewer' when 'game unavailable' then 'game_unavailable' when 'game not scheduled' then 'game_not_scheduled' when 'review closed' then 'review_closed' when 'reviewer not independent' then 'reviewer_not_independent' when 'official identity unconfirmed' then 'official_identity_unconfirmed' when 'first official identity changed' then 'first_official_identity_changed' when 'stale game version' then 'stale_game_version' when 'review claims mismatch' then 'review_claims_mismatch' else 'invalid_request' end;
    v_response:=jsonb_build_object('status','rejected','code',v_code,'completionId',p_completion_id);
    if p_actor_id is not null and p_completion_id is not null and p_operation_id is not null and v_hash is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-completion:'||p_completion_id::text,0));
      select * into v_completion from app.paper_game_completions where id=p_completion_id;
      if found then
        perform 1 from app.tournaments where id=v_completion.tournament_id for update;
        if found then
          perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-official:'||v_completion.tournament_id::text||':'||least(p_actor_id::text,v_completion.cross_checker_profile_id::text),0));
          perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-official:'||v_completion.tournament_id::text||':'||greatest(p_actor_id::text,v_completion.cross_checker_profile_id::text),0));
          select role into v_role from app.tournament_roles where tournament_id=v_completion.tournament_id and profile_id=p_actor_id and role in ('director','co_director','cross_checker') order by case role when 'director' then 1 when 'co_director' then 2 else 3 end limit 1 for update;
          if v_role is not null and p_actor_id<>v_completion.cross_checker_profile_id then
            select role into v_first_role from app.tournament_roles where tournament_id=v_completion.tournament_id and profile_id=v_completion.cross_checker_profile_id and role='cross_checker' limit 1 for update;
            select * into v_first_identity_binding from app.paper_official_identity_bindings where tournament_id=v_completion.tournament_id and official_profile_id=v_completion.cross_checker_profile_id order by binding_version desc limit 1 for update;
            select * into v_identity_binding from app.paper_official_identity_bindings where tournament_id=v_completion.tournament_id and official_profile_id=p_actor_id order by binding_version desc limit 1 for update;
            if v_identity_binding.id is not null and app.paper_official_is_independent(p_actor_id,v_completion.tournament_id,v_completion.canonical_game_id) then
              select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
              if found then
                if v_existing.tournament_id=v_completion.tournament_id and v_existing.operation_type='review_paper_vs_paper_game_v1' and v_existing.target_id=p_completion_id and v_existing.request_hash=v_hash then
                  if v_existing.response_payload->>'status'='approved' and (v_first_role is distinct from 'cross_checker' or v_first_identity_binding.id is distinct from v_completion.official_identity_binding_id or not app.paper_official_is_independent(v_completion.cross_checker_profile_id,v_completion.tournament_id,v_completion.canonical_game_id)) then return v_response; end if;
                  return v_existing.response_payload;
                end if;
                insert into app.paper_game_completion_conflicts(tournament_id,actor_profile_id,attempted_completion_id,attempted_game_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code) values(v_completion.tournament_id,p_actor_id,p_completion_id,v_completion.canonical_game_id,p_operation_id,v_hash,case when v_existing.tournament_id=v_completion.tournament_id then v_existing.id end,'idempotency_conflict');
                return jsonb_build_object('status','rejected','code','idempotency_conflict','completionId',p_completion_id);
              end if;
              insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_completion.tournament_id,p_actor_id,'review_paper_vs_paper_game_v1',p_completion_id,v_hash,p_operation_id,'rejected',v_response,now()) returning id into v_receipt_id;
              insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(v_completion.tournament_id,p_actor_id,v_completion.canonical_game_id,v_receipt_id,'paper_game_completion',p_completion_id,'paper_vs_paper_game_review_rejected',v_response);
            end if;
          end if;
        end if;
      end if;
    end if;
    return v_response;
  end;
end; $$;

create or replace function public.get_paper_game_completion_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_role text; v_tournament_name text; v_candidates jsonb:='[]'::jsonb; v_reviews jsonb:='[]'::jsonb; v_unbound jsonb:='[]'::jsonb; v_roster jsonb:='[]'::jsonb;
begin
  select tournament_row.name into v_tournament_name from app.tournaments tournament_row where tournament_row.id=p_tournament_id and tournament_row.status='open';
  if not found then return null; end if;
  select role_row.role into v_role from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in ('director','co_director','cross_checker') order by case role_row.role when 'director' then 1 when 'co_director' then 2 else 3 end limit 1;
  if v_role is null then return null; end if;
  if v_role='cross_checker' then
    select coalesce(jsonb_agg(jsonb_build_object('gameId',game.id,'eventId',game.event_id,'eventName',event_row.name,'gameNumber',round_row.round_number,'gameVersion',game.version,'sideA',jsonb_build_object('displayName',coalesce(roster_a.claimed_display_name,profile_a.display_name),'verificationId',seat_a.verification_id,'profileLinked',app.recovery_participant_profile_id(participant_a.id,game.tournament_id,game.event_id) is not null),'sideB',jsonb_build_object('displayName',coalesce(roster_b.claimed_display_name,profile_b.display_name),'verificationId',seat_b.verification_id,'profileLinked',app.recovery_participant_profile_id(participant_b.id,game.tournament_id,game.event_id) is not null)) order by event_row.name,round_row.round_number,game.id),'[]'::jsonb) into v_candidates
    from app.canonical_games game join app.event_schedule_games schedule_game on schedule_game.canonical_game_id=game.id and schedule_game.tournament_id=game.tournament_id and schedule_game.event_id=game.event_id join app.event_schedule_publications publication on publication.id=schedule_game.publication_id and publication.tournament_id=schedule_game.tournament_id and publication.event_id=schedule_game.event_id join app.events event_row on event_row.id=game.event_id and event_row.tournament_id=game.tournament_id join app.ruleset_versions ruleset on ruleset.id=event_row.ruleset_version_id and ruleset.tournament_id=event_row.tournament_id join app.rounds round_row on round_row.id=game.round_id join app.event_participants participant_a on participant_a.id=game.side_a_participant_id join app.event_participants participant_b on participant_b.id=game.side_b_participant_id join app.tournament_roster_entries roster_a on roster_a.id=participant_a.roster_entry_id and roster_a.tournament_id=participant_a.tournament_id join app.tournament_roster_entries roster_b on roster_b.id=participant_b.roster_entry_id and roster_b.tournament_id=participant_b.tournament_id left join app.profiles profile_a on profile_a.id=participant_a.profile_id left join app.profiles profile_b on profile_b.id=participant_b.profile_id join app.initial_seating_assignments seat_a on seat_a.tournament_id=participant_a.tournament_id and seat_a.roster_entry_id=participant_a.roster_entry_id join app.initial_seating_assignments seat_b on seat_b.tournament_id=participant_b.tournament_id and seat_b.roster_entry_id=participant_b.roster_entry_id where game.tournament_id=p_tournament_id and event_row.format='standard_singles' and event_row.scoring_method='digital' and ruleset.approved_at is not null and game.state in ('pending','submitted','mismatch','confirmation_pending') and not exists(select 1 from app.score_submissions submission where submission.canonical_game_id=game.id) and not exists(select 1 from app.score_confirmations confirmation where confirmation.canonical_game_id=game.id) and not exists(select 1 from app.card_scorelines scoreline where scoreline.canonical_game_id=game.id) and not app.device_recovery_has_active_case(game.id) and not app.paper_game_has_active_case(game.id) and app.paper_official_is_independent(p_actor_id,game.tournament_id,game.id);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('completionId',completion.id,'gameId',game.id,'eventName',event_row.name,'gameNumber',round_row.round_number,'gameVersion',game.version,'sideA',jsonb_build_object('displayName',coalesce(roster_a.claimed_display_name,profile_a.display_name),'verificationId',seat_a.verification_id,'profileLinked',app.recovery_participant_profile_id(participant_a.id,game.tournament_id,game.event_id) is not null),'sideB',jsonb_build_object('displayName',coalesce(roster_b.claimed_display_name,profile_b.display_name),'verificationId',seat_b.verification_id,'profileLinked',app.recovery_participant_profile_id(participant_b.id,game.tournament_id,game.event_id) is not null)) order by event_row.name,round_row.round_number,game.id),'[]'::jsonb) into v_reviews
  from app.paper_game_completions completion join app.paper_game_completion_state_events state_event on state_event.completion_id=completion.id and state_event.transition_sequence=1 and state_event.state='pending_review' join app.canonical_games game on game.id=completion.canonical_game_id join app.event_schedule_games schedule_game on schedule_game.canonical_game_id=game.id and schedule_game.tournament_id=game.tournament_id and schedule_game.event_id=game.event_id join app.event_schedule_publications publication on publication.id=schedule_game.publication_id and publication.tournament_id=schedule_game.tournament_id and publication.event_id=schedule_game.event_id join app.events event_row on event_row.id=game.event_id join app.rounds round_row on round_row.id=game.round_id join app.event_participants participant_a on participant_a.id=game.side_a_participant_id join app.event_participants participant_b on participant_b.id=game.side_b_participant_id join app.tournament_roster_entries roster_a on roster_a.id=participant_a.roster_entry_id join app.tournament_roster_entries roster_b on roster_b.id=participant_b.roster_entry_id left join app.profiles profile_a on profile_a.id=participant_a.profile_id left join app.profiles profile_b on profile_b.id=participant_b.profile_id join app.initial_seating_assignments seat_a on seat_a.tournament_id=participant_a.tournament_id and seat_a.roster_entry_id=participant_a.roster_entry_id join app.initial_seating_assignments seat_b on seat_b.tournament_id=participant_b.tournament_id and seat_b.roster_entry_id=participant_b.roster_entry_id where completion.tournament_id=p_tournament_id and completion.cross_checker_profile_id<>p_actor_id and not exists(select 1 from app.paper_game_completion_state_events closed where closed.completion_id=completion.id and closed.transition_sequence=2) and not app.device_recovery_has_active_case(game.id) and app.paper_official_is_independent(p_actor_id,game.tournament_id,game.id);
  if v_role in ('director','co_director') then
    select coalesce(jsonb_agg(jsonb_build_object('profileId',role_row.profile_id,'displayName',profile.display_name,'role',role_row.role,'bindingVersion',coalesce(latest.binding_version,0)) order by profile.display_name,role_row.profile_id),'[]'::jsonb) into v_unbound from app.tournament_roles role_row join app.profiles profile on profile.id=role_row.profile_id left join lateral(select binding.binding_version from app.paper_official_identity_bindings binding where binding.tournament_id=p_tournament_id and binding.official_profile_id=role_row.profile_id order by binding.binding_version desc limit 1) latest on true where role_row.tournament_id=p_tournament_id and role_row.role in ('director','co_director','cross_checker') and role_row.profile_id<>p_actor_id;
    select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',roster.id,'displayName',roster.claimed_display_name) order by roster.claimed_display_name,roster.id),'[]'::jsonb) into v_roster from app.tournament_roster_entries roster where roster.tournament_id=p_tournament_id;
  end if;
  return jsonb_build_object('tournamentId',p_tournament_id,'tournamentName',v_tournament_name,'actorRole',v_role,'actorIdentityConfirmed',app.paper_official_identity_is_current_valid(p_actor_id,p_tournament_id),'unboundOfficials',v_unbound,'rosterChoices',v_roster,'candidates',v_candidates,'reviewCases',v_reviews);
end; $$;

-- Actor-scoped recovery for a browser that persisted an operation envelope but
-- lost the HTTP response. This deliberately reads only the caller's immutable
-- receipt and does not depend on the item still appearing in the live workspace.
create or replace function public.get_paper_game_operation_reconciliation_v1(
  p_actor_id uuid,p_tournament_id uuid,p_operation_type text,p_target_id uuid,p_operation_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_role text; v_receipt app.operation_receipts%rowtype; v_binding app.paper_official_identity_bindings%rowtype;
begin
  if p_actor_id is null or p_tournament_id is null or p_target_id is null or p_operation_id is null
    or p_operation_type not in ('complete_paper_vs_paper_game_v1','review_paper_vs_paper_game_v1','bind_paper_official_identity_v1')
  then return jsonb_build_object('authorized',false,'result',null); end if;

  if p_operation_type='bind_paper_official_identity_v1' then
    select role into v_role from app.tournament_roles
    where tournament_id=p_tournament_id and profile_id=p_actor_id and role in ('director','co_director')
    order by case role when 'director' then 1 else 2 end limit 1;
  elsif p_operation_type='complete_paper_vs_paper_game_v1' then
    select role into v_role from app.tournament_roles
    where tournament_id=p_tournament_id and profile_id=p_actor_id and role='cross_checker' limit 1;
  else
    select role into v_role from app.tournament_roles
    where tournament_id=p_tournament_id and profile_id=p_actor_id and role in ('director','co_director','cross_checker')
    order by case role when 'director' then 1 when 'co_director' then 2 else 3 end limit 1;
  end if;
  if v_role is null then return jsonb_build_object('authorized',false,'result',null); end if;

  if p_operation_type<>'bind_paper_official_identity_v1' then
    select * into v_binding from app.paper_official_identity_bindings
    where tournament_id=p_tournament_id and official_profile_id=p_actor_id
    order by binding_version desc limit 1;
    if not found then return jsonb_build_object('authorized',false,'result',null); end if;
  end if;

  select * into v_receipt from app.operation_receipts receipt
  where receipt.actor_profile_id=p_actor_id and receipt.tournament_id=p_tournament_id
    and receipt.client_operation_id=p_operation_id and receipt.operation_type=p_operation_type
    and receipt.target_id=p_target_id;
  if not found then return jsonb_build_object('authorized',true,'result',null); end if;
  if v_receipt.response_payload->>'status' not in ('rejected') then
    if p_operation_type='complete_paper_vs_paper_game_v1' and not exists(
      select 1 from app.paper_game_completions completion where completion.id=p_target_id
        and completion.tournament_id=p_tournament_id and completion.cross_checker_profile_id=p_actor_id
        and completion.official_identity_binding_id=v_binding.id
    ) then return jsonb_build_object('authorized',false,'result',null);
    elsif p_operation_type='review_paper_vs_paper_game_v1' and not exists(
      select 1 from app.paper_game_completion_reviews review where review.completion_id=p_target_id
        and review.tournament_id=p_tournament_id and review.reviewer_profile_id=p_actor_id
        and review.official_identity_binding_id=v_binding.id
    ) then return jsonb_build_object('authorized',false,'result',null);
    elsif p_operation_type='bind_paper_official_identity_v1' and not exists(
      select 1 from app.paper_official_identity_bindings binding
      join app.tournament_roles role_row on role_row.tournament_id=binding.tournament_id
        and role_row.profile_id=binding.official_profile_id and role_row.role in ('director','co_director','cross_checker')
      where binding.id=p_target_id and binding.tournament_id=p_tournament_id
        and binding.binding_version=(select max(latest.binding_version) from app.paper_official_identity_bindings latest where latest.tournament_id=binding.tournament_id and latest.official_profile_id=binding.official_profile_id)
        and (binding.binding_kind='roster_entry' or (
          not exists(select 1 from app.roster_account_links link where link.tournament_id=binding.tournament_id and link.profile_id=binding.official_profile_id)
          and not exists(select 1 from app.event_participants participant where participant.tournament_id=binding.tournament_id and participant.profile_id=binding.official_profile_id)
        ))
    ) then return jsonb_build_object('authorized',false,'result',null);
    end if;
  end if;
  return jsonb_build_object('authorized',true,'result',v_receipt.response_payload);
end; $$;

revoke all on function public.complete_paper_vs_paper_game_v1(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.bind_paper_official_identity_v1(uuid,uuid,uuid,uuid,text,uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.review_paper_vs_paper_game_v1(uuid,uuid,integer,jsonb,jsonb,text,uuid) from public,anon,authenticated;
revoke all on function public.get_paper_game_completion_workspace_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_paper_game_operation_reconciliation_v1(uuid,uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_paper_vs_paper_game_v1(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid) to service_role;
grant execute on function public.bind_paper_official_identity_v1(uuid,uuid,uuid,uuid,text,uuid,integer,uuid) to service_role;
grant execute on function public.review_paper_vs_paper_game_v1(uuid,uuid,integer,jsonb,jsonb,text,uuid) to service_role;
grant execute on function public.get_paper_game_completion_workspace_v1(uuid,uuid) to service_role;
grant execute on function public.get_paper_game_operation_reconciliation_v1(uuid,uuid,text,uuid,uuid) to service_role;
notify pgrst,'reload schema';
