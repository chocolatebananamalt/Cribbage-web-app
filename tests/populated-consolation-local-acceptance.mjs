// Fictional local-only ordinary DIGITAL protocol test. Not physical attendance/play.
// Main receipts remain allocated to Main: this test does not claim funded Consolation.
import assert from 'node:assert/strict';
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
export async function verifyPopulatedConsolation({q,read,actorId,tournamentId,nextOperationId,writeEvidence=()=>{},afterEnrollment=()=>{}}){
 const owner=(sql,who=actorId)=>read(sql,who,'ownerAuthenticated');
 const service=sql=>owner(`set request.jwt.claim.role='service_role';set request.jwt.claim.sub='${actorId}';set request.jwt.claims='{"role":"service_role","sub":"${actorId}"}';${sql}`);
 const eventId=owner(`select to_jsonb(b.event_id)from app.event_settings_operational_bindings_v1 b join app.events e on e.id=b.event_id where b.tournament_id='${tournamentId}'and e.event_type='consolation';`);
 assert.ok(eventId);
 const gate=owner(`select to_jsonb(pg_get_functiondef('app.linked_consy_native_losses_enabled_v1()'::regprocedure));`);
 const operationalGate=owner(`select to_jsonb(pg_get_functiondef('app.event_settings_operational_activation_enabled_v1()'::regprocedure));`);
 try{
 q(`create or replace function app.event_settings_operational_activation_enabled_v1()returns boolean language sql immutable set search_path=''as $$select true$$;alter function app.event_settings_operational_activation_enabled_v1()owner to postgres;revoke all on function app.event_settings_operational_activation_enabled_v1()from public,anon,authenticated,service_role;`);
 q(`create or replace function app.linked_consy_native_losses_enabled_v1()returns boolean language sql immutable set search_path=''as $$select true$$;alter function app.linked_consy_native_losses_enabled_v1()owner to postgres;revoke all on function app.linked_consy_native_losses_enabled_v1()from public,anon,authenticated,service_role;`);
 const mainId=owner(`select to_jsonb(app.linked_consolation_main_event_v1('${tournamentId}','${eventId}'));`);
 const eligibility=owner(`select jsonb_agg(jsonb_build_object('rosterId',p.roster_entry_id,'verificationId',p.table_seat,'decision',app.linked_consy_eligibility_v1('${tournamentId}','${eventId}',p.roster_entry_id))order by split_part(p.table_seat,'-',2)::integer)from app.event_participants p where p.tournament_id='${tournamentId}'and p.event_id='${mainId}';`);
 writeEvidence('consolation-eligibility.json',eligibility);
 const admitted=eligibility.filter(x=>x.decision.status==='eligible');
 assert.equal(admitted.length,16,JSON.stringify(eligibility));
 const expected=owner(`with latest_q as(select id from app.qualification_result_versions where tournament_id='${tournamentId}'and event_id='${mainId}'order by version desc limit 1),lost as(select r.loser_participant_id from app.playoff_series_results_v1 r join app.playoff_series_generations_v1 g on g.id=r.generation_id where r.tournament_id='${tournamentId}'and r.event_id='${mainId}'and g.qualification_id=(select id from latest_q)and g.slot between 1 and 3)select jsonb_agg(p.table_seat order by split_part(p.table_seat,'-',2)::integer)from app.event_participants p join app.qualification_result_rows qr on qr.participant_id=p.id and qr.result_version_id=(select id from latest_q)where p.event_id='${mainId}'and(qr.qualification_status<>'qualified'or p.id in(select loser_participant_id from lost));`);
 assert.deepEqual(admitted.map(x=>x.verificationId),expected);
 const native=admitted.filter(x=>x.decision.provenance==='native_digital_protocol_origin_unverified');assert.equal(native.length,3);
 for(const row of native){assert.equal(row.decision.directorDeclaredSynthetic,null);assert.equal(row.decision.nativeCapture.physicalPlayVerified,false);}
 const enrollmentOp=nextOperationId();
 const enrollment=service(`select public.enroll_roster_entries_in_event_v3('${actorId}','${tournamentId}','${eventId}',${literal(admitted.map(x=>x.rosterId))},'${enrollmentOp}');`);
 assert.equal(enrollment.status,'event_participants_enrolled',JSON.stringify(enrollment));assert.equal(enrollment.requestedCount,16);
 assert.deepEqual(service(`select public.enroll_roster_entries_in_event_v3('${actorId}','${tournamentId}','${eventId}',${literal(admitted.map(x=>x.rosterId))},'${enrollmentOp}');`),enrollment);
 await afterEnrollment({eventId,mainId,admitted});
 const binding=owner(`select jsonb_build_object('gameCount',v.game_count)from app.event_settings_operational_bindings_v1 b join app.tournament_setup_event_versions v on v.id=b.setup_event_version_id where b.event_id='${eventId}';`);assert.equal(binding.gameCount,9);
 let ring=admitted.map(x=>Number(x.verificationId.split('-')[1]));const matches=[];
 for(let round=1;round<=9;round++){for(let b=0;b<8;b++){const a=ring[b],z=ring[15-b];matches.push({gameNumber:round,sideAVerificationId:'A-'+a,sideBVerificationId:'A-'+z,sideATableSeat:'A-'+(round===1?a:b*2+1),sideBTableSeat:'A-'+(round===1?z:b*2+2)});}ring=[ring[0],ring[15],...ring.slice(1,15)];}
 assert.equal(matches.length,72);assert.equal(new Set(matches.map(x=>[x.sideAVerificationId,x.sideBVerificationId].sort().join(':'))).size,72);
 const publication=service(`select public.publish_director_reviewed_event_schedule_v1('${actorId}','${tournamentId}','${eventId}',${literal(matches)},true,'${nextOperationId()}');`);assert.equal(publication.status,'event_schedule_published',JSON.stringify(publication));
 const opened=service(`select public.open_event_check_in_window_v1('${actorId}','${tournamentId}','${eventId}','${nextOperationId()}');`);assert.equal(opened.status,'event_check_in_opened',JSON.stringify(opened));
 for(const row of admitted){const checked=service(`select public.desk_check_in_event_v1('${actorId}','${tournamentId}','${eventId}','${row.rosterId}','${nextOperationId()}');`);assert.equal(checked.status,'checked_in',JSON.stringify(checked));}
 const closed=service(`select public.close_event_check_in_window_v1('${actorId}','${tournamentId}','${eventId}','${nextOperationId()}');`);assert.equal(closed.status,'event_check_in_closed');
 const digest=owner(`select to_jsonb(app.event_participant_snapshot_digest_v1('${eventId}'));`);const startOp=nextOperationId();
 const startSql=`select public.start_event_play_v1('${actorId}','${tournamentId}','${eventId}','${publication.publicationId}','${digest}',16,9,true,'${startOp}');`;
 const started=service(startSql);writeEvidence('consolation-start.json',{enrollment,publication,started});assert.equal(started.status,'event_started',JSON.stringify(started));assert.deepEqual(service(startSql),started);
 const proof=owner(`select app.linked_consy_native_admission_proof_v1('${tournamentId}','${eventId}');`);assert.equal(proof.status,'validated_native_admissions',JSON.stringify(proof));assert.equal(proof.admissions.length,3);
 const alternate=owner(`set timezone='America/New_York';select app.linked_consy_native_admission_proof_v1('${tournamentId}','${eventId}');`);assert.deepEqual(alternate,proof);
 writeEvidence('consolation-admission-proof.json',proof);
 const frozen=owner(`do $freeze_probe$begin
  begin
   insert into app.playoff_series_generations_v1 select(jsonb_populate_record(null::app.playoff_series_generations_v1,to_jsonb(g)||jsonb_build_object('id',extensions.gen_random_uuid(),'version',g.version+1))).*from app.playoff_series_generations_v1 g where exists(select 1 from app.linked_consy_native_admission_witnesses_v1 w where w.generation_id=g.id)limit 1;
   raise exception 'freeze_probe_unexpected_success';
  exception when raise_exception then if sqlerrm<>'native_consy_consumed_result_frozen'then raise;end if;end;
 end $freeze_probe$;select app.linked_consy_native_admission_proof_v1('${tournamentId}','${eventId}');`);assert.deepEqual(frozen,proof);
  const games = owner(`select jsonb_agg(jsonb_build_object(
    'gameId',g.id,'roundNumber',r.round_number,'importRowNumber',sg.import_row_number,
    'sideAProfileId',pa.profile_id,'sideBProfileId',pb.profile_id,
    'sideASeatNumber',split_part(pa.table_seat,'-',2)::integer,
    'sideBSeatNumber',split_part(pb.table_seat,'-',2)::integer
  )order by r.round_number,sg.import_row_number)
  from app.canonical_games g
  join app.rounds r on r.id=g.round_id
  join app.event_schedule_games sg on sg.canonical_game_id=g.id
  join app.event_participants pa on pa.id=g.side_a_participant_id
  join app.event_participants pb on pb.id=g.side_b_participant_id
  where g.tournament_id='${tournamentId}'and g.event_id='${eventId}';`);
  assert.equal(games.length,72);
  const scoreCommands = [];
  for (const game of games) {
    const winnerSide = game.sideASeatNumber < game.sideBSeatNumber ? 'a' : 'b';
    const margin = 1 + Math.min(game.sideASeatNumber,game.sideBSeatNumber) + 5 * Math.max(game.sideASeatNumber,game.sideBSeatNumber);
    assert.ok(margin >= 1 && margin <= 121);
    const sideASubmissionId = nextOperationId(), sideBSubmissionId = nextOperationId();
    scoreCommands.push(
      {action:'submit',actorId:game.sideAProfileId,gameId:game.gameId,submissionId:sideASubmissionId,slot:1,winnerSide,margin,operationId:nextOperationId(),expectedStatus:'submitted'},
      {action:'submit',actorId:game.sideBProfileId,gameId:game.gameId,submissionId:sideBSubmissionId,slot:2,winnerSide,margin,operationId:nextOperationId(),expectedStatus:'confirmation_pending'},
      {action:'confirm',actorId:game.sideAProfileId,gameId:game.gameId,submissionId:sideASubmissionId,operationId:nextOperationId(),expectedStatus:'confirmation_pending'},
      {action:'confirm',actorId:game.sideBProfileId,gameId:game.gameId,submissionId:sideBSubmissionId,operationId:nextOperationId(),expectedStatus:'verified'},
    );
  }
  assert.equal(scoreCommands.length,288);
  q(`begin;set role authenticated;
    do $supported_scores$declare command jsonb;response jsonb;begin
      for command in select value from jsonb_array_elements(${literal(scoreCommands)})loop
        perform set_config('request.jwt.claim.role','authenticated',true);
        perform set_config('request.jwt.claim.sub',command->>'actorId',true);
        perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',command->>'actorId')::text,true);
        if command->>'action'='submit'then
          response:=public.submit_game_score((command->>'gameId')::uuid,(command->>'submissionId')::uuid,(command->>'slot')::smallint,command->>'winnerSide',(command->>'margin')::integer,(command->>'operationId')::uuid);
        else
          response:=public.confirm_game_score((command->>'gameId')::uuid,(command->>'submissionId')::uuid,(command->>'operationId')::uuid);
        end if;
        if response->>'status'is distinct from command->>'expectedStatus'then
          raise exception 'Synthetic supported score command failed: %',jsonb_build_object('command',command,'response',response);
        end if;
      end loop;
    end $supported_scores$;commit;`,actorId,'ownerAuthenticated');
  assert.deepEqual(owner(`select jsonb_build_object(
    'games',(select count(*)from app.canonical_games where event_id='${eventId}'),
    'verified',(select count(*)from app.canonical_games where event_id='${eventId}'and state='verified'),
    'scorelines',(select count(*)from app.card_scorelines where event_id='${eventId}'),
    'submissions',(select count(*)from app.score_submissions s join app.canonical_games g on g.id=s.canonical_game_id where g.event_id='${eventId}'),
    'confirmations',(select count(*)from app.score_confirmations c join app.canonical_games g on g.id=c.canonical_game_id where g.event_id='${eventId}')
  );`), {games:72,verified:72,scorelines:144,submissions:144,confirmations:144});

  const qualificationPreconditions = owner(`select jsonb_build_object(
    'tournamentStatus',(select status from app.tournaments where id='${tournamentId}'),
    'eventPublicationState',(select state from app.event_publication_states where tournament_id='${tournamentId}'and event_id='${eventId}'),
    'eventFormat',(select format from app.events where id='${eventId}'),
    'scoringMethod',(select scoring_method from app.events where id='${eventId}'),
    'rulesetApproved',(select rv.approved_at is not null and nullif(trim(rv.source_reference),'')is not null from app.events e join app.ruleset_versions rv on rv.id=e.ruleset_version_id where e.id='${eventId}'),
    'activationCount',(select count(*)from app.tournament_setup_activations where tournament_id='${tournamentId}'and event_id='${eventId}'),
    'scheduleCount',(select count(*)from app.event_schedule_publications where tournament_id='${tournamentId}'and event_id='${eventId}'),
    'participantCount',(select count(*)from app.event_participants where tournament_id='${tournamentId}'and event_id='${eventId}'),
    'checkedInParticipantCount',(select count(*)from app.event_participants where tournament_id='${tournamentId}'and event_id='${eventId}'and status='checked_in'),
    'canonicalGameCount',(select count(*)from app.canonical_games where tournament_id='${tournamentId}'and event_id='${eventId}'),
    'verifiedGameCount',(select count(*)from app.canonical_games where tournament_id='${tournamentId}'and event_id='${eventId}'and state='verified'),
    'effectiveScorelineCount',(select count(*)from app.current_effective_scorelines('${tournamentId}','${eventId}')),
    'qualificationCount',(select count(*)from app.qualification_result_versions where tournament_id='${tournamentId}'and event_id='${eventId}'),
    'openDisputeCount',(select count(*)from app.event_disputes d where d.tournament_id='${tournamentId}'and d.event_id='${eventId}'and app.event_dispute_is_open(d.id))
  );`);
  assert.deepEqual(qualificationPreconditions, {
    tournamentStatus:'open',eventPublicationState:'draft',eventFormat:'standard_singles',scoringMethod:'digital',rulesetApproved:true,
    activationCount:1,scheduleCount:1,participantCount:16,checkedInParticipantCount:16,canonicalGameCount:72,verifiedGameCount:72,
    effectiveScorelineCount:144,qualificationCount:0,openDisputeCount:0,
  });
  const qualificationOperation = nextOperationId();
  const qualification = service(`select public.finalize_standard_singles_qualification_v1('${actorId}','${tournamentId}','${eventId}','${qualificationOperation}');`);
  writeEvidence('qualification-finalization-attempt.json', {qualification,qualificationPreconditions});
  assert.equal(qualification.status, 'qualification_finalized', JSON.stringify({qualification,qualificationPreconditions},null,2));
  assert.deepEqual({participantCount:qualification.participantCount,qualifierCount:qualification.qualifierCount,version:qualification.version},{participantCount:16,qualifierCount:4,version:1});
  assert.deepEqual(service(`select public.finalize_standard_singles_qualification_v1('${actorId}','${tournamentId}','${eventId}','${qualificationOperation}');`), qualification);
  assert.equal(owner(`select to_jsonb(app.qualification_resolution_snapshot_current_v1('${qualification.resultVersionId}'));`), true);
  const qualificationView = service(`select public.get_standard_singles_qualification_result_v1('${actorId}','${tournamentId}','${eventId}');`);
  assert.equal(qualificationView.resultVersionId, qualification.resultVersionId);
  assert.equal(qualificationView.qualifiers.length, 4);
  assert.equal(qualificationView.participantCount, 16);
  assert.equal(qualificationView.playoffResultsAvailable, false);
  const qRows = owner(`select jsonb_agg(jsonb_build_object('participantId',participant_id,'rank',ranking_ordinal,'displayName',display_name_snapshot)order by ranking_ordinal)from app.qualification_result_rows where result_version_id='${qualification.resultVersionId}'and ranking_ordinal<=4;`);
  assert.equal(qRows.length, 4);
  assert.notEqual(qRows[2].participantId, qRows[3].participantId);


 const source=owner(`select to_jsonb(app.linked_consolation_four_qualifier_source_v2('${tournamentId}','${eventId}','${qualification.resultVersionId}'));`);assert.match(source,/^[a-f0-9]{64}$/);
 const actionEvidence=[];
  const gateSource=owner(`select app.event_settings_playoff_source_v1('${tournamentId}','${eventId}');`);
  assert.equal(gateSource.status,'source_available',JSON.stringify(gateSource));
  assert.equal(gateSource.qualificationId,qualification.resultVersionId);
  const reviewRequest={
   kind:'event-settings-playoff-gate-v1',operationId:nextOperationId(),sourceDigest:gateSource.sourceDigest,
   settingsBindingId:gateSource.settingsBindingId,reviewId:gateSource.reviewId,
   playStartId:gateSource.playStartId,schedulePublicationId:gateSource.schedulePublicationId,
   qualificationId:gateSource.qualificationId,reason:'Synthetic local native playoff rule review only',
  };
  const reviewed=owner(`select app.review_event_settings_playoffs_v1('${tournamentId}','${eventId}',${literal(reviewRequest)});`);
  assert.equal(reviewed.status,'playoff_rules_reviewed',JSON.stringify(reviewed));
  assert.deepEqual(owner(`select app.review_event_settings_playoffs_v1('${tournamentId}','${eventId}',${literal(reviewRequest)});`),{...reviewed,historicalReceipt:true,currentSourceVerified:false});
  const startRequest={kind:'event-settings-playoff-start-v1',operationId:nextOperationId(),sourceDigest:gateSource.sourceDigest,
   gateReviewId:reviewed.gateReviewId,expectedStartId:null,confirmed:true,reason:'Synthetic local native playoff start only'};
  const playoffsStarted=owner(`select app.start_event_settings_playoffs_v1('${tournamentId}','${eventId}',${literal(startRequest)});`);
  assert.equal(playoffsStarted.status,'playoff_start_recorded',JSON.stringify(playoffsStarted));
  assert.deepEqual(owner(`select app.start_event_settings_playoffs_v1('${tournamentId}','${eventId}',${literal(startRequest)});`),{...playoffsStarted,historicalReceipt:true,currentSourceVerified:false});

  const qualifierCount=owner(`select to_jsonb(qualifier_count)from app.qualification_result_versions where id='${qualification.resultVersionId}';`);
  assert.ok([4,5].includes(qualifierCount));
  const slotCount=qualifierCount===4?3:4;
  for(let slot=1;slot<=slotCount;slot++){
   const sourceBefore=owner(`select app.playoff_series_match_source_v1('${tournamentId}','${eventId}','${qualification.resultVersionId}',${slot});`);
   assert.equal(sourceBefore.status,'source_available',JSON.stringify(sourceBefore));
   assert.equal(sourceBefore.currentGenerationId,null);
   const generationRequest={kind:'playoff-series-generation-v1',operationId:nextOperationId(),qualificationId:qualification.resultVersionId,
    slot,expectedGenerationId:null,sourceDigest:sourceBefore.sourceDigest};
   const created=owner(`select app.create_playoff_series_generation_v1('${tournamentId}','${eventId}',${literal(generationRequest)});`);
   assert.equal(created.status,'series_generation_created',JSON.stringify(created));
   assert.deepEqual(owner(`select app.create_playoff_series_generation_v1('${tournamentId}','${eventId}',${literal(generationRequest)});`),{...created,historicalReceipt:true,currentSourceVerified:false});
   const matchSource=owner(`select app.playoff_series_match_source_v1('${tournamentId}','${eventId}','${qualification.resultVersionId}',${slot});`);
   assert.equal(matchSource.currentGenerationId,created.generationId);
   assert.equal(matchSource.sourceDigest,created.sourceDigest);
   const [sideAParticipantId]=matchSource.participants;
   const [sideAProfileId,sideBProfileId]=matchSource.profiles;
   let lastResponse=null;
   for(let gameNumber=1;gameNumber<=matchSource.winsRequired;gameNumber++){
    const gameId=nextOperationId();
    const common={gameId,gameNumber,generationId:created.generationId,generationVersion:created.matchVersion,
     sourceDigest:matchSource.sourceDigest,settingsBindingId:matchSource.settingsBindingId,
     reviewId:matchSource.reviewId,playoffStartId:matchSource.playoffStartId,
     parentResultPins:structuredClone(matchSource.parentResultPins)};
    const requests=[];
    const sideASubmissionId=nextOperationId(),sideBSubmissionId=nextOperationId();
    requests.push({actorId:sideAProfileId,request:{...common,operationId:nextOperationId(),action:'submit',expectedGameVersion:0,
     submissionId:sideASubmissionId,confirmationId:null,priorSubmissionId:null,winnerParticipantId:sideAParticipantId,confirmedSubmissionId:null}});
    requests.push({actorId:sideBProfileId,request:{...common,operationId:nextOperationId(),action:'submit',expectedGameVersion:1,
     submissionId:sideBSubmissionId,confirmationId:null,priorSubmissionId:null,winnerParticipantId:sideAParticipantId,confirmedSubmissionId:null}});
    requests.push({actorId:sideAProfileId,request:{...common,operationId:nextOperationId(),action:'confirm',expectedGameVersion:2,
     submissionId:null,confirmationId:nextOperationId(),priorSubmissionId:null,winnerParticipantId:null,confirmedSubmissionId:sideASubmissionId}});
    if(slot===1&&gameNumber===1){
     const amendedSubmissionId=nextOperationId();
     requests.push({actorId:sideAProfileId,request:{...common,operationId:nextOperationId(),action:'submit',expectedGameVersion:3,
      submissionId:amendedSubmissionId,confirmationId:null,priorSubmissionId:sideASubmissionId,winnerParticipantId:sideAParticipantId,confirmedSubmissionId:null}});
     requests.push({actorId:sideBProfileId,request:{...common,operationId:nextOperationId(),action:'confirm',expectedGameVersion:4,
      submissionId:null,confirmationId:nextOperationId(),priorSubmissionId:null,winnerParticipantId:null,confirmedSubmissionId:sideBSubmissionId}});
     requests.push({actorId:sideAProfileId,request:{...common,operationId:nextOperationId(),action:'confirm',expectedGameVersion:5,
      submissionId:null,confirmationId:nextOperationId(),priorSubmissionId:null,winnerParticipantId:null,confirmedSubmissionId:amendedSubmissionId}});
    }else{
     requests.push({actorId:sideBProfileId,request:{...common,operationId:nextOperationId(),action:'confirm',expectedGameVersion:3,
      submissionId:null,confirmationId:nextOperationId(),priorSubmissionId:null,winnerParticipantId:null,confirmedSubmissionId:sideBSubmissionId}});
    }
    for(let index=0;index<requests.length;index++){
     const command=requests[index];
     const response=owner(`select app.submit_playoff_series_game_action_v1('${tournamentId}','${eventId}','${qualification.resultVersionId}',${slot},${literal(command.request)});`,command.actorId);
     assert.equal(response.status,'playoff_series_game_action_saved_v1',JSON.stringify({command,response}));
     actionEvidence.push({slot,gameNumber,actorId:command.actorId,request:command.request,response});
     lastResponse=response;
     if(slot===1&&gameNumber===1&&index===4)assert.equal(response.verifiedGameId,null,'Other player confirmation must not revive amended submission');
    }
    assert.ok(lastResponse?.verifiedGameId,JSON.stringify(lastResponse));
    if(gameNumber<matchSource.winsRequired)assert.equal(lastResponse.completedResultId,null);
   }
   assert.ok(lastResponse?.completedResultId,JSON.stringify(lastResponse));
   const replayEvidence=actionEvidence.at(-1);
   const replay=owner(`select app.submit_playoff_series_game_action_v1('${tournamentId}','${eventId}','${qualification.resultVersionId}',${slot},${literal(replayEvidence.request)});`,replayEvidence.actorId);
   assert.deepEqual(replay,{...replayEvidence.response,historicalReceipt:true,currentSourceVerified:false});
   const currentResult=owner(`select app.playoff_series_current_result_v1('${tournamentId}','${eventId}','${qualification.resultVersionId}',${slot});`);
   assert.equal(currentResult.resultId,lastResponse.completedResultId);
  }


 writeEvidence('consolation-playoff-game-actions.json',actionEvidence);
 return {playoffMatches:3,eventId,startId:started.startId,qualificationId:qualification.resultVersionId,participantCount:16,gameCount:9,matches:72,qualifiers:4,nativeAdmissions:3,sourceDigest:source,physicalPlayVerified:false,fundedConsolation:false,moneyMoved:false};
 }finally{q(operationalGate);q(gate);assert.equal(owner(`select to_jsonb(app.linked_consy_native_losses_enabled_v1());`),false);}
}
