-- PRIVATE SOURCE ONLY. Ordinary modern 4/5-player series; no canonical/simulation IDs.
begin;
create function app.modern_manual_playoff_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;
create table app.modern_manual_playoff_matches_v1(id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,qualification_id uuid not null,slot integer not null check(slot between 1 and 4),unique(tournament_id,event_id,qualification_id,slot),unique(id,tournament_id,event_id),foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id));
create table app.modern_manual_playoff_generations_v1(
 id uuid primary key default extensions.gen_random_uuid(),match_id uuid not null,tournament_id uuid not null,event_id uuid not null,qualification_id uuid not null,slot integer not null check(slot between 1 and 4),version integer not null check(version>0),
 actor_id uuid not null references app.profiles(id),session_id uuid not null,operation_id uuid not null,request jsonb not null,source_digest text not null,source_capture jsonb not null,
 side_a_participant_id uuid not null,side_b_participant_id uuid not null,round_name text not null,wins_required integer not null,maximum_games integer not null,created_at timestamptz not null default clock_timestamp(),
 unique(actor_id,operation_id),unique(match_id,version),unique(id,tournament_id,event_id),foreign key(match_id,tournament_id,event_id)references app.modern_manual_playoff_matches_v1(id,tournament_id,event_id),
 foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id),foreign key(side_a_participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),foreign key(side_b_participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 check(side_a_participant_id<>side_b_participant_id and wins_required>0 and maximum_games=wins_required*2-1 and maximum_games<=2500),check(source_digest~'^[a-f0-9]{64}$')
);
create table app.modern_manual_playoff_games_v1(id uuid primary key default extensions.gen_random_uuid(),generation_id uuid not null,tournament_id uuid not null,event_id uuid not null,game_number integer not null check(game_number between 1 and 2500),source_digest text not null,unique(generation_id,game_number),unique(id,generation_id),foreign key(generation_id,tournament_id,event_id)references app.modern_manual_playoff_generations_v1(id,tournament_id,event_id));
create table app.modern_manual_playoff_evidence_v1(
 id uuid primary key default extensions.gen_random_uuid(),game_id uuid not null,generation_id uuid not null,revision integer not null check(revision>0),actor_id uuid not null references app.profiles(id),session_id uuid not null,identity_binding_id uuid references app.paper_official_identity_bindings(id),operation_id uuid not null,action text not null check(action in('digital-submit','digital-amend','digital-confirm','handoff-yes','handoff-no','paper-capture','paper-review','adjudicate')),
 request jsonb not null,request_hash text not null,winner_id uuid references app.event_participants(id),target_id uuid references app.modern_manual_playoff_evidence_v1(id),paper_claims jsonb not null,reason text not null,created_at timestamptz not null default clock_timestamp(),
 unique(actor_id,operation_id),unique(game_id,revision),unique(id,game_id),foreign key(game_id,generation_id)references app.modern_manual_playoff_games_v1(id,generation_id),check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('modern-manual-playoff-evidence-v1',actor_id,operation_id,request)::text,'utf8'),'sha256'),'hex'))
);
create table app.modern_manual_playoff_verified_v1(id uuid primary key default extensions.gen_random_uuid(),game_id uuid not null unique,generation_id uuid not null,winner_id uuid not null references app.event_participants(id),proof jsonb not null,verified_by_evidence_id uuid not null references app.modern_manual_playoff_evidence_v1(id),created_at timestamptz not null default clock_timestamp(),foreign key(game_id,generation_id)references app.modern_manual_playoff_games_v1(id,generation_id));
create table app.modern_manual_playoff_results_v1(id uuid primary key default extensions.gen_random_uuid(),generation_id uuid not null unique references app.modern_manual_playoff_generations_v1(id),winner_participant_id uuid not null references app.event_participants(id),loser_participant_id uuid not null references app.event_participants(id),wins_a integer not null,wins_b integer not null,game_count integer not null,source_digest text not null,games_digest text not null,created_at timestamptz not null default clock_timestamp(),check(winner_participant_id<>loser_participant_id and game_count=wins_a+wins_b));

-- Clone only the already-reviewed bracket/format/current-Start derivation.
-- The new mode evidence and journals have a separate digest domain. Existing
-- digital functions/tables/confirmation invariants are not replaced.
do $source$declare body text;old text;replacement text;begin
 if not exists(select 1 from pg_proc where oid=to_regprocedure('app.selected_step_series_match_source_v3(uuid,uuid,uuid,uuid,integer)')and proowner='postgres'::regrole and prosecdef)then raise exception 'modern manual trusted source missing';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid='app.selected_step_series_match_source_v3(uuid,uuid,uuid,uuid,integer)'::regprocedure;
 old:='ids uuid[];x uuid;y uuid;pa uuid;pb uuid;la uuid;lb uuid;prefa integer;prefb integer;';
 if strpos(body,old)=0 then raise exception 'modern manual declaration anchor changed';end if;
 body:=replace(body,old,old||' mode_a text;mode_b text;');
 old:=' -- Native roster preference/link ownership is required; no fallback by name,';
 if strpos(body,old)=0 or strpos(body,' select*into b from app.event_settings_operational_bindings_v1')=0 then raise exception 'modern manual roster anchor changed';end if;
 old:=substring(body from strpos(body,old)for strpos(body,' select*into b from app.event_settings_operational_bindings_v1')-strpos(body,old));
 replacement:=$roster$
 lock table app.roster_account_links,app.tournament_roster_entries,app.event_participants in share mode nowait;
 select p.profile_id,l.id,r.scorecard_preference_version,r.scorecard_type into pa,la,prefa,mode_a from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id left join app.roster_account_links l on l.roster_entry_id=r.id and l.tournament_id=r.tournament_id and l.profile_id=p.profile_id where p.id=x and p.tournament_id=tid and p.event_id=eid and p.status='checked_in';
 select p.profile_id,l.id,r.scorecard_preference_version,r.scorecard_type into pb,lb,prefb,mode_b from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id left join app.roster_account_links l on l.roster_entry_id=r.id and l.tournament_id=r.tournament_id and l.profile_id=p.profile_id where p.id=y and p.tournament_id=tid and p.event_id=eid and p.status='checked_in';
 if mode_a is null or mode_b is null or mode_a not in('digital','paper')or mode_b not in('digital','paper')or(mode_a='digital'and(pa is null or la is null))or(mode_b='digital'and(pb is null or lb is null))or(pa is not null and pa=pb)then return jsonb_build_object('status','blocked','code','current_bound_scorecard_modes_required');end if;
 $roster$;
 body:=replace(body,old,replacement);
 old:=' select array_agg(participant_id order by ranking_ordinal)';if strpos(body,old)=0 then raise exception 'modern manual qualification anchor changed';end if;
 body:=replace(body,old,' if q.qualifier_count not in(4,5)then return jsonb_build_object(''status'',''blocked'',''code'',''unsupported_qualifier_count'');end if;'||old);
 body:=replace(body,'app.selected_step_pool_playoff_source_v3(actor,tid,eid)','app.selected_step_player_gate_evidence_v3(actor,tid,eid)');
 body:=replace(body,'app.selected_step_series_current_result_v3(actor,tid,eid,qid,','app.modern_manual_playoff_current_result_v1(actor,tid,eid,qid,');
 body:=replace(body,'app.playoff_series_matches_v1','app.modern_manual_playoff_matches_v1');body:=replace(body,'app.playoff_series_generations_v1','app.modern_manual_playoff_generations_v1');
 old:='''preferences'',jsonb_build_array(prefa,prefb),';if strpos(body,old)=0 then raise exception 'modern manual preference anchor changed';end if;
 body:=replace(body,old,old||'''modes'',jsonb_build_array(mode_a,mode_b),');
 body:=replace(body,'playoff-series-match-source-v1','modern-manual-playoff-source-v1');
 old:='begin'||E'\n';if strpos(body,old)=0 then raise exception 'modern manual entry anchor changed';end if;
 body:=overlay(body placing old||' if app.modern_manual_playoff_enabled_v1()is distinct from true or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role=''director'')or not exists(select 1 from auth.users where id=actor and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp()))then return null;end if;' from strpos(body,old)for length(old));
 execute format('create function app.modern_manual_playoff_source_v1(actor uuid,tid uuid,eid uuid,qid uuid,slot_no integer)returns jsonb language plpgsql security definer set search_path=''''set timezone=''UTC''as %L',body);
end$source$;

create function app.create_modern_manual_playoff_generation_v1(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare prior app.modern_manual_playoff_generations_v1%rowtype;s jsonb;gid uuid:=extensions.gen_random_uuid();mid uuid;v integer;qid uuid;slot_no integer;begin
 if app.modern_manual_playoff_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if op is null or jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>6 or not(request?&array['kind','qualificationId','slot','expectedSourceDigest','expectedVersion','reason'])or request->>'kind'is distinct from'modern-manual-playoff-generation-v1'or coalesce(request->>'qualificationId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or jsonb_typeof(request->'slot')is distinct from'number'or coalesce(request->>'slot','')!~'^[1-4]$'or jsonb_typeof(request->'expectedVersion')is distinct from'number'or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,8})$'or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'is distinct from app.custom_payout_classification_text_v2(request->>'reason')or app.event_settings_js_text_length_v3(request->>'reason')not between 1 and 2000 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('modern-manual-generation:'||actor||':'||op,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into prior from app.modern_manual_playoff_generations_v1 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id<>tid or prior.event_id<>eid or prior.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;return jsonb_build_object('status','generation_recorded','generationId',prior.id,'operationId',op,'historicalReceipt',true,'currentSourceVerified',false);end if;
 if app.modern_manual_playoff_financial_hold_v1(tid,eid)then return jsonb_build_object('status','blocked','code','existing_financial_liability');end if;
 qid:=(request->>'qualificationId')::uuid;slot_no:=(request->>'slot')::integer;s:=app.modern_manual_playoff_source_v1(actor,tid,eid,qid,slot_no);
 if s->>'status'is distinct from'source_available'then return coalesce(s,jsonb_build_object('status','blocked','code','current_source_required'));end if;
 if s->>'sourceDigest'is distinct from request->>'expectedSourceDigest'or s->>'currentGenerationVersion'is distinct from request->>'expectedVersion'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 if exists(select 1 from app.playoff_series_matches_v1 where tournament_id=tid and event_id=eid and qualification_id=qid)then return jsonb_build_object('status','blocked','code','existing_digital_series_protocol');end if;
 if exists(select 1 from app.modern_manual_playoff_evidence_v1 e join app.modern_manual_playoff_games_v1 g on g.id=e.game_id where g.generation_id=(s->>'currentGenerationId')::uuid)then return jsonb_build_object('status','blocked','code','generation_has_play');end if;
 mid:=(s->>'matchId')::uuid;v:=(s->>'currentGenerationVersion')::integer+1;
 if mid is null then insert into app.modern_manual_playoff_matches_v1(tournament_id,event_id,qualification_id,slot)values(tid,eid,qid,slot_no)returning id into mid;end if;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 insert into app.modern_manual_playoff_generations_v1(id,match_id,tournament_id,event_id,qualification_id,slot,version,actor_id,session_id,operation_id,request,source_digest,source_capture,side_a_participant_id,side_b_participant_id,round_name,wins_required,maximum_games)values(gid,mid,tid,eid,qid,slot_no,v,actor,sid,op,request,s->>'sourceDigest',s->'source',(s->'participants'->>0)::uuid,(s->'participants'->>1)::uuid,s->>'round',(s->>'winsRequired')::integer,(s->>'maximumGames')::integer);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'modern_manual_playoff',gid,'generation_recorded',jsonb_build_object('operationId',op,'sessionId',sid,'sourceDigest',s->>'sourceDigest','moneyMoved',false));
 return jsonb_build_object('status','generation_recorded','generationId',gid,'operationId',op,'historicalReceipt',true,'currentSourceVerified',false);
 exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.modern_manual_playoff_independent_v1(actor uuid,gid uuid)returns uuid language plpgsql security definer set search_path=''as $$
declare g app.modern_manual_playoff_generations_v1%rowtype;b app.paper_official_identity_bindings%rowtype;begin
 select*into g from app.modern_manual_playoff_generations_v1 where id=gid;if g.id is null or app.paper_official_identity_is_current_valid(actor,g.tournament_id)is distinct from true then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=g.tournament_id and profile_id=actor and role in('director','co_director','cross_checker'))or exists(select 1 from app.event_participants where id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor)then return null;end if;
 select*into b from app.paper_official_identity_bindings where tournament_id=g.tournament_id and official_profile_id=actor order by binding_version desc limit 1;
 if b.id is null or(b.binding_kind<>'nonparticipant'and b.roster_entry_id in(select roster_entry_id from app.event_participants where id in(g.side_a_participant_id,g.side_b_participant_id)))then return null;end if;return b.id;
end$$;
create function app.modern_manual_playoff_financial_hold_v1(tid uuid,eid uuid)returns boolean language sql stable security definer set search_path=''as $$select
 app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false
 or exists(select 1 from app.modern_prize_award_sets_v2 where tournament_id=tid and event_id=eid)
 or exists(select 1 from app.selected_step_award_sets_v3 where tournament_id=tid and event_id=eid)
 or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)
 or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)
 or exists(select 1 from app.selected_step_pool_finals_v3 where tournament_id=tid and event_id=eid);$$;

-- Private evidence evaluator. It reads only this ordinary series journal.
-- No player/paper confirmation is manufactured. The references in proof are
-- immutable original digital, tentative handoff, capture, re-entry and resolution IDs.
create function app.modern_manual_playoff_game_state_v1(game uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare g app.modern_manual_playoff_generations_v1%rowtype;gg app.modern_manual_playoff_games_v1%rowtype;
 da app.modern_manual_playoff_evidence_v1%rowtype;db app.modern_manual_playoff_evidence_v1%rowtype;ca app.modern_manual_playoff_evidence_v1%rowtype;cb app.modern_manual_playoff_evidence_v1%rowtype;
 handoff app.modern_manual_playoff_evidence_v1%rowtype;capture app.modern_manual_playoff_evidence_v1%rowtype;review app.modern_manual_playoff_evidence_v1%rowtype;adjudication app.modern_manual_playoff_evidence_v1%rowtype;
 ma text;mb text;pa uuid;pb uuid;effective uuid;provisional uuid;disputed boolean:=false;valid boolean:=false;digital_ready boolean;papers integer;proof jsonb;
 begin
 select*into gg from app.modern_manual_playoff_games_v1 where id=game;select*into g from app.modern_manual_playoff_generations_v1 where id=gg.generation_id;if g.id is null then return null;end if;
 ma:=g.source_capture->'modes'->>0;mb:=g.source_capture->'modes'->>1;pa:=(g.source_capture->'profiles'->>0)::uuid;pb:=(g.source_capture->'profiles'->>1)::uuid;papers:=(case when ma='paper'then 1 else 0 end)+(case when mb='paper'then 1 else 0 end);
 select*into da from app.modern_manual_playoff_evidence_v1 where game_id=game and actor_id=pa and action in('digital-submit','digital-amend')order by revision desc limit 1;
 select*into db from app.modern_manual_playoff_evidence_v1 where game_id=game and actor_id=pb and action in('digital-submit','digital-amend')order by revision desc limit 1;
 select*into ca from app.modern_manual_playoff_evidence_v1 where game_id=game and actor_id=pa and action='digital-confirm'and target_id=da.id order by revision desc limit 1;
 select*into cb from app.modern_manual_playoff_evidence_v1 where game_id=game and actor_id=pb and action='digital-confirm'and target_id=db.id order by revision desc limit 1;
 select*into handoff from app.modern_manual_playoff_evidence_v1 where game_id=game and action in('handoff-yes','handoff-no')order by revision desc limit 1;
 select*into adjudication from app.modern_manual_playoff_evidence_v1 where game_id=game and action='adjudicate'order by revision desc limit 1;
 select*into capture from app.modern_manual_playoff_evidence_v1 where game_id=game and action='paper-capture'and revision>coalesce(adjudication.revision,0)order by revision desc limit 1;
 select*into review from app.modern_manual_playoff_evidence_v1 where game_id=game and action='paper-review'and target_id=capture.id order by revision desc limit 1;
 digital_ready:=(ma<>'digital'or(da.id is not null and ca.id is not null))and(mb<>'digital'or(db.id is not null and cb.id is not null));
 if papers=0 then
  disputed:=da.id is not null and db.id is not null and da.winner_id<>db.winner_id;
  if not disputed and digital_ready then effective:=da.winner_id;provisional:=effective;valid:=true;end if;
 else
  disputed:=handoff.action='handoff-no'and adjudication.id is null;
  if adjudication.id is not null then
   if app.modern_manual_playoff_independent_v1(adjudication.actor_id,g.id)is distinct from adjudication.identity_binding_id then return null;end if;effective:=adjudication.winner_id;
  elsif papers=1 then effective:=case when ma='digital'then da.winner_id else db.winner_id end;
  else effective:=capture.winner_id;end if;
  if capture.id is not null and(capture.winner_id is null or papers=1 and capture.winner_id is distinct from effective) then disputed:=true;end if;
  if review.id is not null and(review.paper_claims is distinct from capture.paper_claims or review.winner_id is distinct from effective or capture.winner_id is distinct from effective)then disputed:=true;end if;
  if not coalesce(disputed,false)and digital_ready and(papers=2 or handoff.action='handoff-yes'or adjudication.id is not null)then provisional:=effective;end if;
  valid:=provisional is not null and capture.id is not null and review.id is not null and capture.winner_id=effective and review.winner_id=effective and capture.paper_claims=review.paper_claims
   and capture.actor_id<>review.actor_id and capture.actor_id is distinct from adjudication.actor_id and review.actor_id is distinct from adjudication.actor_id
   and exists(select 1 from app.tournament_roles where tournament_id=g.tournament_id and profile_id=capture.actor_id and role='cross_checker')and app.modern_manual_playoff_independent_v1(capture.actor_id,g.id)=capture.identity_binding_id and app.modern_manual_playoff_independent_v1(review.actor_id,g.id)=review.identity_binding_id;
 end if;
 proof:=jsonb_build_object('kind','modern-manual-playoff-proof-v1','generationId',g.id,'gameId',game,'sourceDigest',g.source_digest,'digitalSubmissions',jsonb_build_array(da.id,db.id),'digitalConfirmations',jsonb_build_array(ca.id,cb.id),'tentativeHandoffId',handoff.id,'paperCaptureId',capture.id,'paperReviewId',review.id,'adjudicationId',adjudication.id,'winnerId',case when valid then effective else null end,'paperVerified',valid and papers>0,'moneyMoved',false);
 return jsonb_build_object('verified',coalesce(valid,false),'disputed',coalesce(disputed,false),'winnerId',case when valid then effective else null end,'provisionalWinnerId',provisional,'captureId',capture.id,'reviewId',review.id,'adjudicationId',adjudication.id,'handoffId',handoff.id,'proof',proof);
end$$;

-- Current series proof validates every persisted verification against its real
-- journal and the current generation source. Only this can feed another match.
create function app.modern_manual_playoff_current_result_v1(actor uuid,tid uuid,eid uuid,qid uuid,slot_no integer)returns jsonb language plpgsql security definer set search_path=''as $$
declare s jsonb;g app.modern_manual_playoff_generations_v1%rowtype;r app.modern_manual_playoff_results_v1%rowtype;gg record;state jsonb;a integer:=0;b integer:=0;n integer:=0;proofs jsonb:='[]';begin
 s:=app.modern_manual_playoff_source_v1(actor,tid,eid,qid,slot_no);if s->>'status'is distinct from'source_available'then return null;end if;
 select*into g from app.modern_manual_playoff_generations_v1 where id=(s->>'currentGenerationId')::uuid;select*into r from app.modern_manual_playoff_results_v1 where generation_id=g.id;
 if r.id is null or g.source_digest is distinct from s->>'sourceDigest'or r.source_digest is distinct from g.source_digest then return null;end if;
 for gg in select x.*,v.proof,v.winner_id from app.modern_manual_playoff_games_v1 x join app.modern_manual_playoff_verified_v1 v on v.game_id=x.id and v.generation_id=x.generation_id where x.generation_id=g.id order by x.game_number loop
  n:=n+1;if gg.game_number<>n or greatest(a,b)>=g.wins_required then return null;end if;state:=app.modern_manual_playoff_game_state_v1(gg.id);
  if state->'verified'is distinct from'true'::jsonb or state->>'winnerId'is distinct from gg.winner_id::text or state->'proof'is distinct from gg.proof then return null;end if;
  if gg.winner_id=g.side_a_participant_id then a:=a+1;elsif gg.winner_id=g.side_b_participant_id then b:=b+1;else return null;end if;proofs:=proofs||jsonb_build_array(gg.proof);
 end loop;
 if greatest(a,b)<>g.wins_required or n<>r.game_count or n>g.maximum_games or a<>r.wins_a or b<>r.wins_b or r.winner_participant_id is distinct from(case when a=g.wins_required then g.side_a_participant_id else g.side_b_participant_id end)
 or r.loser_participant_id is distinct from(case when a=g.wins_required then g.side_b_participant_id else g.side_a_participant_id end)
 or r.games_digest is distinct from encode(extensions.digest(convert_to(proofs::text,'utf8'),'sha256'),'hex')
 or exists(select 1 from app.modern_manual_playoff_games_v1 x join app.modern_manual_playoff_evidence_v1 e on e.game_id=x.id where x.generation_id=g.id and x.game_number>n)then return null;end if;
 return jsonb_build_object('matchId',g.match_id,'resultId',r.id,'version',1,'winnerId',r.winner_participant_id,'loserId',r.loser_participant_id);
end$$;

create function app.record_modern_manual_playoff_evidence_v1(request jsonb)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare actor uuid;sid uuid;op uuid;gid uuid;number integer;expected integer;action text;winner uuid;target uuid;claims jsonb;item jsonb;papers jsonb;g app.modern_manual_playoff_generations_v1%rowtype;gg app.modern_manual_playoff_games_v1%rowtype;prior app.modern_manual_playoff_evidence_v1%rowtype;anchor app.modern_manual_playoff_evidence_v1%rowtype;capturer app.modern_manual_playoff_evidence_v1%rowtype;
 binding uuid;participant uuid;mode text;source jsonb;state jsonb;previous jsonb;rev integer;eid uuid:=extensions.gen_random_uuid();verified uuid;dispute uuid;adj uuid;ma text;mb text;a integer:=0;b integer:=0;n integer:=0;rowv record;proofs jsonb:='[]';result_id uuid;reason text;
 begin
 if app.modern_manual_playoff_enabled_v1()is distinct from true then return null;end if;actor:=app.manual_mixed_handoff_actor_v1();if actor is null then return null;end if;sid:=(auth.jwt()->>'session_id')::uuid;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>12 or not(request?&array['kind','generationId','gameNumber','operationId','expectedVersion','sourceDigest','action','winnerId','targetId','paperClaims','reason','reference'])
 or request->>'kind'is distinct from'modern-manual-playoff-evidence-v1'or coalesce(request->>'generationId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or coalesce(request->>'operationId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or jsonb_typeof(request->'gameNumber')is distinct from'number'or coalesce(request->>'gameNumber','')!~'^[1-9][0-9]{0,3}$'or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,8})$'or coalesce(request->>'sourceDigest','')!~'^[a-f0-9]{64}$'
 or request->>'action'not in('digital-submit','digital-amend','digital-confirm','handoff-yes','handoff-no','paper-capture','paper-review','adjudicate')or jsonb_typeof(request->'action')is distinct from'string'
 or(request->'winnerId'is distinct from'null'::jsonb and coalesce(request->>'winnerId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$')or(request->'targetId'is distinct from'null'::jsonb and coalesce(request->>'targetId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$')
 or jsonb_typeof(request->'paperClaims')is distinct from'array'or jsonb_array_length(request->'paperClaims')>2 or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'is distinct from app.custom_payout_classification_text_v2(request->>'reason')or app.event_settings_js_text_length_v3(request->>'reason')not between 1 and 2000
 or(request->'reference'is distinct from'null'::jsonb and(jsonb_typeof(request->'reference')is distinct from'string'or request->>'reference'is distinct from app.custom_payout_classification_text_v2(request->>'reference')or app.event_settings_js_text_length_v3(request->>'reference')not between 1 and 500))then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(request->>'operationId')::uuid;gid:=(request->>'generationId')::uuid;number:=(request->>'gameNumber')::integer;expected:=(request->>'expectedVersion')::integer;action:=request->>'action';winner:=(request->>'winnerId')::uuid;target:=(request->>'targetId')::uuid;reason:=request->>'reason';
 if not pg_try_advisory_xact_lock(hashtextextended('modern-manual-action:'||actor||':'||op,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into g from app.modern_manual_playoff_generations_v1 where id=gid for update nowait;if g.id is null then return null;end if;
 -- Serialize with all ordinary event mutation and existing finalization paths.
 perform 1 from app.tournaments where id=g.tournament_id for update nowait;if not found then return null;end if;
 participant:=null;
 if actor=(g.source_capture->'profiles'->>0)::uuid and g.source_capture->'modes'->>0='digital'then participant:=g.side_a_participant_id;end if;
 if actor=(g.source_capture->'profiles'->>1)::uuid and g.source_capture->'modes'->>1='digital'then participant:=g.side_b_participant_id;end if;
 binding:=app.modern_manual_playoff_independent_v1(actor,gid);
 if action in('digital-submit','digital-amend','digital-confirm','handoff-yes','handoff-no')and participant is null or action in('paper-capture','paper-review','adjudicate')and binding is null then return null;end if;
 if action='paper-capture'and not exists(select 1 from app.tournament_roles where tournament_id=g.tournament_id and profile_id=actor and role='cross_checker')then return null;end if;
 select*into prior from app.modern_manual_playoff_evidence_v1 where actor_id=actor and operation_id=op;
 if prior.id is not null then
  if prior.request is distinct from request or prior.generation_id<>gid then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  return jsonb_build_object('status','evidence_recorded','operationId',op,'evidenceId',prior.id,'gameId',prior.game_id,'generationId',gid,'version',prior.revision,'historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false);
 end if;
 source:=app.modern_manual_playoff_source_v1(g.actor_id,g.tournament_id,g.event_id,g.qualification_id,g.slot);
 if source->>'status'is distinct from'source_available'or source->>'currentGenerationId'is distinct from gid::text or source->>'sourceDigest'is distinct from g.source_digest or source->'source'is distinct from g.source_capture or request->>'sourceDigest'is distinct from g.source_digest then return jsonb_build_object('status','rejected','code','generation_source_changed');end if;
 if app.modern_manual_playoff_financial_hold_v1(g.tournament_id,g.event_id)then return jsonb_build_object('status','blocked','code','existing_financial_liability');end if;
 if number>g.maximum_games then return jsonb_build_object('status','rejected','code','game_out_of_series');end if;
 select*into gg from app.modern_manual_playoff_games_v1 where generation_id=gid and game_number=number;
 if exists(select 1 from app.modern_manual_playoff_verified_v1 where game_id=gg.id)or exists(select 1 from app.modern_manual_playoff_results_v1 where generation_id=gid)then return jsonb_build_object('status','rejected','code','verified_or_completed_requires_separate_correction');end if;
 select coalesce(max(revision),0)into rev from app.modern_manual_playoff_evidence_v1 where game_id=gg.id;
 if rev<>expected then return jsonb_build_object('status','rejected','code','stale_game_version');end if;
 ma:=g.source_capture->'modes'->>0;mb:=g.source_capture->'modes'->>1;
 -- Later games may proceed from tentative agreed outcomes, never another round.
 -- Stop at a provisional first-to threshold; no invented extra game policy.
 if gg.id is null then
  for rowv in select x.*from app.modern_manual_playoff_games_v1 x where x.generation_id=gid and x.game_number<number order by x.game_number loop
   n:=n+1;if rowv.game_number<>n then return jsonb_build_object('status','blocked','code','prior_game_missing');end if;previous:=app.modern_manual_playoff_game_state_v1(rowv.id);
   if previous->>'provisionalWinnerId'is null or previous->'disputed'='true'::jsonb then return jsonb_build_object('status','blocked','code','prior_game_unresolved');end if;
   if previous->>'provisionalWinnerId'=g.side_a_participant_id::text then a:=a+1;else b:=b+1;end if;
  end loop;
  if n<>number-1 or greatest(a,b)>=g.wins_required then return jsonb_build_object('status','blocked','code','provisional_series_limit');end if;
 end if;
 state:=coalesce(app.modern_manual_playoff_game_state_v1(gg.id),jsonb_build_object('disputed',false));
 if target is not null then select*into anchor from app.modern_manual_playoff_evidence_v1 where id=target and game_id=gg.id and generation_id=gid;if anchor.id is null then return jsonb_build_object('status','rejected','code','target_evidence_changed');end if;end if;
 if winner is not null and winner not in(g.side_a_participant_id,g.side_b_participant_id)then return jsonb_build_object('status','rejected','code','winner_not_in_match');end if;
 claims:='[]';select coalesce(jsonb_agg(x order by x::text),'[]')into papers from jsonb_array_elements(g.source_capture->'participants')with ordinality p(x,i)where g.source_capture->'modes'->>(i::integer-1)='paper';
 if action in('paper-capture','paper-review')then
  if jsonb_array_length(papers)=0 or jsonb_array_length(request->'paperClaims')<>jsonb_array_length(papers)then return jsonb_build_object('status','rejected','code','paper_claims_required');end if;
  for item in select value from jsonb_array_elements(request->'paperClaims')loop
   if jsonb_typeof(item)is distinct from'object'or(select count(*)from jsonb_object_keys(item))<>3 or not(item?&array['participantId','winnerId','reference'])or not(papers?(item->>'participantId'))or not(g.source_capture->'participants'?(item->>'winnerId')) or jsonb_typeof(item->'reference')is distinct from'string'or item->>'reference'is distinct from app.custom_payout_classification_text_v2(item->>'reference')or app.event_settings_js_text_length_v3(item->>'reference')not between 1 and 500 then return jsonb_build_object('status','rejected','code','paper_claim_binding_invalid');end if;
  end loop;
  if(select count(distinct x->>'participantId')from jsonb_array_elements(request->'paperClaims')x)<>jsonb_array_length(papers)then return jsonb_build_object('status','rejected','code','paper_claim_duplicate');end if;
  if(select count(distinct x->>'winnerId')from jsonb_array_elements(request->'paperClaims')x)=1 then
   if winner::text is distinct from request->'paperClaims'->0->>'winnerId'then return jsonb_build_object('status','rejected','code','paper_winner_binding_invalid');end if;
  elsif winner is not null then return jsonb_build_object('status','rejected','code','contradictory_cards_remain_unresolved');end if;
  select jsonb_agg(x order by x->>'participantId')into claims from jsonb_array_elements(request->'paperClaims')x;
 else if request->'paperClaims'<>'[]'::jsonb then return jsonb_build_object('status','rejected','code','unexpected_paper_claims');end if;end if;
 if action='digital-submit'then
  if target is not null or winner is null or exists(select 1 from app.modern_manual_playoff_evidence_v1 e where e.game_id=gg.id and e.actor_id=actor and e.action='digital-submit')then return jsonb_build_object('status','rejected','code','digital_entry_already_recorded');end if;
 elsif action='digital-amend'then
  if winner is null or anchor.id is null or anchor.actor_id<>actor or anchor.action not in('digital-submit','digital-amend')or exists(select 1 from app.modern_manual_playoff_evidence_v1 e where e.game_id=gg.id and(e.action in('handoff-yes','handoff-no','paper-capture','paper-review','adjudicate')or e.actor_id=actor and e.action='digital-confirm'or e.actor_id=actor and e.action in('digital-submit','digital-amend')and e.revision>anchor.revision))or exists(select 1 from app.modern_manual_playoff_games_v1 x join app.modern_manual_playoff_evidence_v1 e on e.game_id=x.id where x.generation_id=gid and x.game_number>number)then return jsonb_build_object('status','blocked','code','confirmed_or_dependent_entry_requires_separate_correction');end if;
 elsif action='digital-confirm'then
  if winner is not null or anchor.id is null or anchor.action not in('digital-submit','digital-amend')or anchor.actor_id<>actor or exists(select 1 from app.modern_manual_playoff_evidence_v1 e where e.game_id=gg.id and e.actor_id=actor and(e.action='digital-confirm'or e.action in('digital-submit','digital-amend')and e.revision>anchor.revision))then return jsonb_build_object('status','rejected','code','own_original_submission_required');end if;
 elsif action in('handoff-yes','handoff-no')then
  if jsonb_array_length(papers)<>1 or winner is not null or anchor.id is null or anchor.action not in('digital-submit','digital-amend')or anchor.actor_id<>actor or exists(select 1 from app.modern_manual_playoff_evidence_v1 e where e.game_id=gg.id and e.action in('handoff-yes','handoff-no'))or exists(select 1 from app.modern_manual_playoff_evidence_v1 e where e.game_id=gg.id and e.actor_id=actor and e.action in('digital-submit','digital-amend')and e.revision>anchor.revision)then return jsonb_build_object('status','rejected','code','own_mixed_handoff_required');end if;
 elsif action='paper-capture'then
  if state->'disputed'='true'::jsonb or state->>'captureId'is not null or(target is distinct from(state->>'adjudicationId')::uuid)then return jsonb_build_object('status','blocked','code','fresh_resolved_capture_required');end if;
  if jsonb_array_length(papers)=1 and state->>'handoffId'is null then return jsonb_build_object('status','blocked','code','original_handoff_required');end if;
  if target is not null and anchor.actor_id=actor then return jsonb_build_object('status','rejected','code','adjudicator_cannot_capture');end if;
 elsif action='paper-review'then
  if state->'disputed'='true'::jsonb or anchor.id is null or anchor.action<>'paper-capture'or anchor.id is distinct from(state->>'captureId')::uuid or anchor.actor_id=actor or state->>'reviewId'is not null or exists(select 1 from app.modern_manual_playoff_evidence_v1 where id=(state->>'adjudicationId')::uuid and actor_id=actor)then return jsonb_build_object('status','rejected','code','distinct_current_blind_review_required');end if;
 elsif action='adjudicate'then
  if winner is null or state->'disputed'is distinct from'true'::jsonb or anchor.id is null or anchor.action not in('handoff-no','paper-capture','paper-review')or request->'reference'='null'::jsonb then return jsonb_build_object('status','rejected','code','current_dispute_required');end if;
  dispute:=coalesce((state->>'reviewId')::uuid,(state->>'captureId')::uuid,(state->>'handoffId')::uuid);if anchor.id<>dispute then return jsonb_build_object('status','rejected','code','stale_dispute');end if;
  select*into capturer from app.modern_manual_playoff_evidence_v1 where id=(state->>'captureId')::uuid;
  if actor=anchor.actor_id or actor=capturer.actor_id then return jsonb_build_object('status','rejected','code','independent_adjudicator_required');end if;
  if exists(select 1 from app.modern_manual_playoff_games_v1 x join app.modern_manual_playoff_evidence_v1 e on e.game_id=x.id where x.generation_id=gid and x.game_number>number)
   or exists(select 1 from app.modern_manual_playoff_generations_v1 child where child.tournament_id=g.tournament_id and child.event_id=g.event_id and child.source_capture->'parentResultPins'@>jsonb_build_array(jsonb_build_object('matchId',g.match_id)))then return jsonb_build_object('status','blocked','code','dependent_play_requires_separate_correction');end if;
 end if;
 if app.manual_mixed_handoff_actor_v1()is distinct from actor or(action in('paper-capture','paper-review','adjudicate')and app.modern_manual_playoff_independent_v1(actor,gid)is distinct from binding)then return null;end if;
 if gg.id is null then
  insert into app.modern_manual_playoff_games_v1(generation_id,tournament_id,event_id,game_number,source_digest)values(gid,g.tournament_id,g.event_id,number,g.source_digest)returning*into gg;
 end if;
 insert into app.modern_manual_playoff_evidence_v1(id,game_id,generation_id,revision,actor_id,session_id,identity_binding_id,operation_id,action,request,request_hash,winner_id,target_id,paper_claims,reason)
 values(eid,gg.id,gid,rev+1,actor,sid,binding,op,action,request,encode(extensions.digest(convert_to(jsonb_build_array('modern-manual-playoff-evidence-v1',actor,op,request)::text,'utf8'),'sha256'),'hex'),winner,target,claims,reason);
 state:=app.modern_manual_playoff_game_state_v1(gg.id);
 if state->'verified'='true'::jsonb then insert into app.modern_manual_playoff_verified_v1(game_id,generation_id,winner_id,proof,verified_by_evidence_id)values(gg.id,gid,(state->>'winnerId')::uuid,state->'proof',eid)returning id into verified;end if;
 -- Completion requires contiguous VERIFIED games and no later tentative play.
 a:=0;b:=0;n:=0;
 for rowv in select x.game_number,v.winner_id,v.proof from app.modern_manual_playoff_games_v1 x join app.modern_manual_playoff_verified_v1 v on v.game_id=x.id where x.generation_id=gid order by x.game_number loop
  if rowv.game_number<>n+1 or greatest(a,b)>=g.wins_required then exit;end if;n:=n+1;if rowv.winner_id=g.side_a_participant_id then a:=a+1;else b:=b+1;end if;proofs:=proofs||jsonb_build_array(rowv.proof);
 end loop;
 if greatest(a,b)=g.wins_required and not exists(select 1 from app.modern_manual_playoff_games_v1 x join app.modern_manual_playoff_evidence_v1 e on e.game_id=x.id where x.generation_id=gid and x.game_number>n)then
 insert into app.modern_manual_playoff_results_v1(generation_id,winner_participant_id,loser_participant_id,wins_a,wins_b,game_count,source_digest,games_digest)values(gid,case when a=g.wins_required then g.side_a_participant_id else g.side_b_participant_id end,case when a=g.wins_required then g.side_b_participant_id else g.side_a_participant_id end,a,b,n,g.source_digest,encode(extensions.digest(convert_to(proofs::text,'utf8'),'sha256'),'hex'))returning id into result_id;end if;
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(g.tournament_id,actor,'modern_manual_playoff',gg.id,action,jsonb_build_object('evidenceId',eid,'operationId',op,'sessionId',sid,'identityBindingId',binding,'sourceDigest',g.source_digest,'version',rev+1,'verifiedGameId',verified,'resultId',result_id,'sameDeviceHandoffAuthenticatedOpponent',false,'moneyMoved',false));
 return jsonb_build_object('status','evidence_recorded','operationId',op,'evidenceId',eid,'gameId',gg.id,'generationId',gid,'version',rev+1,'verifiedGameId',verified,'seriesResultId',result_id,'disputed',state->'disputed','historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false);
 exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;


-- Own exact-history recovery does not expose another actor's blind reading or
-- convert a historical receipt into current game/series verification.
create function app.get_modern_manual_playoff_operation_v1(op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid;e app.modern_manual_playoff_evidence_v1%rowtype;begin
 if app.modern_manual_playoff_enabled_v1()is distinct from true then return null;end if;actor:=app.manual_mixed_handoff_actor_v1();if actor is null then return null;end if;
 select*into e from app.modern_manual_playoff_evidence_v1 where actor_id=actor and operation_id=op;if e.id is null then return jsonb_build_object('status','unknown','code','operation_not_found');end if;
 if e.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 return jsonb_build_object('status','evidence_recorded','operationId',op,'evidenceId',e.id,'gameId',e.game_id,'generationId',e.generation_id,'version',e.revision,'historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false);
end$$;

-- A protocol cannot silently switch halfway through the same event field.
create function app.guard_modern_manual_protocol_v1()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if(tg_table_name='playoff_series_matches_v1'and exists(select 1 from app.modern_manual_playoff_matches_v1 where tournament_id=new.tournament_id and event_id=new.event_id and qualification_id=new.qualification_id))
 or(tg_table_name='modern_manual_playoff_matches_v1'and exists(select 1 from app.playoff_series_matches_v1 where tournament_id=new.tournament_id and event_id=new.event_id and qualification_id=new.qualification_id))then raise exception'modern_manual_protocol_collision';end if;return new;end$$;
create trigger modern_manual_protocol before insert on app.playoff_series_matches_v1 for each row execute function app.guard_modern_manual_protocol_v1();
create trigger modern_manual_protocol before insert on app.modern_manual_playoff_matches_v1 for each row execute function app.guard_modern_manual_protocol_v1();
-- Old final-award paths cannot ignore this new sporting domain. A future
-- explicit sporting/Finance bridge must replace this hold with real proof.
create function app.guard_modern_manual_finalization_v1()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if tg_table_name='multi_event_joint_finals_v1'then
  if exists(select 1 from app.modern_manual_playoff_matches_v1 where tournament_id=new.tournament_id)then raise exception'modern_manual_finance_bridge_required';end if;
 elsif exists(select 1 from app.modern_manual_playoff_matches_v1 where tournament_id=new.tournament_id and event_id=new.event_id)then raise exception'modern_manual_finance_bridge_required';end if;return new;end$$;
do $final_guards$declare t text;begin foreach t in array array['modern_prize_award_sets_v2','selected_step_award_sets_v3','native_playoff_final_award_sets_v1','native_optional_final_award_sets_v2','selected_step_pool_finals_v3','event_settlement_finals_v2','standard_singles_settlement_final_versions','q_accounting_finals_v6','no_q_accounting_finals_v7','prize_accounting_finals_v8','prize_accounting_finals_v9','multi_event_unpaid_finals_v1','multi_event_joint_finals_v1']loop execute format('create trigger modern_manual_sporting_bridge before insert on app.%I for each row execute function app.guard_modern_manual_finalization_v1()',t);end loop;end$final_guards$;

do $security$declare t text;f record;begin
 foreach t in array array['modern_manual_playoff_matches_v1','modern_manual_playoff_generations_v1','modern_manual_playoff_games_v1','modern_manual_playoff_evidence_v1','modern_manual_playoff_verified_v1','modern_manual_playoff_results_v1']loop
 execute format('alter table app.%I owner to postgres',t);execute format('alter table app.%I enable row level security',t);execute format('alter table app.%I force row level security',t);execute format('revoke all on app.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',t);execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',t);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app'and p.proname in('modern_manual_playoff_enabled_v1','modern_manual_playoff_source_v1','create_modern_manual_playoff_generation_v1','modern_manual_playoff_independent_v1','modern_manual_playoff_financial_hold_v1','modern_manual_playoff_game_state_v1','modern_manual_playoff_current_result_v1','record_modern_manual_playoff_evidence_v1','get_modern_manual_playoff_operation_v1','guard_modern_manual_protocol_v1','guard_modern_manual_finalization_v1')loop
 execute format('alter function %s owner to postgres',f.signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;
end$security$;
commit;

