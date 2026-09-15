-- ACC Tournament Director's Manual (2019), pp. 16-18 and playoff timing.
-- In a two-games-per-opponent format, a first-game departure never creates an
-- automatic second forfeit; that second game requires a substitute or later play.
-- guidance. Exact repairs after a mixed rotation remain director decisions;
-- the database validates and audits the decision without claiming the ACC
-- prescribed an automatic pairing.

create table app.event_schedule_amendment_versions(
  id uuid primary key default extensions.gen_random_uuid(),
  amendment_id uuid not null,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  version integer not null check(version>0),
  operation_kind text not null check(operation_kind in(
    'omitted_player_before_play','late_player_before_game_two','odd_field_first_sitout_makeup',
    'early_departure_substitute','odd_field_extra_games','mixed_rotation_repair','reinstatement_future_games'
  )),
  rule_basis text not null check(length(trim(rule_basis)) between 1 and 500),
  director_reason text not null check(length(trim(director_reason)) between 1 and 1000),
  prior_schedule jsonb not null check(jsonb_typeof(prior_schedule)='array'),
  proposed_schedule jsonb not null check(jsonb_typeof(proposed_schedule)='array'),
  affected_games jsonb not null check(jsonb_typeof(affected_games)='array'),
  unaffected_game_count integer not null check(unaffected_game_count>=0),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(amendment_id,version),unique(event_id,version),unique(id,tournament_id,event_id)
);
alter table app.event_schedule_amendment_versions enable row level security;
alter table app.event_schedule_amendment_versions force row level security;
revoke all on table app.event_schedule_amendment_versions from public,anon,authenticated;
create trigger event_schedule_amendments_immutable before update or delete on app.event_schedule_amendment_versions
for each row execute function app.reject_immutable_history();
create index event_schedule_amendments_event_idx on app.event_schedule_amendment_versions(event_id,version desc);
create index event_schedule_amendments_actor_idx on app.event_schedule_amendment_versions(actor_profile_id);

create table app.event_game_standings_eligibility_versions(
  id uuid primary key default extensions.gen_random_uuid(),canonical_game_id uuid not null,
  tournament_id uuid not null,event_id uuid not null,version integer not null check(version>0),
  standings_eligible boolean not null,reason text not null check(length(trim(reason)) between 1 and 500),
  amendment_version_id uuid not null,created_at timestamptz not null default clock_timestamp(),
  foreign key(canonical_game_id,tournament_id,event_id) references app.canonical_games(id,tournament_id,event_id) on delete restrict,
  foreign key(amendment_version_id,tournament_id,event_id) references app.event_schedule_amendment_versions(id,tournament_id,event_id) on delete restrict,
  unique(canonical_game_id,version)
);
alter table app.event_game_standings_eligibility_versions enable row level security;
alter table app.event_game_standings_eligibility_versions force row level security;
revoke all on table app.event_game_standings_eligibility_versions from public,anon,authenticated;
create trigger event_game_eligibility_immutable before update or delete on app.event_game_standings_eligibility_versions
for each row execute function app.reject_immutable_history();
create index event_game_eligibility_current_idx on app.event_game_standings_eligibility_versions(canonical_game_id,version desc);

create or replace function app.game_counts_in_standings_v1(p_game_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select current.standings_eligible from(
    select distinct on(item.canonical_game_id) item.* from app.event_game_standings_eligibility_versions item
    where item.canonical_game_id=p_game_id order by item.canonical_game_id,item.version desc
  ) current),true)
$$;
revoke all on function app.game_counts_in_standings_v1(uuid) from public,anon,authenticated;

create table app.operational_game_forfeits(
  id uuid primary key,tournament_id uuid not null,event_id uuid not null,canonical_game_id uuid not null,
  winner_participant_id uuid not null,departing_participant_id uuid not null,
  rule_case text not null check(rule_case in('early_departure_current_game','playoff_absence_5','playoff_absence_20','playoff_absence_35')),
  margin integer not null default 10 check(margin=10),game_points smallint not null default 2 check(game_points=2),
  director_reason text not null check(length(trim(director_reason)) between 1 and 1000),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(canonical_game_id,tournament_id,event_id) references app.canonical_games(id,tournament_id,event_id) on delete restrict,
  foreign key(winner_participant_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id) on delete restrict,
  foreign key(departing_participant_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(canonical_game_id),check(winner_participant_id<>departing_participant_id)
);
alter table app.operational_game_forfeits enable row level security;
alter table app.operational_game_forfeits force row level security;
revoke all on table app.operational_game_forfeits from public,anon,authenticated;
create trigger operational_game_forfeits_immutable before update or delete on app.operational_game_forfeits
for each row execute function app.reject_immutable_history();

create table app.playoff_absence_decisions(
  id uuid primary key,tournament_id uuid not null,event_id uuid not null,participant_id uuid not null,
  elapsed_minutes integer not null check(elapsed_minutes>=5),forfeited_games integer not null check(forfeited_games between 1 and 3),
  retained_round_loser_award boolean not null default true,retained_mrps boolean not null default true,
  reason text not null check(length(trim(reason)) between 1 and 1000),actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,created_at timestamptz not null default clock_timestamp(),
  foreign key(participant_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict
);
alter table app.playoff_absence_decisions enable row level security;
alter table app.playoff_absence_decisions force row level security;
revoke all on table app.playoff_absence_decisions from public,anon,authenticated;
create trigger playoff_absence_decisions_immutable before update or delete on app.playoff_absence_decisions
for each row execute function app.reject_immutable_history();

create table app.late_player_refund_decisions(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,participant_id uuid not null,roster_entry_id uuid not null,
 amount_received_minor integer not null check(amount_received_minor>=0),committed_charges jsonb not null check(jsonb_typeof(committed_charges)='array'),
 committed_total_minor integer not null check(committed_total_minor>=0),refund_due_minor integer not null check(refund_due_minor>=0),
 reason text not null check(length(trim(reason)) between 1 and 1000),actor_profile_id uuid not null references app.profiles(id) on delete restrict,
 operation_receipt_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(participant_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id) on delete restrict,
 foreign key(roster_entry_id,tournament_id) references app.tournament_roster_entries(id,tournament_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
 check(refund_due_minor=greatest(amount_received_minor-committed_total_minor,0))
);
alter table app.late_player_refund_decisions enable row level security;alter table app.late_player_refund_decisions force row level security;
revoke all on table app.late_player_refund_decisions from public,anon,authenticated;
create trigger late_player_refund_decisions_immutable before update or delete on app.late_player_refund_decisions for each row execute function app.reject_immutable_history();

create table app.event_excluded_extra_game_records(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,participant_a_id uuid not null,participant_b_id uuid not null,
 winner_participant_id uuid not null,margin integer not null check(margin between 1 and 121),
 cross_check_evidence jsonb not null check(jsonb_typeof(cross_check_evidence)='array' and jsonb_array_length(cross_check_evidence)>=2),
 standings_eligible boolean not null default false check(standings_eligible=false),reason text not null check(length(trim(reason)) between 1 and 1000),
 actor_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(participant_a_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id) on delete restrict,
 foreign key(participant_b_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
 check(participant_a_id<>participant_b_id),check(winner_participant_id in(participant_a_id,participant_b_id))
);
alter table app.event_excluded_extra_game_records enable row level security;alter table app.event_excluded_extra_game_records force row level security;
revoke all on table app.event_excluded_extra_game_records from public,anon,authenticated;
create trigger event_excluded_extra_games_immutable before update or delete on app.event_excluded_extra_game_records for each row execute function app.reject_immutable_history();

-- Published assignments may change only inside the validated amendment RPC.
create or replace function app.protect_published_schedule_game()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from app.event_schedule_games sg where sg.canonical_game_id=old.id) then
    if tg_op='DELETE' then raise exception 'published schedule game is immutable';end if;
    if (new.tournament_id,new.event_id,new.round_id,new.match_instance) is distinct from
       (old.tournament_id,old.event_id,old.round_id,old.match_instance) then raise exception 'published schedule identity is immutable';end if;
    if (new.side_a_participant_id,new.side_b_participant_id,new.side_a_table_seat_snapshot,new.side_b_table_seat_snapshot) is distinct from
       (old.side_a_participant_id,old.side_b_participant_id,old.side_a_table_seat_snapshot,old.side_b_table_seat_snapshot)
       and current_setting('app.validated_schedule_amendment',true) is distinct from 'on' then
      raise exception 'published schedule assignment is immutable';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function app.protect_published_schedule_game() from public,anon,authenticated;

create or replace function app.schedule_snapshot_v1(p_event_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'gameId',game.id,'gameNumber',round_row.round_number,
    'sideAParticipantId',game.side_a_participant_id,'sideBParticipantId',game.side_b_participant_id,
    'sideATableSeat',game.side_a_table_seat_snapshot,'sideBTableSeat',game.side_b_table_seat_snapshot,
    'standingsEligible',app.game_counts_in_standings_v1(game.id),'state',game.state
  ) order by round_row.round_number,scheduled.import_row_number),'[]'::jsonb)
  from app.event_schedule_games scheduled join app.canonical_games game on game.id=scheduled.canonical_game_id
  join app.rounds round_row on round_row.id=game.round_id where scheduled.event_id=p_event_id
$$;
revoke all on function app.schedule_snapshot_v1(uuid) from public,anon,authenticated;

create or replace function public.preview_event_schedule_amendment_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_kind text,
  p_rule_basis text,p_director_reason text,p_proposed_schedule jsonb,p_expected_version integer
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_prior jsonb;v_changed integer;v_total integer;v_allowed_repeat integer:=1;
begin
  if p_actor_id is null or p_operation_kind not in('omitted_player_before_play','late_player_before_game_two','odd_field_first_sitout_makeup','early_departure_substitute','odd_field_extra_games','mixed_rotation_repair','reinstatement_future_games')
    or length(trim(p_rule_basis)) not between 1 and 500 or length(trim(p_director_reason)) not between 1 and 1000
    or jsonb_typeof(p_proposed_schedule)<>'array' or p_expected_version is null or p_expected_version<0 then
    return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then
    return jsonb_build_object('status','rejected','code','not_director');end if;
  if app.event_play_state_v1(p_event_id)='finalized' or not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id) then
    return jsonb_build_object('status','rejected','code','event_unavailable');end if;
  if (select count(*) from app.event_schedule_amendment_versions where event_id=p_event_id)<>p_expected_version then
    return jsonb_build_object('status','rejected','code','stale_schedule_version');end if;
  v_prior:=app.schedule_snapshot_v1(p_event_id);v_total:=jsonb_array_length(v_prior);
  if jsonb_array_length(p_proposed_schedule)<>v_total or
     (select count(distinct (item->>'gameId')::uuid) from jsonb_array_elements(p_proposed_schedule) item)<>v_total or
     exists(select 1 from jsonb_array_elements(p_proposed_schedule) item where not exists(
       select 1 from app.event_schedule_games scheduled where scheduled.event_id=p_event_id and scheduled.canonical_game_id=(item->>'gameId')::uuid)) then
    return jsonb_build_object('status','rejected','code','incomplete_schedule');end if;
  if exists(select 1 from jsonb_array_elements(p_proposed_schedule) item
    where (item->>'sideAParticipantId')::uuid=(item->>'sideBParticipantId')::uuid
      or coalesce(item->>'sideATableSeat','')!~'^[A-Za-z0-9]+-[0-9]+$'
      or coalesce(item->>'sideBTableSeat','')!~'^[A-Za-z0-9]+-[0-9]+$'
      or not exists(select 1 from app.event_participants participant where participant.id=(item->>'sideAParticipantId')::uuid and participant.event_id=p_event_id and participant.tournament_id=p_tournament_id)
      or not exists(select 1 from app.event_participants participant where participant.id=(item->>'sideBParticipantId')::uuid and participant.event_id=p_event_id and participant.tournament_id=p_tournament_id)) then
    return jsonb_build_object('status','rejected','code','invalid_assignment');end if;
  -- A player and a physical seat may appear only once in the same game number.
  if exists(with expanded as(
      select (item->>'gameNumber')::integer game_number,(item->>'sideAParticipantId')::uuid participant_id,item->>'sideATableSeat' seat from jsonb_array_elements(p_proposed_schedule) item
      union all select (item->>'gameNumber')::integer,(item->>'sideBParticipantId')::uuid,item->>'sideBTableSeat' from jsonb_array_elements(p_proposed_schedule) item)
    select 1 from expanded group by game_number,participant_id having count(*)>1) or
    exists(with expanded as(
      select (item->>'gameNumber')::integer game_number,item->>'sideATableSeat' seat from jsonb_array_elements(p_proposed_schedule) item
      union all select (item->>'gameNumber')::integer,item->>'sideBTableSeat' from jsonb_array_elements(p_proposed_schedule) item)
    select 1 from expanded group by game_number,seat having count(*)>1) then
    return jsonb_build_object('status','rejected','code','round_conflict');end if;
  -- Final qualifying games must be played by a substitute. That rule blocks a
  -- forfeit, not the schedule amendment that places the substitute.
  v_allowed_repeat:=case when p_operation_kind='early_departure_substitute' then 2 else 1 end;
  if exists(with pairs as(select least((item->>'sideAParticipantId')::uuid,(item->>'sideBParticipantId')::uuid) low_id,greatest((item->>'sideAParticipantId')::uuid,(item->>'sideBParticipantId')::uuid) high_id from jsonb_array_elements(p_proposed_schedule) item)
    select 1 from pairs group by low_id,high_id having count(*)>v_allowed_repeat) then
    return jsonb_build_object('status','rejected','code','duplicate_opponent');end if;
  select count(*) into v_changed from jsonb_array_elements(p_proposed_schedule) item
    join jsonb_array_elements(v_prior) old on old->>'gameId'=item->>'gameId'
    where (item->>'sideAParticipantId',item->>'sideBParticipantId',item->>'sideATableSeat',item->>'sideBTableSeat',coalesce((item->>'standingsEligible')::boolean,true)) is distinct from
          (old->>'sideAParticipantId',old->>'sideBParticipantId',old->>'sideATableSeat',old->>'sideBTableSeat',coalesce((old->>'standingsEligible')::boolean,true));
  if v_changed=0 then return jsonb_build_object('status','rejected','code','unchanged_schedule');end if;
  if exists(select 1 from jsonb_array_elements(p_proposed_schedule) item join jsonb_array_elements(v_prior) old on old->>'gameId'=item->>'gameId'
    join app.canonical_games game on game.id=(item->>'gameId')::uuid
    where (item->>'sideAParticipantId',item->>'sideBParticipantId',item->>'sideATableSeat',item->>'sideBTableSeat') is distinct from
          (old->>'sideAParticipantId',old->>'sideBParticipantId',old->>'sideATableSeat',old->>'sideBTableSeat')
      and (game.state<>'pending' or exists(select 1 from app.score_submissions submission where submission.canonical_game_id=game.id)
        or exists(select 1 from app.card_scorelines scoreline where scoreline.canonical_game_id=game.id)
        or app.game_is_authoritatively_resolved_v1(game.id))) then
    return jsonb_build_object('status','rejected','code','resolved_game_immutable');end if;
  return jsonb_build_object('status','schedule_amendment_preview','eventId',p_event_id,'expectedVersion',p_expected_version,
    'affectedGameCount',v_changed,'unaffectedGameCount',v_total-v_changed,'priorSchedule',v_prior,'proposedSchedule',p_proposed_schedule,
    'directorDecisionRequired',p_operation_kind='mixed_rotation_repair');
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then
  return jsonb_build_object('status','rejected','code','invalid_schedule');
end $$;
revoke all on function public.preview_event_schedule_amendment_v1(uuid,uuid,uuid,text,text,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.preview_event_schedule_amendment_v1(uuid,uuid,uuid,text,text,text,jsonb,integer) to service_role;

create or replace function public.confirm_event_schedule_amendment_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_amendment_id uuid,p_operation_kind text,
  p_rule_basis text,p_director_reason text,p_proposed_schedule jsonb,p_expected_version integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_preview jsonb;v_hash text;v_prior_receipt app.operation_receipts%rowtype;v_receipt uuid:=extensions.gen_random_uuid();v_version_id uuid:=extensions.gen_random_uuid();v_response jsonb;v_prior jsonb;v_item jsonb;v_old jsonb;v_game uuid;v_new_version integer:=p_expected_version+1;
begin
  if p_amendment_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('confirm_event_schedule_amendment_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_amendment_id::text,p_operation_kind,p_rule_basis,p_director_reason,p_proposed_schedule,p_expected_version)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule-amendment:'||p_event_id::text,0));
  select * into v_prior_receipt from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
  if found then if v_prior_receipt.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior_receipt.response_payload;end if;
  v_preview:=public.preview_event_schedule_amendment_v1(p_actor_id,p_tournament_id,p_event_id,p_operation_kind,p_rule_basis,p_director_reason,p_proposed_schedule,p_expected_version);
  if v_preview->>'status'<>'schedule_amendment_preview' then return v_preview;end if;
  v_prior:=v_preview->'priorSchedule';
  v_response:=jsonb_build_object('status','schedule_amendment_applied','eventId',p_event_id,'amendmentId',p_amendment_id,'version',v_new_version,
    'affectedGameCount',(v_preview->>'affectedGameCount')::integer,'unaffectedGameCount',(v_preview->>'unaffectedGameCount')::integer);
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(v_receipt,p_actor_id,p_tournament_id,'confirm_event_schedule_amendment_v1',p_amendment_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
  insert into app.event_schedule_amendment_versions(id,amendment_id,tournament_id,event_id,version,operation_kind,rule_basis,director_reason,prior_schedule,proposed_schedule,affected_games,unaffected_game_count,actor_profile_id,operation_receipt_id)
    values(v_version_id,p_amendment_id,p_tournament_id,p_event_id,v_new_version,p_operation_kind,trim(p_rule_basis),trim(p_director_reason),v_prior,p_proposed_schedule,
      (select coalesce(jsonb_agg(item),'[]'::jsonb) from jsonb_array_elements(p_proposed_schedule) item join jsonb_array_elements(v_prior) old on old->>'gameId'=item->>'gameId' where item<>old),
      (v_preview->>'unaffectedGameCount')::integer,p_actor_id,v_receipt);
  perform pg_catalog.set_config('app.validated_schedule_amendment','on',true);
  for v_item in select item from jsonb_array_elements(p_proposed_schedule) item loop
    v_game:=(v_item->>'gameId')::uuid;select item into v_old from jsonb_array_elements(v_prior) item where item->>'gameId'=v_item->>'gameId';
    if (v_item->>'sideAParticipantId',v_item->>'sideBParticipantId',v_item->>'sideATableSeat',v_item->>'sideBTableSeat') is distinct from
       (v_old->>'sideAParticipantId',v_old->>'sideBParticipantId',v_old->>'sideATableSeat',v_old->>'sideBTableSeat') then
      update app.canonical_games set side_a_participant_id=(v_item->>'sideAParticipantId')::uuid,side_b_participant_id=(v_item->>'sideBParticipantId')::uuid,
        side_a_table_seat_snapshot=v_item->>'sideATableSeat',side_b_table_seat_snapshot=v_item->>'sideBTableSeat',version=version+1 where id=v_game;
    end if;
    if coalesce((v_item->>'standingsEligible')::boolean,true) is distinct from coalesce((v_old->>'standingsEligible')::boolean,true) then
      insert into app.event_game_standings_eligibility_versions(canonical_game_id,tournament_id,event_id,version,standings_eligible,reason,amendment_version_id)
      values(v_game,p_tournament_id,p_event_id,coalesce((select max(version) from app.event_game_standings_eligibility_versions where canonical_game_id=v_game),0)+1,
        coalesce((v_item->>'standingsEligible')::boolean,true),trim(p_director_reason),v_version_id);
    end if;
  end loop;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
    values(p_tournament_id,p_actor_id,v_receipt,'event_schedule_amendment',p_amendment_id,'schedule_amendment_applied',v_prior,v_response||jsonb_build_object('ruleBasis',trim(p_rule_basis)));
  return v_response;
end $$;
revoke all on function public.confirm_event_schedule_amendment_v1(uuid,uuid,uuid,uuid,text,text,text,jsonb,integer,uuid) from public,anon,authenticated;
grant execute on function public.confirm_event_schedule_amendment_v1(uuid,uuid,uuid,uuid,text,text,text,jsonb,integer,uuid) to service_role;

create or replace function public.record_operational_forfeit_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_game_id uuid,p_forfeit_id uuid,p_winner_participant_id uuid,
  p_departing_participant_id uuid,p_rule_case text,p_director_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_game app.canonical_games%rowtype;v_hash text;v_prior app.operation_receipts%rowtype;v_receipt uuid:=extensions.gen_random_uuid();v_response jsonb;v_round integer;v_max_round integer;
begin
  if p_actor_id is null or p_forfeit_id is null or p_idempotency_key is null or p_rule_case not in('early_departure_current_game','playoff_absence_5','playoff_absence_20','playoff_absence_35') or length(trim(p_director_reason)) not between 1 and 1000 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('record_operational_forfeit_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_game_id::text,p_forfeit_id::text,p_winner_participant_id::text,p_departing_participant_id::text,p_rule_case,p_director_reason)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('operational-forfeit:'||p_game_id::text,0));
  perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director') for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
  select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior.response_payload;end if;
  select * into v_game from app.canonical_games where id=p_game_id and event_id=p_event_id and tournament_id=p_tournament_id for update;
  if not found or p_winner_participant_id not in(v_game.side_a_participant_id,v_game.side_b_participant_id) or p_departing_participant_id not in(v_game.side_a_participant_id,v_game.side_b_participant_id) or p_winner_participant_id=p_departing_participant_id then return jsonb_build_object('status','rejected','code','game_unavailable');end if;
  if app.event_play_state_v1(p_event_id)<>'in_progress' or app.game_is_authoritatively_resolved_v1(p_game_id) or exists(select 1 from app.score_submissions where canonical_game_id=p_game_id)
    or app.participant_game_progression_v1(p_game_id,p_winner_participant_id) is distinct from 'current'
    or app.participant_game_progression_v1(p_game_id,p_departing_participant_id) is distinct from 'current'
  then return jsonb_build_object('status','rejected','code','game_not_forfeitable');end if;
  select round_number into v_round from app.rounds where id=v_game.round_id;select max(round_number) into v_max_round from app.rounds where event_id=p_event_id;
  if p_rule_case='early_departure_current_game' and v_round=v_max_round then return jsonb_build_object('status','rejected','code','final_game_requires_substitute');end if;
  v_response:=jsonb_build_object('status','operational_forfeit_recorded','eventId',p_event_id,'gameId',p_game_id,'forfeitId',p_forfeit_id,'winnerParticipantId',p_winner_participant_id,'gamePoints',2,'spreadPoints',10);
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt,p_actor_id,p_tournament_id,'record_operational_forfeit_v1',p_forfeit_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
  insert into app.operational_game_forfeits(id,tournament_id,event_id,canonical_game_id,winner_participant_id,departing_participant_id,rule_case,director_reason,actor_profile_id,operation_receipt_id)
    values(p_forfeit_id,p_tournament_id,p_event_id,p_game_id,p_winner_participant_id,p_departing_participant_id,p_rule_case,trim(p_director_reason),p_actor_id,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,p_game_id,v_receipt,'operational_game_forfeit',p_forfeit_id,'operational_forfeit_recorded',v_response);
  return v_response;
end $$;
revoke all on function public.record_operational_forfeit_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.record_operational_forfeit_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,uuid) to service_role;

create or replace function public.record_playoff_absence_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_participant_id uuid,p_decision_id uuid,p_elapsed_minutes integer,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_games integer;v_hash text;v_prior app.operation_receipts%rowtype;v_receipt uuid:=extensions.gen_random_uuid();v_response jsonb;
begin
 if p_actor_id is null or p_decision_id is null or p_idempotency_key is null or p_elapsed_minutes<5 or length(trim(p_reason)) not between 1 and 1000 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 v_games:=case when p_elapsed_minutes>=35 then 3 when p_elapsed_minutes>=20 then 2 else 1 end;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('record_playoff_absence_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_participant_id::text,p_decision_id::text,p_elapsed_minutes,p_reason)::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director') for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior.response_payload;end if;
 if not exists(select 1 from app.event_participants where id=p_participant_id and event_id=p_event_id and tournament_id=p_tournament_id) then return jsonb_build_object('status','rejected','code','participant_unavailable');end if;
 v_response:=jsonb_build_object('status','playoff_absence_recorded','eventId',p_event_id,'participantId',p_participant_id,'elapsedMinutes',p_elapsed_minutes,'forfeitedGames',v_games,'roundLoserAwardRetained',true,'mrpsRetained',true);
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt,p_actor_id,p_tournament_id,'record_playoff_absence_v1',p_decision_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
 insert into app.playoff_absence_decisions(id,tournament_id,event_id,participant_id,elapsed_minutes,forfeited_games,reason,actor_profile_id,operation_receipt_id) values(p_decision_id,p_tournament_id,p_event_id,p_participant_id,p_elapsed_minutes,v_games,trim(p_reason),p_actor_id,v_receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'playoff_absence',p_decision_id,'playoff_absence_recorded',v_response);
 return v_response;
end $$;
revoke all on function public.record_playoff_absence_v1(uuid,uuid,uuid,uuid,uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.record_playoff_absence_v1(uuid,uuid,uuid,uuid,uuid,integer,text,uuid) to service_role;

create or replace function public.record_late_player_refund_decision_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_participant_id uuid,p_decision_id uuid,p_committed_charges jsonb,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_participant app.event_participants%rowtype;v_received integer;v_committed integer;v_refund integer;v_hash text;v_prior app.operation_receipts%rowtype;v_receipt uuid:=extensions.gen_random_uuid();v_response jsonb;
begin
 if p_actor_id is null or p_decision_id is null or p_idempotency_key is null or jsonb_typeof(p_committed_charges)<>'array' or length(trim(p_reason)) not between 1 and 1000 or exists(select 1 from jsonb_array_elements(p_committed_charges)item where length(trim(coalesce(item->>'label',''))) not between 1 and 100 or coalesce((item->>'amountMinor')::integer,-1)<0) then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('record_late_player_refund_decision_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_participant_id::text,p_decision_id::text,p_committed_charges,p_reason)::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director') for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior.response_payload;end if;
 select * into v_participant from app.event_participants where id=p_participant_id and event_id=p_event_id and tournament_id=p_tournament_id for update;if not found or v_participant.roster_entry_id is null then return jsonb_build_object('status','rejected','code','participant_unavailable');end if;
 -- Ordinary qualifying admission is closed only once scoring activity has begun in Game 2.
 if not exists(select 1 from app.event_schedule_games scheduled join app.canonical_games game on game.id=scheduled.canonical_game_id join app.rounds round_row on round_row.id=game.round_id where scheduled.event_id=p_event_id and round_row.round_number>=2 and (game.state<>'pending' or exists(select 1 from app.score_submissions where canonical_game_id=game.id) or app.game_is_authoritatively_resolved_v1(game.id))) then return jsonb_build_object('status','rejected','code','game_two_not_started');end if;
 select coalesce((select case when payment.event_type='received' then payment.amount_minor else 0 end from app.roster_payment_events payment where payment.roster_entry_id=v_participant.roster_entry_id order by payment.version desc limit 1),0) into v_received;
 select coalesce(sum((item->>'amountMinor')::integer),0)::integer into v_committed from jsonb_array_elements(p_committed_charges)item;v_refund:=greatest(v_received-v_committed,0);
 v_response:=jsonb_build_object('status','late_player_refund_decision_recorded','eventId',p_event_id,'participantId',p_participant_id,'decisionId',p_decision_id,'amountReceivedMinor',v_received,'committedTotalMinor',v_committed,'refundDueMinor',v_refund,'ordinaryAdmissionRejected',true);
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt,p_actor_id,p_tournament_id,'record_late_player_refund_decision_v1',p_decision_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
 insert into app.late_player_refund_decisions(id,tournament_id,event_id,participant_id,roster_entry_id,amount_received_minor,committed_charges,committed_total_minor,refund_due_minor,reason,actor_profile_id,operation_receipt_id) values(p_decision_id,p_tournament_id,p_event_id,p_participant_id,v_participant.roster_entry_id,v_received,p_committed_charges,v_committed,v_refund,trim(p_reason),p_actor_id,v_receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'late_player_refund_decision',p_decision_id,'late_player_admission_rejected_after_game_two',v_response||jsonb_build_object('committedCharges',p_committed_charges));return v_response;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');
end $$;
revoke all on function public.record_late_player_refund_decision_v1(uuid,uuid,uuid,uuid,uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.record_late_player_refund_decision_v1(uuid,uuid,uuid,uuid,uuid,jsonb,text,uuid) to service_role;

create or replace function public.record_excluded_extra_game_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_record_id uuid,p_participant_a_id uuid,p_participant_b_id uuid,p_winner_participant_id uuid,p_margin integer,p_cross_check_evidence jsonb,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_prior app.operation_receipts%rowtype;v_receipt uuid:=extensions.gen_random_uuid();v_response jsonb;
begin
 if p_actor_id is null or p_record_id is null or p_idempotency_key is null or p_participant_a_id=p_participant_b_id or p_winner_participant_id not in(p_participant_a_id,p_participant_b_id) or p_margin not between 1 and 121 or jsonb_typeof(p_cross_check_evidence)<>'array' or jsonb_array_length(p_cross_check_evidence)<2 or length(trim(p_reason)) not between 1 and 1000 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('record_excluded_extra_game_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_record_id::text,p_participant_a_id::text,p_participant_b_id::text,p_winner_participant_id::text,p_margin,p_cross_check_evidence,p_reason)::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director','cross_checker') for update;if not found then return jsonb_build_object('status','rejected','code','not_official');end if;
 select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior.response_payload;end if;
 if not exists(select 1 from app.event_participants where id=p_participant_a_id and event_id=p_event_id and tournament_id=p_tournament_id) or not exists(select 1 from app.event_participants where id=p_participant_b_id and event_id=p_event_id and tournament_id=p_tournament_id) then return jsonb_build_object('status','rejected','code','participant_unavailable');end if;
 v_response:=jsonb_build_object('status','excluded_extra_game_recorded','eventId',p_event_id,'recordId',p_record_id,'winnerParticipantId',p_winner_participant_id,'margin',p_margin,'standingsEligible',false,'crossCheckEvidenceCount',jsonb_array_length(p_cross_check_evidence));
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt,p_actor_id,p_tournament_id,'record_excluded_extra_game_v1',p_record_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
 insert into app.event_excluded_extra_game_records(id,tournament_id,event_id,participant_a_id,participant_b_id,winner_participant_id,margin,cross_check_evidence,reason,actor_profile_id,operation_receipt_id) values(p_record_id,p_tournament_id,p_event_id,p_participant_a_id,p_participant_b_id,p_winner_participant_id,p_margin,p_cross_check_evidence,trim(p_reason),p_actor_id,v_receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'excluded_extra_game',p_record_id,'cross_checked_extra_game_excluded_from_standings',v_response);return v_response;
end $$;
revoke all on function public.record_excluded_extra_game_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.record_excluded_extra_game_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,jsonb,text,uuid) to service_role;

create or replace function public.get_schedule_amendment_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when base.payload is null then null else base.payload||jsonb_build_object(
    'amendmentVersions',coalesce((select jsonb_object_agg(event_row.id::text,coalesce(latest.version,0))
      from app.events event_row left join lateral(select max(amendment.version)::integer version from app.event_schedule_amendment_versions amendment where amendment.event_id=event_row.id)latest on true
      where event_row.tournament_id=p_tournament_id),'{}'::jsonb),
    'amendmentSchedule',coalesce((select jsonb_agg(jsonb_build_object('eventId',event_row.id,'games',app.schedule_snapshot_v1(event_row.id)) order by event_row.name) from app.events event_row where event_row.tournament_id=p_tournament_id),'[]'::jsonb),
    'ruleCases',jsonb_build_array(
      jsonb_build_object('code','omitted_player_before_play','label','Omitted eligible player before play','rule','ACC Director Manual pp. 16–17'),
      jsonb_build_object('code','late_player_before_game_two','label','Preregistered player returns before Game 2','rule','ACC Director Manual pp. 16–17'),
      jsonb_build_object('code','odd_field_first_sitout_makeup','label','Late arrival paired with first sit-out; makeup after normal play','rule','ACC Director Manual pp. 16–17'),
      jsonb_build_object('code','early_departure_substitute','label','Substitute for future games after early departure','rule','ACC Director Manual pp. 17–18'),
      jsonb_build_object('code','odd_field_extra_games','label','Cross-checked extra games excluded from standings','rule','ACC Director Manual pp. 17–18'),
      jsonb_build_object('code','mixed_rotation_repair','label','Director-reviewed mixed-rotation repair','rule','ACC Director Manual: director decision'),
      jsonb_build_object('code','reinstatement_future_games','label','Reinstate for future games only','rule','Audited future participation')
    ),
    'forfeits',coalesce((select jsonb_agg(jsonb_build_object('gameId',forfeiture.canonical_game_id,'winnerParticipantId',forfeiture.winner_participant_id,'departingParticipantId',forfeiture.departing_participant_id,'ruleCase',forfeiture.rule_case,'createdAt',forfeiture.created_at) order by forfeiture.created_at) from app.operational_game_forfeits forfeiture where forfeiture.tournament_id=p_tournament_id),'[]'::jsonb)
  ) end from lateral(select public.get_event_schedule_workspace_v1(p_actor_id,p_tournament_id) payload)base
$$;
revoke all on function public.get_schedule_amendment_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_schedule_amendment_workspace_v1(uuid,uuid) to service_role;

create or replace function app.game_is_authoritatively_resolved_v1(p_game_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.canonical_games game where game.id=p_game_id and game.state in('verified','corrected') and (select count(*) from app.card_scorelines scoreline where scoreline.canonical_game_id=game.id)=2)
 or exists(select 1 from app.device_failure_recoveries recovery where recovery.canonical_game_id=p_game_id and app.device_recovery_is_approved(recovery.id))
 or exists(select 1 from app.operational_game_forfeits forfeiture where forfeiture.canonical_game_id=p_game_id)
$$;
revoke all on function app.game_is_authoritatively_resolved_v1(uuid) from public,anon,authenticated;

-- Include audited operational forfeits, and exclude expressly designated extra
-- games, from every standings/award projection.
create or replace function app.current_effective_scorelines(p_tournament_id uuid,p_event_id uuid)
returns table(line_id uuid,canonical_game_id uuid,participant_id uuid,opponent_participant_id uuid,side text,table_seat_snapshot text,is_winner boolean,margin integer,plus_points integer,minus_points integer,game_points smallint,recovered boolean)
language sql stable security definer set search_path='' as $$
 select scoreline.id,scoreline.canonical_game_id,scoreline.participant_id,scoreline.opponent_participant_id,scoreline.side,scoreline.table_seat_snapshot,
   coalesce(correction.adjudicated_is_winner,scoreline.is_winner),coalesce(correction.adjudicated_margin,scoreline.margin),coalesce(correction.adjudicated_plus_points,scoreline.plus_points),coalesce(correction.adjudicated_minus_points,scoreline.minus_points),coalesce(correction.adjudicated_game_points,scoreline.game_points),false
 from app.card_scorelines scoreline join app.canonical_games game on game.id=scoreline.canonical_game_id
 left join lateral(select projection.adjudicated_is_winner,projection.adjudicated_margin,projection.adjudicated_plus_points,projection.adjudicated_minus_points,projection.adjudicated_game_points from app.independent_card_correction_projections projection join app.independent_card_corrections correction_row on correction_row.id=projection.correction_id where projection.canonical_scoreline_id=scoreline.id and exists(select 1 from app.independent_card_correction_state_events state_event where state_event.correction_id=correction_row.id and state_event.state='applied') order by correction_row.correction_sequence desc limit 1) correction on true
 where scoreline.tournament_id=p_tournament_id and scoreline.event_id=p_event_id and game.state in('verified','corrected') and app.game_counts_in_standings_v1(game.id)
 union all
 select projection.id,projection.canonical_game_id,projection.participant_id,projection.opponent_participant_id,projection.side,projection.table_seat_snapshot,projection.is_winner,projection.margin,projection.plus_points,projection.minus_points,projection.game_points,true
 from app.device_failure_recovery_projections projection where projection.tournament_id=p_tournament_id and projection.event_id=p_event_id and app.device_recovery_is_approved(projection.recovery_id) and app.game_counts_in_standings_v1(projection.canonical_game_id) and not exists(select 1 from app.card_scorelines where canonical_game_id=projection.canonical_game_id)
 union all
 select forfeiture.id,forfeiture.canonical_game_id,participant.id,case when participant.id=game.side_a_participant_id then game.side_b_participant_id else game.side_a_participant_id end,
   case when participant.id=game.side_a_participant_id then 'a' else 'b' end,case when participant.id=game.side_a_participant_id then game.side_a_table_seat_snapshot else game.side_b_table_seat_snapshot end,
   participant.id=forfeiture.winner_participant_id,10,case when participant.id=forfeiture.winner_participant_id then 10 else 0 end,case when participant.id=forfeiture.winner_participant_id then 0 else 10 end,
   case when participant.id=forfeiture.winner_participant_id then 2 else 0 end::smallint,false
 from app.operational_game_forfeits forfeiture join app.canonical_games game on game.id=forfeiture.canonical_game_id
 join app.event_participants participant on participant.id in(game.side_a_participant_id,game.side_b_participant_id)
 where forfeiture.tournament_id=p_tournament_id and forfeiture.event_id=p_event_id and app.game_counts_in_standings_v1(forfeiture.canonical_game_id)
$$;
revoke all on function app.current_effective_scorelines(uuid,uuid) from public,anon,authenticated;

-- A game resolved by an official forfeit is complete and cannot remain an
-- apparent score-entry task on either player's dashboard.
create or replace function public.get_my_assigned_games_v1(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with base as(select app.get_my_assigned_games_pre_progression_v1(p_tournament_id) payload)
  select case when payload is null then null else jsonb_set(payload,'{games}',coalesce((
    select jsonb_agg(item.game||jsonb_build_object('progressionStatus',progress.status,'nextAction',
      case when progress.status='not_started' then 'event_not_started'
        when progress.status='upcoming' then 'upcoming_locked'
        when progress.status='completed' then 'view_scorecard'
        else item.game->>'nextAction' end,
      'canConfirm',case when progress.status='current' then (item.game->>'canConfirm')::boolean else false end)
      order by (item.game->>'eventName'),(item.game->>'gameNumber')::integer,(item.game->>'matchInstance')::integer)
    from jsonb_array_elements(payload->'games') item(game)
    join app.canonical_games game on game.id=(item.game->>'gameId')::uuid
    join app.event_participants participant on participant.id in(game.side_a_participant_id,game.side_b_participant_id)
      and participant.profile_id=(select auth.uid())
    cross join lateral(select app.participant_game_progression_v1(game.id,participant.id) status) progress
  ),'[]'::jsonb),false) end from base
$$;
revoke all on function public.get_my_assigned_games_v1(uuid) from public,anon;
grant execute on function public.get_my_assigned_games_v1(uuid) to authenticated;

-- Count the same authoritative sources used by the totals projection. In
-- particular, an audited operational forfeit is resolved evidence even though
-- it intentionally does not fabricate two player submissions.
create or replace function public.get_preliminary_event_standings(
  p_tournament_id uuid,
  p_event_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with authorized_event as (
    select tournament_row.id as tournament_id, tournament_row.name as tournament_name,
      event_row.id as event_id, event_row.name as event_name,
      coalesce(setup_event.game_count, publication.game_count)::integer as configured_game_count,
      publication.id is not null as schedule_published,
      coalesce(publication.match_count, 0)::integer as scheduled_match_count
    from app.tournaments tournament_row
    join app.events event_row on event_row.tournament_id = tournament_row.id
      and event_row.id = p_event_id
    join app.ruleset_versions ruleset on ruleset.id = event_row.ruleset_version_id
      and ruleset.tournament_id = event_row.tournament_id
      and ruleset.format = 'standard_singles' and ruleset.approved_at is not null
    left join app.tournament_setup_activations activation
      on activation.tournament_id = event_row.tournament_id
      and activation.event_id = event_row.id
    left join app.tournament_setup_event_versions setup_event
      on setup_event.id = activation.setup_event_version_id
      and setup_event.tournament_id = activation.tournament_id
    left join app.event_schedule_publications publication
      on publication.tournament_id = event_row.tournament_id
      and publication.event_id = event_row.id
    where tournament_row.id = p_tournament_id
      and event_row.format = 'standard_singles'
      and event_row.scoring_method = 'digital'
      and (select auth.uid()) is not null
      and exists (
        select 1 from app.tournament_roles role_row
        where role_row.tournament_id = tournament_row.id
          and role_row.profile_id = (select auth.uid())
          and role_row.role in ('director','co_director','player','cross_checker','judge','viewer')
      )
  ), match_evidence as (
    select authorized_event.tournament_id, authorized_event.event_id,
      count(game.id)::integer as persisted_match_count,
      count(game.id) filter (where app.game_is_authoritatively_resolved_v1(game.id))::integer as resolved_match_count
    from authorized_event
    left join app.canonical_games game
      on game.tournament_id = authorized_event.tournament_id
      and game.event_id = authorized_event.event_id
    group by authorized_event.tournament_id, authorized_event.event_id
  ), totals as (
    select participant.id as participant_id,
      participant.status as participant_status,
      coalesce(nullif(trim(roster.claimed_display_name), ''), nullif(trim(profile.display_name), '')) as display_name,
      coalesce(sum(line.game_points), 0)::integer as game_points,
      count(*) filter (where line.is_winner)::integer as games_won,
      coalesce(sum(line.plus_points), 0)::integer as plus_points,
      coalesce(sum(line.minus_points), 0)::integer as minus_points,
      count(line.line_id)::integer as verified_games
    from authorized_event
    join app.event_participants participant
      on participant.tournament_id = authorized_event.tournament_id
      and participant.event_id = authorized_event.event_id
    left join app.tournament_roster_entries roster
      on roster.id = participant.roster_entry_id
      and roster.tournament_id = participant.tournament_id
    left join app.profiles profile on profile.id = participant.profile_id
    left join lateral (
      select effective.*
      from app.current_effective_scorelines(
        authorized_event.tournament_id, authorized_event.event_id
      ) effective where effective.participant_id = participant.id
    ) line on true
    where coalesce(nullif(trim(roster.claimed_display_name), ''), nullif(trim(profile.display_name), '')) is not null
    group by participant.id, participant.status,
      coalesce(nullif(trim(roster.claimed_display_name), ''), nullif(trim(profile.display_name), ''))
  ), ranked as (
    select totals.*,
      rank() over (order by game_points desc, games_won desc,
        (plus_points - minus_points) desc, plus_points desc)::integer as numeric_rank,
      count(*) over (partition by game_points, games_won,
        (plus_points - minus_points), plus_points)::integer as tied_count
    from totals
  )
  select jsonb_build_object(
    'tournamentId', authorized_event.tournament_id,
    'eventId', authorized_event.event_id,
    'tournamentName', authorized_event.tournament_name,
    'eventName', authorized_event.event_name,
    'status', 'preliminary',
    'configuredGameCount', authorized_event.configured_game_count,
    'schedulePublished', authorized_event.schedule_published,
    'scheduledMatchCount', authorized_event.scheduled_match_count,
    'persistedMatchCount', evidence.persisted_match_count,
    'resolvedMatchCount', evidence.resolved_match_count,
    'scheduledScorecardsComplete', authorized_event.schedule_published
      and authorized_event.configured_game_count is not null
      and authorized_event.scheduled_match_count > 0
      and evidence.persisted_match_count = authorized_event.scheduled_match_count
      and evidence.resolved_match_count = authorized_event.scheduled_match_count
      and exists (select 1 from totals)
      and not exists (select 1 from totals item
        where item.verified_games <> authorized_event.configured_game_count),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'participantId', row_data.participant_id,
      'displayName', row_data.display_name,
      'participantStatus', row_data.participant_status,
      'verifiedGames', row_data.verified_games,
      'gamePoints', row_data.game_points,
      'gamesWon', row_data.games_won,
      'plusPoints', row_data.plus_points,
      'minusPoints', row_data.minus_points,
      'netSpreadPoints', row_data.plus_points - row_data.minus_points,
      'numericRank', row_data.numeric_rank,
      'tied', row_data.tied_count > 1
    ) order by row_data.numeric_rank, row_data.display_name, row_data.participant_id)
    from ranked row_data), '[]'::jsonb)
  )
  from authorized_event
  join match_evidence evidence on evidence.tournament_id = authorized_event.tournament_id
    and evidence.event_id = authorized_event.event_id
$$;

revoke all on function public.get_preliminary_event_standings(uuid, uuid) from public, anon;
grant execute on function public.get_preliminary_event_standings(uuid, uuid) to authenticated;

notify pgrst,'reload schema';
