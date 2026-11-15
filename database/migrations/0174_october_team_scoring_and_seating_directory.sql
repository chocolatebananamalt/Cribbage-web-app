-- October release: two-person Traditional/Canadian Doubles, shared paper or
-- digital team cards, team-scoped seating/scoring, and a privacy-bounded
-- participant seating directory. Singles tables and RPCs remain unchanged.

do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='app.events'::regclass and contype='c' and pg_get_constraintdef(oid) like '%scoring_method%' loop
    execute format('alter table app.events drop constraint %I',c.conname);
  end loop;
end $$;
alter table app.events add constraint events_supported_scoring_method_check check(
  scoring_method in('manual','imported') or
  (scoring_method='digital' and format in('standard_singles','doubles','canadian_doubles'))
);

do $$ declare c record; begin
  for c in select oid,conname from pg_constraint where conrelid='app.event_team_entries'::regclass and contype='c' loop
    if pg_get_constraintdef(c.oid) like '%scorecard_type%' or pg_get_constraintdef(c.oid) like '%digital_scoring_enabled%' then
      execute format('alter table app.event_team_entries drop constraint %I',c.conname);
    end if;
  end loop;
end $$;
alter table app.event_team_entries add constraint event_team_entries_scorecard_type_check check(scorecard_type in('digital','paper'));
alter table app.event_team_entries add constraint event_team_entries_digital_consistency_check check(digital_scoring_enabled=(scorecard_type='digital'));

create or replace function app.enable_supported_doubles_ruleset_v1() returns trigger language plpgsql set search_path='' as $$
begin
  if new.format in('doubles','canadian_doubles') then
    new.name:=case when new.format='doubles' then 'ACC 2025 Traditional Doubles' else 'ACC 2025 Canadian Doubles' end;
    new.source_reference:='ACC Official Tournament Rules 2025 Appendix B; sha256=db284283420259c99cfcc960bfdf4a6b79c95a5fc1bee02b1817b4af4a02f9fd';
    new.approved_at:=coalesce(new.approved_at,clock_timestamp());
  end if;
  return new;
end $$;
create trigger ruleset_enable_supported_doubles before insert on app.ruleset_versions for each row execute function app.enable_supported_doubles_ruleset_v1();

create or replace function app.enable_supported_doubles_event_v1() returns trigger language plpgsql set search_path='' as $$
begin if new.format in('doubles','canadian_doubles') then new.scoring_method:='digital'; end if; return new; end $$;
create trigger event_enable_supported_doubles before insert on app.events for each row execute function app.enable_supported_doubles_event_v1();

create table app.event_team_entry_versions(
 id uuid primary key default extensions.gen_random_uuid(),team_entry_id uuid not null references app.event_team_entries(id) on delete restrict,
 tournament_id uuid not null references app.tournaments(id) on delete restrict,event_id uuid not null,version integer not null check(version>0),
 scorecard_type text not null check(scorecard_type in('digital','paper')),designated_scorer_profile_id uuid references app.profiles(id) on delete restrict,
 actor_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,
 reason text check(reason is null or length(reason)<=500),created_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
 unique(team_entry_id,version),check((scorecard_type='digital' and designated_scorer_profile_id is not null) or scorecard_type='paper')
);
create table app.event_team_seating_publications(
 id uuid primary key,tournament_id uuid not null references app.tournaments(id) on delete restrict,event_id uuid not null,
 actor_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,
 published_at timestamptz not null default clock_timestamp(),foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,unique(event_id)
);
create table app.event_team_seating_assignments(
 id uuid primary key default extensions.gen_random_uuid(),publication_id uuid not null references app.event_team_seating_publications(id) on delete restrict,
 team_entry_id uuid not null references app.event_team_entries(id) on delete restrict,tournament_id uuid not null,event_id uuid not null,
 initial_table_seat text not null check(initial_table_seat~'^[A-Z]-[1-9][0-9]*$'),verification_id text generated always as(initial_table_seat) stored,
 foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,unique(event_id,team_entry_id),unique(event_id,initial_table_seat)
);
create table app.event_team_schedule_publications(
 id uuid primary key,tournament_id uuid not null references app.tournaments(id) on delete restrict,event_id uuid not null,
 game_count integer not null check(game_count between 1 and 99),actor_profile_id uuid not null references app.profiles(id) on delete restrict,
 operation_receipt_id uuid not null,published_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,unique(event_id)
);
create table app.event_team_games(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,publication_id uuid not null references app.event_team_schedule_publications(id) on delete restrict,
 game_number integer not null check(game_number between 1 and 99),match_instance integer not null default 1 check(match_instance>0),
 side_a_team_entry_id uuid not null references app.event_team_entries(id) on delete restrict,side_b_team_entry_id uuid not null references app.event_team_entries(id) on delete restrict,
 side_a_table_seat text not null check(side_a_table_seat~'^[A-Z]-[1-9][0-9]*$'),side_b_table_seat text not null check(side_b_table_seat~'^[A-Z]-[1-9][0-9]*$'),
 state text not null default 'pending' check(state in('pending','submitted','mismatch','confirmation_pending','verified','corrected')),
 version integer not null default 1 check(version>0),winner_side text check(winner_side in('a','b')),margin integer check(margin between 1 and 121),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
 check(side_a_team_entry_id<>side_b_team_entry_id),check(side_a_table_seat<>side_b_table_seat),unique(event_id,game_number,match_instance,side_a_team_entry_id,side_b_team_entry_id)
);
create table app.event_team_starts(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,schedule_publication_id uuid not null references app.event_team_schedule_publications(id) on delete restrict,
 actor_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,started_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,unique(event_id)
);
create table app.event_team_score_submissions(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,team_game_id uuid not null references app.event_team_games(id) on delete restrict,
 submitting_team_entry_id uuid not null references app.event_team_entries(id) on delete restrict,submitter_profile_id uuid not null references app.profiles(id) on delete restrict,
 side text not null check(side in('a','b')),winner_side text not null check(winner_side in('a','b')),margin integer not null check(margin between 1 and 121),
 source_method text not null check(source_method in('digital','paper_transcription')),operation_receipt_id uuid not null,submitted_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
 unique(team_game_id,side),unique(team_game_id,submitter_profile_id)
);
create table app.event_team_score_confirmations(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,team_game_id uuid not null references app.event_team_games(id) on delete restrict,
 submission_id uuid not null references app.event_team_score_submissions(id) on delete restrict,confirmation_profile_id uuid not null references app.profiles(id) on delete restrict,
 operation_receipt_id uuid not null,confirmed_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
 unique(team_game_id,submission_id),unique(team_game_id,confirmation_profile_id)
);
create table app.event_team_scorelines(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,team_game_id uuid not null references app.event_team_games(id) on delete restrict,
 team_entry_id uuid not null references app.event_team_entries(id) on delete restrict,opponent_team_entry_id uuid not null references app.event_team_entries(id) on delete restrict,
 side text not null check(side in('a','b')),is_winner boolean not null,margin integer not null check(margin between 1 and 121),
 plus_points integer not null check(plus_points between 0 and 121),minus_points integer not null check(minus_points between 0 and 121),game_points smallint not null check(game_points in(0,2,3)),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
 unique(team_game_id,team_entry_id),check(team_entry_id<>opponent_team_entry_id),
 check((is_winner and plus_points=margin and minus_points=0 and game_points in(2,3)) or(not is_winner and minus_points=margin and plus_points=0 and game_points=0))
);
create table app.event_team_score_corrections(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,team_game_id uuid not null references app.event_team_games(id) on delete restrict,
 sequence integer not null check(sequence>0),previous_winner_side text not null check(previous_winner_side in('a','b')),previous_margin integer not null check(previous_margin between 1 and 121),
 corrected_winner_side text not null check(corrected_winner_side in('a','b')),corrected_margin integer not null check(corrected_margin between 1 and 121),
 reason text check(reason is null or length(reason)<=500),actor_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,unique(team_game_id,sequence),
 check(previous_winner_side<>corrected_winner_side or previous_margin<>corrected_margin)
);

do $$ declare n text; begin foreach n in array array['event_team_entry_versions','event_team_seating_publications','event_team_seating_assignments','event_team_schedule_publications','event_team_games','event_team_starts','event_team_score_submissions','event_team_score_confirmations','event_team_scorelines','event_team_score_corrections'] loop
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);execute format('revoke all on table app.%I from public,anon,authenticated',n);end loop;end $$;
create trigger event_team_entry_versions_immutable before update or delete on app.event_team_entry_versions for each row execute function app.reject_immutable_history();
create trigger event_team_seating_publications_immutable before update or delete on app.event_team_seating_publications for each row execute function app.reject_immutable_history();
create trigger event_team_seating_assignments_immutable before update or delete on app.event_team_seating_assignments for each row execute function app.reject_immutable_history();
create trigger event_team_schedule_publications_immutable before update or delete on app.event_team_schedule_publications for each row execute function app.reject_immutable_history();
create trigger event_team_starts_immutable before update or delete on app.event_team_starts for each row execute function app.reject_immutable_history();
create trigger event_team_score_submissions_immutable before update or delete on app.event_team_score_submissions for each row execute function app.reject_immutable_history();
create trigger event_team_score_confirmations_immutable before update or delete on app.event_team_score_confirmations for each row execute function app.reject_immutable_history();
create trigger event_team_score_corrections_immutable before update or delete on app.event_team_score_corrections for each row execute function app.reject_immutable_history();

create or replace function app.team_actor_is_official_v1(p_actor uuid,p_tournament uuid,p_game uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament and r.profile_id=p_actor and r.role in('director','co_director','cross_checker'))
 and not exists(select 1 from app.event_team_games g join app.event_team_entries te on te.id in(g.side_a_team_entry_id,g.side_b_team_entry_id) join app.event_team_members tm on tm.team_id=te.team_id where g.id=p_game and tm.profile_id=p_actor)
$$;
revoke all on function app.team_actor_is_official_v1(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.create_event_team_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_team_id uuid,p_team_entry_id uuid,p_captain_roster_entry_id uuid,p_partner_roster_entry_id uuid,p_scorecard_type text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text;prior app.operation_receipts%rowtype;rid uuid;captain_profile uuid;captain_name text;partner_name text;response jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_scorecard_type not in('digital','paper') or p_captain_roster_entry_id=p_partner_roster_entry_id then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('create_event_team_v1',p_actor_id,p_tournament_id,p_event_id,p_team_id,p_team_entry_id,p_captain_roster_entry_id,p_partner_roster_entry_id,p_scorecard_type)::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team:'||p_event_id::text,0));select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return prior.response_payload;end if;
 perform 1 from app.events where id=p_event_id and tournament_id=p_tournament_id and format in('doubles','canadian_doubles') and scoring_method='digital';if not found then return jsonb_build_object('status','rejected','code','event_not_supported');end if;
 select l.profile_id,r.claimed_display_name into captain_profile,captain_name from app.tournament_roster_entries r left join app.roster_account_links l on l.tournament_id=r.tournament_id and l.roster_entry_id=r.id where r.id=p_captain_roster_entry_id and r.tournament_id=p_tournament_id;
 select claimed_display_name into partner_name from app.tournament_roster_entries where id=p_partner_roster_entry_id and tournament_id=p_tournament_id;
 if captain_name is null or partner_name is null or (p_scorecard_type='digital' and captain_profile is null) or not(exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) or captain_profile=p_actor_id) then return jsonb_build_object('status','rejected','code','team_authority_unavailable');end if;
 if exists(select 1 from app.event_team_members where event_id=p_event_id and roster_entry_id in(p_captain_roster_entry_id,p_partner_roster_entry_id)) then return jsonb_build_object('status','rejected','code','member_already_teamed');end if;
 response:=jsonb_build_object('status','team_created','teamId',p_team_id,'teamEntryId',p_team_entry_id,'displayName',captain_name||' / '||partner_name,'scorecardType',p_scorecard_type);
 insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'create_event_team_v1',p_team_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into rid;
 insert into app.event_teams(id,tournament_id,event_id,display_name,created_by_profile_id) values(p_team_id,p_tournament_id,p_event_id,captain_name||' / '||partner_name,p_actor_id);
 insert into app.event_team_members(team_id,tournament_id,event_id,roster_entry_id,profile_id,acc_number_snapshot,member_role,claimed_at) select p_team_id,p_tournament_id,p_event_id,r.id,l.profile_id,coalesce(r.claimed_acc_number,''),case when r.id=p_captain_roster_entry_id then 'captain' else 'member' end,case when l.profile_id is null then null else clock_timestamp() end from app.tournament_roster_entries r left join app.roster_account_links l on l.tournament_id=r.tournament_id and l.roster_entry_id=r.id where r.id in(p_captain_roster_entry_id,p_partner_roster_entry_id);
 insert into app.event_team_entries(id,team_id,tournament_id,event_id,entry_fee_minor,scorecard_type,digital_scoring_enabled) values(p_team_entry_id,p_team_id,p_tournament_id,p_event_id,0,p_scorecard_type,p_scorecard_type='digital');
 insert into app.event_team_entry_versions(team_entry_id,tournament_id,event_id,version,scorecard_type,designated_scorer_profile_id,actor_profile_id,operation_receipt_id,reason) values(p_team_entry_id,p_tournament_id,p_event_id,1,p_scorecard_type,case when p_scorecard_type='digital' then captain_profile else null end,p_actor_id,rid,'Captain selected the shared team scorecard');
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,rid,'event_team',p_team_id,'team_created',response);return response;
end $$;

create or replace function public.configure_event_team_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_team_entry_id uuid,p_scorecard_type text,p_designated_scorer_profile_id uuid,p_expected_version integer,p_reason text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text;prior app.operation_receipts%rowtype;rid uuid;next_version integer;team_id_value uuid;response jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_scorecard_type not in('digital','paper') or p_expected_version<1 or(p_scorecard_type='digital' and p_designated_scorer_profile_id is null) then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('configure_event_team_v1',p_actor_id,p_tournament_id,p_event_id,p_team_entry_id,p_scorecard_type,p_designated_scorer_profile_id,p_expected_version,coalesce(p_reason,''))::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-entry:'||p_team_entry_id::text,0));select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return prior.response_payload;end if;
 select team_id into team_id_value from app.event_team_entries where id=p_team_entry_id and tournament_id=p_tournament_id and event_id=p_event_id;if not found or exists(select 1 from app.event_team_starts where event_id=p_event_id) then return jsonb_build_object('status','rejected','code','configuration_locked');end if;
 if not(exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) or exists(select 1 from app.event_team_members where team_id=team_id_value and profile_id=p_actor_id and member_role='captain')) then return jsonb_build_object('status','rejected','code','not_authorized');end if;
 if p_scorecard_type='digital' and not exists(select 1 from app.event_team_members where team_id=team_id_value and profile_id=p_designated_scorer_profile_id) then return jsonb_build_object('status','rejected','code','scorer_not_team_member');end if;
 select coalesce(max(version),0)+1 into next_version from app.event_team_entry_versions where team_entry_id=p_team_entry_id;if next_version<>p_expected_version+1 then return jsonb_build_object('status','rejected','code','stale_version');end if;
 response:=jsonb_build_object('status','team_configured','teamEntryId',p_team_entry_id,'version',next_version,'scorecardType',p_scorecard_type,'designatedScorerProfileId',case when p_scorecard_type='digital' then p_designated_scorer_profile_id else null end);
 insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'configure_event_team_v1',p_team_entry_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into rid;
 insert into app.event_team_entry_versions(team_entry_id,tournament_id,event_id,version,scorecard_type,designated_scorer_profile_id,actor_profile_id,operation_receipt_id,reason) values(p_team_entry_id,p_tournament_id,p_event_id,next_version,p_scorecard_type,case when p_scorecard_type='digital' then p_designated_scorer_profile_id else null end,p_actor_id,rid,nullif(trim(coalesce(p_reason,'')),''));
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,rid,'event_team_entry',p_team_entry_id,'team_configuration_changed',response);return response;
end $$;

create or replace function public.publish_event_team_seating_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_publication_id uuid,p_assignments jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text;prior app.operation_receipts%rowtype;rid uuid;response jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' or jsonb_typeof(p_assignments)<>'array' or jsonb_array_length(p_assignments)<1 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('publish_event_team_seating_v1',p_actor_id,p_tournament_id,p_event_id,p_publication_id,p_assignments)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-seating:'||p_event_id::text,0));select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return prior.response_payload;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))
   or not exists(select 1 from app.tournaments where id=p_tournament_id and status in('draft','open') and registration_status='closed')
   or exists(select 1 from app.event_team_seating_publications where event_id=p_event_id) then return jsonb_build_object('status','rejected','code','not_available');end if;
 if jsonb_array_length(p_assignments)<>(select count(*) from app.event_team_entries where event_id=p_event_id) or exists(select 1 from jsonb_array_elements(p_assignments)x where coalesce(x->>'teamEntryId','')!~'^[0-9a-f-]{36}$' or coalesce(x->>'tableSeat','')!~'^[A-Z]-[1-9][0-9]*$') or (select count(distinct x->>'teamEntryId') from jsonb_array_elements(p_assignments)x)<>jsonb_array_length(p_assignments) or(select count(distinct x->>'tableSeat') from jsonb_array_elements(p_assignments)x)<>jsonb_array_length(p_assignments) or exists(select 1 from jsonb_array_elements(p_assignments)x where not exists(select 1 from app.event_team_entries te where te.id=(x->>'teamEntryId')::uuid and te.tournament_id=p_tournament_id and te.event_id=p_event_id)) then return jsonb_build_object('status','rejected','code','invalid_assignments');end if;
 response:=jsonb_build_object('status','team_seating_published','eventId',p_event_id,'publicationId',p_publication_id,'assignmentCount',jsonb_array_length(p_assignments));insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'publish_event_team_seating_v1',p_publication_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into rid;
 insert into app.event_team_seating_publications(id,tournament_id,event_id,actor_profile_id,operation_receipt_id) values(p_publication_id,p_tournament_id,p_event_id,p_actor_id,rid);insert into app.event_team_seating_assignments(publication_id,team_entry_id,tournament_id,event_id,initial_table_seat) select p_publication_id,(x->>'teamEntryId')::uuid,p_tournament_id,p_event_id,x->>'tableSeat' from jsonb_array_elements(p_assignments)x;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,rid,'event_team_seating',p_publication_id,'team_seating_published',response);return response;
end $$;

create or replace function public.publish_event_team_schedule_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_publication_id uuid,p_game_count integer,p_matches jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text;prior app.operation_receipts%rowtype;rid uuid;response jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_game_count not between 1 and 99 or jsonb_typeof(p_matches)<>'array' or jsonb_array_length(p_matches)<1 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('publish_event_team_schedule_v1',p_actor_id,p_tournament_id,p_event_id,p_publication_id,p_game_count,p_matches)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-schedule:'||p_event_id::text,0));select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return prior.response_payload;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) or not exists(select 1 from app.event_team_seating_publications where event_id=p_event_id) or exists(select 1 from app.event_team_schedule_publications where event_id=p_event_id)
   or p_game_count is distinct from (select setup_event.game_count::integer from app.tournament_setup_activations activation join app.tournament_setup_event_versions setup_event on setup_event.id=activation.setup_event_version_id where activation.event_id=p_event_id and activation.tournament_id=p_tournament_id)
   then return jsonb_build_object('status','rejected','code','not_available');end if;
 if exists(select 1 from jsonb_array_elements(p_matches)x where coalesce((x->>'gameNumber')::integer,0) not between 1 and p_game_count or coalesce(x->>'sideATeamEntryId','')!~'^[0-9a-f-]{36}$' or coalesce(x->>'sideBTeamEntryId','')!~'^[0-9a-f-]{36}$' or x->>'sideATeamEntryId'=x->>'sideBTeamEntryId' or coalesce(x->>'sideATableSeat','')!~'^[A-Z]-[1-9][0-9]*$' or coalesce(x->>'sideBTableSeat','')!~'^[A-Z]-[1-9][0-9]*$') then return jsonb_build_object('status','rejected','code','invalid_schedule');end if;
 response:=jsonb_build_object('status','team_schedule_published','eventId',p_event_id,'publicationId',p_publication_id,'gameCount',p_game_count,'matchCount',jsonb_array_length(p_matches));insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'publish_event_team_schedule_v1',p_publication_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into rid;
 insert into app.event_team_schedule_publications(id,tournament_id,event_id,game_count,actor_profile_id,operation_receipt_id) values(p_publication_id,p_tournament_id,p_event_id,p_game_count,p_actor_id,rid);insert into app.event_team_games(id,tournament_id,event_id,publication_id,game_number,match_instance,side_a_team_entry_id,side_b_team_entry_id,side_a_table_seat,side_b_table_seat) select (x->>'gameId')::uuid,p_tournament_id,p_event_id,p_publication_id,(x->>'gameNumber')::integer,coalesce((x->>'matchInstance')::integer,1),(x->>'sideATeamEntryId')::uuid,(x->>'sideBTeamEntryId')::uuid,x->>'sideATableSeat',x->>'sideBTableSeat' from jsonb_array_elements(p_matches)x;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,rid,'event_team_schedule',p_publication_id,'team_schedule_published',response);return response;
end $$;

create or replace function public.start_event_team_play_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_start_id uuid,p_schedule_publication_id uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text;prior app.operation_receipts%rowtype;rid uuid;response jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then return jsonb_build_object('status','rejected','code','invalid_request');end if;h:=encode(extensions.digest(convert_to(jsonb_build_array('start_event_team_play_v1',p_actor_id,p_tournament_id,p_event_id,p_start_id,p_schedule_publication_id)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-start:'||p_event_id::text,0));select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return prior.response_payload;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))
   or not exists(select 1 from app.tournaments where id=p_tournament_id and status='open' and registration_status='closed')
   or not exists(select 1 from app.event_team_schedule_publications where id=p_schedule_publication_id and event_id=p_event_id and tournament_id=p_tournament_id)
   or exists(select 1 from app.event_team_starts where event_id=p_event_id) then return jsonb_build_object('status','rejected','code','not_ready');end if;
 if exists(select 1 from app.event_team_entries te left join lateral(select * from app.event_team_entry_versions v where v.team_entry_id=te.id order by v.version desc limit 1)v on true where te.event_id=p_event_id and (v.id is null or(v.scorecard_type='digital' and v.designated_scorer_profile_id is null))) then return jsonb_build_object('status','rejected','code','team_configuration_incomplete');end if;
 response:=jsonb_build_object('status','team_event_started','eventId',p_event_id,'startId',p_start_id);insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'start_event_team_play_v1',p_start_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into rid;insert into app.event_team_starts(id,tournament_id,event_id,schedule_publication_id,actor_profile_id,operation_receipt_id) values(p_start_id,p_tournament_id,p_event_id,p_schedule_publication_id,p_actor_id,rid);insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,rid,'event_team_start',p_start_id,'team_event_started',response);return response;
end $$;

create or replace function public.submit_event_team_score_v1(p_actor_id uuid,p_tournament_id uuid,p_game_id uuid,p_submission_id uuid,p_winner_side text,p_margin integer,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g app.event_team_games%rowtype;entry_id uuid;card text;scorer uuid;source text;h text;prior app.operation_receipts%rowtype;rid uuid;response jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_winner_side not in('a','b') or p_margin not between 1 and 121 then return jsonb_build_object('status','rejected','code','invalid_request');end if;select * into g from app.event_team_games where id=p_game_id and tournament_id=p_tournament_id for update;if not found or not exists(select 1 from app.event_team_starts where event_id=g.event_id) or g.state not in('pending','submitted') then return jsonb_build_object('status','rejected','code','game_not_available');end if;
 entry_id:=case when exists(select 1 from app.event_team_members tm join app.event_team_entries te on te.team_id=tm.team_id where tm.profile_id=p_actor_id and te.id=g.side_a_team_entry_id) then g.side_a_team_entry_id when exists(select 1 from app.event_team_members tm join app.event_team_entries te on te.team_id=tm.team_id where tm.profile_id=p_actor_id and te.id=g.side_b_team_entry_id) then g.side_b_team_entry_id else null end;
 if entry_id is null then if not app.team_actor_is_official_v1(p_actor_id,p_tournament_id,p_game_id) then return jsonb_build_object('status','rejected','code','not_authorized');end if;entry_id:=case when not exists(select 1 from app.event_team_score_submissions where team_game_id=p_game_id and side='a') then g.side_a_team_entry_id else g.side_b_team_entry_id end;source:='paper_transcription';else source:='digital';end if;
 select v.scorecard_type,v.designated_scorer_profile_id into card,scorer from app.event_team_entry_versions v where v.team_entry_id=entry_id order by v.version desc limit 1;if (source='digital' and(card<>'digital' or scorer<>p_actor_id))or(source='paper_transcription' and card<>'paper') then return jsonb_build_object('status','rejected','code','wrong_scorecard_authority');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('submit_event_team_score_v1',p_actor_id,p_tournament_id,p_game_id,p_submission_id,p_winner_side,p_margin,entry_id,source)::text,'utf8'),'sha256'),'hex');select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return prior.response_payload;end if;
 response:=jsonb_build_object('status','team_score_submitted','gameId',p_game_id,'submissionId',p_submission_id,'side',case when entry_id=g.side_a_team_entry_id then'a'else'b'end,'sourceMethod',source);insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'submit_event_team_score_v1',p_submission_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into rid;
 insert into app.event_team_score_submissions(id,tournament_id,event_id,team_game_id,submitting_team_entry_id,submitter_profile_id,side,winner_side,margin,source_method,operation_receipt_id) values(p_submission_id,p_tournament_id,g.event_id,p_game_id,entry_id,p_actor_id,case when entry_id=g.side_a_team_entry_id then'a'else'b'end,p_winner_side,p_margin,source,rid);
 update app.event_team_games set state=case when(select count(*) from app.event_team_score_submissions where team_game_id=p_game_id)=2 then case when(select count(distinct(winner_side,margin)) from app.event_team_score_submissions where team_game_id=p_game_id)=1 then'confirmation_pending'else'mismatch'end else'submitted'end where id=p_game_id;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,rid,'event_team_game',p_game_id,'team_score_submitted',response);return response;
end $$;

create or replace function public.confirm_event_team_score_v1(p_actor_id uuid,p_tournament_id uuid,p_game_id uuid,p_submission_id uuid,p_confirmation_id uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g app.event_team_games%rowtype;s app.event_team_score_submissions%rowtype;opposite uuid;opposite_card text;opposite_scorer uuid;h text;prior app.operation_receipts%rowtype;rid uuid;response jsonb;winning uuid;losing uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then return jsonb_build_object('status','rejected','code','invalid_request');end if;select * into g from app.event_team_games where id=p_game_id and tournament_id=p_tournament_id for update;select * into s from app.event_team_score_submissions where id=p_submission_id and team_game_id=p_game_id;if g.state<>'confirmation_pending' or s.id is null or s.submitter_profile_id=p_actor_id then return jsonb_build_object('status','rejected','code','confirmation_not_available');end if;opposite:=case when s.side='a' then g.side_b_team_entry_id else g.side_a_team_entry_id end;select v.scorecard_type,v.designated_scorer_profile_id into opposite_card,opposite_scorer from app.event_team_entry_versions v where v.team_entry_id=opposite order by v.version desc limit 1;
 if not((opposite_card='digital' and opposite_scorer=p_actor_id)or(opposite_card='paper' and app.team_actor_is_official_v1(p_actor_id,p_tournament_id,p_game_id))) then return jsonb_build_object('status','rejected','code','not_independent_confirmer');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('confirm_event_team_score_v1',p_actor_id,p_game_id,p_submission_id,p_confirmation_id)::text,'utf8'),'sha256'),'hex');select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return prior.response_payload;end if;
 response:=jsonb_build_object('status','team_score_confirmed','gameId',p_game_id,'submissionId',p_submission_id,'confirmationId',p_confirmation_id);insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'confirm_event_team_score_v1',p_confirmation_id,h,p_operation_id,'accepted',response,clock_timestamp()) returning id into rid;insert into app.event_team_score_confirmations(id,tournament_id,event_id,team_game_id,submission_id,confirmation_profile_id,operation_receipt_id) values(p_confirmation_id,p_tournament_id,g.event_id,p_game_id,p_submission_id,p_actor_id,rid);
 if(select count(*) from app.event_team_score_confirmations where team_game_id=p_game_id)=2 then
   select case when winner_side='a' then g.side_a_team_entry_id else g.side_b_team_entry_id end,case when winner_side='a' then g.side_b_team_entry_id else g.side_a_team_entry_id end into winning,losing from app.event_team_score_submissions where team_game_id=p_game_id limit 1;
   insert into app.event_team_scorelines(tournament_id,event_id,team_game_id,team_entry_id,opponent_team_entry_id,side,is_winner,margin,plus_points,minus_points,game_points)
   select p_tournament_id,g.event_id,p_game_id,g.side_a_team_entry_id,g.side_b_team_entry_id,'a',g.side_a_team_entry_id=winning,scored.margin,case when g.side_a_team_entry_id=winning then scored.margin else 0 end,case when g.side_a_team_entry_id=losing then scored.margin else 0 end,case when g.side_a_team_entry_id=winning then case when scored.margin>=31 then 3 else 2 end else 0 end
     from (select submission.margin from app.event_team_score_submissions submission where submission.team_game_id=p_game_id order by submission.side limit 1) scored
   union all
   select p_tournament_id,g.event_id,p_game_id,g.side_b_team_entry_id,g.side_a_team_entry_id,'b',g.side_b_team_entry_id=winning,scored.margin,case when g.side_b_team_entry_id=winning then scored.margin else 0 end,case when g.side_b_team_entry_id=losing then scored.margin else 0 end,case when g.side_b_team_entry_id=winning then case when scored.margin>=31 then 3 else 2 end else 0 end
     from (select submission.margin from app.event_team_score_submissions submission where submission.team_game_id=p_game_id order by submission.side limit 1) scored;
   update app.event_team_games set state='verified',winner_side=case when winning=g.side_a_team_entry_id then'a'else'b'end,margin=(select margin from app.event_team_score_submissions where team_game_id=p_game_id limit 1) where id=p_game_id;
 end if;insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,rid,'event_team_game',p_game_id,'team_score_confirmed',response);return response;
end $$;

create or replace function public.get_event_team_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tournament_row app.tournaments%rowtype; event_row app.events%rowtype;
  events_json jsonb:='[]'::jsonb; teams_json jsonb; games_json jsonb; standings_json jsonb; roster_json jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or not exists(
    select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id
  ) then return null; end if;
  select * into tournament_row from app.tournaments where id=p_tournament_id;
  if not found then return null; end if;
  for event_row in select * from app.events e where e.tournament_id=p_tournament_id and e.format in('doubles','canadian_doubles') order by e.name loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'teamId',team.id,'teamEntryId',entry.id,'displayName',team.display_name,
      'members',(select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',member.roster_entry_id,'displayName',roster.claimed_display_name,'accNumber',roster.claimed_acc_number,'profileLinked',member.profile_id is not null,'role',member.member_role) order by member.member_role),'[]'::jsonb) from app.event_team_members member join app.tournament_roster_entries roster on roster.id=member.roster_entry_id where member.team_id=team.id),
      'scorecardType',version.scorecard_type,'designatedScorerProfileId',version.designated_scorer_profile_id,
      'configurationVersion',version.version,'verificationId',seat.verification_id,'initialTableSeat',seat.initial_table_seat
    ) order by team.display_name),'[]'::jsonb) into teams_json
    from app.event_team_entries entry join app.event_teams team on team.id=entry.team_id
    join lateral(select * from app.event_team_entry_versions value where value.team_entry_id=entry.id order by value.version desc limit 1) version on true
    left join app.event_team_seating_assignments seat on seat.team_entry_id=entry.id where entry.event_id=event_row.id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'gameId',game.id,'gameNumber',game.game_number,'state',game.state,'version',game.version,
      'sideATeamEntryId',game.side_a_team_entry_id,'sideBTeamEntryId',game.side_b_team_entry_id,
      'sideATableSeat',game.side_a_table_seat,'sideBTableSeat',game.side_b_table_seat,
      'winnerSide',game.winner_side,'margin',game.margin,
      'submissions',(select coalesce(jsonb_agg(jsonb_build_object('submissionId',submission.id,'side',submission.side,'winnerSide',submission.winner_side,'margin',submission.margin,'sourceMethod',submission.source_method,'own',submission.submitter_profile_id=p_actor_id,'confirmed',exists(select 1 from app.event_team_score_confirmations confirmation where confirmation.submission_id=submission.id)) order by submission.side),'[]'::jsonb) from app.event_team_score_submissions submission where submission.team_game_id=game.id)
    ) order by game.game_number,game.match_instance),'[]'::jsonb) into games_json
    from app.event_team_games game where game.event_id=event_row.id;
    select coalesce(jsonb_agg(jsonb_build_object('teamEntryId',summary.team_entry_id,'displayName',summary.display_name,'gamePoints',summary.game_points,'gamesWon',summary.games_won,'plusPoints',summary.plus_points,'minusPoints',summary.minus_points,'netSpreadPoints',summary.net_points) order by summary.game_points desc,summary.games_won desc,summary.net_points desc,summary.plus_points desc,summary.display_name),'[]'::jsonb) into standings_json
    from (select entry.id team_entry_id,team.display_name,coalesce(sum(line.game_points),0)::integer game_points,coalesce(count(*) filter(where line.is_winner),0)::integer games_won,coalesce(sum(line.plus_points),0)::integer plus_points,coalesce(sum(line.minus_points),0)::integer minus_points,coalesce(sum(line.plus_points-line.minus_points),0)::integer net_points from app.event_team_entries entry join app.event_teams team on team.id=entry.team_id left join app.event_team_scorelines line on line.team_entry_id=entry.id where entry.event_id=event_row.id group by entry.id,team.display_name) summary;
    events_json:=events_json||jsonb_build_array(jsonb_build_object(
      'eventId',event_row.id,'name',event_row.name,'format',event_row.format,
      'configuredGameCount',coalesce((select setup_event.game_count::integer from app.tournament_setup_activations activation join app.tournament_setup_event_versions setup_event on setup_event.id=activation.setup_event_version_id where activation.event_id=event_row.id),1),
      'started',exists(select 1 from app.event_team_starts start_record where start_record.event_id=event_row.id),
      'teams',teams_json,'games',games_json,'standings',standings_json));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',roster.id,'displayName',roster.claimed_display_name,'accNumber',roster.claimed_acc_number,'profileId',link.profile_id,'personalScorecardType',roster.scorecard_type) order by roster.claimed_normalized_name),'[]'::jsonb) into roster_json from app.tournament_roster_entries roster left join app.roster_account_links link on link.tournament_id=roster.tournament_id and link.roster_entry_id=roster.id where roster.tournament_id=p_tournament_id;
  return jsonb_build_object('tournamentId',tournament_row.id,'tournamentName',tournament_row.name,
    'canManage',exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')),
    'canCrossCheck',exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director','cross_checker')),
    'events',events_json,'roster',roster_json);
end
$$;

create or replace function public.get_tournament_seating_directory_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
select case when coalesce(auth.role(),'')='service_role' and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id) then jsonb_build_object('tournamentId',t.id,'tournamentName',t.name,'entries',coalesce((
 select jsonb_agg(row_data order by row_data->>'displayName') from(
  select jsonb_build_object('entryKind','player','eventId',ep.event_id,'eventName',e.name,'displayName',r.claimed_display_name,'teamName',null,'scorecardType',r.scorecard_type,'assignedTableSeat',seat.initial_table_seat,'verificationId',seat.verification_id,'isSelf',l.profile_id=p_actor_id)row_data from app.event_participants ep join app.events e on e.id=ep.event_id join app.tournament_roster_entries r on r.id=ep.roster_entry_id left join app.roster_account_links l on l.roster_entry_id=r.id and l.tournament_id=r.tournament_id join app.initial_seating_assignments seat on seat.roster_entry_id=r.id and seat.tournament_id=r.tournament_id where ep.tournament_id=p_tournament_id and e.format='standard_singles' and(p_event_id is null or ep.event_id=p_event_id)
  union all
  select jsonb_build_object('entryKind','team_member','eventId',te.event_id,'eventName',e.name,'displayName',r.claimed_display_name,'teamName',team.display_name,'scorecardType',v.scorecard_type,'assignedTableSeat',seat.initial_table_seat,'verificationId',seat.verification_id,'isSelf',tm.profile_id=p_actor_id) from app.event_team_entries te join app.events e on e.id=te.event_id join app.event_teams team on team.id=te.team_id join app.event_team_members tm on tm.team_id=team.id join app.tournament_roster_entries r on r.id=tm.roster_entry_id join lateral(select * from app.event_team_entry_versions x where x.team_entry_id=te.id order by x.version desc limit 1)v on true join app.event_team_seating_assignments seat on seat.team_entry_id=te.id where te.tournament_id=p_tournament_id and(p_event_id is null or te.event_id=p_event_id)
 )q),'[]'::jsonb))else null end from app.tournaments t where t.id=p_tournament_id
$$;

do $$ declare sig text; begin foreach sig in array array[
 'public.create_event_team_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)','public.configure_event_team_v1(uuid,uuid,uuid,uuid,text,uuid,integer,text,uuid)','public.publish_event_team_seating_v1(uuid,uuid,uuid,uuid,jsonb,uuid)','public.publish_event_team_schedule_v1(uuid,uuid,uuid,uuid,integer,jsonb,uuid)','public.start_event_team_play_v1(uuid,uuid,uuid,uuid,uuid,uuid)','public.submit_event_team_score_v1(uuid,uuid,uuid,uuid,text,integer,uuid)','public.confirm_event_team_score_v1(uuid,uuid,uuid,uuid,uuid,uuid)','public.get_event_team_workspace_v1(uuid,uuid)','public.get_tournament_seating_directory_v1(uuid,uuid,uuid)'] loop execute 'revoke all on function '||sig||' from public,anon,authenticated';execute 'grant execute on function '||sig||' to service_role';end loop;end $$;

notify pgrst,'reload schema';
