-- Authoritative one-digital/one-paper Standard Singles completion.
-- The player's immutable digital submission is paired with one paper-card
-- transcription, then a second independent official must re-enter and confirm
-- both sources before reciprocal scorelines are created.

alter table app.score_submissions
  add constraint score_submissions_id_game_unique unique(id,canonical_game_id);

create table app.hybrid_game_cases (
  id uuid primary key,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  round_id uuid not null,
  case_sequence integer not null check(case_sequence>0),
  base_game_version integer not null check(base_game_version>0),
  digital_submission_id uuid not null,
  digital_participant_id uuid not null,
  paper_participant_id uuid not null,
  digital_scorecard_preference_version integer not null check(digital_scorecard_preference_version>0),
  paper_scorecard_preference_version integer not null check(paper_scorecard_preference_version>0),
  winner_side text not null check(winner_side in('a','b')),
  margin integer not null check(margin between 1 and 121),
  paper_evidence_reference text not null check(length(trim(paper_evidence_reference)) between 1 and 200),
  first_official_profile_id uuid not null references app.profiles(id) on delete restrict,
  first_official_identity_binding_id uuid not null,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key(canonical_game_id,tournament_id,event_id) references app.canonical_games(id,tournament_id,event_id) on delete restrict,
  foreign key(round_id,tournament_id,event_id) references app.rounds(id,tournament_id,event_id) on delete restrict,
  foreign key(digital_submission_id,canonical_game_id) references app.score_submissions(id,canonical_game_id) on delete restrict,
  foreign key(digital_participant_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id) on delete restrict,
  foreign key(paper_participant_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id) on delete restrict,
  foreign key(first_official_identity_binding_id,tournament_id,first_official_profile_id) references app.paper_official_identity_bindings(id,tournament_id,official_profile_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  check(digital_participant_id<>paper_participant_id),
  unique(canonical_game_id,case_sequence), unique(id,tournament_id,event_id), unique(id,canonical_game_id)
);

create table app.hybrid_game_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  hybrid_case_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  decision text not null check(decision in('approve','reject')),
  asserted_digital_submission_id uuid not null,
  asserted_digital_winner_side text not null check(asserted_digital_winner_side in('a','b')),
  asserted_digital_margin integer not null check(asserted_digital_margin between 1 and 121),
  paper_winner_side text not null check(paper_winner_side in('a','b')),
  paper_margin integer not null check(paper_margin between 1 and 121),
  paper_evidence_reference text not null check(length(trim(paper_evidence_reference)) between 1 and 200),
  reviewer_profile_id uuid not null references app.profiles(id) on delete restrict,
  reviewer_identity_binding_id uuid not null,
  operation_receipt_id uuid not null,
  reviewed_at timestamptz not null default now(),
  foreign key(hybrid_case_id,tournament_id,event_id) references app.hybrid_game_cases(id,tournament_id,event_id) on delete restrict,
  foreign key(hybrid_case_id,canonical_game_id) references app.hybrid_game_cases(id,canonical_game_id) on delete restrict,
  foreign key(asserted_digital_submission_id,canonical_game_id) references app.score_submissions(id,canonical_game_id) on delete restrict,
  foreign key(reviewer_identity_binding_id,tournament_id,reviewer_profile_id) references app.paper_official_identity_bindings(id,tournament_id,official_profile_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(hybrid_case_id)
);

create table app.hybrid_game_state_events (
  id uuid primary key default extensions.gen_random_uuid(),
  hybrid_case_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  state text not null check(state in('pending_review','approved','rejected')),
  transition_sequence smallint not null check(transition_sequence in(1,2)),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key(hybrid_case_id,tournament_id,event_id) references app.hybrid_game_cases(id,tournament_id,event_id) on delete restrict,
  foreign key(hybrid_case_id,canonical_game_id) references app.hybrid_game_cases(id,canonical_game_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(hybrid_case_id,transition_sequence)
);

create table app.hybrid_game_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  hybrid_case_id uuid not null,
  canonical_game_id uuid,
  attempted_operation_id uuid not null,
  attempted_request_hash text not null check(length(attempted_request_hash)=64),
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now()
);

do $$ declare n text; begin
  foreach n in array array['hybrid_game_cases','hybrid_game_reviews','hybrid_game_state_events','hybrid_game_conflicts'] loop
    execute format('alter table app.%I enable row level security',n);
    execute format('alter table app.%I force row level security',n);
    execute format('revoke all on table app.%I from public,anon,authenticated',n);
    execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
  end loop;
end $$;
create index hybrid_game_cases_scope_idx on app.hybrid_game_cases(tournament_id,event_id,canonical_game_id);
create index hybrid_game_cases_official_idx on app.hybrid_game_cases(first_official_profile_id,created_at desc);
create index hybrid_game_cases_round_idx on app.hybrid_game_cases(round_id,tournament_id,event_id);
create index hybrid_game_cases_submission_idx on app.hybrid_game_cases(digital_submission_id,canonical_game_id);
create index hybrid_game_cases_digital_participant_idx on app.hybrid_game_cases(digital_participant_id,event_id,tournament_id);
create index hybrid_game_cases_paper_participant_idx on app.hybrid_game_cases(paper_participant_id,event_id,tournament_id);
create index hybrid_game_cases_binding_idx on app.hybrid_game_cases(first_official_identity_binding_id,tournament_id,first_official_profile_id);
create index hybrid_game_cases_receipt_idx on app.hybrid_game_cases(operation_receipt_id,tournament_id);
create index hybrid_game_reviews_official_idx on app.hybrid_game_reviews(reviewer_profile_id,reviewed_at desc);
create index hybrid_game_reviews_case_idx on app.hybrid_game_reviews(hybrid_case_id,tournament_id,event_id);
create index hybrid_game_reviews_case_game_idx on app.hybrid_game_reviews(hybrid_case_id,canonical_game_id);
create index hybrid_game_reviews_submission_idx on app.hybrid_game_reviews(asserted_digital_submission_id,canonical_game_id);
create index hybrid_game_reviews_binding_idx on app.hybrid_game_reviews(reviewer_identity_binding_id,tournament_id,reviewer_profile_id);
create index hybrid_game_reviews_receipt_idx on app.hybrid_game_reviews(operation_receipt_id,tournament_id);
create index hybrid_game_state_case_idx on app.hybrid_game_state_events(hybrid_case_id,tournament_id,event_id);
create index hybrid_game_state_case_game_idx on app.hybrid_game_state_events(hybrid_case_id,canonical_game_id);
create index hybrid_game_state_receipt_idx on app.hybrid_game_state_events(operation_receipt_id,tournament_id);
create index hybrid_game_state_actor_idx on app.hybrid_game_state_events(actor_profile_id,created_at desc);
create index hybrid_game_conflicts_actor_idx on app.hybrid_game_conflicts(actor_profile_id,created_at desc);
create index hybrid_game_conflicts_receipt_idx on app.hybrid_game_conflicts(prior_receipt_id);
create trigger qualification_freeze_hybrid_game_cases before insert on app.hybrid_game_cases for each row execute function app.block_finalized_qualification_mutation();

create or replace function app.hybrid_game_latest_state(p_case_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select state from app.hybrid_game_state_events where hybrid_case_id=p_case_id order by transition_sequence desc limit 1
$$;
revoke all on function app.hybrid_game_latest_state(uuid) from public,anon,authenticated;

create or replace function app.hybrid_game_has_active_case(p_game_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.hybrid_game_cases c where c.canonical_game_id=p_game_id and app.hybrid_game_latest_state(c.id)<>'rejected')
$$;
revoke all on function app.hybrid_game_has_active_case(uuid) from public,anon,authenticated;

create or replace function app.hybrid_game_is_approved(p_game_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.hybrid_game_cases c where c.canonical_game_id=p_game_id and app.hybrid_game_latest_state(c.id)='approved')
$$;
revoke all on function app.hybrid_game_is_approved(uuid) from public,anon,authenticated;

-- Replace the shared exclusion guard so all three exceptional completion paths
-- serialize on the same game lock and are mutually exclusive.
create or replace function app.guard_manual_game_evidence_case() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('manual-game-evidence:'||new.canonical_game_id::text,0));
  if tg_table_name='paper_game_completions' and (app.device_recovery_has_active_case(new.canonical_game_id) or app.hybrid_game_has_active_case(new.canonical_game_id)) then raise exception using errcode='P0001',message='another manual evidence case already open'; end if;
  if tg_table_name='device_failure_recoveries' and (app.paper_game_has_active_case(new.canonical_game_id) or app.hybrid_game_has_active_case(new.canonical_game_id)) then raise exception using errcode='P0001',message='another manual evidence case already open'; end if;
  if tg_table_name='hybrid_game_cases' and (app.paper_game_has_active_case(new.canonical_game_id) or app.device_recovery_has_active_case(new.canonical_game_id)) then raise exception using errcode='P0001',message='another manual evidence case already open'; end if;
  return new;
end $$;
create trigger hybrid_completion_excludes_other_recovery before insert on app.hybrid_game_cases for each row execute function app.guard_manual_game_evidence_case();

create or replace function app.guard_ordinary_score_against_hybrid() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('manual-game-evidence:'||new.canonical_game_id::text,0));
  if app.hybrid_game_has_active_case(new.canonical_game_id) then raise exception using errcode='P0001',message='hybrid completion case already open'; end if;
  return new;
end $$;
revoke all on function app.guard_ordinary_score_against_hybrid() from public,anon,authenticated;
create trigger score_submission_excludes_hybrid before insert on app.score_submissions for each row execute function app.guard_ordinary_score_against_hybrid();
create trigger score_confirmation_excludes_hybrid before insert on app.score_confirmations for each row execute function app.guard_ordinary_score_against_hybrid();

create or replace function app.game_is_authoritatively_resolved_v1(p_game_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select game.state in('verified','corrected')
      or exists(select 1 from app.device_failure_recoveries recovery where recovery.canonical_game_id=game.id and app.device_recovery_is_approved(recovery.id))
      or exists(select 1 from app.paper_game_completions completion where completion.canonical_game_id=game.id and app.paper_game_completion_is_approved(completion.id))
      or app.hybrid_game_is_approved(game.id)
    from app.canonical_games game where game.id=p_game_id),false)
$$;

create or replace function app.record_hybrid_operation_result(
  p_actor uuid,p_tournament uuid,p_game uuid,p_operation text,p_target uuid,p_hash text,p_operation_id uuid,p_response jsonb,p_outcome text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_receipt uuid;
begin
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_tournament,p_actor,p_operation,p_target,p_hash,p_operation_id,p_outcome,p_response,now()) returning id into v_receipt;
  insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  values(p_tournament,p_actor,case when exists(select 1 from app.canonical_games where id=p_game and tournament_id=p_tournament) then p_game else null end,v_receipt,'hybrid_game_case',p_target,p_operation||'_'||p_outcome,p_response);
  return p_response||jsonb_build_object('_receiptId',v_receipt);
end $$;
revoke all on function app.record_hybrid_operation_result(uuid,uuid,uuid,text,uuid,text,uuid,jsonb,text) from public,anon,authenticated;

create or replace function public.create_hybrid_digital_paper_case_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_game_id uuid,p_case_id uuid,p_expected_game_version integer,
  p_digital_submission_id uuid,p_paper_claim jsonb,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text;v_tournament_status text;v_game app.canonical_games%rowtype;v_submission app.score_submissions%rowtype;v_identity app.paper_official_identity_bindings%rowtype;
  v_digital app.event_participants%rowtype;v_paper app.event_participants%rowtype;v_digital_roster app.tournament_roster_entries%rowtype;v_paper_roster app.tournament_roster_entries%rowtype;
  v_hash text;v_existing app.operation_receipts%rowtype;v_response jsonb;v_receipt uuid;v_case_sequence integer;
begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_game_id is null or p_case_id is null or p_expected_game_version is null or p_expected_game_version<1 or p_digital_submission_id is null or p_operation_id is null
    or jsonb_typeof(p_paper_claim)<>'object' or p_paper_claim-'winnerSide'-'margin'-'evidenceReference'<>'{}'::jsonb
    or p_paper_claim->>'winnerSide' not in('a','b') or (p_paper_claim->>'margin')!~'^[0-9]+$' or (p_paper_claim->>'margin')::integer not between 1 and 121
    or length(trim(coalesce(p_paper_claim->>'evidenceReference',''))) not between 1 and 200 then return jsonb_build_object('status','rejected','code','invalid_request','caseId',p_case_id); end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('create_hybrid_digital_paper_case_v1',p_tournament_id,p_event_id,p_game_id,p_case_id,p_expected_game_version,p_digital_submission_id,p_paper_claim)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select status into v_tournament_status from app.tournaments where id=p_tournament_id for update;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-official:'||p_tournament_id::text||':'||p_actor_id::text,0));
  select role into v_role from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='cross_checker' limit 1 for update;
  if v_role is null then return jsonb_build_object('status','rejected','code','not_cross_checker','caseId',p_case_id); end if;
  select * into v_identity from app.paper_official_identity_bindings where tournament_id=p_tournament_id and official_profile_id=p_actor_id order by binding_version desc limit 1 for update;
  if not found or not app.paper_official_identity_is_current_valid(p_actor_id,p_tournament_id) then return jsonb_build_object('status','rejected','code','official_identity_unconfirmed','caseId',p_case_id); end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then
    if v_existing.operation_type='create_hybrid_digital_paper_case_v1' and v_existing.tournament_id=p_tournament_id and v_existing.target_id=p_case_id and v_existing.request_hash=v_hash then return v_existing.response_payload; end if;
    insert into app.hybrid_game_conflicts(tournament_id,actor_profile_id,hybrid_case_id,canonical_game_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code) values(p_tournament_id,p_actor_id,p_case_id,p_game_id,p_operation_id,v_hash,case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
    return jsonb_build_object('status','rejected','code','idempotency_conflict','caseId',p_case_id);
  end if;
  select * into v_game from app.canonical_games where id=p_game_id and tournament_id=p_tournament_id and event_id=p_event_id for update;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('manual-game-evidence:'||p_game_id::text,0));
  if v_game.id is null then v_response:=jsonb_build_object('status','rejected','code','game_unavailable','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,p_tournament_id,p_game_id,'create_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  if v_tournament_status is distinct from 'open' then v_response:=jsonb_build_object('status','rejected','code','tournament_closed','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,p_tournament_id,p_game_id,'create_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  if v_game.version<>p_expected_game_version then v_response:=jsonb_build_object('status','rejected','code','stale_game_version','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,p_tournament_id,p_game_id,'create_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  if v_game.state not in('pending','submitted') or exists(select 1 from app.card_scorelines where canonical_game_id=p_game_id) or exists(select 1 from app.score_confirmations where canonical_game_id=p_game_id) or app.paper_game_has_active_case(p_game_id) or app.device_recovery_has_active_case(p_game_id) or app.hybrid_game_has_active_case(p_game_id) then v_response:=jsonb_build_object('status','rejected','code','game_already_claimed','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,p_tournament_id,p_game_id,'create_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  select * into v_submission from app.score_submissions where id=p_digital_submission_id and canonical_game_id=p_game_id and source_method='digital' for update;
  if not found or (select count(*) from app.score_submissions where canonical_game_id=p_game_id)<>1 then v_response:=jsonb_build_object('status','rejected','code','digital_submission_unavailable','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,p_tournament_id,p_game_id,'create_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  select * into v_digital from app.event_participants where id=v_submission.submitter_participant_id and status='checked_in';
  select * into v_paper from app.event_participants where id=case when v_digital.id=v_game.side_a_participant_id then v_game.side_b_participant_id else v_game.side_a_participant_id end and status='checked_in';
  select * into v_digital_roster from app.tournament_roster_entries where id=v_digital.roster_entry_id;
  select * into v_paper_roster from app.tournament_roster_entries where id=v_paper.roster_entry_id;
  if v_digital.id is null or v_paper.id is null or v_digital.id not in(v_game.side_a_participant_id,v_game.side_b_participant_id) or v_digital_roster.scorecard_type<>'digital' or v_paper_roster.scorecard_type<>'paper' then v_response:=jsonb_build_object('status','rejected','code','not_hybrid_pair','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,p_tournament_id,p_game_id,'create_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  if not exists(select 1 from app.events e join app.ruleset_versions rv on rv.id=e.ruleset_version_id and rv.tournament_id=e.tournament_id where e.id=p_event_id and e.tournament_id=p_tournament_id and e.format='standard_singles' and e.scoring_method='digital' and rv.approved_at is not null) then v_response:=jsonb_build_object('status','rejected','code','event_unavailable','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,p_tournament_id,p_game_id,'create_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  if not app.paper_official_is_independent(p_actor_id,p_tournament_id,p_game_id) then v_response:=jsonb_build_object('status','rejected','code','self_cross_check_denied','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,p_tournament_id,p_game_id,'create_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  if not exists(select 1 from app.event_schedule_games schedule where schedule.canonical_game_id=p_game_id and schedule.tournament_id=p_tournament_id and schedule.event_id=p_event_id)
    or app.participant_game_progression_v1(p_game_id,v_digital.id) is distinct from 'current'
    or app.participant_game_progression_v1(p_game_id,v_paper.id) is distinct from 'current'
  then v_response:=jsonb_build_object('status','rejected','code','game_progression_locked','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,p_tournament_id,p_game_id,'create_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  if v_submission.winner_side<>(p_paper_claim->>'winnerSide') or v_submission.margin<>(p_paper_claim->>'margin')::integer then v_response:=jsonb_build_object('status','rejected','code','digital_paper_mismatch','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,p_tournament_id,p_game_id,'create_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  v_response:=jsonb_build_object('status','pending_review','caseId',p_case_id,'gameId',p_game_id,'gameVersion',v_game.version,'digitalSubmissionId',p_digital_submission_id,'winnerSide',v_submission.winner_side,'margin',v_submission.margin,'authoritative',false);
  select coalesce(max(c.case_sequence),0)+1 into v_case_sequence from app.hybrid_game_cases c where c.canonical_game_id=p_game_id;
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_tournament_id,p_actor_id,'create_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.hybrid_game_cases(id,tournament_id,event_id,canonical_game_id,round_id,case_sequence,base_game_version,digital_submission_id,digital_participant_id,paper_participant_id,digital_scorecard_preference_version,paper_scorecard_preference_version,winner_side,margin,paper_evidence_reference,first_official_profile_id,first_official_identity_binding_id,operation_receipt_id)
  values(p_case_id,p_tournament_id,p_event_id,p_game_id,v_game.round_id,v_case_sequence,v_game.version,p_digital_submission_id,v_digital.id,v_paper.id,v_digital_roster.scorecard_preference_version,v_paper_roster.scorecard_preference_version,v_submission.winner_side,v_submission.margin,trim(p_paper_claim->>'evidenceReference'),p_actor_id,v_identity.id,v_receipt);
  insert into app.hybrid_game_state_events(hybrid_case_id,tournament_id,event_id,canonical_game_id,state,transition_sequence,actor_profile_id,operation_receipt_id) values(p_case_id,p_tournament_id,p_event_id,p_game_id,'pending_review',1,p_actor_id,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,p_game_id,v_receipt,'hybrid_game_case',p_case_id,'hybrid_case_pending_review',v_response);
  return v_response;
end $$;

create or replace function public.review_hybrid_digital_paper_case_v1(
  p_actor_id uuid,p_case_id uuid,p_expected_game_version integer,p_digital_submission_id uuid,p_digital_winner_side text,p_digital_margin integer,
  p_paper_claim jsonb,p_decision text,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case app.hybrid_game_cases%rowtype;v_game app.canonical_games%rowtype;v_submission app.score_submissions%rowtype;v_reviewer_binding app.paper_official_identity_bindings%rowtype;v_first_binding app.paper_official_identity_bindings%rowtype;
  v_role text;v_first_role text;v_hash text;v_existing app.operation_receipts%rowtype;v_response jsonb;v_receipt uuid;v_digital_roster app.tournament_roster_entries%rowtype;v_paper_roster app.tournament_roster_entries%rowtype;
  v_tournament_status text;
begin
  if p_actor_id is null or p_case_id is null or p_expected_game_version is null or p_digital_submission_id is null or p_digital_winner_side not in('a','b') or p_digital_margin not between 1 and 121 or p_decision not in('approve','reject') or p_operation_id is null
    or jsonb_typeof(p_paper_claim)<>'object' or p_paper_claim-'winnerSide'-'margin'-'evidenceReference'<>'{}'::jsonb or p_paper_claim->>'winnerSide' not in('a','b') or (p_paper_claim->>'margin')!~'^[0-9]+$' or (p_paper_claim->>'margin')::integer not between 1 and 121 or length(trim(coalesce(p_paper_claim->>'evidenceReference',''))) not between 1 and 200
  then return jsonb_build_object('status','rejected','code','invalid_request','caseId',p_case_id); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_case from app.hybrid_game_cases where id=p_case_id;
  if not found then return jsonb_build_object('status','rejected','code','case_unavailable','caseId',p_case_id); end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('review_hybrid_digital_paper_case_v1',p_case_id,p_expected_game_version,p_digital_submission_id,p_digital_winner_side,p_digital_margin,p_paper_claim,p_decision)::text,'utf8'),'sha256'),'hex');
  select status into v_tournament_status from app.tournaments where id=v_case.tournament_id for update;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-official:'||v_case.tournament_id::text||':'||least(p_actor_id::text,v_case.first_official_profile_id::text),0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-official:'||v_case.tournament_id::text||':'||greatest(p_actor_id::text,v_case.first_official_profile_id::text),0));
  select role into v_role from app.tournament_roles where tournament_id=v_case.tournament_id and profile_id=p_actor_id and role in('director','co_director','cross_checker') order by case role when 'director' then 1 when 'co_director' then 2 else 3 end limit 1 for update;
  if v_role is null or p_actor_id=v_case.first_official_profile_id then return jsonb_build_object('status','rejected','code','not_eligible_reviewer','caseId',p_case_id); end if;
  select role into v_first_role from app.tournament_roles where tournament_id=v_case.tournament_id and profile_id=v_case.first_official_profile_id and role='cross_checker' limit 1 for update;
  select * into v_reviewer_binding from app.paper_official_identity_bindings where tournament_id=v_case.tournament_id and official_profile_id=p_actor_id order by binding_version desc limit 1 for update;
  select * into v_first_binding from app.paper_official_identity_bindings where tournament_id=v_case.tournament_id and official_profile_id=v_case.first_official_profile_id order by binding_version desc limit 1 for update;
  if v_reviewer_binding.id is null or not app.paper_official_is_independent(p_actor_id,v_case.tournament_id,v_case.canonical_game_id) then return jsonb_build_object('status','rejected','code','official_identity_unconfirmed','caseId',p_case_id); end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then
    if v_existing.operation_type='review_hybrid_digital_paper_case_v1' and v_existing.tournament_id=v_case.tournament_id and v_existing.target_id=p_case_id and v_existing.request_hash=v_hash then
      if v_existing.response_payload->>'status'='approved' and (v_first_role is distinct from 'cross_checker' or v_first_binding.id is distinct from v_case.first_official_identity_binding_id or not app.paper_official_is_independent(v_case.first_official_profile_id,v_case.tournament_id,v_case.canonical_game_id)) then return jsonb_build_object('status','rejected','code','first_official_identity_changed','caseId',p_case_id); end if;
      return v_existing.response_payload;
    end if;
    insert into app.hybrid_game_conflicts(tournament_id,actor_profile_id,hybrid_case_id,canonical_game_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code) values(v_case.tournament_id,p_actor_id,p_case_id,v_case.canonical_game_id,p_operation_id,v_hash,case when v_existing.tournament_id=v_case.tournament_id then v_existing.id end,'idempotency_conflict');
    return jsonb_build_object('status','rejected','code','idempotency_conflict','caseId',p_case_id);
  end if;
  select * into v_game from app.canonical_games where id=v_case.canonical_game_id for update;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('manual-game-evidence:'||v_case.canonical_game_id::text,0));
  select * into v_submission from app.score_submissions where id=v_case.digital_submission_id and canonical_game_id=v_case.canonical_game_id for update;
  if app.hybrid_game_latest_state(p_case_id)<>'pending_review' then v_response:=jsonb_build_object('status','rejected','code','review_closed','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,v_case.tournament_id,v_case.canonical_game_id,'review_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  if v_tournament_status is distinct from 'open' then v_response:=jsonb_build_object('status','rejected','code','tournament_closed','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,v_case.tournament_id,v_case.canonical_game_id,'review_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  select roster.* into v_digital_roster from app.event_participants participant join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id where participant.id=v_case.digital_participant_id;
  select roster.* into v_paper_roster from app.event_participants participant join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id where participant.id=v_case.paper_participant_id;
  if p_decision='approve' and (v_first_role is distinct from 'cross_checker' or v_first_binding.id is distinct from v_case.first_official_identity_binding_id or not app.paper_official_is_independent(v_case.first_official_profile_id,v_case.tournament_id,v_case.canonical_game_id)) then v_response:=jsonb_build_object('status','rejected','code','first_official_identity_changed','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,v_case.tournament_id,v_case.canonical_game_id,'review_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  if p_decision='approve' and (v_game.version<>p_expected_game_version or v_game.version<>v_case.base_game_version) then v_response:=jsonb_build_object('status','rejected','code','stale_game_version','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,v_case.tournament_id,v_case.canonical_game_id,'review_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  if p_decision='approve' and (v_digital_roster.scorecard_type<>'digital' or v_paper_roster.scorecard_type<>'paper' or v_digital_roster.scorecard_preference_version<>v_case.digital_scorecard_preference_version or v_paper_roster.scorecard_preference_version<>v_case.paper_scorecard_preference_version) then v_response:=jsonb_build_object('status','rejected','code','scorecard_preference_changed','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,v_case.tournament_id,v_case.canonical_game_id,'review_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  if p_decision='approve' and (not exists(select 1 from app.event_schedule_games schedule where schedule.canonical_game_id=v_case.canonical_game_id and schedule.tournament_id=v_case.tournament_id and schedule.event_id=v_case.event_id)
    or app.participant_game_progression_v1(v_case.canonical_game_id,v_case.digital_participant_id) is distinct from 'current'
    or app.participant_game_progression_v1(v_case.canonical_game_id,v_case.paper_participant_id) is distinct from 'current')
  then v_response:=jsonb_build_object('status','rejected','code','game_progression_locked','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,v_case.tournament_id,v_case.canonical_game_id,'review_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  if p_decision='approve' and (p_digital_submission_id<>v_case.digital_submission_id or p_digital_winner_side<>v_submission.winner_side or p_digital_margin<>v_submission.margin or p_paper_claim->>'winnerSide'<>v_case.winner_side or (p_paper_claim->>'margin')::integer<>v_case.margin or trim(p_paper_claim->>'evidenceReference')<>v_case.paper_evidence_reference or v_submission.winner_side<>v_case.winner_side or v_submission.margin<>v_case.margin) then v_response:=jsonb_build_object('status','rejected','code','review_evidence_mismatch','caseId',p_case_id); return app.record_hybrid_operation_result(p_actor_id,v_case.tournament_id,v_case.canonical_game_id,'review_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,v_response,'rejected')-'_receiptId'; end if;
  v_response:=jsonb_build_object('status',case when p_decision='approve' then 'approved' else 'rejected' end,'decision',p_decision,'caseId',p_case_id,'gameId',v_case.canonical_game_id,'gameVersion',case when p_decision='approve' then v_game.version+1 else p_expected_game_version end,'authoritative',p_decision='approve','scorelinesCreated',p_decision='approve');
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_case.tournament_id,p_actor_id,'review_hybrid_digital_paper_case_v1',p_case_id,v_hash,p_operation_id,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.hybrid_game_reviews(hybrid_case_id,tournament_id,event_id,canonical_game_id,decision,asserted_digital_submission_id,asserted_digital_winner_side,asserted_digital_margin,paper_winner_side,paper_margin,paper_evidence_reference,reviewer_profile_id,reviewer_identity_binding_id,operation_receipt_id)
  values(p_case_id,v_case.tournament_id,v_case.event_id,v_case.canonical_game_id,p_decision,p_digital_submission_id,p_digital_winner_side,p_digital_margin,p_paper_claim->>'winnerSide',(p_paper_claim->>'margin')::integer,trim(p_paper_claim->>'evidenceReference'),p_actor_id,v_reviewer_binding.id,v_receipt);
  insert into app.hybrid_game_state_events(hybrid_case_id,tournament_id,event_id,canonical_game_id,state,transition_sequence,actor_profile_id,operation_receipt_id) values(p_case_id,v_case.tournament_id,v_case.event_id,v_case.canonical_game_id,case when p_decision='approve' then 'approved' else 'rejected' end,2,p_actor_id,v_receipt);
  if p_decision='approve' then
    insert into app.card_scorelines(tournament_id,event_id,canonical_game_id,participant_id,opponent_participant_id,side,table_seat_snapshot,is_winner,margin,plus_points,minus_points,game_points)
    select v_game.tournament_id,v_game.event_id,v_game.id,p.id,case when p.id=v_game.side_a_participant_id then v_game.side_b_participant_id else v_game.side_a_participant_id end,case when p.id=v_game.side_a_participant_id then 'a' else 'b' end,case when p.id=v_game.side_a_participant_id then v_game.side_a_table_seat_snapshot else v_game.side_b_table_seat_snapshot end,v_case.winner_side=case when p.id=v_game.side_a_participant_id then 'a' else 'b' end,v_case.margin,case when v_case.winner_side=case when p.id=v_game.side_a_participant_id then 'a' else 'b' end then v_case.margin else 0 end,case when v_case.winner_side=case when p.id=v_game.side_a_participant_id then 'a' else 'b' end then 0 else v_case.margin end,case when v_case.winner_side=case when p.id=v_game.side_a_participant_id then 'a' else 'b' end then case when v_case.margin>=31 then 3 else 2 end else 0 end
    from app.event_participants p where p.id in(v_game.side_a_participant_id,v_game.side_b_participant_id);
    update app.canonical_games set state='verified',winner_side=v_case.winner_side,margin=v_case.margin,version=version+1 where id=v_game.id;
  end if;
  insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(v_case.tournament_id,p_actor_id,v_case.canonical_game_id,v_receipt,'hybrid_game_case',p_case_id,case when p_decision='approve' then 'hybrid_game_verified' else 'hybrid_case_rejected' end,v_response);
  return v_response;
end $$;

create or replace function public.get_hybrid_game_operation_reconciliation_v1(p_actor_id uuid,p_tournament_id uuid,p_operation_type text,p_target_id uuid,p_operation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_role text;v_receipt app.operation_receipts%rowtype;v_binding app.paper_official_identity_bindings%rowtype;begin
  if p_operation_type not in('create_hybrid_digital_paper_case_v1','review_hybrid_digital_paper_case_v1') then return jsonb_build_object('authorized',false,'result',null); end if;
  if p_operation_type='create_hybrid_digital_paper_case_v1' then
    select role into v_role from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='cross_checker' limit 1;
  else
    select role into v_role from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director','cross_checker') limit 1;
  end if;
  if v_role is null or not app.paper_official_identity_is_current_valid(p_actor_id,p_tournament_id) then return jsonb_build_object('authorized',false,'result',null); end if;
  select * into v_binding from app.paper_official_identity_bindings where tournament_id=p_tournament_id and official_profile_id=p_actor_id order by binding_version desc limit 1;
  select * into v_receipt from app.operation_receipts where actor_profile_id=p_actor_id and tournament_id=p_tournament_id and operation_type=p_operation_type and target_id=p_target_id and client_operation_id=p_operation_id;
  if found and v_receipt.outcome<>'rejected' then
    if p_operation_type='create_hybrid_digital_paper_case_v1' and not exists(select 1 from app.hybrid_game_cases c where c.id=p_target_id and c.tournament_id=p_tournament_id and c.first_official_profile_id=p_actor_id and c.first_official_identity_binding_id=v_binding.id) then return jsonb_build_object('authorized',false,'result',null); end if;
    if p_operation_type='review_hybrid_digital_paper_case_v1' and not exists(select 1 from app.hybrid_game_reviews r where r.hybrid_case_id=p_target_id and r.tournament_id=p_tournament_id and r.reviewer_profile_id=p_actor_id and r.reviewer_identity_binding_id=v_binding.id) then return jsonb_build_object('authorized',false,'result',null); end if;
  end if;
  return jsonb_build_object('authorized',true,'result',case when found then v_receipt.response_payload else null end);
end $$;

create or replace function public.get_hybrid_game_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_role text;v_name text;v_candidates jsonb:='[]'::jsonb;v_reviews jsonb:='[]'::jsonb;
begin
  select t.name into v_name from app.tournaments t where t.id=p_tournament_id and t.status='open';
  if not found then return null; end if;
  select role into v_role from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director','cross_checker') order by case role when 'director' then 1 when 'co_director' then 2 else 3 end limit 1;
  if v_role is null then return null; end if;
  if v_role='cross_checker' and app.paper_official_identity_is_current_valid(p_actor_id,p_tournament_id) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'gameId',g.id,'eventId',g.event_id,'eventName',e.name,'gameNumber',r.round_number,'gameVersion',g.version,
      'digitalSubmissionId',s.id,'digitalWinnerSide',s.winner_side,'digitalMargin',s.margin,
      'digitalSide',case when s.submitter_participant_id=g.side_a_participant_id then 'a' else 'b' end,
      'digitalPlayerName',coalesce(rd.claimed_display_name,pd.display_name),'paperPlayerName',coalesce(rp.claimed_display_name,pp.display_name),
      'paperVerificationId',sp.verification_id) order by e.name,r.round_number,g.id),'[]'::jsonb) into v_candidates
    from app.canonical_games g
    join app.events e on e.id=g.event_id and e.tournament_id=g.tournament_id
    join app.ruleset_versions rv on rv.id=e.ruleset_version_id and rv.tournament_id=e.tournament_id and rv.approved_at is not null
    join app.rounds r on r.id=g.round_id
    join app.event_schedule_games sg on sg.canonical_game_id=g.id and sg.tournament_id=g.tournament_id and sg.event_id=g.event_id
    join app.score_submissions s on s.canonical_game_id=g.id and s.source_method='digital'
    join app.event_participants d on d.id=s.submitter_participant_id and d.status='checked_in'
    join app.tournament_roster_entries rd on rd.id=d.roster_entry_id and rd.scorecard_type='digital'
    left join app.profiles pd on pd.id=d.profile_id
    join app.event_participants p on p.id=case when d.id=g.side_a_participant_id then g.side_b_participant_id else g.side_a_participant_id end and p.status='checked_in'
    join app.tournament_roster_entries rp on rp.id=p.roster_entry_id and rp.scorecard_type='paper'
    left join app.profiles pp on pp.id=p.profile_id
    join app.initial_seating_assignments sp on sp.tournament_id=p.tournament_id and sp.roster_entry_id=p.roster_entry_id
    where g.tournament_id=p_tournament_id and e.format='standard_singles' and e.scoring_method='digital'
      and g.state in('pending','submitted') and (select count(*) from app.score_submissions x where x.canonical_game_id=g.id)=1
      and not exists(select 1 from app.score_confirmations x where x.canonical_game_id=g.id)
      and not exists(select 1 from app.card_scorelines x where x.canonical_game_id=g.id)
      and not app.paper_game_has_active_case(g.id) and not app.device_recovery_has_active_case(g.id) and not app.hybrid_game_has_active_case(g.id)
      and app.participant_game_progression_v1(g.id,d.id)='current' and app.participant_game_progression_v1(g.id,p.id)='current'
      and app.paper_official_is_independent(p_actor_id,p_tournament_id,g.id);
  end if;
  if app.paper_official_identity_is_current_valid(p_actor_id,p_tournament_id) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'caseId',c.id,'gameId',c.canonical_game_id,'eventName',e.name,'gameNumber',r.round_number,'gameVersion',g.version,
      'digitalSubmissionId',c.digital_submission_id,'digitalWinnerSide',c.winner_side,'digitalMargin',c.margin,
      'digitalSide',case when c.digital_participant_id=g.side_a_participant_id then 'a' else 'b' end,
      'digitalPlayerName',coalesce(rd.claimed_display_name,pd.display_name),'paperPlayerName',coalesce(rp.claimed_display_name,pp.display_name),
      'paperVerificationId',sp.verification_id) order by e.name,r.round_number,g.id),'[]'::jsonb) into v_reviews
    from app.hybrid_game_cases c
    join app.hybrid_game_state_events state on state.hybrid_case_id=c.id and state.transition_sequence=1 and state.state='pending_review'
    join app.canonical_games g on g.id=c.canonical_game_id
    join app.events e on e.id=c.event_id
    join app.rounds r on r.id=c.round_id
    join app.event_participants d on d.id=c.digital_participant_id
    join app.tournament_roster_entries rd on rd.id=d.roster_entry_id
    left join app.profiles pd on pd.id=d.profile_id
    join app.event_participants p on p.id=c.paper_participant_id
    join app.tournament_roster_entries rp on rp.id=p.roster_entry_id
    left join app.profiles pp on pp.id=p.profile_id
    join app.initial_seating_assignments sp on sp.tournament_id=p.tournament_id and sp.roster_entry_id=p.roster_entry_id
    where c.tournament_id=p_tournament_id and c.first_official_profile_id<>p_actor_id
      and not exists(select 1 from app.hybrid_game_state_events closed where closed.hybrid_case_id=c.id and closed.transition_sequence=2)
      and app.paper_official_is_independent(p_actor_id,p_tournament_id,c.canonical_game_id);
  end if;
  return jsonb_build_object('tournamentId',p_tournament_id,'tournamentName',v_name,'actorRole',v_role,'actorIdentityConfirmed',app.paper_official_identity_is_current_valid(p_actor_id,p_tournament_id),'candidates',v_candidates,'reviewCases',v_reviews);
end $$;

revoke all on function public.create_hybrid_digital_paper_case_v1(uuid,uuid,uuid,uuid,uuid,integer,uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.review_hybrid_digital_paper_case_v1(uuid,uuid,integer,uuid,text,integer,jsonb,text,uuid) from public,anon,authenticated;
revoke all on function public.get_hybrid_game_operation_reconciliation_v1(uuid,uuid,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_hybrid_game_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_hybrid_digital_paper_case_v1(uuid,uuid,uuid,uuid,uuid,integer,uuid,jsonb,uuid) to service_role;
grant execute on function public.review_hybrid_digital_paper_case_v1(uuid,uuid,integer,uuid,text,integer,jsonb,text,uuid) to service_role;
grant execute on function public.get_hybrid_game_operation_reconciliation_v1(uuid,uuid,text,uuid,uuid) to service_role;
grant execute on function public.get_hybrid_game_workspace_v1(uuid,uuid) to service_role;
notify pgrst,'reload schema';
