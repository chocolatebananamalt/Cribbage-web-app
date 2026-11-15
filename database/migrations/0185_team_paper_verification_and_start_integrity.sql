-- Release-blocking integrity for supported October team play. Paper evidence is
-- append-only, tied to the published team Verification ID, independently
-- re-entered, and never authoritative until the normal two-confirmation gate.

create table app.event_team_paper_score_evidence(
  submission_id uuid primary key references app.event_team_score_submissions(id) on delete restrict,
  tournament_id uuid not null,event_id uuid not null,team_game_id uuid not null,
  submitting_team_entry_id uuid not null,paper_card_reference text not null check(length(trim(paper_card_reference)) between 1 and 100),
  transcriber_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,created_at timestamptz not null default clock_timestamp(),
  foreign key(team_game_id,tournament_id,event_id) references app.event_team_games(id,tournament_id,event_id) on delete restrict,
  foreign key(submitting_team_entry_id,tournament_id,event_id) references app.event_team_entries(id,tournament_id,event_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(team_game_id,submitting_team_entry_id)
);
create table app.event_team_paper_score_reviews(
  id uuid primary key,submission_id uuid not null references app.event_team_score_submissions(id) on delete restrict,
  tournament_id uuid not null,event_id uuid not null,team_game_id uuid not null,
  reviewer_profile_id uuid not null references app.profiles(id) on delete restrict,
  paper_card_reference text not null check(length(trim(paper_card_reference)) between 1 and 100),
  winner_side text not null check(winner_side in('a','b')),margin integer not null check(margin between 1 and 121),
  matched boolean not null,operation_receipt_id uuid not null,created_at timestamptz not null default clock_timestamp(),
  foreign key(team_game_id,tournament_id,event_id) references app.event_team_games(id,tournament_id,event_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(submission_id,reviewer_profile_id)
);
alter table app.event_team_paper_score_evidence enable row level security;
alter table app.event_team_paper_score_evidence force row level security;
alter table app.event_team_paper_score_reviews enable row level security;
alter table app.event_team_paper_score_reviews force row level security;
revoke all on table app.event_team_paper_score_evidence,app.event_team_paper_score_reviews from public,anon,authenticated;
create trigger event_team_paper_score_evidence_immutable before update or delete on app.event_team_paper_score_evidence for each row execute function app.reject_immutable_history();
create trigger event_team_paper_score_reviews_immutable before update or delete on app.event_team_paper_score_reviews for each row execute function app.reject_immutable_history();

create or replace function app.guard_team_paper_evidence_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare submission app.event_team_score_submissions%rowtype; expected_reference text;
begin
  select * into submission from app.event_team_score_submissions where id=new.submission_id;
  if not found or submission.source_method<>'paper_transcription' or submission.tournament_id<>new.tournament_id
     or submission.event_id<>new.event_id or submission.team_game_id<>new.team_game_id
     or submission.submitting_team_entry_id<>new.submitting_team_entry_id
     or submission.submitter_profile_id<>new.transcriber_profile_id then
    raise exception 'paper evidence does not match its transcription';
  end if;
  if not app.team_actor_is_official_v1(new.transcriber_profile_id,new.tournament_id,new.team_game_id) then
    raise exception 'paper transcription requires a non-participant official';
  end if;
  select verification_id into expected_reference from app.event_team_seating_assignments
    where team_entry_id=new.submitting_team_entry_id and event_id=new.event_id and tournament_id=new.tournament_id;
  if expected_reference is null or upper(trim(new.paper_card_reference))<>upper(expected_reference) then
    raise exception 'paper card reference must match the team verification id';
  end if;
  new.paper_card_reference:=upper(trim(new.paper_card_reference));
  return new;
end $$;
create trigger event_team_paper_score_evidence_guard before insert on app.event_team_paper_score_evidence
for each row execute function app.guard_team_paper_evidence_v1();

create or replace function app.guard_team_paper_review_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare submission app.event_team_score_submissions%rowtype; evidence app.event_team_paper_score_evidence%rowtype;
begin
  select * into submission from app.event_team_score_submissions where id=new.submission_id;
  select * into evidence from app.event_team_paper_score_evidence where submission_id=new.submission_id;
  if submission.id is null or evidence.submission_id is null or submission.team_game_id<>new.team_game_id
     or submission.tournament_id<>new.tournament_id or submission.event_id<>new.event_id then
    raise exception 'paper review does not match its transcription';
  end if;
  if new.reviewer_profile_id=evidence.transcriber_profile_id
     or not app.team_actor_is_official_v1(new.reviewer_profile_id,new.tournament_id,new.team_game_id) then
    raise exception 'paper review requires a second non-participant official';
  end if;
  new.paper_card_reference:=upper(trim(new.paper_card_reference));
  new.matched:=new.paper_card_reference=evidence.paper_card_reference
    and new.winner_side=submission.winner_side and new.margin=submission.margin;
  return new;
end $$;
create trigger event_team_paper_score_review_guard before insert on app.event_team_paper_score_reviews
for each row execute function app.guard_team_paper_review_v1();

-- Preserve the four people and their game-location snapshot, not just the two
-- team entry IDs. Both partners share the team's scheduled Table/Seat.
create or replace function app.snapshot_team_game_members_v2() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',m.roster_entry_id,'displayName',r.claimed_display_name,'accNumber',m.acc_number_snapshot,'currentTableSeat',new.side_a_table_seat) order by m.member_role),'[]'::jsonb)
    into new.side_a_member_snapshot from app.event_team_members m join app.tournament_roster_entries r on r.id=m.roster_entry_id
    where m.team_id=(select team_id from app.event_team_entries where id=new.side_a_team_entry_id);
  select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',m.roster_entry_id,'displayName',r.claimed_display_name,'accNumber',m.acc_number_snapshot,'currentTableSeat',new.side_b_table_seat) order by m.member_role),'[]'::jsonb)
    into new.side_b_member_snapshot from app.event_team_members m join app.tournament_roster_entries r on r.id=m.roster_entry_id
    where m.team_id=(select team_id from app.event_team_entries where id=new.side_b_team_entry_id);
  if jsonb_array_length(new.side_a_member_snapshot)<>2 or jsonb_array_length(new.side_b_member_snapshot)<>2 then
    raise exception 'team game requires four member location snapshots';
  end if;
  return new;
end $$;
drop trigger if exists event_team_game_member_snapshot on app.event_team_games;
create trigger event_team_game_member_snapshot before insert on app.event_team_games
for each row execute function app.snapshot_team_game_members_v2();
update app.event_team_games game set
  side_a_member_snapshot=(select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',m.roster_entry_id,'displayName',r.claimed_display_name,'accNumber',m.acc_number_snapshot,'currentTableSeat',game.side_a_table_seat) order by m.member_role),'[]'::jsonb) from app.event_team_members m join app.tournament_roster_entries r on r.id=m.roster_entry_id where m.team_id=(select team_id from app.event_team_entries where id=game.side_a_team_entry_id)),
  side_b_member_snapshot=(select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',m.roster_entry_id,'displayName',r.claimed_display_name,'accNumber',m.acc_number_snapshot,'currentTableSeat',game.side_b_table_seat) order by m.member_role),'[]'::jsonb) from app.event_team_members m join app.tournament_roster_entries r on r.id=m.roster_entry_id where m.team_id=(select team_id from app.event_team_entries where id=game.side_b_team_entry_id));

create or replace function app.team_event_has_supported_digital_rules_v2(p_tournament_id uuid,p_event_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.events event_row join app.ruleset_versions ruleset on ruleset.id=event_row.ruleset_version_id
    where event_row.id=p_event_id and event_row.tournament_id=p_tournament_id
      and event_row.format in('doubles','canadian_doubles') and event_row.scoring_method='digital'
      and ruleset.tournament_id=p_tournament_id and ruleset.format=event_row.format and ruleset.approved_at is not null)
$$;
revoke all on function app.team_event_has_supported_digital_rules_v2(uuid,uuid) from public,anon,authenticated;

-- Explicit upgrades are allowed only while registration is open and only when
-- every selected event is supported, approved, unstarted, unpublished, and has
-- no score/offline/correction evidence of any kind.
create or replace function public.enable_supported_team_scoring_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_ids jsonb,p_parent_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request_hash text;derived_hex text;derived_operation_id uuid;prior app.operation_receipts%rowtype;
  receipt_id uuid:=extensions.gen_random_uuid();response jsonb;event_id_value uuid;event_row app.events%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' or jsonb_typeof(p_event_ids)<>'array' or jsonb_array_length(p_event_ids)<1
     or jsonb_array_length(p_event_ids)>32 or p_parent_operation_id is null
     or (select count(distinct value) from jsonb_array_elements_text(p_event_ids))<>jsonb_array_length(p_event_ids)
     or exists(select 1 from jsonb_array_elements_text(p_event_ids) item where item!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then
    return jsonb_build_object('status','rejected','code','not_director');
  end if;
  request_hash:=encode(extensions.digest(convert_to(jsonb_build_array('enable_supported_team_scoring_v1',p_actor_id,p_tournament_id,p_event_ids,p_parent_operation_id)::text,'utf8'),'sha256'),'hex');
  derived_hex:=encode(extensions.digest(convert_to(p_parent_operation_id::text||':enable-supported-team-scoring','utf8'),'sha256'),'hex');
  derived_operation_id:=(substr(derived_hex,1,8)||'-'||substr(derived_hex,9,4)||'-4'||substr(derived_hex,14,3)||'-a'||substr(derived_hex,18,3)||'-'||substr(derived_hex,21,12))::uuid;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-event-enable:'||p_tournament_id::text,0));
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=derived_operation_id;
  if found then
    if prior.request_hash<>request_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
    return prior.response_payload;
  end if;
  if not exists(select 1 from app.tournaments where id=p_tournament_id and status in('draft','open') and registration_status='open') then
    return jsonb_build_object('status','rejected','code','event_not_upgradeable');
  end if;
  for event_id_value in select value::uuid from jsonb_array_elements_text(p_event_ids) order by value loop
    select * into event_row from app.events where id=event_id_value and tournament_id=p_tournament_id for update;
    if not found or event_row.format not in('doubles','canadian_doubles') or event_row.scoring_method not in('manual','digital')
       or not exists(select 1 from app.ruleset_versions ruleset where ruleset.id=event_row.ruleset_version_id and ruleset.tournament_id=p_tournament_id and ruleset.format=event_row.format and ruleset.approved_at is not null)
       or exists(select 1 from app.event_team_seating_publications where event_id=event_id_value)
       or exists(select 1 from app.event_team_schedule_publications where event_id=event_id_value)
       or exists(select 1 from app.event_team_games where event_id=event_id_value)
       or exists(select 1 from app.event_team_starts where event_id=event_id_value)
       or exists(select 1 from app.event_team_score_submissions where event_id=event_id_value)
       or exists(select 1 from app.event_team_score_confirmations where event_id=event_id_value)
       or exists(select 1 from app.event_team_scorelines where event_id=event_id_value)
       or exists(select 1 from app.event_team_score_corrections where event_id=event_id_value)
       or exists(select 1 from app.event_team_score_correction_reviews where event_id=event_id_value)
       or exists(select 1 from app.event_team_offline_capabilities where event_id=event_id_value)
       or exists(select 1 from app.event_team_offline_replays where event_id=event_id_value)
       or exists(select 1 from app.event_team_paper_score_evidence where event_id=event_id_value)
       or exists(select 1 from app.event_team_paper_score_reviews where event_id=event_id_value) then
      return jsonb_build_object('status','rejected','code','event_not_upgradeable');
    end if;
  end loop;
  update app.events set scoring_method='digital' where tournament_id=p_tournament_id and id in(select value::uuid from jsonb_array_elements_text(p_event_ids));
  response:=jsonb_build_object('status','supported_team_scoring_enabled','eventIds',p_event_ids,'eventCount',jsonb_array_length(p_event_ids));
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(receipt_id,p_actor_id,p_tournament_id,'enable_supported_team_scoring_v1',p_tournament_id,request_hash,derived_operation_id,'accepted',response,clock_timestamp());
  for event_id_value in select value::uuid from jsonb_array_elements_text(p_event_ids) loop
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
      values(p_tournament_id,p_actor_id,receipt_id,'event',event_id_value,'supported_team_scoring_enabled',jsonb_build_object('parentOperationId',p_parent_operation_id,'scoringMethod','digital'));
  end loop;
  return response;
end $$;
revoke all on function public.enable_supported_team_scoring_v1(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.enable_supported_team_scoring_v1(uuid,uuid,jsonb,uuid) to service_role;

-- All official-only team operations exclude every member of either team. This
-- remains true even when an official account is separately assigned a staff role.
create or replace function app.team_actor_is_official_v1(p_actor uuid,p_tournament uuid,p_game uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament and role_row.profile_id=p_actor and role_row.role in('director','co_director','cross_checker','judge'))
    and not exists(select 1 from app.event_team_games game
      join app.event_team_entries entry on entry.tournament_id=game.tournament_id and entry.event_id=game.event_id and entry.id in(game.side_a_team_entry_id,game.side_b_team_entry_id)
      join app.event_team_members member on member.team_id=entry.team_id and member.tournament_id=game.tournament_id and member.event_id=game.event_id
      where game.id=p_game and game.tournament_id=p_tournament and member.profile_id=p_actor)
$$;
revoke all on function app.team_actor_is_official_v1(uuid,uuid,uuid) from public,anon,authenticated;

-- Restore the approved captain flow while retaining 0183's lifecycle lock.
-- Directors may register on behalf of a team; otherwise the actor must be the
-- linked captain identity selected in the request.
create or replace function public.create_event_team_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_team_id uuid,p_team_entry_id uuid,
  p_captain_roster_entry_id uuid,p_partner_roster_entry_id uuid,p_scorecard_type text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text;prior app.operation_receipts%rowtype;rid uuid;captain_profile uuid;captain_name text;partner_name text;response jsonb;can_manage boolean;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_operation_id is null or p_scorecard_type not in('digital','paper') or p_captain_roster_entry_id=p_partner_roster_entry_id then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('create_event_team_v1',p_actor_id,p_tournament_id,p_event_id,p_team_id,p_team_entry_id,p_captain_roster_entry_id,p_partner_roster_entry_id,p_scorecard_type)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-lifecycle:'||p_event_id::text,0));
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  perform 1 from app.events event_row join app.ruleset_versions ruleset on ruleset.id=event_row.ruleset_version_id
    where event_row.id=p_event_id and event_row.tournament_id=p_tournament_id and event_row.format in('doubles','canadian_doubles')
      and event_row.scoring_method='digital' and ruleset.tournament_id=p_tournament_id and ruleset.format=event_row.format and ruleset.approved_at is not null for update of event_row;
  if not found then return jsonb_build_object('status','rejected','code','event_not_supported'); end if;
  if not exists(select 1 from app.tournaments where id=p_tournament_id and status in('draft','open') and registration_status='open') then
    return jsonb_build_object('status','rejected','code','registration_closed');
  end if;
  if exists(select 1 from app.event_team_seating_publications where event_id=p_event_id)
     or exists(select 1 from app.event_team_schedule_publications where event_id=p_event_id)
     or exists(select 1 from app.event_team_starts where event_id=p_event_id)
     or exists(select 1 from app.event_team_games where event_id=p_event_id)
     or exists(select 1 from app.event_team_score_submissions where event_id=p_event_id) then
    return jsonb_build_object('status','rejected','code','event_locked');
  end if;
  select link.profile_id,roster.claimed_display_name into captain_profile,captain_name
    from app.tournament_roster_entries roster left join app.roster_account_links link on link.tournament_id=roster.tournament_id and link.roster_entry_id=roster.id
    where roster.id=p_captain_roster_entry_id and roster.tournament_id=p_tournament_id;
  select claimed_display_name into partner_name from app.tournament_roster_entries where id=p_partner_roster_entry_id and tournament_id=p_tournament_id;
  select exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) into can_manage;
  if captain_name is null or partner_name is null or (p_scorecard_type='digital' and captain_profile is null)
     or not(can_manage or captain_profile=p_actor_id) then
    return jsonb_build_object('status','rejected','code','team_authority_unavailable');
  end if;
  if exists(select 1 from app.event_team_members where event_id=p_event_id and roster_entry_id in(p_captain_roster_entry_id,p_partner_roster_entry_id)) then
    return jsonb_build_object('status','rejected','code','member_already_teamed');
  end if;
  response:=jsonb_build_object('status','team_created','teamId',p_team_id,'teamEntryId',p_team_entry_id,'displayName',captain_name||' / '||partner_name,'scorecardType',p_scorecard_type);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_actor_id,p_tournament_id,'create_event_team_v1',p_team_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into rid;
  insert into app.event_teams(id,tournament_id,event_id,display_name,created_by_profile_id) values(p_team_id,p_tournament_id,p_event_id,captain_name||' / '||partner_name,p_actor_id);
  insert into app.event_team_members(team_id,tournament_id,event_id,roster_entry_id,profile_id,acc_number_snapshot,member_role,claimed_at)
    select p_team_id,p_tournament_id,p_event_id,roster.id,link.profile_id,coalesce(roster.claimed_acc_number,''),case when roster.id=p_captain_roster_entry_id then 'captain' else 'member' end,case when link.profile_id is null then null else clock_timestamp() end
      from app.tournament_roster_entries roster left join app.roster_account_links link on link.tournament_id=roster.tournament_id and link.roster_entry_id=roster.id
      where roster.id in(p_captain_roster_entry_id,p_partner_roster_entry_id);
  insert into app.event_team_entries(id,team_id,tournament_id,event_id,entry_fee_minor,scorecard_type,digital_scoring_enabled) values(p_team_entry_id,p_team_id,p_tournament_id,p_event_id,0,p_scorecard_type,p_scorecard_type='digital');
  insert into app.event_team_entry_versions(team_entry_id,tournament_id,event_id,version,scorecard_type,designated_scorer_profile_id,actor_profile_id,operation_receipt_id,reason)
    values(p_team_entry_id,p_tournament_id,p_event_id,1,p_scorecard_type,case when p_scorecard_type='digital' then captain_profile else null end,p_actor_id,rid,'Captain selected the shared team scorecard');
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,rid,'event_team',p_team_id,'team_created',response);
  return response;
end $$;
revoke all on function public.create_event_team_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.create_event_team_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) to service_role;

create or replace function app.assert_team_seating_capability_v2() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from app.events where id=new.event_id and tournament_id=new.tournament_id for update;
  if not app.team_event_has_supported_digital_rules_v2(new.tournament_id,new.event_id)
     or not exists(select 1 from app.tournaments where id=new.tournament_id and status in('draft','open') and registration_status='closed')
     or exists(select 1 from app.event_team_schedule_publications where event_id=new.event_id)
     or exists(select 1 from app.event_team_starts where event_id=new.event_id)
     or exists(select 1 from app.event_team_score_submissions where event_id=new.event_id)
     or exists(select 1 from app.event_team_score_confirmations where event_id=new.event_id)
     or exists(select 1 from app.event_team_scorelines where event_id=new.event_id)
     or exists(select 1 from app.event_team_score_corrections where event_id=new.event_id) then
    raise exception 'team seating publication is not available';
  end if;
  return new;
end $$;
drop trigger if exists event_team_seating_capability_guard on app.event_team_seating_publications;
create trigger event_team_seating_capability_guard before insert on app.event_team_seating_publications
for each row execute function app.assert_team_seating_capability_v2();

create or replace function app.assert_team_schedule_capability_v2() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from app.events where id=new.event_id and tournament_id=new.tournament_id for update;
  if not app.team_event_has_supported_digital_rules_v2(new.tournament_id,new.event_id)
     or not exists(select 1 from app.tournaments where id=new.tournament_id and status in('draft','open') and registration_status='closed')
     or not exists(select 1 from app.event_team_seating_publications where event_id=new.event_id and tournament_id=new.tournament_id)
     or exists(select 1 from app.event_team_starts where event_id=new.event_id)
     or exists(select 1 from app.event_team_score_submissions where event_id=new.event_id)
     or exists(select 1 from app.event_team_score_confirmations where event_id=new.event_id)
     or exists(select 1 from app.event_team_scorelines where event_id=new.event_id)
     or exists(select 1 from app.event_team_score_corrections where event_id=new.event_id) then
    raise exception 'team schedule publication is not available';
  end if;
  return new;
end $$;
drop trigger if exists event_team_schedule_capability_guard on app.event_team_schedule_publications;
create trigger event_team_schedule_capability_guard before insert on app.event_team_schedule_publications
for each row execute function app.assert_team_schedule_capability_v2();

create or replace function app.assert_team_start_ready_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from app.events where id=new.event_id and tournament_id=new.tournament_id for update;
  if not app.team_event_has_supported_digital_rules_v2(new.tournament_id,new.event_id)
     or not exists(select 1 from app.tournaments where id=new.tournament_id and status='open' and registration_status='closed')
     or not exists(select 1 from app.event_team_seating_publications where event_id=new.event_id and tournament_id=new.tournament_id)
     or not exists(select 1 from app.event_team_schedule_publications where id=new.schedule_publication_id and event_id=new.event_id and tournament_id=new.tournament_id)
     or exists(select 1 from app.event_team_score_submissions where event_id=new.event_id)
     or exists(select 1 from app.event_team_score_confirmations where event_id=new.event_id)
     or exists(select 1 from app.event_team_scorelines where event_id=new.event_id)
     or exists(select 1 from app.event_team_score_corrections where event_id=new.event_id)
     or exists(select 1 from app.event_team_entries entry left join lateral(select * from app.event_team_entry_versions version where version.team_entry_id=entry.id order by version.version desc limit 1) current_version on true
       where entry.event_id=new.event_id and (current_version.id is null or (current_version.scorecard_type='digital' and (current_version.designated_scorer_profile_id is null
         or not exists(select 1 from app.event_team_members member where member.team_id=entry.team_id and member.profile_id=current_version.designated_scorer_profile_id)))))
     or exists(select 1 from app.event_team_games game where game.publication_id=new.schedule_publication_id
       and (jsonb_array_length(game.side_a_member_snapshot)<>2 or jsonb_array_length(game.side_b_member_snapshot)<>2
         or exists(select 1 from jsonb_array_elements(game.side_a_member_snapshot) member where member->>'currentTableSeat'<>game.side_a_table_seat)
         or exists(select 1 from jsonb_array_elements(game.side_b_member_snapshot) member where member->>'currentTableSeat'<>game.side_b_table_seat))) then
    raise exception 'team event is not ready to start';
  end if;
  return new;
end $$;
drop trigger if exists event_team_start_ready on app.event_team_starts;
create trigger event_team_start_ready before insert on app.event_team_starts
for each row execute function app.assert_team_start_ready_v1();

create or replace function app.apply_event_team_result_v1(p_game_id uuid,p_winner_side text,p_margin integer,p_state text)
returns void language plpgsql security definer set search_path='' as $$
declare game_row app.event_team_games%rowtype;winning uuid;losing uuid;
begin
  if p_winner_side not in('a','b') or p_margin not between 1 and 121 or p_state not in('verified','corrected') then
    raise exception 'invalid authoritative team result';
  end if;
  select * into game_row from app.event_team_games where id=p_game_id for update;
  if not found or exists(select 1 from app.event_team_scorelines where team_game_id=p_game_id) then
    raise exception 'authoritative team result already exists';
  end if;
  winning:=case when p_winner_side='a' then game_row.side_a_team_entry_id else game_row.side_b_team_entry_id end;
  losing:=case when p_winner_side='a' then game_row.side_b_team_entry_id else game_row.side_a_team_entry_id end;
  insert into app.event_team_scorelines(tournament_id,event_id,team_game_id,team_entry_id,opponent_team_entry_id,side,is_winner,margin,plus_points,minus_points,game_points)
  values
    (game_row.tournament_id,game_row.event_id,p_game_id,game_row.side_a_team_entry_id,game_row.side_b_team_entry_id,'a',game_row.side_a_team_entry_id=winning,p_margin,case when game_row.side_a_team_entry_id=winning then p_margin else 0 end,case when game_row.side_a_team_entry_id=losing then p_margin else 0 end,case when game_row.side_a_team_entry_id=winning then case when p_margin>=31 then 3 else 2 end else 0 end),
    (game_row.tournament_id,game_row.event_id,p_game_id,game_row.side_b_team_entry_id,game_row.side_a_team_entry_id,'b',game_row.side_b_team_entry_id=winning,p_margin,case when game_row.side_b_team_entry_id=winning then p_margin else 0 end,case when game_row.side_b_team_entry_id=losing then p_margin else 0 end,case when game_row.side_b_team_entry_id=winning then case when p_margin>=31 then 3 else 2 end else 0 end);
  update app.event_team_games set state=p_state,winner_side=p_winner_side,margin=p_margin,version=case when p_state='corrected' then version+1 else version end where id=p_game_id;
end $$;
revoke all on function app.apply_event_team_result_v1(uuid,text,integer,text) from public,anon,authenticated;

create or replace function app.try_finalize_event_team_game_v2(p_game_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare game_row app.event_team_games%rowtype;submission_count integer;result_count integer;confirmation_count integer;winner text;margin_value integer;
begin
  select * into game_row from app.event_team_games where id=p_game_id for update;
  if not found or game_row.state not in('confirmation_pending','mismatch') then return false; end if;
  select count(*),count(distinct (winner_side,margin)),min(winner_side),min(margin)
    into submission_count,result_count,winner,margin_value from app.event_team_score_submissions where team_game_id=p_game_id;
  if submission_count<>2 or result_count<>1 then return false; end if;
  if exists(select 1 from app.event_team_score_submissions submission where submission.team_game_id=p_game_id and submission.source_method='paper_transcription'
    and not exists(select 1 from app.event_team_paper_score_reviews review where review.submission_id=submission.id and review.matched)) then return false; end if;
  select count(*) into confirmation_count from app.event_team_score_confirmations where team_game_id=p_game_id;
  if confirmation_count<>2 then return false; end if;
  perform app.apply_event_team_result_v1(p_game_id,winner,margin_value,'verified');
  return true;
end $$;
revoke all on function app.try_finalize_event_team_game_v2(uuid) from public,anon,authenticated;

create or replace function app.guard_team_confirmation_v2() returns trigger
language plpgsql security definer set search_path='' as $$
declare game_row app.event_team_games%rowtype;submission app.event_team_score_submissions%rowtype;opposite_entry uuid;opposite_card text;opposite_scorer uuid;
begin
  select * into game_row from app.event_team_games where id=new.team_game_id;
  select * into submission from app.event_team_score_submissions where id=new.submission_id and team_game_id=new.team_game_id;
  if game_row.id is null or submission.id is null or submission.submitter_profile_id=new.confirmation_profile_id then
    raise exception 'confirmation is not independent';
  end if;
  if submission.source_method='paper_transcription' and not exists(select 1 from app.event_team_paper_score_reviews review where review.submission_id=submission.id and review.matched) then
    raise exception 'paper review required before confirmation';
  end if;
  opposite_entry:=case when submission.side='a' then game_row.side_b_team_entry_id else game_row.side_a_team_entry_id end;
  select version.scorecard_type,version.designated_scorer_profile_id into opposite_card,opposite_scorer
    from app.event_team_entry_versions version where version.team_entry_id=opposite_entry order by version.version desc limit 1;
  if not((opposite_card='digital' and opposite_scorer=new.confirmation_profile_id)
    or (opposite_card='paper' and app.team_actor_is_official_v1(new.confirmation_profile_id,new.tournament_id,new.team_game_id))) then
    raise exception 'confirmation actor is not independent opposition';
  end if;
  return new;
end $$;
drop trigger if exists event_team_score_confirmation_guard on app.event_team_score_confirmations;
create trigger event_team_score_confirmation_guard before insert on app.event_team_score_confirmations
for each row execute function app.guard_team_confirmation_v2();

-- The generic submit RPC is digital-only. Officials must use the paper RPC so
-- no paper transcription can bypass its card identity and review trail.
create or replace function public.submit_event_team_score_v1(
  p_actor_id uuid,p_tournament_id uuid,p_game_id uuid,p_submission_id uuid,p_winner_side text,p_margin integer,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare game_row app.event_team_games%rowtype;entry_id uuid;card text;scorer uuid;h text;prior app.operation_receipts%rowtype;receipt uuid;response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_operation_id is null or p_winner_side not in('a','b') or p_margin not between 1 and 121 then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('submit_event_team_score_v1',p_actor_id,p_tournament_id,p_game_id,p_submission_id,p_winner_side,p_margin)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-score:'||p_game_id::text,0));
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  select * into game_row from app.event_team_games where id=p_game_id and tournament_id=p_tournament_id for update;
  if not found or not exists(select 1 from app.event_team_starts where event_id=game_row.event_id) or game_row.state not in('pending','submitted') then return jsonb_build_object('status','rejected','code','game_not_available'); end if;
  entry_id:=case
    when exists(select 1 from app.event_team_members member join app.event_team_entries entry on entry.team_id=member.team_id where member.profile_id=p_actor_id and entry.id=game_row.side_a_team_entry_id) then game_row.side_a_team_entry_id
    when exists(select 1 from app.event_team_members member join app.event_team_entries entry on entry.team_id=member.team_id where member.profile_id=p_actor_id and entry.id=game_row.side_b_team_entry_id) then game_row.side_b_team_entry_id
    else null end;
  if entry_id is null then return jsonb_build_object('status','rejected','code','not_authorized'); end if;
  select version.scorecard_type,version.designated_scorer_profile_id into card,scorer from app.event_team_entry_versions version where version.team_entry_id=entry_id order by version.version desc limit 1;
  if card<>'digital' or scorer<>p_actor_id then return jsonb_build_object('status','rejected','code','wrong_scorecard_authority'); end if;
  response:=jsonb_build_object('status','team_score_submitted','gameId',p_game_id,'submissionId',p_submission_id,'side',case when entry_id=game_row.side_a_team_entry_id then 'a' else 'b' end,'sourceMethod','digital');
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_actor_id,p_tournament_id,'submit_event_team_score_v1',p_submission_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into receipt;
  insert into app.event_team_score_submissions(id,tournament_id,event_id,team_game_id,submitting_team_entry_id,submitter_profile_id,side,winner_side,margin,source_method,operation_receipt_id)
    values(p_submission_id,p_tournament_id,game_row.event_id,p_game_id,entry_id,p_actor_id,case when entry_id=game_row.side_a_team_entry_id then 'a' else 'b' end,p_winner_side,p_margin,'digital',receipt);
  update app.event_team_games set state=case when (select count(*) from app.event_team_score_submissions where team_game_id=p_game_id)=2
    then case when (select count(distinct (winner_side,margin)) from app.event_team_score_submissions where team_game_id=p_game_id)=1 then 'confirmation_pending' else 'mismatch' end else 'submitted' end where id=p_game_id;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,receipt,'event_team_game',p_game_id,'team_score_submitted',response);
  return response;
end $$;
revoke all on function public.submit_event_team_score_v1(uuid,uuid,uuid,uuid,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.submit_event_team_score_v1(uuid,uuid,uuid,uuid,text,integer,uuid) to service_role;

drop function if exists public.submit_event_team_paper_score_v1(uuid,uuid,uuid,text,uuid,text,integer,uuid);
create or replace function public.submit_event_team_paper_score_v1(
  p_actor_id uuid,p_tournament_id uuid,p_game_id uuid,p_side text,p_submission_id uuid,p_paper_card_reference text,p_winner_side text,p_margin integer,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare game_row app.event_team_games%rowtype;entry_id uuid;h text;prior app.operation_receipts%rowtype;receipt uuid;response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_operation_id is null or p_side not in('a','b') or p_winner_side not in('a','b') or p_margin not between 1 and 121 or length(trim(p_paper_card_reference)) not between 1 and 100 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('submit_event_team_paper_score_v1',p_actor_id,p_tournament_id,p_game_id,p_side,p_submission_id,upper(trim(p_paper_card_reference)),p_winner_side,p_margin)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-score:'||p_game_id::text,0));
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  select * into game_row from app.event_team_games where id=p_game_id and tournament_id=p_tournament_id for update;
  if not found or not exists(select 1 from app.event_team_starts where event_id=game_row.event_id) or game_row.state not in('pending','submitted') then return jsonb_build_object('status','rejected','code','game_not_available'); end if;
  if not app.team_actor_is_official_v1(p_actor_id,p_tournament_id,p_game_id) then return jsonb_build_object('status','rejected','code','independent_official_required'); end if;
  entry_id:=case when p_side='a' then game_row.side_a_team_entry_id else game_row.side_b_team_entry_id end;
  if not exists(select 1 from app.event_team_entry_versions version where version.team_entry_id=entry_id and version.scorecard_type='paper' order by version.version desc limit 1) then return jsonb_build_object('status','rejected','code','paper_card_required'); end if;
  response:=jsonb_build_object('status','team_paper_score_submitted','gameId',p_game_id,'submissionId',p_submission_id,'side',p_side,'sourceMethod','paper_transcription','paperCardReference',upper(trim(p_paper_card_reference)));
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_actor_id,p_tournament_id,'submit_event_team_paper_score_v1',p_submission_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into receipt;
  insert into app.event_team_score_submissions(id,tournament_id,event_id,team_game_id,submitting_team_entry_id,submitter_profile_id,side,winner_side,margin,source_method,operation_receipt_id)
    values(p_submission_id,p_tournament_id,game_row.event_id,p_game_id,entry_id,p_actor_id,p_side,p_winner_side,p_margin,'paper_transcription',receipt);
  insert into app.event_team_paper_score_evidence(submission_id,tournament_id,event_id,team_game_id,submitting_team_entry_id,paper_card_reference,transcriber_profile_id,operation_receipt_id)
    values(p_submission_id,p_tournament_id,game_row.event_id,p_game_id,entry_id,p_paper_card_reference,p_actor_id,receipt);
  update app.event_team_games set state=case when (select count(*) from app.event_team_score_submissions where team_game_id=p_game_id)=2
    then case when (select count(distinct (winner_side,margin)) from app.event_team_score_submissions where team_game_id=p_game_id)=1 then 'confirmation_pending' else 'mismatch' end else 'submitted' end where id=p_game_id;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,receipt,'event_team_paper_score',p_submission_id,'team_paper_score_transcribed',response);
  return response;
end $$;
revoke all on function public.submit_event_team_paper_score_v1(uuid,uuid,uuid,text,uuid,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.submit_event_team_paper_score_v1(uuid,uuid,uuid,text,uuid,text,text,integer,uuid) to service_role;

create or replace function public.review_event_team_paper_score_v1(
  p_actor_id uuid,p_tournament_id uuid,p_game_id uuid,p_submission_id uuid,p_review_id uuid,p_paper_card_reference text,p_winner_side text,p_margin integer,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare game_row app.event_team_games%rowtype;submission app.event_team_score_submissions%rowtype;evidence app.event_team_paper_score_evidence%rowtype;
  h text;prior app.operation_receipts%rowtype;receipt uuid;response jsonb;is_match boolean;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_operation_id is null or p_review_id is null or p_winner_side not in('a','b') or p_margin not between 1 and 121 or length(trim(p_paper_card_reference)) not between 1 and 100 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('review_event_team_paper_score_v1',p_actor_id,p_tournament_id,p_game_id,p_submission_id,p_review_id,upper(trim(p_paper_card_reference)),p_winner_side,p_margin)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-score:'||p_game_id::text,0));
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  select * into game_row from app.event_team_games where id=p_game_id and tournament_id=p_tournament_id for update;
  select * into submission from app.event_team_score_submissions where id=p_submission_id and team_game_id=p_game_id and source_method='paper_transcription';
  select * into evidence from app.event_team_paper_score_evidence where submission_id=p_submission_id;
  if game_row.id is null or submission.id is null or evidence.submission_id is null or game_row.state not in('confirmation_pending','mismatch') then return jsonb_build_object('status','rejected','code','paper_review_not_available'); end if;
  if evidence.transcriber_profile_id=p_actor_id or not app.team_actor_is_official_v1(p_actor_id,p_tournament_id,p_game_id) then return jsonb_build_object('status','rejected','code','independent_paper_reviewer_required'); end if;
  if exists(select 1 from app.event_team_paper_score_reviews where submission_id=p_submission_id and reviewer_profile_id=p_actor_id) then return jsonb_build_object('status','rejected','code','paper_review_already_recorded'); end if;
  is_match:=upper(trim(p_paper_card_reference))=evidence.paper_card_reference and p_winner_side=submission.winner_side and p_margin=submission.margin;
  response:=jsonb_build_object('status',case when is_match then 'team_paper_score_reviewed' else 'team_paper_score_review_mismatch' end,'gameId',p_game_id,'submissionId',p_submission_id,'reviewId',p_review_id,'matched',is_match);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_actor_id,p_tournament_id,'review_event_team_paper_score_v1',p_review_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into receipt;
  insert into app.event_team_paper_score_reviews(id,submission_id,tournament_id,event_id,team_game_id,reviewer_profile_id,paper_card_reference,winner_side,margin,matched,operation_receipt_id)
    values(p_review_id,p_submission_id,p_tournament_id,game_row.event_id,p_game_id,p_actor_id,p_paper_card_reference,p_winner_side,p_margin,false,receipt)
    returning matched into is_match;
  update app.event_team_games set state=case when is_match and (select count(distinct (winner_side,margin)) from app.event_team_score_submissions where team_game_id=p_game_id)=1 then 'confirmation_pending' else 'mismatch' end where id=p_game_id;
  perform app.try_finalize_event_team_game_v2(p_game_id);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,receipt,'event_team_paper_score_review',p_review_id,case when is_match then 'team_paper_score_reviewed' else 'team_paper_score_review_mismatch' end,response);
  return response;
end $$;
revoke all on function public.review_event_team_paper_score_v1(uuid,uuid,uuid,uuid,uuid,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.review_event_team_paper_score_v1(uuid,uuid,uuid,uuid,uuid,text,text,integer,uuid) to service_role;

create or replace function public.confirm_event_team_score_v1(
  p_actor_id uuid,p_tournament_id uuid,p_game_id uuid,p_submission_id uuid,p_confirmation_id uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare game_row app.event_team_games%rowtype;submission app.event_team_score_submissions%rowtype;opposite_entry uuid;opposite_card text;opposite_scorer uuid;h text;prior app.operation_receipts%rowtype;receipt uuid;response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_operation_id is null or p_confirmation_id is null then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('confirm_event_team_score_v1',p_actor_id,p_tournament_id,p_game_id,p_submission_id,p_confirmation_id)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-score:'||p_game_id::text,0));
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  select * into game_row from app.event_team_games where id=p_game_id and tournament_id=p_tournament_id for update;
  select * into submission from app.event_team_score_submissions where id=p_submission_id and team_game_id=p_game_id;
  if game_row.id is null or submission.id is null or game_row.state<>'confirmation_pending' or submission.submitter_profile_id=p_actor_id then return jsonb_build_object('status','rejected','code','confirmation_not_available'); end if;
  if exists(select 1 from app.event_team_score_confirmations where team_game_id=p_game_id and (submission_id=p_submission_id or confirmation_profile_id=p_actor_id)) then return jsonb_build_object('status','rejected','code','confirmation_not_available'); end if;
  if submission.source_method='paper_transcription' and not exists(select 1 from app.event_team_paper_score_reviews where submission_id=p_submission_id and matched) then return jsonb_build_object('status','rejected','code','paper_review_required'); end if;
  opposite_entry:=case when submission.side='a' then game_row.side_b_team_entry_id else game_row.side_a_team_entry_id end;
  select version.scorecard_type,version.designated_scorer_profile_id into opposite_card,opposite_scorer from app.event_team_entry_versions version where version.team_entry_id=opposite_entry order by version.version desc limit 1;
  if not((opposite_card='digital' and opposite_scorer=p_actor_id) or (opposite_card='paper' and app.team_actor_is_official_v1(p_actor_id,p_tournament_id,p_game_id))) then return jsonb_build_object('status','rejected','code','not_independent_confirmer'); end if;
  response:=jsonb_build_object('status','team_score_confirmed','gameId',p_game_id,'submissionId',p_submission_id,'confirmationId',p_confirmation_id);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_actor_id,p_tournament_id,'confirm_event_team_score_v1',p_confirmation_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into receipt;
  insert into app.event_team_score_confirmations(id,tournament_id,event_id,team_game_id,submission_id,confirmation_profile_id,operation_receipt_id)
    values(p_confirmation_id,p_tournament_id,game_row.event_id,p_game_id,p_submission_id,p_actor_id,receipt);
  perform app.try_finalize_event_team_game_v2(p_game_id);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,receipt,'event_team_game',p_game_id,'team_score_confirmed',response);
  return response;
end $$;
revoke all on function public.confirm_event_team_score_v1(uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.confirm_event_team_score_v1(uuid,uuid,uuid,uuid,uuid,uuid) to service_role;

-- Mismatched original submissions remain immutable. Two independent officials
-- resolve the discrepancy through a proposal and a separate approval.
create table app.event_team_mismatch_resolutions(
  id uuid primary key,tournament_id uuid not null,event_id uuid not null,team_game_id uuid not null,
  base_game_version integer not null check(base_game_version>0),winner_side text not null check(winner_side in('a','b')),
  margin integer not null check(margin between 1 and 121),reason text not null check(length(trim(reason)) between 1 and 500),
  resolver_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(team_game_id,tournament_id,event_id) references app.event_team_games(id,tournament_id,event_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(team_game_id,base_game_version)
);
create table app.event_team_mismatch_resolution_reviews(
  id uuid primary key,resolution_id uuid not null references app.event_team_mismatch_resolutions(id) on delete restrict,
  tournament_id uuid not null,event_id uuid not null,team_game_id uuid not null,
  reviewer_profile_id uuid not null references app.profiles(id) on delete restrict,approved boolean not null,
  operation_receipt_id uuid not null,created_at timestamptz not null default clock_timestamp(),
  foreign key(team_game_id,tournament_id,event_id) references app.event_team_games(id,tournament_id,event_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(resolution_id,reviewer_profile_id)
);
alter table app.event_team_mismatch_resolutions enable row level security;
alter table app.event_team_mismatch_resolutions force row level security;
alter table app.event_team_mismatch_resolution_reviews enable row level security;
alter table app.event_team_mismatch_resolution_reviews force row level security;
revoke all on table app.event_team_mismatch_resolutions,app.event_team_mismatch_resolution_reviews from public,anon,authenticated;
create trigger event_team_mismatch_resolutions_immutable before update or delete on app.event_team_mismatch_resolutions for each row execute function app.reject_immutable_history();
create trigger event_team_mismatch_resolution_reviews_immutable before update or delete on app.event_team_mismatch_resolution_reviews for each row execute function app.reject_immutable_history();

create or replace function public.propose_event_team_mismatch_resolution_v1(
  p_actor_id uuid,p_tournament_id uuid,p_game_id uuid,p_resolution_id uuid,p_expected_game_version integer,p_winner_side text,p_margin integer,p_reason text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare game_row app.event_team_games%rowtype;h text;prior app.operation_receipts%rowtype;receipt uuid;response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_operation_id is null or p_winner_side not in('a','b') or p_margin not between 1 and 121 or length(trim(p_reason)) not between 1 and 500 then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('propose_event_team_mismatch_resolution_v1',p_actor_id,p_tournament_id,p_game_id,p_resolution_id,p_expected_game_version,p_winner_side,p_margin,trim(p_reason))::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-score:'||p_game_id::text,0));
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  select * into game_row from app.event_team_games where id=p_game_id and tournament_id=p_tournament_id for update;
  if game_row.id is null or game_row.state<>'mismatch' then return jsonb_build_object('status','rejected','code','mismatch_not_available'); end if;
  if game_row.version<>p_expected_game_version then return jsonb_build_object('status','rejected','code','stale_game_version'); end if;
  if not app.team_actor_is_official_v1(p_actor_id,p_tournament_id,p_game_id)
     or exists(select 1 from app.event_team_score_submissions where team_game_id=p_game_id and submitter_profile_id=p_actor_id) then return jsonb_build_object('status','rejected','code','independent_official_required'); end if;
  if exists(select 1 from app.event_team_score_submissions submission where submission.team_game_id=p_game_id and submission.source_method='paper_transcription'
    and not exists(select 1 from app.event_team_paper_score_reviews review where review.submission_id=submission.id)) then return jsonb_build_object('status','rejected','code','paper_review_required'); end if;
  response:=jsonb_build_object('status','team_mismatch_resolution_pending','gameId',p_game_id,'resolutionId',p_resolution_id,'winnerSide',p_winner_side,'margin',p_margin);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_actor_id,p_tournament_id,'propose_event_team_mismatch_resolution_v1',p_resolution_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into receipt;
  insert into app.event_team_mismatch_resolutions(id,tournament_id,event_id,team_game_id,base_game_version,winner_side,margin,reason,resolver_profile_id,operation_receipt_id)
    values(p_resolution_id,p_tournament_id,game_row.event_id,p_game_id,game_row.version,p_winner_side,p_margin,trim(p_reason),p_actor_id,receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,receipt,'event_team_mismatch_resolution',p_resolution_id,'team_mismatch_resolution_proposed',response);
  return response;
end $$;
revoke all on function public.propose_event_team_mismatch_resolution_v1(uuid,uuid,uuid,uuid,integer,text,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.propose_event_team_mismatch_resolution_v1(uuid,uuid,uuid,uuid,integer,text,integer,text,uuid) to service_role;

create or replace function public.review_event_team_mismatch_resolution_v1(
  p_actor_id uuid,p_tournament_id uuid,p_resolution_id uuid,p_review_id uuid,p_approved boolean,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare resolution app.event_team_mismatch_resolutions%rowtype;game_row app.event_team_games%rowtype;h text;prior app.operation_receipts%rowtype;receipt uuid;response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_operation_id is null or p_approved is null then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  select * into resolution from app.event_team_mismatch_resolutions where id=p_resolution_id and tournament_id=p_tournament_id;
  if not found then return jsonb_build_object('status','rejected','code','mismatch_resolution_unavailable'); end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('review_event_team_mismatch_resolution_v1',p_actor_id,p_tournament_id,p_resolution_id,p_review_id,p_approved)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-score:'||resolution.team_game_id::text,0));
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  select * into game_row from app.event_team_games where id=resolution.team_game_id for update;
  if game_row.state<>'mismatch' or game_row.version<>resolution.base_game_version or exists(select 1 from app.event_team_mismatch_resolution_reviews where resolution_id=p_resolution_id) then return jsonb_build_object('status','rejected','code','mismatch_resolution_unavailable'); end if;
  if p_actor_id=resolution.resolver_profile_id or not app.team_actor_is_official_v1(p_actor_id,p_tournament_id,resolution.team_game_id)
     or exists(select 1 from app.event_team_score_submissions where team_game_id=resolution.team_game_id and submitter_profile_id=p_actor_id) then return jsonb_build_object('status','rejected','code','independent_reviewer_required'); end if;
  response:=jsonb_build_object('status',case when p_approved then 'team_mismatch_resolution_applied' else 'team_mismatch_resolution_rejected' end,'gameId',resolution.team_game_id,'resolutionId',p_resolution_id,'approved',p_approved);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_actor_id,p_tournament_id,'review_event_team_mismatch_resolution_v1',p_review_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into receipt;
  insert into app.event_team_mismatch_resolution_reviews(id,resolution_id,tournament_id,event_id,team_game_id,reviewer_profile_id,approved,operation_receipt_id)
    values(p_review_id,p_resolution_id,p_tournament_id,resolution.event_id,resolution.team_game_id,p_actor_id,p_approved,receipt);
  if p_approved then
    perform app.apply_event_team_result_v1(resolution.team_game_id,resolution.winner_side,resolution.margin,'corrected');
  else
    update app.event_team_games set version=version+1 where id=resolution.team_game_id and state='mismatch';
  end if;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,receipt,'event_team_mismatch_resolution',p_resolution_id,case when p_approved then 'team_mismatch_resolution_applied' else 'team_mismatch_resolution_rejected' end,response);
  return response;
end $$;
revoke all on function public.review_event_team_mismatch_resolution_v1(uuid,uuid,uuid,uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.review_event_team_mismatch_resolution_v1(uuid,uuid,uuid,uuid,boolean,uuid) to service_role;

-- Rebuild the workspace at the privacy boundary so a linked captain can create
-- before joining a team. Non-staff callers receive no other account profile IDs.
create or replace function public.get_event_team_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tournament_row app.tournaments%rowtype;event_row app.events%rowtype;staff boolean;linked boolean;
  events_json jsonb:='[]'::jsonb;teams_json jsonb;games_json jsonb;standings_json jsonb;roster_json jsonb;corrections_json jsonb;resolutions_json jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then return null; end if;
  select * into tournament_row from app.tournaments where id=p_tournament_id;
  if not found then return null; end if;
  select exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director','cross_checker','judge')) into staff;
  select exists(select 1 from app.roster_account_links where tournament_id=p_tournament_id and profile_id=p_actor_id)
    or exists(select 1 from app.event_team_members where tournament_id=p_tournament_id and profile_id=p_actor_id) into linked;
  if not staff and not linked then return null; end if;
  for event_row in select * from app.events event_value where event_value.tournament_id=p_tournament_id and event_value.format in('doubles','canadian_doubles') order by event_value.name loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'teamId',team.id,'teamEntryId',entry.id,'displayName',team.display_name,
      'members',(select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',member.roster_entry_id,'displayName',roster.claimed_display_name,'accNumber',roster.claimed_acc_number,'profileLinked',member.profile_id is not null,'role',member.member_role) order by member.member_role),'[]'::jsonb) from app.event_team_members member join app.tournament_roster_entries roster on roster.id=member.roster_entry_id where member.team_id=team.id),
      'scorecardType',version.scorecard_type,'designatedScorerProfileId',case when staff or version.designated_scorer_profile_id=p_actor_id then version.designated_scorer_profile_id else null end,
      'configurationVersion',version.version,'verificationId',seat.verification_id,'initialTableSeat',seat.initial_table_seat
    ) order by team.display_name),'[]'::jsonb) into teams_json
    from app.event_team_entries entry join app.event_teams team on team.id=entry.team_id
    join lateral(select * from app.event_team_entry_versions value where value.team_entry_id=entry.id order by value.version desc limit 1) version on true
    left join app.event_team_seating_assignments seat on seat.team_entry_id=entry.id where entry.event_id=event_row.id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'gameId',game.id,'gameNumber',game.game_number,'state',game.state,'version',game.version,
      'sideATeamEntryId',game.side_a_team_entry_id,'sideBTeamEntryId',game.side_b_team_entry_id,
      'sideATableSeat',game.side_a_table_seat,'sideBTableSeat',game.side_b_table_seat,
      'sideAMembers',coalesce(game.side_a_member_snapshot,'[]'::jsonb),'sideBMembers',coalesce(game.side_b_member_snapshot,'[]'::jsonb),
      'winnerSide',game.winner_side,'margin',game.margin,
      'submissions',(select coalesce(jsonb_agg(jsonb_build_object(
        'submissionId',submission.id,'side',submission.side,'winnerSide',submission.winner_side,'margin',submission.margin,
        'sourceMethod',submission.source_method,'own',submission.submitter_profile_id=p_actor_id,
        'confirmed',exists(select 1 from app.event_team_score_confirmations confirmation where confirmation.submission_id=submission.id),
        'paperCardReference',(select evidence.paper_card_reference from app.event_team_paper_score_evidence evidence where evidence.submission_id=submission.id),
        'paperReviewed',exists(select 1 from app.event_team_paper_score_reviews review where review.submission_id=submission.id and review.matched),
        'paperReviewMismatch',exists(select 1 from app.event_team_paper_score_reviews review where review.submission_id=submission.id and not review.matched)
      ) order by submission.side),'[]'::jsonb) from app.event_team_score_submissions submission where submission.team_game_id=game.id)
    ) order by game.game_number,game.match_instance),'[]'::jsonb) into games_json
    from app.event_team_games game where game.event_id=event_row.id;
    select coalesce(jsonb_agg(jsonb_build_object('teamEntryId',summary.team_entry_id,'displayName',summary.display_name,'gamePoints',summary.game_points,'gamesWon',summary.games_won,'plusPoints',summary.plus_points,'minusPoints',summary.minus_points,'netSpreadPoints',summary.net_points) order by summary.game_points desc,summary.games_won desc,summary.net_points desc,summary.plus_points desc,summary.display_name),'[]'::jsonb) into standings_json
    from (select entry.id team_entry_id,team.display_name,coalesce(sum(line.game_points),0)::integer game_points,coalesce(count(*) filter(where line.is_winner),0)::integer games_won,coalesce(sum(line.plus_points),0)::integer plus_points,coalesce(sum(line.minus_points),0)::integer minus_points,coalesce(sum(line.plus_points-line.minus_points),0)::integer net_points
      from app.event_team_entries entry join app.event_teams team on team.id=entry.team_id left join app.event_team_scorelines line on line.team_entry_id=entry.id where entry.event_id=event_row.id group by entry.id,team.display_name) summary;
    if staff then
      select coalesce(jsonb_agg(jsonb_build_object('correctionId',correction.id,'gameId',correction.team_game_id,'editorProfileId',correction.actor_profile_id,'winnerSide',correction.corrected_winner_side,'margin',correction.corrected_margin,'reason',correction.reason,'baseGameVersion',correction.base_game_version) order by correction.created_at),'[]'::jsonb) into corrections_json
        from app.event_team_score_corrections correction where correction.event_id=event_row.id and correction.required_approvals=1 and not exists(select 1 from app.event_team_score_correction_reviews review where review.correction_id=correction.id);
      select coalesce(jsonb_agg(jsonb_build_object('resolutionId',resolution.id,'gameId',resolution.team_game_id,'resolverProfileId',resolution.resolver_profile_id,'winnerSide',resolution.winner_side,'margin',resolution.margin,'reason',resolution.reason,'baseGameVersion',resolution.base_game_version) order by resolution.created_at),'[]'::jsonb) into resolutions_json
        from app.event_team_mismatch_resolutions resolution where resolution.event_id=event_row.id and not exists(select 1 from app.event_team_mismatch_resolution_reviews review where review.resolution_id=resolution.id);
    else corrections_json:='[]'::jsonb;resolutions_json:='[]'::jsonb; end if;
    events_json:=events_json||jsonb_build_array(jsonb_build_object(
      'eventId',event_row.id,'name',event_row.name,'format',event_row.format,
      'configuredGameCount',coalesce((select setup_event.game_count::integer from app.tournament_setup_activations activation join app.tournament_setup_event_versions setup_event on setup_event.id=activation.setup_event_version_id where activation.event_id=event_row.id),1),
      'started',exists(select 1 from app.event_team_starts where event_id=event_row.id),
      'schedulePublicationId',(select id from app.event_team_schedule_publications where event_id=event_row.id limit 1),
      'teams',teams_json,'games',games_json,'standings',standings_json,'pendingCorrections',corrections_json,'pendingMismatchResolutions',resolutions_json));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',roster.id,'displayName',roster.claimed_display_name,'accNumber',roster.claimed_acc_number,
    'profileId',case when staff or link.profile_id=p_actor_id then link.profile_id else null end,'personalScorecardType',roster.scorecard_type) order by roster.claimed_normalized_name),'[]'::jsonb)
    into roster_json from app.tournament_roster_entries roster left join app.roster_account_links link on link.tournament_id=roster.tournament_id and link.roster_entry_id=roster.id where roster.tournament_id=p_tournament_id;
  return jsonb_build_object('tournamentId',tournament_row.id,'tournamentName',tournament_row.name,
    'canManage',exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')),
    'canCrossCheck',staff,'events',events_json,'roster',roster_json);
end $$;
revoke all on function public.get_event_team_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_event_team_workspace_v1(uuid,uuid) to service_role;

notify pgrst,'reload schema';
