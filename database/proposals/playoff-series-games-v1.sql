-- UNEXECUTED PRIVATE SOURCE CANDIDATE. No route, grant, feature enablement, or
-- database installation is included. This depends on playoff-series-matches-v1
-- and the operational activation gate. Runtime parsing, concurrency, and SQL/TS
-- parity remain to be proved in an isolated database.
--
-- This protocol supports identity-bound digital play only. Paper records,
-- synthetic players, forfeits, director attestations, and checkbox approval are
-- deliberately unsupported. It never writes canonical_games or card_scorelines.
begin;

create table app.playoff_series_game_operations_v1(
 actor_id uuid not null references app.profiles(id),
 operation_id uuid not null,
 tournament_id uuid not null,
 event_id uuid not null,
 qualification_id uuid not null,
 slot integer not null check(slot between 1 and 4),
 generation_id uuid,
 request_payload jsonb not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),
 unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(qualification_id,tournament_id,event_id)
  references app.qualification_result_versions(id,tournament_id,event_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array(
  'playoff-series-game-action-v1',actor_id,tournament_id,event_id,qualification_id,slot,operation_id,request_payload
 )::text,'utf8'),'sha256'),'hex'))
);

create table app.playoff_series_game_operation_outcomes_v1(
 actor_id uuid not null,
 operation_id uuid not null,
 tournament_id uuid not null,
 event_id uuid not null,
 result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.playoff_series_game_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

create table app.playoff_series_game_operation_conflicts_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 actor_id uuid not null references app.profiles(id),
 operation_id uuid not null,
 tournament_id uuid not null,
 event_id uuid not null,
 qualification_id uuid not null,
 slot integer not null check(slot between 1 and 4),
 attempted_request jsonb not null,
 attempted_hash text not null check(attempted_hash~'^[a-f0-9]{64}$'),
 result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(actor_id,operation_id)
  references app.playoff_series_game_operations_v1(actor_id,operation_id)
);

create table app.playoff_series_games_v1(
 id uuid primary key,
 generation_id uuid not null,
 tournament_id uuid not null,
 event_id uuid not null,
 game_number integer not null check(game_number>0),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 unique(generation_id,game_number),
 unique(id,generation_id),
 foreign key(generation_id,tournament_id,event_id)
  references app.playoff_series_generations_v1(id,tournament_id,event_id)
);

-- Only accepted submit/confirm work appears here. Recovery must inspect this
-- table, not the terminal operation journal, so rejected requests do not block
-- generation replacement.
create table app.playoff_series_game_actions_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 actor_id uuid not null,
 operation_id uuid not null,
 tournament_id uuid not null,
 event_id uuid not null,
 generation_id uuid not null,
 game_id uuid not null,
 game_version integer not null check(game_version>0),
 action_type text not null check(action_type in('submit','amend','confirm')),
 created_at timestamptz not null default clock_timestamp(),
 unique(actor_id,operation_id),
 unique(game_id,game_version),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.playoff_series_game_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(game_id,generation_id) references app.playoff_series_games_v1(id,generation_id),
 foreign key(generation_id,tournament_id,event_id)
  references app.playoff_series_generations_v1(id,tournament_id,event_id)
);

create table app.playoff_series_game_submissions_v1(
 id uuid primary key,
 action_id uuid not null unique references app.playoff_series_game_actions_v1(id),
 game_id uuid not null,
 generation_id uuid not null,
 tournament_id uuid not null,
 event_id uuid not null,
 actor_profile_id uuid not null references app.profiles(id),
 participant_id uuid not null,
 winner_participant_id uuid not null,
 submitted_at timestamptz not null default clock_timestamp(),
 unique(id,game_id),
 unique(id,game_id,actor_profile_id),
 foreign key(game_id,generation_id) references app.playoff_series_games_v1(id,generation_id),
 foreign key(participant_id,actor_profile_id,event_id,tournament_id)
  references app.event_participants(id,profile_id,event_id,tournament_id),
 foreign key(winner_participant_id,event_id,tournament_id)
  references app.event_participants(id,event_id,tournament_id)
);

create table app.playoff_series_game_confirmations_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 action_id uuid not null unique references app.playoff_series_game_actions_v1(id),
 game_id uuid not null,
 generation_id uuid not null,
 actor_profile_id uuid not null references app.profiles(id),
 submission_id uuid not null,
 confirmed_at timestamptz not null default clock_timestamp(),
 unique(game_id,actor_profile_id,submission_id),
 unique(id,game_id),
 unique(id,game_id,actor_profile_id),
 foreign key(game_id,generation_id) references app.playoff_series_games_v1(id,generation_id),
 foreign key(submission_id,game_id,actor_profile_id)
  references app.playoff_series_game_submissions_v1(id,game_id,actor_profile_id)
);

create table app.playoff_series_verified_games_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 game_id uuid not null unique,
 generation_id uuid not null,
 tournament_id uuid not null,
 event_id uuid not null,
 game_number integer not null check(game_number>0),
 winner_participant_id uuid not null,
 loser_participant_id uuid not null,
 side_a_submission_id uuid not null,
 side_b_submission_id uuid not null,
 side_a_confirmation_id uuid not null,
 side_b_confirmation_id uuid not null,
 verified_by_action_id uuid not null unique references app.playoff_series_game_actions_v1(id),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 verified_at timestamptz not null default clock_timestamp(),
 unique(generation_id,game_number),
 unique(id,generation_id),
 foreign key(game_id,generation_id) references app.playoff_series_games_v1(id,generation_id),
 foreign key(generation_id,tournament_id,event_id)
  references app.playoff_series_generations_v1(id,tournament_id,event_id),
 foreign key(winner_participant_id,event_id,tournament_id)
  references app.event_participants(id,event_id,tournament_id),
 foreign key(loser_participant_id,event_id,tournament_id)
  references app.event_participants(id,event_id,tournament_id),
 foreign key(side_a_submission_id,game_id) references app.playoff_series_game_submissions_v1(id,game_id),
 foreign key(side_b_submission_id,game_id) references app.playoff_series_game_submissions_v1(id,game_id),
 foreign key(side_a_confirmation_id,game_id) references app.playoff_series_game_confirmations_v1(id,game_id),
 foreign key(side_b_confirmation_id,game_id) references app.playoff_series_game_confirmations_v1(id,game_id),
 check(winner_participant_id<>loser_participant_id),
 check(side_a_submission_id<>side_b_submission_id),
 check(side_a_confirmation_id<>side_b_confirmation_id)
);

do $$declare n text;begin
 foreach n in array array[
  'playoff_series_game_operations_v1','playoff_series_game_operation_outcomes_v1',
  'playoff_series_game_operation_conflicts_v1',
  'playoff_series_games_v1','playoff_series_game_actions_v1',
  'playoff_series_game_submissions_v1','playoff_series_game_confirmations_v1',
  'playoff_series_verified_games_v1'
 ]loop
  execute format('alter table app.%I owner to postgres',n);
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 end loop;
end$$;

create index playoff_series_game_actions_generation_v1
 on app.playoff_series_game_actions_v1(generation_id,created_at);
create index playoff_series_game_submissions_latest_v1
 on app.playoff_series_game_submissions_v1(game_id,actor_profile_id,submitted_at desc,id desc);
create index playoff_series_game_confirmations_latest_v1
 on app.playoff_series_game_confirmations_v1(game_id,actor_profile_id,confirmed_at desc,id desc);

create or replace function app.playoff_series_uuid_v1(v text)returns boolean
language sql immutable set search_path='' as $$
 select v is not null and v~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
$$;

create or replace function app.valid_playoff_series_game_request_v1(r jsonb)returns boolean
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(r)is distinct from'object'or(select count(*)from jsonb_object_keys(r))<>17 then return false;end if;
 return r ?& array['operationId','action','gameId','gameNumber','expectedGameVersion','submissionId',
  'confirmationId','priorSubmissionId','winnerParticipantId','confirmedSubmissionId','generationId','generationVersion','sourceDigest',
  'settingsBindingId','reviewId','playoffStartId','parentResultPins']
 and app.playoff_series_uuid_v1(r->>'operationId')
 and r->>'action' in('submit','confirm')
 and app.playoff_series_uuid_v1(r->>'gameId')
 and jsonb_typeof(r->'gameNumber')='number' and (r->>'gameNumber')~'^[1-9][0-9]*$'
 and (r->>'gameNumber')::numeric<=10000
 and jsonb_typeof(r->'expectedGameVersion')='number' and (r->>'expectedGameVersion')~'^(0|[1-9][0-9]*)$'
 and (r->>'expectedGameVersion')::numeric<=2147483646
 and app.playoff_series_uuid_v1(r->>'generationId')
 and jsonb_typeof(r->'generationVersion')='number' and (r->>'generationVersion')~'^[1-9][0-9]*$'
 and (r->>'generationVersion')::numeric<=2147483647
 and (r->>'sourceDigest')~'^[a-f0-9]{64}$'
 and app.playoff_series_uuid_v1(r->>'settingsBindingId')
 and app.playoff_series_uuid_v1(r->>'reviewId')
 and app.playoff_series_uuid_v1(r->>'playoffStartId')
 and jsonb_typeof(r->'parentResultPins')='array'
 and case when r->>'action'='submit' then
  app.playoff_series_uuid_v1(r->>'submissionId')
  and r->'confirmationId'='null'::jsonb
  and (r->'priorSubmissionId'='null'::jsonb or app.playoff_series_uuid_v1(r->>'priorSubmissionId'))
  and app.playoff_series_uuid_v1(r->>'winnerParticipantId')
  and r->'confirmedSubmissionId'='null'::jsonb
 else
  r->'submissionId'='null'::jsonb
  and app.playoff_series_uuid_v1(r->>'confirmationId')
  and r->'priorSubmissionId'='null'::jsonb
  and r->'winnerParticipantId'='null'::jsonb
  and app.playoff_series_uuid_v1(r->>'confirmedSubmissionId')
 end
 ;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end
$$;

create or replace function app.playoff_series_game_request_hash_v1(
 p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_qualification_id uuid,p_slot integer,p_request jsonb
)returns text language sql immutable set search_path='' as $$
 select encode(extensions.digest(convert_to(jsonb_build_array(
  'playoff-series-game-action-v1',p_actor_id,p_tournament_id,p_event_id,p_qualification_id,p_slot,
  (p_request->>'operationId')::uuid,p_request
 )::text,'utf8'),'sha256'),'hex')
$$;

create or replace function app.playoff_series_game_actor_valid_v1(
 p_tournament_id uuid,p_event_id uuid,p_generation_id uuid,p_actor_id uuid
)returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from app.playoff_series_generations_v1 g
  join app.event_participants p on p.id in(g.side_a_participant_id,g.side_b_participant_id)
   and p.event_id=g.event_id and p.tournament_id=g.tournament_id and p.profile_id=p_actor_id
  join app.roster_account_links l on l.tournament_id=g.tournament_id
   and l.roster_entry_id=p.roster_entry_id and l.profile_id=p_actor_id
  where g.id=p_generation_id and g.tournament_id=p_tournament_id and g.event_id=p_event_id
   and p.roster_entry_id is not null
 )
$$;

create or replace function app.playoff_series_games_digest_v1(p_generation_id uuid)returns text
language sql stable security definer set search_path='' as $$
 select encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
  'gameId',v.game_id,'gameNumber',v.game_number,'winnerParticipantId',v.winner_participant_id,
  'sideASubmissionId',v.side_a_submission_id,'sideBSubmissionId',v.side_b_submission_id,
  'sideAConfirmationId',v.side_a_confirmation_id,'sideBConfirmationId',v.side_b_confirmation_id,
  'sourceDigest',v.source_digest
 )order by v.game_number),'[]'::jsonb)::text,'utf8'),'sha256'),'hex')
 from app.playoff_series_verified_games_v1 v where v.generation_id=p_generation_id
$$;

-- This validator intentionally reconstructs the completed series from exact
-- game evidence. It does not call the root current-result reader for this slot.
create or replace function app.playoff_series_completed_result_valid_v1(p_result_id uuid)returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare r app.playoff_series_results_v1%rowtype;g app.playoff_series_generations_v1%rowtype;
 a_wins integer;b_wins integer;n integer;terminal_number integer;final_actor uuid;final_op uuid;
begin
 select * into r from app.playoff_series_results_v1 where id=p_result_id;
 if not found then return false;end if;
 select * into g from app.playoff_series_generations_v1 where id=r.generation_id;
 if not found or r.match_id is distinct from g.match_id or r.tournament_id is distinct from g.tournament_id
  or r.event_id is distinct from g.event_id or r.source_digest is distinct from g.source_digest
  or (select count(*) from app.playoff_series_game_actions_v1 where generation_id=g.id)>10000
  or exists(select 1 from app.playoff_series_game_actions_v1 action where action.generation_id=g.id and(
   action.actor_id not in(g.side_a_profile_id,g.side_b_profile_id)
   or (action.action_type in('submit','amend')and(
    (select count(*)from app.playoff_series_game_submissions_v1 s where s.action_id=action.id)<>1
    or exists(select 1 from app.playoff_series_game_confirmations_v1 c where c.action_id=action.id)))
   or (action.action_type='confirm'and(
    (select count(*)from app.playoff_series_game_confirmations_v1 c where c.action_id=action.id)<>1
    or exists(select 1 from app.playoff_series_game_submissions_v1 s where s.action_id=action.id)))
  ))
  or exists(select 1 from app.playoff_series_games_v1 game where game.generation_id=g.id and(
   not exists(select 1 from app.playoff_series_verified_games_v1 verified where verified.game_id=game.id)
   or (select count(*)from app.playoff_series_game_actions_v1 action where action.game_id=game.id)
      is distinct from(select max(action.game_version)::bigint from app.playoff_series_game_actions_v1 action where action.game_id=game.id)
   or (select action.game_version from app.playoff_series_verified_games_v1 verified
       join app.playoff_series_game_actions_v1 action on action.id=verified.verified_by_action_id
       where verified.game_id=game.id)
      is distinct from(select max(action.game_version)from app.playoff_series_game_actions_v1 action where action.game_id=game.id)
  ))
 then return false;end if;
 if exists(
  select 1 from app.playoff_series_verified_games_v1 v
  join app.playoff_series_games_v1 game on game.id=v.game_id and game.generation_id=v.generation_id
  join app.playoff_series_game_submissions_v1 sa on sa.id=v.side_a_submission_id
  join app.playoff_series_game_actions_v1 saa on saa.id=sa.action_id
  join app.playoff_series_game_submissions_v1 sb on sb.id=v.side_b_submission_id
  join app.playoff_series_game_actions_v1 sba on sba.id=sb.action_id
  join app.playoff_series_game_confirmations_v1 ca on ca.id=v.side_a_confirmation_id
  join app.playoff_series_game_actions_v1 caa on caa.id=ca.action_id
  join app.playoff_series_game_confirmations_v1 cb on cb.id=v.side_b_confirmation_id
  join app.playoff_series_game_actions_v1 cba on cba.id=cb.action_id
  join app.playoff_series_game_actions_v1 va on va.id=v.verified_by_action_id
  where v.generation_id=g.id and not(
   v.tournament_id=g.tournament_id and v.event_id=g.event_id and v.source_digest=g.source_digest
   and game.game_number=v.game_number and game.source_digest=g.source_digest
   and sa.game_id=v.game_id and sb.game_id=v.game_id and ca.game_id=v.game_id and cb.game_id=v.game_id
   and sa.actor_profile_id=g.side_a_profile_id and sb.actor_profile_id=g.side_b_profile_id
   and ca.actor_profile_id=g.side_a_profile_id and cb.actor_profile_id=g.side_b_profile_id
   and sa.participant_id=g.side_a_participant_id and sb.participant_id=g.side_b_participant_id
   and ca.submission_id=sa.id and cb.submission_id=sb.id
   and saa.game_id=v.game_id and sba.game_id=v.game_id and caa.game_id=v.game_id and cba.game_id=v.game_id
   and saa.generation_id=g.id and sba.generation_id=g.id and caa.generation_id=g.id and cba.generation_id=g.id
   and saa.actor_id=sa.actor_profile_id and sba.actor_id=sb.actor_profile_id
   and caa.actor_id=ca.actor_profile_id and cba.actor_id=cb.actor_profile_id
   and saa.action_type in('submit','amend') and sba.action_type in('submit','amend')
   and caa.action_type='confirm' and cba.action_type='confirm'
   and va.action_type='confirm' and va.id in(ca.action_id,cb.action_id)
   and va.game_id=v.game_id and va.generation_id=g.id
   and sa.winner_participant_id=sb.winner_participant_id
   and v.winner_participant_id=sa.winner_participant_id
   and v.loser_participant_id=case when v.winner_participant_id=g.side_a_participant_id
    then g.side_b_participant_id else g.side_a_participant_id end
   and v.winner_participant_id in(g.side_a_participant_id,g.side_b_participant_id)
   and not exists(select 1 from app.playoff_series_game_submissions_v1 newer
    join app.playoff_series_game_actions_v1 newer_action on newer_action.id=newer.action_id
    where newer.game_id=v.game_id and newer.actor_profile_id=sa.actor_profile_id
     and newer_action.game_version>saa.game_version)
   and not exists(select 1 from app.playoff_series_game_submissions_v1 newer
    join app.playoff_series_game_actions_v1 newer_action on newer_action.id=newer.action_id
    where newer.game_id=v.game_id and newer.actor_profile_id=sb.actor_profile_id
     and newer_action.game_version>sba.game_version)
  )
 )then return false;end if;
 select count(*)::integer,
  count(*)filter(where winner_participant_id=g.side_a_participant_id)::integer,
  count(*)filter(where winner_participant_id=g.side_b_participant_id)::integer,
  max(game_number)::integer
 into n,a_wins,b_wins,terminal_number
 from app.playoff_series_verified_games_v1 where generation_id=g.id;
 if n<>r.game_count or (select count(*)from app.playoff_series_games_v1 where generation_id=g.id)<>n
  or terminal_number<>n or n>g.maximum_games
  or exists(select 1 from generate_series(1,n)s(i) where not exists(
   select 1 from app.playoff_series_verified_games_v1 v where v.generation_id=g.id and v.game_number=s.i))
  or r.wins_a<>a_wins or r.wins_b<>b_wins
  or greatest(a_wins,b_wins)<>g.wins_required or least(a_wins,b_wins)>=g.wins_required
  or r.winner_participant_id is distinct from(case when a_wins=g.wins_required then g.side_a_participant_id else g.side_b_participant_id end)
  or r.loser_participant_id is distinct from(case when a_wins=g.wins_required then g.side_b_participant_id else g.side_a_participant_id end)
  or r.games_digest is distinct from app.playoff_series_games_digest_v1(g.id)
  or exists(select 1 from app.playoff_series_verified_games_v1 cutoff
   where cutoff.generation_id=g.id and cutoff.game_number<n
    and ((select count(*) from app.playoff_series_verified_games_v1 prior
          where prior.generation_id=g.id and prior.game_number<=cutoff.game_number
           and prior.winner_participant_id=g.side_a_participant_id)>=g.wins_required
      or (select count(*) from app.playoff_series_verified_games_v1 prior
          where prior.generation_id=g.id and prior.game_number<=cutoff.game_number
           and prior.winner_participant_id=g.side_b_participant_id)>=g.wins_required))
 then return false;end if;
 select a.actor_id,a.operation_id into final_actor,final_op
 from app.playoff_series_verified_games_v1 v join app.playoff_series_game_actions_v1 a on a.id=v.verified_by_action_id
 where v.generation_id=g.id and v.game_number=n;
 return final_actor=r.completed_by_profile_id and final_op=r.operation_id;
end$$;

create or replace function app.require_playoff_series_completed_result_v1()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not app.playoff_series_completed_result_valid_v1(new.id)then
  raise exception using errcode='P0001',message='playoff_series_game_evidence_required';
 end if;
 return null;
end$$;
create constraint trigger playoff_series_results_game_evidence_v1
 after insert on app.playoff_series_results_v1 deferrable initially immediate
 for each row execute function app.require_playoff_series_completed_result_v1();

create or replace function app.finish_playoff_series_game_operation_v1(
 p_actor_id uuid,p_operation_id uuid,p_tournament_id uuid,p_event_id uuid,p_result jsonb
)returns jsonb language plpgsql security definer set search_path='' as $$
declare operation app.playoff_series_game_operations_v1%rowtype;response jsonb;
begin
 if auth.uid() is distinct from p_actor_id then
  raise exception using errcode='P0001',message='playoff_series_game_actor_mismatch';
 end if;
 select * into operation from app.playoff_series_game_operations_v1
  where actor_id=p_actor_id and operation_id=p_operation_id
   and tournament_id=p_tournament_id and event_id=p_event_id;
 if not found then raise exception using errcode='P0001',message='playoff_series_game_operation_missing';end if;
 response:=p_result||jsonb_build_object(
  'actorId',operation.actor_id,'tournamentId',operation.tournament_id,'eventId',operation.event_id,
  'qualificationId',operation.qualification_id,'slot',operation.slot,'operationId',operation.operation_id,
  'request',operation.request_payload
 );
 insert into app.playoff_series_game_operation_outcomes_v1(actor_id,operation_id,tournament_id,event_id,result)
 values(p_actor_id,p_operation_id,p_tournament_id,p_event_id,response);
 return response;
end$$;

create or replace function app.submit_playoff_series_game_action_v1(
 p_tournament_id uuid,p_event_id uuid,p_qualification_id uuid,p_slot integer,p_request jsonb
)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid();op uuid;h text;prior app.playoff_series_game_operations_v1%rowtype;
 response jsonb;prior_result jsonb;src jsonb;g app.playoff_series_generations_v1%rowtype;game app.playoff_series_games_v1%rowtype;
 requested_game_id uuid;requested_generation_id uuid;requested_submission_id uuid;requested_confirmation_id uuid;winner_id uuid;confirmed_id uuid;
 game_no integer;expected integer;current_version integer;actor_participant uuid;other_participant uuid;
 actor_is_a boolean;action_kind text;saved_action_id uuid;latest_submission app.playoff_series_game_submissions_v1%rowtype;
 sa app.playoff_series_game_submissions_v1%rowtype;sb app.playoff_series_game_submissions_v1%rowtype;
 ca app.playoff_series_game_confirmations_v1%rowtype;cb app.playoff_series_game_confirmations_v1%rowtype;
 verified_id uuid;a_wins integer;b_wins integer;games_count integer;result_id uuid;
begin
 if a is null or not app.valid_playoff_series_game_request_v1(p_request)then
  return jsonb_build_object('status','rejected','code','invalid_request');
 end if;
 if current_setting('transaction_isolation')<>'read committed'then
  return jsonb_build_object('status','retry_exact','code','isolation_not_supported');
 end if;
 op:=(p_request->>'operationId')::uuid;requested_generation_id:=(p_request->>'generationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended('playoff-series-game-op:'||a::text||':'||op::text,0))then
  return jsonb_build_object('status','retry_exact','code','operation_busy');
 end if;
 select * into prior from app.playoff_series_game_operations_v1 where actor_id=a and operation_id=op;
 if found then select result into prior_result from app.playoff_series_game_operation_outcomes_v1
  where actor_id=a and operation_id=op;end if;
 h:=app.playoff_series_game_request_hash_v1(a,p_tournament_id,p_event_id,p_qualification_id,p_slot,p_request);
 if found then
  if prior.tournament_id=p_tournament_id and prior.event_id=p_event_id
   and prior.qualification_id=p_qualification_id and prior.slot=p_slot and prior.request_hash=h
   and prior.request_payload=p_request and prior_result is not null then
   return prior_result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
  end if;
  response:=jsonb_build_object('status','rejected','code','idempotency_conflict');
  if prior.tournament_id=p_tournament_id and prior.event_id=p_event_id
   and prior.qualification_id=p_qualification_id and prior.slot=p_slot then
   response:=response||jsonb_build_object(
    'actorId',a,'tournamentId',p_tournament_id,'eventId',p_event_id,
    'qualificationId',p_qualification_id,'slot',p_slot,'operationId',op,'request',p_request
   );
   insert into app.playoff_series_game_operation_conflicts_v1(actor_id,operation_id,tournament_id,event_id,
    qualification_id,slot,attempted_request,attempted_hash,result)
   values(a,op,p_tournament_id,p_event_id,p_qualification_id,p_slot,p_request,h,response);
  end if;
  return response;
 end if;
 if to_regprocedure('app.event_settings_operational_activation_enabled_v1()') is null
  or not app.event_settings_operational_activation_enabled_v1()then
  return jsonb_build_object('status','rejected','code','operational_activation_unavailable','operationAttempted',false);
 end if;
 perform 1 from app.tournaments where id=p_tournament_id for update nowait;
 if not found then return jsonb_build_object('status','rejected','code','source_unavailable','operationAttempted',false);end if;
 select * into g from app.playoff_series_generations_v1 where id=requested_generation_id
  and tournament_id=p_tournament_id and event_id=p_event_id and qualification_id=p_qualification_id and slot=p_slot
  for update nowait;
 if not found or not app.playoff_series_game_actor_valid_v1(p_tournament_id,p_event_id,requested_generation_id,a)then
  return jsonb_build_object('status','rejected','code','player_identity_required','operationAttempted',false);
 end if;
 insert into app.playoff_series_game_operations_v1(actor_id,operation_id,tournament_id,event_id,qualification_id,slot,
  generation_id,request_payload,request_hash)
 values(a,op,p_tournament_id,p_event_id,p_qualification_id,p_slot,requested_generation_id,p_request,h);
 src:=app.playoff_series_match_source_v1(p_tournament_id,p_event_id,p_qualification_id,p_slot);
 if src->>'status'='retry_exact'then raise lock_not_available;end if;
 if src->>'status'<>'source_available' then return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
  jsonb_build_object('status','rejected','code','source_unavailable'));end if;
 if g.tournament_id is distinct from p_tournament_id or g.event_id is distinct from p_event_id
  or g.qualification_id is distinct from p_qualification_id or g.slot is distinct from p_slot
  or (p_request->>'generationVersion')::integer is distinct from g.version
  or src->>'currentGenerationId' is distinct from g.id::text
  or (src->>'currentGenerationVersion')::integer is distinct from g.version
  or src->>'sourceDigest' is distinct from g.source_digest or p_request->>'sourceDigest' is distinct from g.source_digest
  or (p_request->>'settingsBindingId')::uuid is distinct from g.settings_binding_id
  or (p_request->>'reviewId')::uuid is distinct from g.context_review_id
  or (p_request->>'playoffStartId')::uuid is distinct from g.playoff_start_id
  or p_request->'parentResultPins' is distinct from src->'parentResultPins'
  or g.source_capture is distinct from src->'source'
 then return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
  jsonb_build_object('status','rejected','code','stale_source'));end if;
 if not app.playoff_series_game_actor_valid_v1(p_tournament_id,p_event_id,g.id,a)then
  return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
   jsonb_build_object('status','rejected','code','player_identity_required'));end if;
 if (select count(*) from app.playoff_series_game_actions_v1 accepted_action where accepted_action.generation_id=g.id)>=10000 then
  return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
   jsonb_build_object('status','rejected','code','series_action_limit_reached'));end if;
 actor_is_a:=a=g.side_a_profile_id;
 actor_participant:=case when actor_is_a then g.side_a_participant_id else g.side_b_participant_id end;
 other_participant:=case when actor_is_a then g.side_b_participant_id else g.side_a_participant_id end;
 requested_game_id:=(p_request->>'gameId')::uuid;game_no:=(p_request->>'gameNumber')::integer;
 expected:=(p_request->>'expectedGameVersion')::integer;
 if game_no>g.maximum_games or exists(select 1 from app.playoff_series_results_v1 result where result.generation_id=g.id)
  or exists(select 1 from app.playoff_series_verified_games_v1 verified where verified.generation_id=g.id group by verified.generation_id
   having count(*)filter(where verified.winner_participant_id=g.side_a_participant_id)>=g.wins_required
       or count(*)filter(where verified.winner_participant_id=g.side_b_participant_id)>=g.wins_required)
  or (select count(*) from app.playoff_series_verified_games_v1 verified where verified.generation_id=g.id and verified.game_number<game_no)<>game_no-1
  or exists(select 1 from app.playoff_series_verified_games_v1 verified where verified.generation_id=g.id and verified.game_number>game_no)
 then return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
  jsonb_build_object('status','rejected','code','game_sequence_closed'));end if;
 select * into game from app.playoff_series_games_v1 candidate where candidate.generation_id=g.id and candidate.game_number=game_no;
 if not found then
  if p_request->>'action'<>'submit' then return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
   jsonb_build_object('status','rejected','code','game_not_started'));end if;
  if expected<>0 then return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
   jsonb_build_object('status','rejected','code','stale_game_version'));end if;
  if exists(select 1 from app.playoff_series_games_v1 where id=requested_game_id)then
   return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
    jsonb_build_object('status','rejected','code','game_identity_conflict'));end if;
  requested_submission_id:=(p_request->>'submissionId')::uuid;
  if p_request->'priorSubmissionId'<>'null'::jsonb then
   return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
    jsonb_build_object('status','rejected','code','latest_own_submission_required'));end if;
  if exists(select 1 from app.playoff_series_game_submissions_v1 where id=requested_submission_id)then
   return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
    jsonb_build_object('status','rejected','code','submission_identity_conflict'));end if;
  winner_id:=(p_request->>'winnerParticipantId')::uuid;
  if winner_id not in(g.side_a_participant_id,g.side_b_participant_id)then
   return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
    jsonb_build_object('status','rejected','code','invalid_winner'));end if;
  insert into app.playoff_series_games_v1(id,generation_id,tournament_id,event_id,game_number,source_digest)
  values(requested_game_id,g.id,p_tournament_id,p_event_id,game_no,g.source_digest) returning * into game;
 elsif game.id<>requested_game_id then return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
  jsonb_build_object('status','rejected','code','game_identity_conflict'));
 end if;
 if exists(select 1 from app.playoff_series_verified_games_v1 verified where verified.game_id=game.id)then
  return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
   jsonb_build_object('status','rejected','code','game_already_verified'));end if;
 select coalesce(max(accepted_action.game_version),0) into current_version from app.playoff_series_game_actions_v1 accepted_action where accepted_action.game_id=game.id;
 if current_version<>expected then return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
  jsonb_build_object('status','rejected','code','stale_game_version'));end if;
 if p_request->>'action'='submit' then
  requested_submission_id:=(p_request->>'submissionId')::uuid;
  winner_id:=(p_request->>'winnerParticipantId')::uuid;
  if winner_id not in(g.side_a_participant_id,g.side_b_participant_id)then
   return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
    jsonb_build_object('status','rejected','code','invalid_winner'));end if;
  if exists(select 1 from app.playoff_series_game_submissions_v1 where id=requested_submission_id)then
   return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
    jsonb_build_object('status','rejected','code','submission_identity_conflict'));end if;
  select s.* into latest_submission from app.playoff_series_game_submissions_v1 s
   join app.playoff_series_game_actions_v1 latest_action on latest_action.id=s.action_id
   where s.game_id=game.id and s.actor_profile_id=a order by latest_action.game_version desc limit 1;
  if (latest_submission.id is null and p_request->'priorSubmissionId'<>'null'::jsonb)
   or (latest_submission.id is not null and p_request->>'priorSubmissionId' is distinct from latest_submission.id::text)
  then return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
   jsonb_build_object('status','rejected','code','latest_own_submission_required'));end if;
  action_kind:=case when found then 'amend' else 'submit' end;
  insert into app.playoff_series_game_actions_v1(actor_id,operation_id,tournament_id,event_id,generation_id,game_id,game_version,action_type)
  values(a,op,p_tournament_id,p_event_id,g.id,game.id,current_version+1,action_kind) returning id into saved_action_id;
  insert into app.playoff_series_game_submissions_v1(id,action_id,game_id,generation_id,tournament_id,event_id,
   actor_profile_id,participant_id,winner_participant_id)
  values(requested_submission_id,saved_action_id,game.id,g.id,p_tournament_id,p_event_id,a,actor_participant,winner_id);
 else
  action_kind:='confirm';requested_confirmation_id:=(p_request->>'confirmationId')::uuid;
  confirmed_id:=(p_request->>'confirmedSubmissionId')::uuid;
  select s.* into latest_submission from app.playoff_series_game_submissions_v1 s
   join app.playoff_series_game_actions_v1 latest_action on latest_action.id=s.action_id
   where s.game_id=game.id and s.actor_profile_id=a order by latest_action.game_version desc limit 1;
  if not found or latest_submission.id<>confirmed_id then
   return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
    jsonb_build_object('status','rejected','code','latest_own_submission_required'));end if;
  if exists(select 1 from app.playoff_series_game_confirmations_v1 confirmation
   where confirmation.game_id=game.id and confirmation.actor_profile_id=a and confirmation.submission_id=confirmed_id)then
   return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
    jsonb_build_object('status','rejected','code','already_confirmed'));end if;
  if exists(select 1 from app.playoff_series_game_confirmations_v1 confirmation where confirmation.id=requested_confirmation_id)then
   return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,
    jsonb_build_object('status','rejected','code','confirmation_identity_conflict'));end if;
  insert into app.playoff_series_game_actions_v1(actor_id,operation_id,tournament_id,event_id,generation_id,game_id,game_version,action_type)
  values(a,op,p_tournament_id,p_event_id,g.id,game.id,current_version+1,'confirm') returning id into saved_action_id;
  insert into app.playoff_series_game_confirmations_v1(id,action_id,game_id,generation_id,actor_profile_id,submission_id)
  values(requested_confirmation_id,saved_action_id,game.id,g.id,a,confirmed_id);
 end if;
 -- Only the latest submission from each identity and a confirmation of that
 -- exact row can authorize verification. An amendment therefore invalidates
 -- the amending player's older confirmation without mutating history.
 select s.* into sa from app.playoff_series_game_submissions_v1 s
  join app.playoff_series_game_actions_v1 action on action.id=s.action_id where s.game_id=game.id
  and s.actor_profile_id=g.side_a_profile_id order by action.game_version desc limit 1;
 select s.* into sb from app.playoff_series_game_submissions_v1 s
  join app.playoff_series_game_actions_v1 action on action.id=s.action_id where s.game_id=game.id
  and s.actor_profile_id=g.side_b_profile_id order by action.game_version desc limit 1;
 if sa.id is not null and sb.id is not null and sa.winner_participant_id=sb.winner_participant_id then
  select confirmation.* into ca from app.playoff_series_game_confirmations_v1 confirmation where confirmation.game_id=game.id
   and confirmation.actor_profile_id=g.side_a_profile_id and confirmation.submission_id=sa.id order by confirmation.confirmed_at desc,confirmation.id desc limit 1;
  select confirmation.* into cb from app.playoff_series_game_confirmations_v1 confirmation where confirmation.game_id=game.id
   and confirmation.actor_profile_id=g.side_b_profile_id and confirmation.submission_id=sb.id order by confirmation.confirmed_at desc,confirmation.id desc limit 1;
  if ca.id is not null and cb.id is not null then
   insert into app.playoff_series_verified_games_v1(game_id,generation_id,tournament_id,event_id,game_number,
    winner_participant_id,loser_participant_id,side_a_submission_id,side_b_submission_id,
    side_a_confirmation_id,side_b_confirmation_id,verified_by_action_id,source_digest)
   values(game.id,g.id,p_tournament_id,p_event_id,game_no,sa.winner_participant_id,
    case when sa.winner_participant_id=g.side_a_participant_id then g.side_b_participant_id else g.side_a_participant_id end,
    sa.id,sb.id,ca.id,cb.id,saved_action_id,g.source_digest) returning id into verified_id;
  end if;
 end if;
 if verified_id is not null then
  select count(*)filter(where verified.winner_participant_id=g.side_a_participant_id)::integer,
   count(*)filter(where verified.winner_participant_id=g.side_b_participant_id)::integer,count(*)::integer
  into a_wins,b_wins,games_count from app.playoff_series_verified_games_v1 verified where verified.generation_id=g.id;
  if a_wins=g.wins_required or b_wins=g.wins_required then
   insert into app.playoff_series_results_v1(generation_id,match_id,tournament_id,event_id,winner_participant_id,
    loser_participant_id,wins_a,wins_b,game_count,source_digest,games_digest,completed_by_profile_id,operation_id)
   values(g.id,g.match_id,p_tournament_id,p_event_id,
    case when a_wins=g.wins_required then g.side_a_participant_id else g.side_b_participant_id end,
    case when a_wins=g.wins_required then g.side_b_participant_id else g.side_a_participant_id end,
    a_wins,b_wins,games_count,g.source_digest,app.playoff_series_games_digest_v1(g.id),a,op)
   returning id into result_id;
  end if;
 end if;
 response:=jsonb_build_object('status','playoff_series_game_action_saved_v1','eventId',p_event_id,
  'generationId',g.id,'gameId',game.id,'gameNumber',game_no,'gameVersion',current_version+1,
  'action',action_kind,'verifiedGameId',verified_id,'completedResultId',result_id);
 return app.finish_playoff_series_game_operation_v1(a,op,p_tournament_id,p_event_id,response);
exception when lock_not_available then
 return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;

create or replace function app.get_playoff_series_game_action_reconciliation_v1(
 p_tournament_id uuid,p_operation_id uuid
)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid();o app.playoff_series_game_operations_v1%rowtype;r jsonb;
begin
 if a is null then return null;end if;
 select * into o from app.playoff_series_game_operations_v1 where actor_id=a and operation_id=p_operation_id;
 if not found or o.tournament_id<>p_tournament_id then return jsonb_build_object('authorized',true,'result',null);end if;
 select result into r from app.playoff_series_game_operation_outcomes_v1 where actor_id=a and operation_id=p_operation_id;
 return jsonb_build_object('authorized',true,'result',case when r is null then null else
  r||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false)end);
end$$;

do $$declare n text;begin
 foreach n in array array[
  'app.playoff_series_uuid_v1(text)','app.valid_playoff_series_game_request_v1(jsonb)',
  'app.playoff_series_game_request_hash_v1(uuid,uuid,uuid,uuid,integer,jsonb)',
  'app.playoff_series_game_actor_valid_v1(uuid,uuid,uuid,uuid)',
  'app.playoff_series_games_digest_v1(uuid)','app.playoff_series_completed_result_valid_v1(uuid)',
  'app.require_playoff_series_completed_result_v1()',
  'app.finish_playoff_series_game_operation_v1(uuid,uuid,uuid,uuid,jsonb)',
  'app.submit_playoff_series_game_action_v1(uuid,uuid,uuid,integer,jsonb)',
  'app.get_playoff_series_game_action_reconciliation_v1(uuid,uuid)'
 ]loop
  execute format('alter function %s owner to postgres',n);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',n);
 end loop;
end$$;

commit;
