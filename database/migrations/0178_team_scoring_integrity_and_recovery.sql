-- Additive integrity boundary for October two-person team scoring.
-- Singles tables and RPCs are intentionally not changed here.

-- 0174 initially used event-local foreign keys inconsistently.  Add the
-- composite keys required to prevent cross-event/team leakage.
alter table app.event_team_entries
  add constraint event_team_entries_id_scope_unique unique (id,tournament_id,event_id);
alter table app.event_team_seating_publications
  add constraint event_team_seating_publications_scope_unique unique (id,tournament_id,event_id);
alter table app.event_team_schedule_publications
  add constraint event_team_schedule_publications_scope_unique unique (id,tournament_id,event_id);
alter table app.event_team_games
  add constraint event_team_games_scope_unique unique (id,tournament_id,event_id);
alter table app.event_team_games
  add constraint event_team_games_publication_scope_fk
    foreign key (publication_id,tournament_id,event_id)
    references app.event_team_schedule_publications(id,tournament_id,event_id)
    on delete restrict,
  add constraint event_team_games_a_scope_fk
    foreign key (side_a_team_entry_id,tournament_id,event_id)
    references app.event_team_entries(id,tournament_id,event_id)
    on delete restrict,
  add constraint event_team_games_b_scope_fk
    foreign key (side_b_team_entry_id,tournament_id,event_id)
    references app.event_team_entries(id,tournament_id,event_id)
    on delete restrict;
alter table app.event_team_seating_assignments
  add constraint event_team_seating_assignments_publication_scope_fk
    foreign key (publication_id,tournament_id,event_id)
    references app.event_team_seating_publications(id,tournament_id,event_id)
    on delete restrict,
  add constraint event_team_seating_assignments_entry_scope_fk
    foreign key (team_entry_id,tournament_id,event_id)
    references app.event_team_entries(id,tournament_id,event_id)
    on delete restrict;
alter table app.event_team_starts
  add constraint event_team_starts_schedule_scope_fk
    foreign key (schedule_publication_id,tournament_id,event_id)
    references app.event_team_schedule_publications(id,tournament_id,event_id)
    on delete restrict;
alter table app.event_team_score_submissions
  add constraint event_team_score_submissions_game_scope_fk
    foreign key (team_game_id,tournament_id,event_id)
    references app.event_team_games(id,tournament_id,event_id)
    on delete restrict,
  add constraint event_team_score_submissions_entry_scope_fk
    foreign key (submitting_team_entry_id,tournament_id,event_id)
    references app.event_team_entries(id,tournament_id,event_id)
    on delete restrict;
alter table app.event_team_score_confirmations
  add constraint event_team_score_confirmations_game_scope_fk
    foreign key (team_game_id,tournament_id,event_id)
    references app.event_team_games(id,tournament_id,event_id)
    on delete restrict;
alter table app.event_team_scorelines
  add constraint event_team_scorelines_game_scope_fk
    foreign key (team_game_id,tournament_id,event_id)
    references app.event_team_games(id,tournament_id,event_id)
    on delete restrict,
  add constraint event_team_scorelines_entry_scope_fk
    foreign key (team_entry_id,tournament_id,event_id)
    references app.event_team_entries(id,tournament_id,event_id)
    on delete restrict,
  add constraint event_team_scorelines_opponent_scope_fk
    foreign key (opponent_team_entry_id,tournament_id,event_id)
    references app.event_team_entries(id,tournament_id,event_id)
    on delete restrict;

alter table app.event_team_games
  add column side_a_member_snapshot jsonb,
  add column side_b_member_snapshot jsonb;
create or replace function app.snapshot_team_game_members_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.side_a_member_snapshot is null then
    select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',m.roster_entry_id,'displayName',r.claimed_display_name,'accNumber',m.acc_number_snapshot) order by m.member_role),'[]'::jsonb)
      into new.side_a_member_snapshot from app.event_team_members m join app.tournament_roster_entries r on r.id=m.roster_entry_id where m.team_id=(select team_id from app.event_team_entries where id=new.side_a_team_entry_id);
  end if;
  if new.side_b_member_snapshot is null then
    select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',m.roster_entry_id,'displayName',r.claimed_display_name,'accNumber',m.acc_number_snapshot) order by m.member_role),'[]'::jsonb)
      into new.side_b_member_snapshot from app.event_team_members m join app.tournament_roster_entries r on r.id=m.roster_entry_id where m.team_id=(select team_id from app.event_team_entries where id=new.side_b_team_entry_id);
  end if;
  if jsonb_array_length(new.side_a_member_snapshot)<>2 or jsonb_array_length(new.side_b_member_snapshot)<>2 then raise exception 'team game requires four member snapshots'; end if;
  return new;
end $$;
drop trigger if exists event_team_game_member_snapshot on app.event_team_games;
create trigger event_team_game_member_snapshot before insert on app.event_team_games
for each row execute function app.snapshot_team_game_members_v1();

create or replace function app.assert_team_schedule_complete_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare expected integer; actual integer; invalid integer; incomplete_rounds integer; duplicate_seats integer;
begin
  select count(*) into actual from app.event_team_games where publication_id=new.id;
  select count(*) into expected from app.event_team_entries where event_id=new.event_id and tournament_id=new.tournament_id;
  if expected<2 or expected%2<>0 then
    raise exception 'team schedule requires an even number of teams';
  end if;
  if actual<>new.game_count*(expected/2) then
    raise exception 'team schedule is incomplete';
  end if;
  select count(*) into invalid from app.event_team_games g where g.publication_id=new.id and (
    g.game_number<1 or g.game_number>new.game_count or g.side_a_team_entry_id=g.side_b_team_entry_id or
    not exists(select 1 from app.event_team_entries te where te.id=g.side_a_team_entry_id and te.event_id=new.event_id and te.tournament_id=new.tournament_id) or
    not exists(select 1 from app.event_team_entries te where te.id=g.side_b_team_entry_id and te.event_id=new.event_id and te.tournament_id=new.tournament_id));
  if invalid<>0 then raise exception 'team schedule contains invalid or cross-event games'; end if;
  select count(*) into incomplete_rounds from (
    select round.game_number
    from generate_series(1,new.game_count) round(game_number)
    left join lateral (
      select count(*) match_count,
             count(distinct team_entry_id) team_count
      from (
        select g.side_a_team_entry_id team_entry_id from app.event_team_games g where g.publication_id=new.id and g.game_number=round.game_number
        union all
        select g.side_b_team_entry_id from app.event_team_games g where g.publication_id=new.id and g.game_number=round.game_number
      ) participants
    ) coverage on true
    where coverage.match_count<>expected or coverage.team_count<>expected
  ) bad;
  if incomplete_rounds<>0 then raise exception 'each team must appear exactly once in every scheduled game'; end if;
  select count(*) into duplicate_seats from (
    select g.game_number, seat
    from app.event_team_games g
    cross join lateral (values(g.side_a_table_seat),(g.side_b_table_seat)) s(seat)
    where g.publication_id=new.id
    group by g.game_number,seat having count(*)>1
  ) collisions;
  if duplicate_seats<>0 then raise exception 'a table seat cannot be assigned twice in one game'; end if;
  if exists(select 1 from app.event_team_games g where g.publication_id=new.id and (jsonb_array_length(g.side_a_member_snapshot)<>2 or jsonb_array_length(g.side_b_member_snapshot)<>2)) then
    raise exception 'every scheduled game must preserve all four team members';
  end if;
  return new;
end $$;
drop trigger if exists event_team_schedule_complete on app.event_team_schedule_publications;
create constraint trigger event_team_schedule_complete after insert on app.event_team_schedule_publications
deferrable initially deferred for each row execute function app.assert_team_schedule_complete_v1();

-- Enforce exactly two members and exactly one captain at transaction commit.
create or replace function app.assert_team_shape_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare n integer; c integer;
begin
  select count(*),count(*) filter(where member_role='captain') into n,c
    from app.event_team_members where team_id=coalesce(new.team_id,old.team_id);
  if n<>2 or c<>1 then
    raise exception 'team must contain exactly two members and one captain';
  end if;
  return coalesce(new,old);
end $$;
drop trigger if exists event_team_members_shape on app.event_team_members;
create constraint trigger event_team_members_shape
after insert or update or delete on app.event_team_members
deferrable initially deferred for each row execute function app.assert_team_shape_v1();

create or replace function app.reject_team_member_rebind_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.profile_id is not null and (new.profile_id is distinct from old.profile_id
      or new.roster_entry_id is distinct from old.roster_entry_id) then
    raise exception 'team member binding is append-only';
  end if;
  if new.profile_id is not null and new.claimed_at is null then
    new.claimed_at:=clock_timestamp();
  end if;
  return new;
end $$;
drop trigger if exists event_team_member_rebind_guard on app.event_team_members;
create trigger event_team_member_rebind_guard before update on app.event_team_members
for each row execute function app.reject_team_member_rebind_v1();

create table app.event_team_member_claim_versions(
  id uuid primary key default extensions.gen_random_uuid(), team_id uuid not null,
  tournament_id uuid not null, event_id uuid not null, roster_entry_id uuid not null,
  profile_id uuid not null references app.profiles(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null, created_at timestamptz not null default clock_timestamp(),
  foreign key(team_id,tournament_id,event_id) references app.event_teams(id,tournament_id,event_id) on delete restrict,
  foreign key(roster_entry_id,tournament_id) references app.tournament_roster_entries(id,tournament_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(team_id,roster_entry_id), unique(team_id,profile_id)
);
alter table app.event_team_member_claim_versions enable row level security;
alter table app.event_team_member_claim_versions force row level security;
revoke all on table app.event_team_member_claim_versions from public,anon,authenticated;
create trigger event_team_member_claims_immutable before update or delete on app.event_team_member_claim_versions
for each row execute function app.reject_immutable_history();

create or replace function public.claim_event_team_partner_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_team_id uuid,
  p_roster_entry_id uuid,p_claim_id uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m app.event_team_members%rowtype; h text; prior app.operation_receipts%rowtype;
  receipt uuid:=extensions.gen_random_uuid(); response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null then
    return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-claim:'||p_team_id::text,0));
  select * into m from app.event_team_members where team_id=p_team_id and roster_entry_id=p_roster_entry_id for update;
  if not found or m.event_id<>p_event_id or m.tournament_id<>p_tournament_id then
    return jsonb_build_object('status','rejected','code','member_unavailable'); end if;
  if m.profile_id is not null then
    if m.profile_id=p_actor_id then return jsonb_build_object('status','team_partner_already_claimed'); end if;
    return jsonb_build_object('status','rejected','code','member_already_claimed'); end if;
  if not exists(select 1 from app.roster_account_links l where l.tournament_id=p_tournament_id and l.roster_entry_id=p_roster_entry_id and l.profile_id=p_actor_id) then
    return jsonb_build_object('status','rejected','code','roster_account_mismatch'); end if;
  if exists(select 1 from app.event_team_members x where x.event_id=p_event_id and x.profile_id=p_actor_id) then
    return jsonb_build_object('status','rejected','code','profile_already_teamed'); end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('claim_event_team_partner_v1',p_actor_id,p_tournament_id,p_event_id,p_team_id,p_roster_entry_id)::text,'utf8'),'sha256'),'hex');
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  response:=jsonb_build_object('status','team_partner_claimed','teamId',p_team_id,'rosterEntryId',p_roster_entry_id,'profileId',p_actor_id);
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(receipt,p_actor_id,p_tournament_id,'claim_event_team_partner_v1',p_claim_id,h,p_operation_id,'accepted',response,clock_timestamp());
  perform pg_catalog.set_config('app.team_claim_profile_id',p_actor_id::text,true);
  update app.event_team_members set profile_id=p_actor_id,claimed_at=clock_timestamp() where id=m.id;
  insert into app.event_team_member_claim_versions(id,team_id,tournament_id,event_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id)
    values(p_claim_id,p_team_id,p_tournament_id,p_event_id,p_roster_entry_id,p_actor_id,p_actor_id,receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,receipt,'event_team_member',m.id,'team_partner_claimed',response);
  return response;
end $$;
revoke all on function public.claim_event_team_partner_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_event_team_partner_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid) to service_role;

-- Paper/mixed team games use an explicit side so an official cannot silently
-- transcribe the wrong card.  The opposing side must still provide the
-- independent confirmation before the game becomes authoritative.
create or replace function public.submit_event_team_paper_score_v1(
  p_actor_id uuid,p_tournament_id uuid,p_game_id uuid,p_side text,
  p_submission_id uuid,p_winner_side text,p_margin integer,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g app.event_team_games%rowtype; entry_id uuid; h text; prior app.operation_receipts%rowtype;
  receipt uuid:=extensions.gen_random_uuid(); response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_side not in('a','b') or p_winner_side not in('a','b') or p_margin not between 1 and 121 then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  select * into g from app.event_team_games where id=p_game_id and tournament_id=p_tournament_id for update;
  if not found or not exists(select 1 from app.event_team_starts s where s.event_id=g.event_id) or g.state not in('pending','submitted','mismatch','confirmation_pending') then return jsonb_build_object('status','rejected','code','game_not_available'); end if;
  if not app.team_actor_is_official_v1(p_actor_id,p_tournament_id,p_game_id) then return jsonb_build_object('status','rejected','code','independent_official_required'); end if;
  entry_id:=case when p_side='a' then g.side_a_team_entry_id else g.side_b_team_entry_id end;
  if not exists(select 1 from app.event_team_entry_versions v where v.team_entry_id=entry_id and v.scorecard_type='paper' order by v.version desc limit 1) then return jsonb_build_object('status','rejected','code','paper_card_required'); end if;
  if exists(select 1 from app.event_team_score_submissions s where s.team_game_id=p_game_id and s.side=p_side) then return jsonb_build_object('status','rejected','code','side_already_submitted'); end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('submit_event_team_paper_score_v1',p_actor_id,p_tournament_id,p_game_id,p_side,p_submission_id,p_winner_side,p_margin)::text,'utf8'),'sha256'),'hex');
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  response:=jsonb_build_object('status','team_paper_score_submitted','gameId',p_game_id,'submissionId',p_submission_id,'side',p_side,'sourceMethod','paper_transcription');
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(receipt,p_actor_id,p_tournament_id,'submit_event_team_paper_score_v1',p_submission_id,h,p_operation_id,'accepted',response,clock_timestamp());
  insert into app.event_team_score_submissions(id,tournament_id,event_id,team_game_id,submitting_team_entry_id,submitter_profile_id,side,winner_side,margin,source_method,operation_receipt_id)
    values(p_submission_id,p_tournament_id,g.event_id,p_game_id,entry_id,p_actor_id,p_side,p_winner_side,p_margin,'paper_transcription',receipt);
  update app.event_team_games set state=case when (select count(*) from app.event_team_score_submissions where team_game_id=p_game_id)=2 then case when (select count(distinct(winner_side,margin)) from app.event_team_score_submissions where team_game_id=p_game_id)=1 then 'confirmation_pending' else 'mismatch' end else 'submitted' end where id=p_game_id;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,receipt,'event_team_game',p_game_id,'team_paper_score_submitted',response);
  return response;
end $$;
revoke all on function public.submit_event_team_paper_score_v1(uuid,uuid,uuid,text,uuid,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.submit_event_team_paper_score_v1(uuid,uuid,uuid,text,uuid,text,integer,uuid) to service_role;

-- Supported doubles may be made digital only through the explicit event setup
-- operation.  Remove 0174's silent mutation triggers; the existing approved
-- ruleset constraint remains the final safety gate.
drop trigger if exists event_ruleset_enable_supported_doubles on app.events;
drop trigger if exists event_enable_supported_doubles on app.events;
drop trigger if exists ruleset_enable_supported_doubles on app.ruleset_versions;
drop trigger if exists event_team_ruleset_auto_enable on app.events;
drop trigger if exists event_team_auto_digital on app.events;
drop function if exists app.enable_supported_doubles_ruleset_v1();
drop function if exists app.enable_supported_doubles_event_v1();

-- Event-specific team seating directory: no publication means no disclosure.
drop function if exists public.get_tournament_seating_directory_v1(uuid,uuid,uuid);
create or replace function public.get_tournament_seating_directory_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid default null,p_query text default null)
returns jsonb language sql stable security definer set search_path='' as $$
select case when coalesce(auth.role(),'')='service_role'
  and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id)
then jsonb_build_object('tournamentId',t.id,'tournamentName',t.name,'entries',coalesce((select jsonb_agg(x order by x->>'displayName') from (
  select jsonb_build_object('entryKind','player','eventId',ep.event_id,'eventName',e.name,'displayName',r.claimed_display_name,'teamName',null,'scorecardType',r.scorecard_type,'assignedTableSeat',seat.initial_table_seat,'verificationId',seat.verification_id,'currentTableSeat',null,'isSelf',l.profile_id=p_actor_id) x
    from app.event_participants ep join app.events e on e.id=ep.event_id join app.tournament_roster_entries r on r.id=ep.roster_entry_id
    left join app.roster_account_links l on l.tournament_id=r.tournament_id and l.roster_entry_id=r.id join app.initial_seating_assignments seat on seat.roster_entry_id=r.id and seat.tournament_id=r.tournament_id
    where ep.tournament_id=p_tournament_id and e.format='standard_singles' and (p_event_id is null or ep.event_id=p_event_id)
      and (nullif(trim(p_query),'') is null or lower(r.claimed_display_name) like '%'||lower(trim(p_query))||'%' or r.claimed_normalized_acc_number=nullif(upper(regexp_replace(trim(p_query),'[[:space:]]+','','g')),''))
  union all
  select jsonb_build_object('entryKind','team_member','eventId',te.event_id,'eventName',e.name,'displayName',r.claimed_display_name,'teamName',team.display_name,'scorecardType',v.scorecard_type,'assignedTableSeat',seat.initial_table_seat,'verificationId',seat.verification_id,'currentTableSeat',cg.current_table_seat,'isSelf',tm.profile_id=p_actor_id) x
    from app.event_team_entries te join app.events e on e.id=te.event_id join app.event_teams team on team.id=te.team_id join app.event_team_members tm on tm.team_id=team.id join app.tournament_roster_entries r on r.id=tm.roster_entry_id
    join lateral(select * from app.event_team_entry_versions q where q.team_entry_id=te.id order by q.version desc limit 1)v on true join app.event_team_seating_assignments seat on seat.team_entry_id=te.id
    left join lateral(select case when g.side_a_team_entry_id=te.id then g.side_a_table_seat else g.side_b_table_seat end current_table_seat from app.event_team_games g where g.event_id=te.event_id and (g.side_a_team_entry_id=te.id or g.side_b_team_entry_id=te.id) and g.state in('pending','submitted','mismatch','confirmation_pending') order by g.game_number,g.match_instance limit 1) cg on true
    where te.tournament_id=p_tournament_id and (p_event_id is null or te.event_id=p_event_id)
      and (nullif(trim(p_query),'') is null or lower(r.claimed_display_name) like '%'||lower(trim(p_query))||'%' or r.claimed_normalized_acc_number=nullif(upper(regexp_replace(trim(p_query),'[[:space:]]+','','g')),''))
) q),'[]'::jsonb)) else null end from app.tournaments t where t.id=p_tournament_id
$$;
revoke all on function public.get_tournament_seating_directory_v1(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_tournament_seating_directory_v1(uuid,uuid,uuid,text) to service_role;
create or replace function public.get_tournament_seating_directory_v2(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid default null,p_query text default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select public.get_tournament_seating_directory_v1(p_actor_id,p_tournament_id,p_event_id,p_query)
$$;
revoke all on function public.get_tournament_seating_directory_v2(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_tournament_seating_directory_v2(uuid,uuid,uuid,text) to service_role;

-- Offline team score capability/replay is separate from the proven singles queue.
create table app.event_team_offline_capabilities(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,team_game_id uuid not null,
 actor_profile_id uuid not null references app.profiles(id) on delete restrict,nonce text not null,
 capability_digest text not null,expires_at timestamptz not null,issued_at timestamptz not null default clock_timestamp(),
 foreign key(team_game_id,tournament_id,event_id) references app.event_team_games(id,tournament_id,event_id) on delete restrict,
 unique(team_game_id,actor_profile_id),unique(capability_digest));
create table app.event_team_offline_replays(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,team_game_id uuid not null,
 capability_id uuid not null references app.event_team_offline_capabilities(id) on delete restrict,
 actor_profile_id uuid not null references app.profiles(id) on delete restrict,client_operation_id uuid not null,
 payload_digest text not null,replayed_submission_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(team_game_id,tournament_id,event_id) references app.event_team_games(id,tournament_id,event_id) on delete restrict,
 unique(client_operation_id),unique(team_game_id,actor_profile_id));
alter table app.event_team_offline_capabilities enable row level security; alter table app.event_team_offline_capabilities force row level security; revoke all on table app.event_team_offline_capabilities from public,anon,authenticated;
alter table app.event_team_offline_replays enable row level security; alter table app.event_team_offline_replays force row level security; revoke all on table app.event_team_offline_replays from public,anon,authenticated;
create trigger event_team_offline_capabilities_immutable before update or delete on app.event_team_offline_capabilities for each row execute function app.reject_immutable_history();
create trigger event_team_offline_replays_immutable before update or delete on app.event_team_offline_replays for each row execute function app.reject_immutable_history();

create or replace function public.issue_event_team_offline_capability_v1(
  p_actor_id uuid,p_tournament_id uuid,p_game_id uuid,p_capability_id uuid,p_nonce text,p_expires_at timestamptz,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g app.event_team_games%rowtype; h text; prior app.operation_receipts%rowtype; receipt uuid:=extensions.gen_random_uuid(); response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_nonce is null or length(trim(p_nonce))<16 or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '24 hours' then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  select * into g from app.event_team_games where id=p_game_id and tournament_id=p_tournament_id; if not found or not exists(select 1 from app.event_team_starts where event_id=g.event_id) then return jsonb_build_object('status','rejected','code','game_not_available'); end if;
  if not exists(select 1 from app.event_team_members tm join app.event_team_entries te on te.team_id=tm.team_id and te.id in(g.side_a_team_entry_id,g.side_b_team_entry_id) where tm.profile_id=p_actor_id) and not app.team_actor_is_official_v1(p_actor_id,p_tournament_id,p_game_id) then return jsonb_build_object('status','rejected','code','not_authorized'); end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('issue_event_team_offline_capability_v1',p_actor_id,p_tournament_id,p_game_id,p_nonce,p_expires_at)::text,'utf8'),'sha256'),'hex');
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id; if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  response:=jsonb_build_object('status','team_offline_capability_issued','capabilityId',p_capability_id,'expiresAt',p_expires_at,'digest',h);
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(receipt,p_actor_id,p_tournament_id,'issue_event_team_offline_capability_v1',p_capability_id,h,p_operation_id,'accepted',response,clock_timestamp());
  insert into app.event_team_offline_capabilities(id,tournament_id,event_id,team_game_id,actor_profile_id,nonce,capability_digest,expires_at) values(p_capability_id,p_tournament_id,g.event_id,p_game_id,p_actor_id,p_nonce,h,p_expires_at);
  return response;
end $$;
revoke all on function public.issue_event_team_offline_capability_v1(uuid,uuid,uuid,uuid,text,timestamptz,uuid) from public,anon,authenticated; grant execute on function public.issue_event_team_offline_capability_v1(uuid,uuid,uuid,uuid,text,timestamptz,uuid) to service_role;

create or replace function public.replay_event_team_offline_score_v1(
  p_actor_id uuid,p_tournament_id uuid,p_capability_id uuid,p_replay_id uuid,p_submission_id uuid,p_client_operation_id uuid,
  p_side text,p_winner_side text,p_margin integer,p_payload_digest text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cap app.event_team_offline_capabilities%rowtype; prior app.event_team_offline_replays%rowtype; response jsonb; game app.event_team_games%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_payload_digest is null or p_side not in('a','b') or p_winner_side not in('a','b') or p_margin not between 1 and 121 then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  select * into cap from app.event_team_offline_capabilities where id=p_capability_id and actor_profile_id=p_actor_id for update; if not found or cap.expires_at<clock_timestamp() then return jsonb_build_object('status','rejected','code','capability_expired'); end if;
  if exists(select 1 from app.event_team_offline_replays where client_operation_id=p_client_operation_id) then select * into prior from app.event_team_offline_replays where client_operation_id=p_client_operation_id; if prior.payload_digest<>p_payload_digest then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return jsonb_build_object('status','team_offline_replay_already_applied','submissionId',prior.replayed_submission_id); end if;
  select * into game from app.event_team_games where id=cap.team_game_id and tournament_id=p_tournament_id;
  if p_side='a' and exists(select 1 from app.event_team_score_submissions where team_game_id=game.id and side='a') or p_side='b' and exists(select 1 from app.event_team_score_submissions where team_game_id=game.id and side='b') then return jsonb_build_object('status','rejected','code','side_already_submitted'); end if;
  if exists(select 1 from app.event_team_members tm where tm.profile_id=p_actor_id and tm.team_id in((select team_id from app.event_team_entries where id=game.side_a_team_entry_id),(select team_id from app.event_team_entries where id=game.side_b_team_entry_id))) then
    response:=public.submit_event_team_score_v1(p_actor_id,p_tournament_id,game.id,p_submission_id,p_winner_side,p_margin,p_client_operation_id);
  else
    response:=public.submit_event_team_paper_score_v1(p_actor_id,p_tournament_id,game.id,p_side,p_submission_id,p_winner_side,p_margin,p_client_operation_id);
  end if;
  if coalesce(response->>'status','') not in('team_score_submitted','team_paper_score_submitted') then return response; end if;
  insert into app.event_team_offline_replays(id,tournament_id,event_id,team_game_id,capability_id,actor_profile_id,client_operation_id,payload_digest,replayed_submission_id) values(p_replay_id,p_tournament_id,game.event_id,game.id,p_capability_id,p_actor_id,p_client_operation_id,p_payload_digest,p_submission_id);
  return response||jsonb_build_object('offlineReplayId',p_replay_id);
end $$;
revoke all on function public.replay_event_team_offline_score_v1(uuid,uuid,uuid,uuid,uuid,uuid,text,text,integer,text) from public,anon,authenticated; grant execute on function public.replay_event_team_offline_score_v1(uuid,uuid,uuid,uuid,uuid,uuid,text,text,integer,text) to service_role;

-- Verified/corrected team results only.  This reader preserves both members
-- and intentionally returns no qualification for Satellite events.
create or replace function public.get_event_team_results_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with ranked as (
  select e.id event_id,e.name event_name,e.format,e.event_type,te.id team_entry_id,team.display_name team_name,
    coalesce(sum(sl.game_points),0)::integer game_points,coalesce(count(*) filter(where sl.is_winner),0)::integer games_won,
    coalesce(sum(sl.plus_points),0)::integer plus_points,coalesce(sum(sl.minus_points),0)::integer minus_points,
    coalesce(sum(sl.plus_points-sl.minus_points),0)::integer net_points,
    row_number() over(order by coalesce(sum(sl.game_points),0) desc,coalesce(sum(sl.plus_points-sl.minus_points),0) desc,team.display_name) position
  from app.events e join app.event_team_entries te on te.event_id=e.id join app.event_teams team on team.id=te.team_id
  left join app.event_team_scorelines sl on sl.team_entry_id=te.id and exists(select 1 from app.event_team_games g where g.id=sl.team_game_id and g.state in('verified','corrected'))
  where e.id=p_event_id and e.tournament_id=p_tournament_id group by e.id,e.name,e.format,e.event_type,te.id,team.display_name
)
select case when coalesce(auth.role(),'')='service_role' and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id) then jsonb_build_object(
 'eventId',r.event_id,'eventName',r.event_name,'format',r.format,'qualificationCount',case when r.event_type='satellite' then 0 else ceil((select count(*)::numeric from ranked)/4.0)::integer end,
 'mrps',case when r.event_type='satellite' then 'not_applicable_satellite' else 'eligible_after_review' end,
 'entries',coalesce((select jsonb_agg(jsonb_build_object('teamEntryId',x.team_entry_id,'teamName',x.team_name,'members',(select jsonb_agg(jsonb_build_object('name',m.claimed_display_name,'accNumber',m.claimed_acc_number) order by tm.member_role) from app.event_team_members tm join app.tournament_roster_entries m on m.id=tm.roster_entry_id where tm.team_id=(select team_id from app.event_team_entries where id=x.team_entry_id)),'gamePoints',x.game_points,'gamesWon',x.games_won,'plusSpreadPoints',x.plus_points,'minusSpreadPoints',x.minus_points,'netSpreadPoints',x.net_points,'qualifies',r.event_type<>'satellite' and x.position<=ceil((select count(*)::numeric from ranked)/4.0)::integer) order by x.position) from ranked x),'[]'::jsonb)) else null end from ranked r order by r.position limit 1
$$;
revoke all on function public.get_event_team_results_v1(uuid,uuid,uuid) from public,anon,authenticated; grant execute on function public.get_event_team_results_v1(uuid,uuid,uuid) to service_role;

-- Preserve the existing workspace contract while adding the schedule
-- publication identifier required by the team operations UI. Side-pool
-- beneficiaries are exposed only by the separate Side Pool workspace.
alter function public.get_event_team_workspace_v1(uuid,uuid) rename to get_event_team_workspace_base_v1;
create or replace function public.get_event_team_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with base as (select public.get_event_team_workspace_base_v1(p_actor_id,p_tournament_id) value),
events as (select coalesce(jsonb_agg(
  jsonb_set(ev,'{schedulePublicationId}',coalesce(to_jsonb((select sp.id from app.event_team_schedule_publications sp where sp.event_id=(ev->>'eventId')::uuid and sp.tournament_id=p_tournament_id limit 1)),'null'::jsonb),true)
  order by ev->>'name'), '[]'::jsonb) value from base, lateral jsonb_array_elements(coalesce(base.value->'events','[]'::jsonb)) ev)
select case when base.value is null then null else jsonb_set(base.value,'{events}',events.value,true) end from base,events
$$;
revoke all on function public.get_event_team_workspace_base_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_event_team_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_event_team_workspace_v1(uuid,uuid) to service_role;

notify pgrst,'reload schema';
