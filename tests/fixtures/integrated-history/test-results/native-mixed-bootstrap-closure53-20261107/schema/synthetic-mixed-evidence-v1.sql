-- LOCAL PROPOSAL ONLY. No enrollment, identity, score or financial rows seeded.
-- Deliberately separate from 0266 and the 0290-0292 release.
begin;
create table app.synthetic_mixed_deployments_v1(
 project_ref text primary key check(project_ref='nnhcnvksxgxnpvdqjgpg'),
 authorization_reference text not null check(length(trim(authorization_reference))between 1 and 500));
create table app.synthetic_mixed_fixtures_v1(
 event_id uuid primary key,tournament_id uuid not null,project_ref text not null references app.synthetic_mixed_deployments_v1,
 authorization_reference text not null check(length(trim(authorization_reference))between 1 and 500),
 source_snapshot jsonb not null,source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),
 enrolled_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),unique(event_id,tournament_id));
create table app.synthetic_mixed_games_v1(
 game_id uuid primary key,event_id uuid not null,tournament_id uuid not null,
 pairing text not null check(pairing in('DD','PD','PP')),side_a_participant_id uuid not null,side_b_participant_id uuid not null,
 digital_participant_id uuid,digital_profile_id uuid references app.profiles(id),base_game_version integer not null check(base_game_version>0),
 foreign key(event_id,tournament_id)references app.synthetic_mixed_fixtures_v1(event_id,tournament_id),
 foreign key(game_id,tournament_id,event_id)references app.canonical_games(id,tournament_id,event_id),
 unique(game_id,event_id,tournament_id),check((pairing='PD')=(digital_participant_id is not null)),
 check((pairing='PD')=(digital_profile_id is not null)));
create table app.synthetic_mixed_artifacts_v1(
 id uuid primary key default extensions.gen_random_uuid(),game_id uuid not null unique,event_id uuid not null,tournament_id uuid not null,
 winner_side text not null check(winner_side in('a','b')),margin integer not null check(margin between 1 and 121),
 artifact_text text not null,sha256 text generated always as(encode(extensions.digest(artifact_text,'sha256'),'hex'))stored,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(game_id,event_id,tournament_id)references app.synthetic_mixed_games_v1(game_id,event_id,tournament_id),
 unique(id,game_id,event_id,tournament_id));
create table app.synthetic_mixed_attestations_v1(
 id uuid primary key default extensions.gen_random_uuid(),artifact_id uuid not null unique,game_id uuid not null,event_id uuid not null,tournament_id uuid not null,
 digital_submission_id uuid not null,actor_id uuid not null references app.profiles(id),expected_game_version integer not null,
 operation_receipt_id uuid not null unique,acknowledged_synthetic_opponent boolean not null check(acknowledged_synthetic_opponent),
 attested_at timestamptz not null default clock_timestamp(),
 foreign key(artifact_id,game_id,event_id,tournament_id)references app.synthetic_mixed_artifacts_v1(id,game_id,event_id,tournament_id),
 foreign key(digital_submission_id,game_id)references app.score_submissions(id,canonical_game_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id));
-- A private, exact actor/operation/target reservation makes the wrapper context
-- transaction-specific. No caller receives a table or preparation grant.
create table app.synthetic_mixed_contexts_v1(
 id uuid primary key default extensions.gen_random_uuid(),artifact_id uuid not null references app.synthetic_mixed_artifacts_v1(id),
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,target_id uuid not null,
 phase text not null check(phase in('capture','review')),request_hash text not null,backend_pid integer not null,transaction_id bigint not null,
 created_at timestamptz not null default clock_timestamp());
create table app.synthetic_mixed_provenance_v1(
 operation_receipt_id uuid primary key,tournament_id uuid not null,event_id uuid not null,game_id uuid not null,
 artifact_id uuid not null,context_id uuid not null references app.synthetic_mixed_contexts_v1(id),actor_id uuid not null references app.profiles(id),
 phase text not null check(phase in('capture','review')),pairing text not null check(pairing in('PD','PP')),
 physical_original boolean not null default false check(not physical_original),fictional_opponent_played boolean not null default false check(not fictional_opponent_played),
 independent_human_play_claimed boolean not null default false check(not independent_human_play_claimed),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 foreign key(artifact_id,game_id,event_id,tournament_id)references app.synthetic_mixed_artifacts_v1(id,game_id,event_id,tournament_id));
create table app.synthetic_mixed_requests_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,context_id uuid not null unique references app.synthetic_mixed_contexts_v1(id),
 native_receipt_id uuid references app.operation_receipts(id),response jsonb not null,primary key(actor_id,operation_id));

create function app.synthetic_mixed_snapshot_v1(tid uuid,eid uuid)returns jsonb language sql stable security definer set search_path=''as $$
 select jsonb_build_object('participants',(select jsonb_agg(jsonb_build_object('participantId',p.id,'rosterEntryId',r.id,'profileId',p.profile_id,
 'status',p.status,'mode',r.scorecard_type,'preferenceVersion',r.scorecard_preference_version,'tournamentPlayerId',s.verification_id,
 'links',(select coalesce(jsonb_agg(jsonb_build_array(l.id,l.profile_id)order by l.id),'[]')from app.roster_account_links l where l.tournament_id=tid and l.roster_entry_id=r.id))order by p.id)
 from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
 join app.initial_seating_assignments s on s.roster_entry_id=r.id and s.tournament_id=tid where p.event_id=eid and p.tournament_id=tid),
 'games',(select jsonb_agg(jsonb_build_object('gameId',g.id,'publicationId',sg.publication_id,'roundId',g.round_id,'sideA',g.side_a_participant_id,
 'sideB',g.side_b_participant_id,'seatA',g.side_a_table_seat_snapshot,'seatB',g.side_b_table_seat_snapshot)order by g.id)
 from app.event_schedule_games sg join app.canonical_games g on g.id=sg.canonical_game_id where sg.event_id=eid and sg.tournament_id=tid))
$$;
create function app.assert_synthetic_mixed_current_v1(tid uuid,eid uuid)returns void language plpgsql security definer set search_path=''as $$
begin
 if not exists(select 1 from app.synthetic_mixed_fixtures_v1 f join app.synthetic_mixed_deployments_v1 d using(project_ref)
 where f.event_id=eid and f.tournament_id=tid and f.source_snapshot=app.synthetic_mixed_snapshot_v1(tid,eid))then raise exception'synthetic_mixed_source_changed';end if;
end$$;

-- Owner-only enrollment, before any result/submission/manual case. Every draw
-- may place the six Digital participants differently; no preferred ID list.
create function app.enroll_synthetic_mixed_fixture_v1(tid uuid,eid uuid,project text,authorization_ref text)returns void
language plpgsql security definer set search_path=''as $$
declare snap jsonb;v_fixture_game record;
begin
 perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'for update;
 if not found then raise exception'synthetic_mixed_fixture_unavailable';end if;
 perform 1 from app.events where id=eid and tournament_id=tid and format='standard_singles'and scoring_method='digital'for update;
 if not found or project<>'nnhcnvksxgxnpvdqjgpg' or not exists(select 1 from app.synthetic_mixed_deployments_v1 where project_ref=project)
 or exists(select 1 from app.synthetic_paper_fixtures_v1 where event_id=eid)
 or exists(select 1 from app.synthetic_mixed_fixtures_v1 where event_id=eid)then raise exception'synthetic_mixed_fixture_unavailable';end if;
 perform 1 from app.canonical_games where event_id=eid and tournament_id=tid order by id for update;
 snap:=app.synthetic_mixed_snapshot_v1(tid,eid);
 if(select count(*)from app.event_participants where event_id=eid and tournament_id=tid)<>17
 or(select count(*)from app.canonical_games where event_id=eid and tournament_id=tid)<>102
 or jsonb_array_length(snap->'participants')is distinct from 17 or jsonb_array_length(snap->'games')is distinct from 102
 or(select count(*)from jsonb_array_elements(snap->'participants')p where p->>'mode'='digital'and p->>'status'='checked_in'and p->>'profileId'is not null
 and jsonb_array_length(p->'links')=1 and p->'links'->0->>1=p->>'profileId')<>6
 or(select count(*)from jsonb_array_elements(snap->'participants')p where p->>'mode'='paper'and p->>'status'='checked_in'and p->>'profileId'is null and jsonb_array_length(p->'links')=0)<>11
 or(select count(distinct p->>'profileId')from jsonb_array_elements(snap->'participants')p where p->>'mode'='digital')<>6
 or exists(select 1 from app.canonical_games where event_id=eid and(state<>'pending'or winner_side is not null or margin is not null))
 or exists(select 1 from app.score_submissions where event_id=eid)or exists(select 1 from app.card_scorelines where event_id=eid)
 or exists(select 1 from app.paper_game_completions where event_id=eid)or exists(select 1 from app.hybrid_game_cases where event_id=eid)
 or exists(select 1 from app.device_failure_recoveries where event_id=eid)or exists(select 1 from app.qualification_result_versions where event_id=eid)
 then raise exception'synthetic_mixed_fixture_not_idle';end if;
 if exists(select 1 from app.canonical_games where event_id=eid group by least(side_a_participant_id,side_b_participant_id),greatest(side_a_participant_id,side_b_participant_id)having count(*)>1)
 or exists(select 1 from app.event_participants p left join app.canonical_games g on g.event_id=eid and p.id in(g.side_a_participant_id,g.side_b_participant_id)where p.event_id=eid group by p.id having count(g.id)<>12)
 then raise exception'synthetic_mixed_schedule_invalid';end if;
 insert into app.synthetic_mixed_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference,source_snapshot,source_sha256)
 values(eid,tid,project,authorization_ref,snap,encode(extensions.digest(snap::text,'sha256'),'hex'));
 for v_fixture_game in select c.*,a.scorecard_type am,b.scorecard_type bm,pa.profile_id ap,pb.profile_id bp from app.canonical_games c
 join app.event_participants pa on pa.id=c.side_a_participant_id join app.tournament_roster_entries a on a.id=pa.roster_entry_id
 join app.event_participants pb on pb.id=c.side_b_participant_id join app.tournament_roster_entries b on b.id=pb.roster_entry_id where c.event_id=eid loop
 insert into app.synthetic_mixed_games_v1(game_id,event_id,tournament_id,pairing,side_a_participant_id,side_b_participant_id,digital_participant_id,digital_profile_id,base_game_version)
 values(v_fixture_game.id,eid,tid,case when v_fixture_game.am='digital'and v_fixture_game.bm='digital'then'DD'when v_fixture_game.am='paper'and v_fixture_game.bm='paper'then'PP'else'PD'end,
 v_fixture_game.side_a_participant_id,v_fixture_game.side_b_participant_id,case when v_fixture_game.am<>v_fixture_game.bm then case when v_fixture_game.am='digital'then v_fixture_game.side_a_participant_id else v_fixture_game.side_b_participant_id end end,
 case when v_fixture_game.am<>v_fixture_game.bm then case when v_fixture_game.am='digital'then v_fixture_game.ap else v_fixture_game.bp end end,v_fixture_game.version);
 end loop;
end$$;

create function app.prepare_synthetic_mixed_artifact_v1(gid uuid,winner text,spread integer)returns uuid language plpgsql security definer set search_path=''as $$
declare m app.synthetic_mixed_games_v1%rowtype;g app.canonical_games%rowtype;aid uuid;
begin
 select * into m from app.synthetic_mixed_games_v1 where game_id=gid;
 perform 1 from app.tournaments where id=m.tournament_id for update;perform 1 from app.events where id=m.event_id for update;
 select * into g from app.canonical_games where id=gid for update;
 perform app.assert_synthetic_mixed_current_v1(m.tournament_id,m.event_id);
 if m.pairing not in('PP','PD')or g.state<>'pending'or g.version<>m.base_game_version
 or exists(select 1 from app.score_submissions where canonical_game_id=gid)or exists(select 1 from app.card_scorelines where canonical_game_id=gid)
 then raise exception'synthetic_mixed_artifact_unavailable';end if;
 insert into app.synthetic_mixed_artifacts_v1(game_id,event_id,tournament_id,winner_side,margin,artifact_text)
 values(gid,m.event_id,m.tournament_id,winner,spread,jsonb_build_object('schema','synthetic-mixed-paper-v1','tournamentId',m.tournament_id,'eventId',m.event_id,
 'gameId',gid,'pairing',m.pairing,'sideA',m.side_a_participant_id,'sideB',m.side_b_participant_id,'digitalParticipantId',m.digital_participant_id,
 'winnerSide',winner,'spreadPoints',spread,'physicalOriginal',false,'fictionalOpponentPlayed',false,'independentHumanPlayClaimed',false)::text)returning id into aid;
 return aid;
end$$;
create function app.synthetic_mixed_claim_valid_v1(a app.synthetic_mixed_artifacts_v1,claim jsonb,side text)returns boolean language sql immutable set search_path=''as $$
 select coalesce(jsonb_typeof(claim)='object'and claim-'winnerSide'-'margin'-'evidenceReference'='{}'::jsonb and claim->>'winnerSide'=a.winner_side
 and claim->>'margin'=a.margin::text and claim->>'evidenceReference'='SYNTHETIC-MIXED-v1:'||a.id||':'||side||':'||a.sha256,false)
$$;

-- Own-player confirmation is a separate, plainly synthetic-opponent sidecar.
-- It cannot manufacture the absent opponent's submission or ordinary confirm.
create function public.attest_synthetic_mixed_hybrid_v1(p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();a app.synthetic_mixed_artifacts_v1%rowtype;m app.synthetic_mixed_games_v1%rowtype;s app.score_submissions%rowtype;
 g app.canonical_games%rowtype;r app.operation_receipts%rowtype;h text;response jsonb;aid uuid;receipt uuid;
begin
 if actor is null or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'authenticated'
 or p_operation_id is null or jsonb_typeof(p_request)is distinct from'object'or p_request-'gameId'-'artifactId'-'expectedGameVersion'-'digitalSubmissionId'-'confirmed'<>'{}'::jsonb
 or not(p_request?&array['gameId','artifactId','expectedGameVersion','digitalSubmissionId','confirmed'])
 or jsonb_typeof(p_request->'expectedGameVersion')is distinct from'number'or(p_request->>'expectedGameVersion')!~'^[1-9][0-9]*$'
 or jsonb_typeof(p_request->'gameId')is distinct from'string'or jsonb_typeof(p_request->'artifactId')is distinct from'string'or jsonb_typeof(p_request->'digitalSubmissionId')is distinct from'string'
 or p_request->'confirmed'is distinct from'true'::jsonb then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 select * into a from app.synthetic_mixed_artifacts_v1 where id=(p_request->>'artifactId')::uuid and game_id=(p_request->>'gameId')::uuid and tournament_id=p_tournament_id and event_id=p_event_id;
 select * into m from app.synthetic_mixed_games_v1 where game_id=a.game_id and pairing='PD'and digital_profile_id=actor;
 if m.game_id is null or not exists(select 1 from app.event_participants where id=m.digital_participant_id and profile_id=actor and status='checked_in')then return jsonb_build_object('status','rejected','code','own_submission_required');end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_operation_id,0));
 h:=encode(extensions.digest(jsonb_build_array('attest_synthetic_mixed_hybrid_v1',p_tournament_id,p_event_id,p_request)::text,'sha256'),'hex');
 select * into r from app.operation_receipts where actor_profile_id=actor and client_operation_id=p_operation_id;
 if found then if r.operation_type='attest_synthetic_mixed_hybrid_v1'and r.target_id=a.id and r.request_hash=h then return r.response_payload;end if;
 return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 perform 1 from app.tournaments where id=p_tournament_id and status='open'for update;
 if not found then return jsonb_build_object('status','rejected','code','own_submission_required');end if;
 perform 1 from app.events where id=p_event_id for update;
 select * into g from app.canonical_games where id=m.game_id for update;
 perform app.assert_synthetic_mixed_current_v1(p_tournament_id,p_event_id);
 select * into s from app.score_submissions where id=(p_request->>'digitalSubmissionId')::uuid and canonical_game_id=g.id and submitter_participant_id=m.digital_participant_id and source_method='digital';
 if s.id is null or g.state<>'submitted'or g.version is distinct from(p_request->>'expectedGameVersion')::integer or g.version<>m.base_game_version+1
 or not exists(select 1 from app.event_play_starts where event_id=p_event_id and tournament_id=p_tournament_id)
 or app.participant_game_progression_v1(g.id,m.digital_participant_id)is distinct from'current'
 or s.winner_side<>a.winner_side or s.margin<>a.margin or(select count(*)from app.score_submissions where canonical_game_id=g.id)<>1
 or exists(select 1 from app.synthetic_mixed_attestations_v1 where artifact_id=a.id)then return jsonb_build_object('status','rejected','code','own_submission_required');end if;
 aid:=extensions.gen_random_uuid();response:=jsonb_build_object('status','synthetic_opponent_acknowledged','attestationId',aid,'artifactId',a.id,'gameId',g.id,'digitalSubmissionId',s.id,'gameVersion',g.version,'authoritative',false);
 insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(p_tournament_id,actor,'attest_synthetic_mixed_hybrid_v1',a.id,h,p_operation_id,'accepted',response,now())returning id into receipt;
 insert into app.synthetic_mixed_attestations_v1(id,artifact_id,game_id,event_id,tournament_id,digital_submission_id,actor_id,expected_game_version,operation_receipt_id,acknowledged_synthetic_opponent)
 values(aid,a.id,g.id,p_event_id,p_tournament_id,s.id,actor,g.version,receipt,true);
 insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(p_tournament_id,actor,g.id,receipt,'synthetic_mixed_attestation',aid,'own_entry_synthetic_opponent_acknowledged',response);
 return response;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');
end$$;

create function app.synthetic_mixed_dispatch_v1(actor uuid,tid uuid,eid uuid,request jsonb,operation uuid,pair text,phase_value text)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a app.synthetic_mixed_artifacts_v1%rowtype;m app.synthetic_mixed_games_v1%rowtype;ctx uuid;prior text;result jsonb;receipt app.operation_receipts%rowtype;rh text;
 binding app.synthetic_mixed_requests_v1%rowtype;native_operation text;accepted boolean;
 target uuid;expected integer;paper_side text;keys text[];
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null or operation is null then return null;end if;
 keys:=case when pair='PP'and phase_value='capture'then array['gameId','completionId','artifactId','expectedGameVersion','sideAClaim','sideBClaim']
 when pair='PP'then array['completionId','artifactId','expectedGameVersion','sideAClaim','sideBClaim','decision']
 when phase_value='capture'then array['gameId','caseId','artifactId','expectedGameVersion','digitalSubmissionId','paperClaim']
 else array['caseId','artifactId','expectedGameVersion','digitalSubmissionId','digitalWinnerSide','digitalMargin','paperClaim','decision']end;
 if jsonb_typeof(request)is distinct from'object'or request-keys<>'{}'::jsonb or not(request?&keys)
 or jsonb_typeof(request->'expectedGameVersion')is distinct from'number'or(request->>'expectedGameVersion')!~'^[1-9][0-9]*$'
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 select * into a from app.synthetic_mixed_artifacts_v1 where id=(request->>'artifactId')::uuid and tournament_id=tid and event_id=eid;
 select * into m from app.synthetic_mixed_games_v1 where game_id=a.game_id and pairing=pair;
 target:=coalesce(request->>'completionId',request->>'caseId')::uuid;expected:=(request->>'expectedGameVersion')::integer;
 if m.game_id is null or target is null or expected is distinct from(m.base_game_version+case when pair='PD'then 1 else 0 end)
 or(phase_value='capture'and(request->>'gameId')::uuid is distinct from m.game_id)
 or(phase_value='review'and request->>'decision'not in('approve','reject'))then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 paper_side:=case when m.digital_participant_id=m.side_a_participant_id then'b'else'a'end;
 if(pair='PP'and(not app.synthetic_mixed_claim_valid_v1(a,request->'sideAClaim','a')or not app.synthetic_mixed_claim_valid_v1(a,request->'sideBClaim','b')))
 or(pair='PD'and not app.synthetic_mixed_claim_valid_v1(a,request->'paperClaim',paper_side))then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||operation,0));
 perform 1 from app.tournaments where id=tid for update;
 perform pg_advisory_xact_lock(hashtextextended('paper-official:'||tid||':'||actor,0));
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and(role='cross_checker'or pair='PP'or phase_value='review')and role in('director','co_director','cross_checker'))
 or not app.paper_official_identity_is_current_valid(actor,tid)or not app.paper_official_is_independent(actor,tid,m.game_id)
 then return jsonb_build_object('status','rejected','code','official_unavailable');end if;
 rh:=encode(extensions.digest(request::text,'sha256'),'hex');
 select * into binding from app.synthetic_mixed_requests_v1 where actor_id=actor and operation_id=operation;
 if found then
 if exists(select 1 from app.synthetic_mixed_contexts_v1 c join app.synthetic_mixed_artifacts_v1 old_a on old_a.id=c.artifact_id
 where c.id=binding.context_id and c.artifact_id=a.id and old_a.event_id=eid and old_a.tournament_id=tid and c.phase=phase_value and c.request_hash=rh and c.target_id=target)
 then return binding.response;end if;
 return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select * into receipt from app.operation_receipts where actor_profile_id=actor and client_operation_id=operation;
 if found then
 return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 perform 1 from app.events where id=eid for update;perform 1 from app.canonical_games where id=m.game_id for update;
 perform app.assert_synthetic_mixed_current_v1(tid,eid);
 if phase_value='review'and pair='PP'and not exists(select 1 from app.paper_game_completions where id=target and canonical_game_id=m.game_id and tournament_id=tid and event_id=eid)
 or phase_value='review'and pair='PD'and not exists(select 1 from app.hybrid_game_cases where id=target and canonical_game_id=m.game_id and tournament_id=tid and event_id=eid)
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if pair='PD'and not exists(select 1 from app.synthetic_mixed_attestations_v1 t where t.artifact_id=a.id and t.game_id=m.game_id
 and t.digital_submission_id=(request->>'digitalSubmissionId')::uuid and t.actor_id=m.digital_profile_id and t.expected_game_version=expected)
 then return jsonb_build_object('status','rejected','code','synthetic_player_attestation_required');end if;
 insert into app.synthetic_mixed_contexts_v1(artifact_id,actor_id,operation_id,target_id,phase,request_hash,backend_pid,transaction_id)
 values(a.id,actor,operation,target,phase_value,rh,pg_backend_pid(),txid_current())returning id into ctx;
 prior:=current_setting('app.synthetic_mixed_context',true);perform set_config('app.synthetic_mixed_context',ctx::text,true);
 if pair='PP'and phase_value='capture'then result:=public.complete_paper_vs_paper_game_v1(actor,tid,eid,m.game_id,target,expected,request->'sideAClaim',request->'sideBClaim',operation);
 elsif pair='PP'then result:=public.review_paper_vs_paper_game_v1(actor,target,expected,request->'sideAClaim',request->'sideBClaim',request->>'decision',operation);
 elsif phase_value='capture'then result:=public.create_hybrid_digital_paper_case_v1(actor,tid,eid,m.game_id,target,expected,(request->>'digitalSubmissionId')::uuid,request->'paperClaim',operation);
 else result:=public.review_hybrid_digital_paper_case_v1(actor,target,expected,(request->>'digitalSubmissionId')::uuid,request->>'digitalWinnerSide',(request->>'digitalMargin')::integer,request->'paperClaim',request->>'decision',operation);end if;
 perform set_config('app.synthetic_mixed_context',coalesce(prior,''),true);
 native_operation:=case when pair='PP'and phase_value='capture'then'complete_paper_vs_paper_game_v1'when pair='PP'then'review_paper_vs_paper_game_v1'when phase_value='capture'then'create_hybrid_digital_paper_case_v1'else'review_hybrid_digital_paper_case_v1'end;
 select * into receipt from app.operation_receipts where actor_profile_id=actor and client_operation_id=operation;
 accepted:=result->>'status'='pending_review'or result?'decision';
 if accepted and(receipt.id is null or receipt.tournament_id<>tid or receipt.target_id<>target or receipt.outcome<>'accepted'or receipt.response_payload is distinct from result or receipt.operation_type<>native_operation)
 then raise exception'synthetic_mixed_native_receipt_mismatch';end if;
 if receipt.id is not null and(receipt.tournament_id<>tid or receipt.target_id<>target or receipt.response_payload is distinct from result or receipt.operation_type<>native_operation)
 then raise exception'synthetic_mixed_native_receipt_mismatch';end if;
 insert into app.synthetic_mixed_requests_v1(actor_id,operation_id,context_id,native_receipt_id,response)values(actor,operation,ctx,receipt.id,result);
 if accepted then
 insert into app.synthetic_mixed_provenance_v1(operation_receipt_id,tournament_id,event_id,game_id,artifact_id,context_id,actor_id,phase,pairing)
 values(receipt.id,tid,eid,m.game_id,a.id,ctx,actor,phase_value,pair);
 insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(tid,actor,m.game_id,receipt.id,'synthetic_mixed_provenance',target,'synthetic_mixed_'||phase_value,jsonb_build_object('artifactId',a.id,'pairing',pair,'physicalOriginal',false,'fictionalOpponentPlayed',false,'independentHumanPlayClaimed',false));end if;
 return result;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');
end$$;
create function public.capture_synthetic_mixed_paper_v1(actor uuid,tid uuid,eid uuid,request jsonb,operation uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_dispatch_v1(actor,tid,eid,request,operation,'PP','capture')$$;
create function public.review_synthetic_mixed_paper_v1(actor uuid,tid uuid,eid uuid,request jsonb,operation uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_dispatch_v1(actor,tid,eid,request,operation,'PP','review')$$;
create function public.capture_synthetic_mixed_hybrid_v1(actor uuid,tid uuid,eid uuid,request jsonb,operation uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_dispatch_v1(actor,tid,eid,request,operation,'PD','capture')$$;
create function public.review_synthetic_mixed_hybrid_v1(actor uuid,tid uuid,eid uuid,request jsonb,operation uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_dispatch_v1(actor,tid,eid,request,operation,'PD','review')$$;

create function public.get_synthetic_mixed_workspace_v1(actor uuid,tid uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'
 or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director','cross_checker'))then return null;end if;
 if not exists(select 1 from app.synthetic_mixed_fixtures_v1 where tournament_id=tid)then return null;end if;
 return jsonb_build_object('kind','synthetic-mixed-workspace-v1','tournamentId',tid,'notice','Fictional paper evidence; no physical original or independent human play claimed.',
 'fixtures',(select jsonb_agg(jsonb_build_object('eventId',event_id,'sourceSha256',source_sha256)order by event_id)from app.synthetic_mixed_fixtures_v1 where tournament_id=tid),
 'artifacts',(select coalesce(jsonb_agg(jsonb_build_object('artifactId',a.id,'gameId',a.game_id,'eventId',a.event_id,'pairing',m.pairing,
 'expectedGameVersion',m.base_game_version+case when m.pairing='PD'then 1 else 0 end,'text',a.artifact_text,'sha256',a.sha256,
 'sideAReference','SYNTHETIC-MIXED-v1:'||a.id||':a:'||a.sha256,'sideBReference','SYNTHETIC-MIXED-v1:'||a.id||':b:'||a.sha256,
 'playerAttested',exists(select 1 from app.synthetic_mixed_attestations_v1 where artifact_id=a.id))order by a.game_id),'[]')from app.synthetic_mixed_artifacts_v1 a join app.synthetic_mixed_games_v1 m on m.game_id=a.game_id where a.tournament_id=tid));
end$$;

create function public.get_own_synthetic_mixed_hybrid_v1(tid uuid,eid uuid,gid uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare m app.synthetic_mixed_games_v1%rowtype;a app.synthetic_mixed_artifacts_v1%rowtype;s app.score_submissions%rowtype;g app.canonical_games%rowtype;
begin
 if auth.uid()is null or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'authenticated'then return null;end if;
 select * into m from app.synthetic_mixed_games_v1 where game_id=gid and event_id=eid and tournament_id=tid and pairing='PD'and digital_profile_id=auth.uid();
 if m.game_id is null or not exists(select 1 from app.event_participants where id=m.digital_participant_id and profile_id=auth.uid()and status='checked_in')then return null;end if;
 select * into a from app.synthetic_mixed_artifacts_v1 where game_id=gid;
 if not found then return null;end if;
 select * into g from app.canonical_games where id=gid;
 select * into s from app.score_submissions where canonical_game_id=gid and submitter_participant_id=m.digital_participant_id and source_method='digital';
 return jsonb_build_object('kind','own-synthetic-mixed-hybrid-v1','gameId',gid,'eventId',eid,'tournamentId',tid,'artifactId',a.id,'gameVersion',g.version,
 'notice','Your opponent is fictional. Acknowledge only your own entry; this is not independent human play.',
 'scriptedWinnerSide',a.winner_side,'scriptedSpreadPoints',a.margin,'digitalSubmissionId',s.id,'digitalWinnerSide',s.winner_side,'digitalMargin',s.margin,
 'acknowledged',exists(select 1 from app.synthetic_mixed_attestations_v1 where artifact_id=a.id and actor_id=auth.uid()),'authoritative',false);
end$$;

create function app.guard_synthetic_mixed_write_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare m app.synthetic_mixed_games_v1%rowtype;a app.synthetic_mixed_artifacts_v1%rowtype;c app.synthetic_mixed_contexts_v1%rowtype;gid uuid;j jsonb:=to_jsonb(new);
begin
 gid:=case when tg_table_name='canonical_games'then(j->>'id')::uuid else(j->>'canonical_game_id')::uuid end;
 select * into m from app.synthetic_mixed_games_v1 where game_id=gid;
 if not found then return new;end if;
 perform app.assert_synthetic_mixed_current_v1(m.tournament_id,m.event_id);
 if m.pairing='DD'then
 if tg_table_name not in('score_submissions','score_confirmations','card_scorelines','canonical_games')then raise exception'synthetic_mixed_digital_protocol_required';end if;
 if(tg_table_name='card_scorelines'or(tg_table_name='canonical_games'and j->>'state'='verified'))and
 ((select count(*)from app.score_submissions where canonical_game_id=gid and source_method='digital')<>2
 or(select count(*)from app.score_confirmations where canonical_game_id=gid)<>2)then raise exception'synthetic_mixed_digital_protocol_required';end if;
 return new;end if;
 if tg_table_name='score_submissions'and m.pairing='PD'then
 if(j->>'submitter_participant_id')::uuid=m.digital_participant_id and j->>'source_method'='digital'then return new;end if;
 raise exception'synthetic_mixed_own_submission_required';end if;
 if tg_table_name='canonical_games'and m.pairing='PD'and to_jsonb(old)->>'state'='pending'and j->>'state'='submitted'and(j->>'version')::integer=(to_jsonb(old)->>'version')::integer+1
 and j->>'winner_side'is null and j->>'margin'is null and exists(select 1 from app.score_submissions where canonical_game_id=gid and submitter_participant_id=m.digital_participant_id and source_method='digital')then return new;end if;
 if tg_table_name in('score_confirmations','device_failure_recoveries','game_corrections','independent_card_corrections','independent_card_correction_projections')then raise exception'synthetic_mixed_evidence_required';end if;
 select * into c from app.synthetic_mixed_contexts_v1 where id=nullif(current_setting('app.synthetic_mixed_context',true),'')::uuid and backend_pid=pg_backend_pid()and transaction_id=txid_current();
 select * into a from app.synthetic_mixed_artifacts_v1 where id=c.artifact_id and game_id=gid;
 if a.id is null then raise exception'synthetic_mixed_evidence_required';end if;
 if j?'operation_receipt_id'and not exists(select 1 from app.operation_receipts r where r.id=(j->>'operation_receipt_id')::uuid
 and r.actor_profile_id=c.actor_id and r.client_operation_id=c.operation_id and r.target_id=c.target_id and r.tournament_id=m.tournament_id)
 then raise exception'synthetic_mixed_context_mismatch';end if;
 if tg_table_name='paper_game_completions'and(m.pairing<>'PP'or c.phase<>'capture'or(j->>'id')::uuid<>c.target_id or(j->>'cross_checker_profile_id')::uuid<>c.actor_id or j->>'winner_side'<>a.winner_side or(j->>'margin')::integer<>a.margin)
 or tg_table_name='paper_game_completion_reviews'and(m.pairing<>'PP'or c.phase<>'review'or(j->>'completion_id')::uuid<>c.target_id or(j->>'reviewer_profile_id')::uuid<>c.actor_id)
 or tg_table_name='hybrid_game_cases'and(m.pairing<>'PD'or c.phase<>'capture'or(j->>'id')::uuid<>c.target_id or(j->>'first_official_profile_id')::uuid<>c.actor_id or j->>'winner_side'<>a.winner_side or(j->>'margin')::integer<>a.margin)
 or tg_table_name='hybrid_game_reviews'and(m.pairing<>'PD'or c.phase<>'review'or(j->>'hybrid_case_id')::uuid<>c.target_id or(j->>'reviewer_profile_id')::uuid<>c.actor_id)
 then raise exception'synthetic_mixed_context_mismatch';end if;
 return new;
end$$;
do $$declare t text;begin
 foreach t in array array['score_submissions','score_confirmations','paper_game_completions','paper_game_completion_reviews','hybrid_game_cases','hybrid_game_reviews','card_scorelines','device_failure_recoveries','game_corrections','independent_card_corrections','independent_card_correction_projections']loop
 execute format('create trigger %I before insert on app.%I for each row execute function app.guard_synthetic_mixed_write_v1()','aaa_synthetic_mixed_'||t,t);end loop;
end$$;
create trigger synthetic_mixed_canonical_v1 before update on app.canonical_games for each row when((old.state,old.version,old.winner_side,old.margin)is distinct from(new.state,new.version,new.winner_side,new.margin))execute function app.guard_synthetic_mixed_write_v1();

-- Qualification/playoff/financial dispatch has not been made mixed-provenance
-- aware. Block it rather than incorrectly treating the mock as genuine play.
create function app.block_unreviewed_mixed_closure_v1()returns trigger language plpgsql security definer set search_path=''as $$
begin
 if exists(select 1 from app.synthetic_mixed_fixtures_v1 f where f.tournament_id=new.tournament_id
 and(tg_table_name not in('qualification_result_versions','standard_singles_playoff_result_versions','playoff_outcome_versions_v3','playoff_outcome_versions_v4','consolation_playoff_outcome_versions_v1')
 or f.event_id=(to_jsonb(new)->>'event_id')::uuid))then raise exception'synthetic_mixed_closure_not_supported';end if;
 return new;
end$$;
do $$declare t text;begin
 foreach t in array array['qualification_result_versions','standard_singles_playoff_result_versions','playoff_outcome_versions_v3','playoff_outcome_versions_v4',
 'consolation_playoff_outcome_versions_v1','roster_payment_events','standard_singles_settlement_awards','q_accounting_drafts_v6','q_accounting_finals_v6',
 'no_q_accounting_drafts_v7','no_q_accounting_finals_v7','prize_accounting_drafts_v8','prize_accounting_finals_v8','prize_accounting_drafts_v9','prize_accounting_finals_v9',
 'tournament_expense_events','multi_event_pool_receipts_v1','multi_event_unpaid_drafts_v1','multi_event_unpaid_finals_v1','multi_event_joint_finals_v1','synthetic_event_crosscheck_closures_v1']loop
 execute format('create trigger %I before insert on app.%I for each row execute function app.block_unreviewed_mixed_closure_v1()','aaa_mixed_block_'||t,t);end loop;
end$$;

do $$declare t text;p record;begin
 foreach t in array array['synthetic_mixed_deployments_v1','synthetic_mixed_fixtures_v1','synthetic_mixed_games_v1','synthetic_mixed_artifacts_v1','synthetic_mixed_attestations_v1','synthetic_mixed_contexts_v1','synthetic_mixed_provenance_v1','synthetic_mixed_requests_v1']loop
 execute format('alter table app.%I enable row level security',t);execute format('alter table app.%I force row level security',t);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',t||'_immutable',t);end loop;
 for p in select routine.oid::regprocedure signature from pg_proc routine join pg_namespace n on n.oid=routine.pronamespace where n.nspname='app'and(routine.proname like'%synthetic_mixed%'or routine.proname='block_unreviewed_mixed_closure_v1')loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',p.signature);end loop;
end$$;
revoke all on function public.attest_synthetic_mixed_hybrid_v1(uuid,uuid,jsonb,uuid)from public,anon,service_role;
grant execute on function public.attest_synthetic_mixed_hybrid_v1(uuid,uuid,jsonb,uuid)to authenticated;
revoke all on function public.capture_synthetic_mixed_paper_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
revoke all on function public.review_synthetic_mixed_paper_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
revoke all on function public.capture_synthetic_mixed_hybrid_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
revoke all on function public.review_synthetic_mixed_hybrid_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.capture_synthetic_mixed_paper_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;
grant execute on function public.review_synthetic_mixed_paper_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;
grant execute on function public.capture_synthetic_mixed_hybrid_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;
grant execute on function public.review_synthetic_mixed_hybrid_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;
revoke all on function public.get_synthetic_mixed_workspace_v1(uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_synthetic_mixed_workspace_v1(uuid,uuid)to service_role;
revoke all on function public.get_own_synthetic_mixed_hybrid_v1(uuid,uuid,uuid)from public,anon,service_role;
grant execute on function public.get_own_synthetic_mixed_hybrid_v1(uuid,uuid,uuid)to authenticated;
commit;
