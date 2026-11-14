// Injected disposable-DB helper; creates no database and is unexecuted until
// called by a reviewed runner. Genuine V2 proposal/ownership only. Fictional
// accounts drive native submit/confirm; no physical play or provider-auth claim.
import assert from 'node:assert/strict';

const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;

export async function verifyNativeOptionalPlayoffsV2({
 q,read,withHeldLock=null,actorId,outsiderId,tournamentId,eventId,qualificationId,nextOperationId,writeEvidence=()=>{},onReady=async()=>null,
}){
 for(const value of[actorId,tournamentId,eventId,qualificationId,...(outsiderId?[outsiderId]:[])])assert.match(value,/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
 const owner=(sql,who=actorId)=>read(sql,who,'ownerAuthenticated');
 const enabled=(sql,who=actorId)=>owner(`set app.fixture_native_playoff_recipient='approved-local-only';${sql}`,who);
 const recipient=()=>enabled(`set request.jwt.claim.role='service_role';select app.get_native_optional_playoff_source_v2('${actorId}','${tournamentId}','${eventId}');`);
 const financeHead=owner(`select jsonb_build_object('revisionId',id,'version',version,'qualificationResultVersionId','${qualificationId}','sourceDigest',source_digest,'basisDigest',basis_digest)from app.native_optional_finance_revisions_v2 where tournament_id='${tournamentId}'and event_id='${eventId}'order by version desc limit 1;`);
 assert.ok(financeHead?.revisionId);assert.ok(qualificationId);
 const defaultDenied=owner(`set request.jwt.claim.role='service_role';select app.get_native_optional_playoff_source_v2('${actorId}','${tournamentId}','${eventId}');`);
 assert.deepEqual(defaultDenied,{status:'blocked',code:'feature_unavailable',proposalOnly:true,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false});
 assert.equal(owner(`select to_jsonb(count(*))from app.playoff_series_results_v1 where tournament_id='${tournamentId}'and event_id='${eventId}';`),0);

 const originalOperationalGate=owner(`select to_jsonb(pg_get_functiondef('app.event_settings_operational_activation_enabled_v1()'::regprocedure));`);
 const originalRecipientGate=owner(`select to_jsonb(pg_get_functiondef('app.native_optional_playoff_source_enabled_v2()'::regprocedure));`);
 assert.match(originalOperationalGate,/select false/i);
 assert.match(originalRecipientGate,/select false/i);
 const actionEvidence=[];
 let nativeSource,callbackResult;
 try{
  q(`create or replace function app.event_settings_operational_activation_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_native_playoff_recipient',true)='approved-local-only',false)$$;
   alter function app.event_settings_operational_activation_enabled_v1()owner to postgres;
   revoke all on function app.event_settings_operational_activation_enabled_v1()from public,anon,authenticated,service_role;
   create or replace function app.native_optional_playoff_source_enabled_v2()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_native_playoff_recipient',true)='approved-local-only',false)$$;
   alter function app.native_optional_playoff_source_enabled_v2()owner to postgres;
   revoke all on function app.native_optional_playoff_source_enabled_v2()from public,anon,authenticated,service_role;`);

  const gateSource=enabled(`select app.event_settings_playoff_source_v1('${tournamentId}','${eventId}');`);
  assert.equal(gateSource.status,'source_available',JSON.stringify(gateSource));
  assert.equal(gateSource.qualificationId,financeHead.qualificationResultVersionId);
  const reviewRequest={
   kind:'event-settings-playoff-gate-v1',operationId:nextOperationId(),sourceDigest:gateSource.sourceDigest,
   settingsBindingId:gateSource.settingsBindingId,reviewId:gateSource.reviewId,
   playStartId:gateSource.playStartId,schedulePublicationId:gateSource.schedulePublicationId,
   qualificationId:gateSource.qualificationId,reason:'Synthetic local native playoff rule review only',
  };
  const reviewed=enabled(`select app.review_event_settings_playoffs_v1('${tournamentId}','${eventId}',${literal(reviewRequest)});`);
  assert.equal(reviewed.status,'playoff_rules_reviewed',JSON.stringify(reviewed));
  assert.deepEqual(enabled(`select app.review_event_settings_playoffs_v1('${tournamentId}','${eventId}',${literal(reviewRequest)});`),{...reviewed,historicalReceipt:true,currentSourceVerified:false});
  const startRequest={kind:'event-settings-playoff-start-v1',operationId:nextOperationId(),sourceDigest:gateSource.sourceDigest,
   gateReviewId:reviewed.gateReviewId,expectedStartId:null,confirmed:true,reason:'Synthetic local native playoff start only'};
  const started=enabled(`select app.start_event_settings_playoffs_v1('${tournamentId}','${eventId}',${literal(startRequest)});`);
  assert.equal(started.status,'playoff_start_recorded',JSON.stringify(started));
  assert.deepEqual(enabled(`select app.start_event_settings_playoffs_v1('${tournamentId}','${eventId}',${literal(startRequest)});`),{...started,historicalReceipt:true,currentSourceVerified:false});

  const qualifierCount=owner(`select to_jsonb(qualifier_count)from app.qualification_result_versions where id='${financeHead.qualificationResultVersionId}';`);
  assert.ok([4,5].includes(qualifierCount));
  const slotCount=qualifierCount===4?3:4;
  for(let slot=1;slot<=slotCount;slot++){
   const sourceBefore=enabled(`select app.playoff_series_match_source_v1('${tournamentId}','${eventId}','${financeHead.qualificationResultVersionId}',${slot});`);
   assert.equal(sourceBefore.status,'source_available',JSON.stringify(sourceBefore));
   assert.equal(sourceBefore.currentGenerationId,null);
   const generationRequest={kind:'playoff-series-generation-v1',operationId:nextOperationId(),qualificationId:financeHead.qualificationResultVersionId,
    slot,expectedGenerationId:null,sourceDigest:sourceBefore.sourceDigest};
   const created=enabled(`select app.create_playoff_series_generation_v1('${tournamentId}','${eventId}',${literal(generationRequest)});`);
   assert.equal(created.status,'series_generation_created',JSON.stringify(created));
   assert.deepEqual(enabled(`select app.create_playoff_series_generation_v1('${tournamentId}','${eventId}',${literal(generationRequest)});`),{...created,historicalReceipt:true,currentSourceVerified:false});
   const matchSource=enabled(`select app.playoff_series_match_source_v1('${tournamentId}','${eventId}','${financeHead.qualificationResultVersionId}',${slot});`);
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
     const response=enabled(`select app.submit_playoff_series_game_action_v1('${tournamentId}','${eventId}','${financeHead.qualificationResultVersionId}',${slot},${literal(command.request)});`,command.actorId);
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
   const replay=enabled(`select app.submit_playoff_series_game_action_v1('${tournamentId}','${eventId}','${financeHead.qualificationResultVersionId}',${slot},${literal(replayEvidence.request)});`,replayEvidence.actorId);
   assert.deepEqual(replay,{...replayEvidence.response,historicalReceipt:true,currentSourceVerified:false});
   const currentResult=enabled(`select app.playoff_series_current_result_v1('${tournamentId}','${eventId}','${financeHead.qualificationResultVersionId}',${slot});`);
   assert.equal(currentResult.resultId,lastResponse.completedResultId);
  }

  nativeSource=recipient();
  writeEvidence('native-playoff-finance-recipient-source.json',nativeSource);
  writeEvidence('native-playoff-finance-game-actions.json',{acceptedActionCount:actionEvidence.length,actions:actionEvidence});
  assert.equal(nativeSource.status,'source_available',JSON.stringify(nativeSource));
  assert.equal(nativeSource.kind,'native-optional-playoff-source-v2');
  assert.equal(nativeSource.actorId,actorId);
  assert.equal(nativeSource.proposal.revisionId,financeHead.revisionId);
  assert.deepEqual(nativeSource.expectedHead,{revisionId:financeHead.revisionId,version:financeHead.version});
  assert.equal(nativeSource.playoff.qualificationResultVersionId,financeHead.qualificationResultVersionId);
  assert.equal(nativeSource.playoff.matches.length,qualifierCount===4?3:4);
  assert.equal(nativeSource.playoff.players.length,qualifierCount);
  assert.equal(new Set(nativeSource.playoff.players.map(row=>row.tournamentPlayerId)).size,qualifierCount);
  assert.ok(nativeSource.playoff.matches.every(match=>match.result.sourceDigest===match.sourceDigest));
  assert.ok(nativeSource.playoff.matches.every(match=>match.result.completedByProfileId===match.actions.at(-1).actorId));
  assert.ok(nativeSource.playoff.matches.every(match=>match.result.operationId===match.actions.at(-1).operationId));
  assert.ok(nativeSource.playoff.matches.every(match=>match.games.length===match.result.gameCount));
  assert.ok(nativeSource.playoff.matches.every(match=>match.actions.length>=match.games.length*4));
  assert.deepEqual(recipient(),nativeSource);
  if(outsiderId)assert.deepEqual(enabled(`set request.jwt.claim.role='service_role';select app.get_native_optional_playoff_source_v2('${outsiderId}','${tournamentId}','${eventId}');`),{status:'blocked',code:'not_director'});
  if(withHeldLock)await withHeldLock(`begin;lock table app.playoff_series_game_actions_v1 in row exclusive mode;select 'LOCK_HELD';`,async()=>{
   assert.deepEqual(recipient(),{status:'retry_exact',code:'source_busy'});
  });
  callbackResult=await onReady(structuredClone(nativeSource));
 }finally{
  q(originalOperationalGate);
  q(originalRecipientGate);
  assert.equal(owner(`select to_jsonb(app.event_settings_operational_activation_enabled_v1());`),false);
  assert.equal(owner(`select to_jsonb(app.native_optional_playoff_source_enabled_v2());`),false);
  assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.event_settings_operational_activation_enabled_v1()'::regprocedure));`),originalOperationalGate);
  assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.native_optional_playoff_source_enabled_v2()'::regprocedure));`),originalRecipientGate);
 }

 const acl=owner(`select jsonb_build_object(
  'anonGetter',has_function_privilege('anon','app.get_native_optional_playoff_source_v2(uuid,uuid,uuid)','EXECUTE'),
  'authenticatedGetter',has_function_privilege('authenticated','app.get_native_optional_playoff_source_v2(uuid,uuid,uuid)','EXECUTE'),
  'serviceGetter',has_function_privilege('service_role','app.get_native_optional_playoff_source_v2(uuid,uuid,uuid)','EXECUTE'),
  'anonGate',has_function_privilege('anon','app.native_optional_playoff_source_enabled_v2()','EXECUTE'),
  'authenticatedGate',has_function_privilege('authenticated','app.native_optional_playoff_source_enabled_v2()','EXECUTE'),
  'serviceGate',has_function_privilege('service_role','app.native_optional_playoff_source_enabled_v2()','EXECUTE')
 );`);
 assert.deepEqual(acl,{anonGetter:false,authenticatedGetter:false,serviceGetter:false,anonGate:false,authenticatedGate:false,serviceGate:false});
 return{status:'passed',callbackResult,eventId,qualificationResultVersionId:financeHead.qualificationResultVersionId,
  qualifierCount:nativeSource.playoff.qualifierCount,matchCount:nativeSource.playoff.matches.length,
  verifiedGameCount:nativeSource.playoff.matches.reduce((sum,row)=>sum+row.games.length,0),
  acceptedActionCount:actionEvidence.length,sourceDigest:nativeSource.sourceDigest,
  equalBand:nativeSource.proposal.editor.overrideHistory.find(row=>row.firstPlace===3&&row.lastPlace===4),
  proposalOnly:true,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false,
  fictionalIdentities:true,independentPlayEstablished:false,hostedWrites:false};
}
