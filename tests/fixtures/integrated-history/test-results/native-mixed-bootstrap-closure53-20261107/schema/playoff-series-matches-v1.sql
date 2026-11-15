-- UNEXECUTED PRIVATE SOURCE CANDIDATE. Requires operational bindings and the
-- native playoff start gate. Four/five verified qualifiers only; no invented
-- larger bracket, bye game, paper approval or individual game evidence.
begin;
create table app.playoff_series_match_operations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id),event_id uuid not null,
 request_payload jsonb not null,request_hash text not null,result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('playoff-series-generation-v1',actor_id,tournament_id,event_id,operation_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.playoff_series_matches_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 qualification_id uuid not null,slot integer not null check(slot between 1 and 4),
 unique(tournament_id,event_id,qualification_id,slot),unique(id,tournament_id,event_id),unique(id,tournament_id,event_id,qualification_id,slot),
 foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id)
);
create table app.playoff_series_generations_v1(
 id uuid primary key default extensions.gen_random_uuid(),match_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version>0),qualification_id uuid not null,playoff_start_id uuid not null,
 settings_binding_id uuid not null references app.event_settings_operational_bindings_v1(id),
 context_review_id uuid not null references app.event_rule_context_reviews_v1(id),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),source_capture jsonb not null,
 side_a_participant_id uuid not null,side_b_participant_id uuid not null,side_a_profile_id uuid not null,side_b_profile_id uuid not null,
 round_name text not null check(round_name in('regular','semifinal','final')),slot integer not null check(slot between 1 and 4),
 wins_required integer not null check(wins_required>0),maximum_games integer not null,
 prior_generation_id uuid,actor_id uuid not null,operation_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),unique(match_id,version),unique(id,tournament_id,event_id),unique(id,match_id,tournament_id,event_id),
 foreign key(match_id,tournament_id,event_id,qualification_id,slot)references app.playoff_series_matches_v1(id,tournament_id,event_id,qualification_id,slot),
 foreign key(prior_generation_id,match_id,tournament_id,event_id)references app.playoff_series_generations_v1(id,match_id,tournament_id,event_id),
 foreign key(playoff_start_id,tournament_id,event_id)references app.event_settings_playoff_starts_v1(id,tournament_id,event_id),
 foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id),
 foreign key(side_a_participant_id,side_a_profile_id,event_id,tournament_id)references app.event_participants(id,profile_id,event_id,tournament_id),
 foreign key(side_b_participant_id,side_b_profile_id,event_id,tournament_id)references app.event_participants(id,profile_id,event_id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.playoff_series_match_operations_v1(actor_id,operation_id,tournament_id,event_id),
 check(side_a_participant_id<>side_b_participant_id and side_a_profile_id<>side_b_profile_id),
 check(maximum_games::bigint=wins_required::bigint*2-1)
);
create table app.playoff_series_results_v1(
 id uuid primary key default extensions.gen_random_uuid(),generation_id uuid not null unique,match_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,version integer not null default 1 check(version=1),
 winner_participant_id uuid not null,loser_participant_id uuid not null,
 wins_a integer not null check(wins_a>=0),wins_b integer not null check(wins_b>=0),game_count integer not null check(game_count>0),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),games_digest text not null check(games_digest~'^[a-f0-9]{64}$'),
 completed_by_profile_id uuid not null references app.profiles(id),operation_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),unique(id,generation_id),
 foreign key(generation_id,match_id,tournament_id,event_id)references app.playoff_series_generations_v1(id,match_id,tournament_id,event_id),
 foreign key(match_id,tournament_id,event_id)references app.playoff_series_matches_v1(id,tournament_id,event_id),
 foreign key(winner_participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 foreign key(loser_participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 check(winner_participant_id<>loser_participant_id and wins_a+wins_b=game_count)
);
do $$declare n text;begin
 foreach n in array array['playoff_series_match_operations_v1','playoff_series_matches_v1','playoff_series_generations_v1','playoff_series_results_v1']loop
  execute format('alter table app.%I owner to postgres',n);
  execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 end loop;
end$$;
create index playoff_series_generations_latest_v1 on app.playoff_series_generations_v1(match_id,version desc);
-- Forward helper calls are PL/pgSQL runtime dependencies. Slot dependencies
-- strictly decrease (4/5-qualifier scope), so they cannot form a bracket cycle.
create function app.playoff_series_current_result_v1(tid uuid,eid uuid,qid uuid,slot_no integer)returns jsonb
language plpgsql security definer set search_path=''as $$
declare src jsonb;g app.playoff_series_generations_v1%rowtype;r app.playoff_series_results_v1%rowtype;valid boolean;
begin
 src:=app.playoff_series_match_source_v1(tid,eid,qid,slot_no);
 if src->>'status'='retry_exact'then raise lock_not_available;end if;
 if src->>'status'is distinct from'source_available'or src->'currentGenerationId'='null'::jsonb then return null;end if;
 select*into g from app.playoff_series_generations_v1 where id=(src->>'currentGenerationId')::uuid and tournament_id=tid and event_id=eid;
 select*into r from app.playoff_series_results_v1 where generation_id=g.id and tournament_id=tid and event_id=eid;
 if r.id is null or r.match_id<>g.match_id or r.source_digest is distinct from src->>'sourceDigest'or g.source_digest is distinct from src->>'sourceDigest'
 or r.game_count>g.maximum_games or greatest(r.wins_a,r.wins_b)<>g.wins_required or least(r.wins_a,r.wins_b)>=g.wins_required
 or r.winner_participant_id is distinct from(case when r.wins_a=g.wins_required then g.side_a_participant_id else g.side_b_participant_id end)
 or r.loser_participant_id is distinct from(case when r.wins_a=g.wins_required then g.side_b_participant_id else g.side_a_participant_id end)then return null;end if;
 if to_regprocedure('app.playoff_series_completed_result_valid_v1(uuid)')is null then return null;end if;
 execute 'select app.playoff_series_completed_result_valid_v1($1)'into valid using r.id;
 if valid is distinct from true then return null;end if;
 return jsonb_build_object('matchId',g.match_id,'resultId',r.id,'version',r.version,'winnerId',r.winner_participant_id,'loserId',r.loser_participant_id);
end$$;

create function app.playoff_series_match_source_v1(tid uuid,eid uuid,qid uuid,slot_no integer)returns jsonb
language plpgsql security definer set search_path=''as $$
declare native jsonb;start_row app.event_settings_playoff_starts_v1%rowtype;b app.event_settings_operational_bindings_v1%rowtype;
 q app.qualification_result_versions%rowtype;m app.playoff_series_matches_v1%rowtype;g app.playoff_series_generations_v1%rowtype;
 ids uuid[];x uuid;y uuid;pa uuid;pb uuid;la uuid;lb uuid;prefa integer;prefb integer;
 parent_a jsonb;parent_b jsonb;parents jsonb;round_name text;format_value jsonb;capture_value jsonb;h text;
begin
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for update nowait;
 if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 native:=app.event_settings_playoff_source_v1(tid,eid);
 if native->>'status'='retry_exact'then return native;end if;
 if native->>'status'is distinct from'source_available'or native->>'qualificationId'is distinct from qid::text then return jsonb_build_object('status','blocked','code','qualification_source_changed');end if;
 if not app.event_settings_playoff_lifecycle_open_v1(tid,eid)then return jsonb_build_object('status','blocked','code','playoff_lifecycle_closed');end if;
 select*into start_row from app.event_settings_playoff_starts_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if start_row.id is null or start_row.qualification_id<>qid or start_row.source_digest is distinct from native->>'sourceDigest'then return jsonb_build_object('status','blocked','code','current_playoff_start_required');end if;
 select*into q from app.qualification_result_versions where id=qid and tournament_id=tid and event_id=eid;
 if q.qualifier_count not in(4,5)then return jsonb_build_object('status','blocked','code','unsupported_qualifier_count');end if;
 select array_agg(participant_id order by ranking_ordinal)into ids from app.qualification_result_rows where result_version_id=qid and qualification_status='qualified';
 if cardinality(ids)<>q.qualifier_count then return jsonb_build_object('status','blocked','code','qualification_rows_unavailable');end if;
 if q.qualifier_count=4 then
  if slot_no=1 then x:=ids[1];y:=ids[4];round_name:='semifinal';
  elsif slot_no=2 then x:=ids[2];y:=ids[3];round_name:='semifinal';
  elsif slot_no=3 then parent_a:=app.playoff_series_current_result_v1(tid,eid,qid,1);parent_b:=app.playoff_series_current_result_v1(tid,eid,qid,2);round_name:='final';
   if parent_a is null or parent_b is null then return jsonb_build_object('status','blocked','code','parent_series_incomplete');end if;x:=(parent_a->>'winnerId')::uuid;y:=(parent_b->>'winnerId')::uuid;
  else return jsonb_build_object('status','blocked','code','invalid_slot');end if;
 else
  if slot_no=1 then x:=ids[4];y:=ids[5];round_name:='regular';
  elsif slot_no=2 then parent_b:=app.playoff_series_current_result_v1(tid,eid,qid,1);round_name:='semifinal';
   if parent_b is null then return jsonb_build_object('status','blocked','code','parent_series_incomplete');end if;x:=ids[1];y:=(parent_b->>'winnerId')::uuid;
  elsif slot_no=3 then x:=ids[3];y:=ids[2];round_name:='semifinal';
  elsif slot_no=4 then parent_a:=app.playoff_series_current_result_v1(tid,eid,qid,2);parent_b:=app.playoff_series_current_result_v1(tid,eid,qid,3);round_name:='final';
   if parent_a is null or parent_b is null then return jsonb_build_object('status','blocked','code','parent_series_incomplete');end if;x:=(parent_a->>'winnerId')::uuid;y:=(parent_b->>'winnerId')::uuid;
  else return jsonb_build_object('status','blocked','code','invalid_slot');end if;
 end if;
 if x is null or y is null or x=y then return jsonb_build_object('status','blocked','code','invalid_slot_players');end if;
 -- Native roster preference/link ownership is required; no fallback by name,
 -- email, ACC number, account role or a posted digital-mode assertion.
 lock table app.roster_account_links in share mode nowait;
 select p.profile_id,l.id,r.scorecard_preference_version into pa,la,prefa from app.event_participants p
 join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id and r.scorecard_type='digital'
 join app.roster_account_links l on l.roster_entry_id=r.id and l.tournament_id=r.tournament_id and l.profile_id=p.profile_id
 where p.id=x and p.tournament_id=tid and p.event_id=eid and p.status='checked_in';
 select p.profile_id,l.id,r.scorecard_preference_version into pb,lb,prefb from app.event_participants p
 join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id and r.scorecard_type='digital'
 join app.roster_account_links l on l.roster_entry_id=r.id and l.tournament_id=r.tournament_id and l.profile_id=p.profile_id
 where p.id=y and p.tournament_id=tid and p.event_id=eid and p.status='checked_in';
 if pa is null or pb is null or pa=pb or la is null or lb is null then return jsonb_build_object('status','blocked','code','distinct_linked_digital_players_required');end if;
 select*into b from app.event_settings_operational_bindings_v1 where id=(native->>'settingsBindingId')::uuid and tournament_id=tid and event_id=eid;
 format_value:=app.resolve_event_series_format_v1(case when round_name='final'and b.draft->>'finalMode'='separate'then b.draft#>'{series,final}'else b.draft#>'{series,regular}'end);
 if format_value is null then return jsonb_build_object('status','blocked','code','series_format_unavailable');end if;
 -- Each verified game needs four accepted actions. The shared protocol's
 -- 10,000-action processing bound must represent the full best-of series.
 -- This is a technical bound, not an ACC rule; never shorten a chosen format.
 if(format_value->>'maximumGames')::bigint*4>10000 then return jsonb_build_object('status','blocked','code','series_game_resource_bound');end if;
 parents:=jsonb_build_array(case when parent_a is null then null else jsonb_build_object('matchId',parent_a->'matchId','resultId',parent_a->'resultId','version',parent_a->'version')end,case when parent_b is null then null else jsonb_build_object('matchId',parent_b->'matchId','resultId',parent_b->'resultId','version',parent_b->'version')end);
 capture_value:=jsonb_build_object('tournamentId',tid,'eventId',eid,'qualificationId',qid,'slot',slot_no,'playoffStartId',start_row.id,'gateDigest',native->>'sourceDigest','settingsBindingId',b.id,'reviewId',b.review_id,'activationId',b.activation_id,'round',round_name,'participants',jsonb_build_array(x,y),'profiles',jsonb_build_array(pa,pb),'rosterLinks',jsonb_build_array(la,lb),'preferences',jsonb_build_array(prefa,prefb),'format',format_value,'parentResultPins',parents);
 h:=encode(extensions.digest(convert_to(jsonb_build_array('playoff-series-match-source-v1',capture_value)::text,'utf8'),'sha256'),'hex');
 select*into m from app.playoff_series_matches_v1 where tournament_id=tid and event_id=eid and qualification_id=qid and slot=slot_no;
 select*into g from app.playoff_series_generations_v1 where match_id=m.id order by version desc limit 1;
 return jsonb_build_object('status','source_available','sourceDigest',h,'source',capture_value,'matchId',m.id,'currentGenerationId',g.id,'currentGenerationVersion',coalesce(g.version,0),'round',round_name,'participants',jsonb_build_array(x,y),'profiles',jsonb_build_array(pa,pb),'winsRequired',format_value->'winsRequired','maximumGames',format_value->'maximumGames','parentResultPins',parents,'settingsBindingId',b.id,'reviewId',b.review_id,'playoffStartId',start_row.id);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function app.get_playoff_series_generation_operation_v1(tid uuid,eid uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();r app.playoff_series_match_operations_v1%rowtype;
begin
 if a is null then return jsonb_build_object('status','blocked','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','blocked','code','not_director');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into r from app.playoff_series_match_operations_v1 where actor_id=a and operation_id=op and tournament_id=tid and event_id=eid;
 if not found then return jsonb_build_object('status','unknown','actorId',a,'tournamentId',tid,'eventId',eid,'operationId',op);end if;
 return r.result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.finish_playoff_series_generation_v1(tid uuid,eid uuid,op uuid,v jsonb,outcome jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();h text;response jsonb;
begin
 h:=encode(extensions.digest(convert_to(jsonb_build_array('playoff-series-generation-v1',a,tid,eid,op,v)::text,'utf8'),'sha256'),'hex');
 response:=outcome||jsonb_build_object('actorId',a,'tournamentId',tid,'eventId',eid,'operationId',op,'request',v,'verifiedGamesCreated',false,'moneyMoved',false);
 insert into app.playoff_series_match_operations_v1(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash,result)values(a,op,tid,eid,v,h,response);return response;
end$$;

create function app.create_playoff_series_generation_v1(tid uuid,eid uuid,v jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;h text;old app.playoff_series_match_operations_v1%rowtype;src jsonb;
 mid uuid;gid uuid;qid uuid;slot_no integer;head app.playoff_series_generations_v1%rowtype;response jsonb;has_work boolean;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(v)is distinct from'object'or(select count(*)from jsonb_object_keys(v))<>6 or not(v?&array['kind','operationId','qualificationId','slot','expectedGenerationId','sourceDigest'])
 or v->>'kind'is distinct from'playoff-series-generation-v1'
 or jsonb_typeof(v->'operationId')is distinct from'string'or(v->>'operationId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or jsonb_typeof(v->'qualificationId')is distinct from'string'or(v->>'qualificationId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or not(v->'expectedGenerationId'='null'::jsonb or(jsonb_typeof(v->'expectedGenerationId')='string'and(v->>'expectedGenerationId')~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
 or jsonb_typeof(v->'sourceDigest')is distinct from'string'or(v->>'sourceDigest')!~'^[a-f0-9]{64}$'
 or jsonb_typeof(v->'slot')is distinct from'number'or(v->>'slot')!~'^[1-4]$'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(v->>'operationId')::uuid;qid:=(v->>'qualificationId')::uuid;slot_no:=(v->>'slot')::integer;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('playoff-series-generation-v1',a,tid,eid,op,v)::text,'utf8'),'sha256'),'hex');
 select*into old from app.playoff_series_match_operations_v1 where actor_id=a and operation_id=op;
 if found then
  if old.tournament_id<>tid or old.event_id<>eid or old.request_hash<>h or old.request_payload<>v then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  return old.result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if not exists(select 1 from app.events where id=eid and tournament_id=tid)then return jsonb_build_object('status','rejected','code','event_unavailable');end if;
 src:=app.playoff_series_match_source_v1(tid,eid,qid,slot_no);if src->>'status'='retry_exact'then raise lock_not_available;end if;
 if src->>'status'is distinct from'source_available'or src->>'sourceDigest'is distinct from v->>'sourceDigest'then return app.finish_playoff_series_generation_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','match_source_changed'));end if;
 if exists(select 1 from app.playoff_series_results_v1 r join app.playoff_series_generations_v1 old_generation on old_generation.id=r.generation_id where old_generation.tournament_id=tid and old_generation.event_id=eid and old_generation.qualification_id<>qid)
 then return app.finish_playoff_series_generation_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','bracket_recovery_review_required'));end if;
 if to_regclass('app.playoff_series_game_actions_v1')is not null then
  execute 'select exists(select 1 from app.playoff_series_game_actions_v1 action join app.playoff_series_generations_v1 old_generation on old_generation.id=action.generation_id where old_generation.tournament_id=$1 and old_generation.event_id=$2 and old_generation.qualification_id<>$3)'into has_work using tid,eid,qid;
  if has_work then return app.finish_playoff_series_generation_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','bracket_recovery_review_required'));end if;
 end if;
 if coalesce(src->>'currentGenerationId','')<>coalesce(v->>'expectedGenerationId','')then return app.finish_playoff_series_generation_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','generation_changed'));end if;
 if src->>'currentGenerationId'is not null then
  select*into head from app.playoff_series_generations_v1 where id=(src->>'currentGenerationId')::uuid;
  if head.source_digest=src->>'sourceDigest'then return app.finish_playoff_series_generation_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','generation_already_current'));end if;
  if exists(select 1 from app.playoff_series_results_v1 where generation_id=head.id)then return app.finish_playoff_series_generation_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','generation_recovery_review_required'));end if;
  -- Do not clear or rebase a generation containing pending player work.
  if to_regclass('app.playoff_series_game_actions_v1')is not null then
   execute 'select exists(select 1 from app.playoff_series_game_actions_v1 where generation_id=$1)'into has_work using head.id;
   if has_work then return app.finish_playoff_series_generation_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','generation_recovery_review_required'));end if;
  end if;
 end if;
 mid:=(src->>'matchId')::uuid;
 if mid is null then mid:=extensions.gen_random_uuid();insert into app.playoff_series_matches_v1(id,tournament_id,event_id,qualification_id,slot)values(mid,tid,eid,qid,slot_no);end if;
 gid:=extensions.gen_random_uuid();response:=app.finish_playoff_series_generation_v1(tid,eid,op,v,jsonb_build_object('status','series_generation_created','matchId',mid,'generationId',gid,'matchVersion',coalesce(head.version,0)+1,'sourceDigest',src->>'sourceDigest'));
 insert into app.playoff_series_generations_v1(id,match_id,tournament_id,event_id,version,qualification_id,playoff_start_id,settings_binding_id,context_review_id,source_digest,source_capture,side_a_participant_id,side_b_participant_id,side_a_profile_id,side_b_profile_id,round_name,slot,wins_required,maximum_games,prior_generation_id,actor_id,operation_id)
 values(gid,mid,tid,eid,coalesce(head.version,0)+1,qid,(src->>'playoffStartId')::uuid,(src->>'settingsBindingId')::uuid,(src->>'reviewId')::uuid,src->>'sourceDigest',src->'source',(src#>>'{participants,0}')::uuid,(src#>>'{participants,1}')::uuid,(src#>>'{profiles,0}')::uuid,(src#>>'{profiles,1}')::uuid,src->>'round',slot_no,(src->>'winsRequired')::integer,(src->>'maximumGames')::integer,head.id,a,op);
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
alter function app.playoff_series_current_result_v1(uuid,uuid,uuid,integer)owner to postgres;
alter function app.playoff_series_match_source_v1(uuid,uuid,uuid,integer)owner to postgres;
alter function app.finish_playoff_series_generation_v1(uuid,uuid,uuid,jsonb,jsonb)owner to postgres;
alter function app.create_playoff_series_generation_v1(uuid,uuid,jsonb)owner to postgres;
alter function app.get_playoff_series_generation_operation_v1(uuid,uuid,uuid)owner to postgres;
revoke all on function app.playoff_series_current_result_v1(uuid,uuid,uuid,integer),app.playoff_series_match_source_v1(uuid,uuid,uuid,integer),app.finish_playoff_series_generation_v1(uuid,uuid,uuid,jsonb,jsonb),app.create_playoff_series_generation_v1(uuid,uuid,jsonb),app.get_playoff_series_generation_operation_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
