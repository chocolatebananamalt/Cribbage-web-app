// Acceptance-only readback. This does not close play, qualify players or grant roles.
import assert from 'node:assert/strict';
import {buildMixedMockManifest} from '../src/lib/mixed-mock-plan.ts';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const idKey=p=>[p.participantId.toLowerCase(),p.tournamentPlayerId,p.mode,p.profileId?.toLowerCase()??null];

export function assertMixedQualifyingFinishEvidence(value,manifest,normalStart) {
  const checked=buildMixedMockManifest([...manifest.participants],[...manifest.matches]);
  assert.equal(checked.participants.length,18);
  assert.equal(normalStart.proof.normalStartReceiptVerified,true);
  const initial=normalStart.capture.participants;
  assert.deepEqual(value.participants.map(idKey).sort(),initial.map(idKey).sort(),
    'Participant, fixed Tournament ID, mode and account must survive qualifying');
  assert.deepEqual(checked.participants.map(p=>[p.participantId,p.tournamentPlayerId,p.mode]).sort(),
    value.participants.map(p=>[p.participantId.toLowerCase(),p.tournamentPlayerId,p.mode]).sort());
  assert.equal(value.startId,normalStart.capture.start.id);
  assert.equal(value.schedulePublicationId,normalStart.capture.schedule.id);
  assert.equal(value.games.length,108);
  const matches=new Map(checked.matches.map(g=>[g.gameId,g]));
  const people=new Map(value.participants.map(p=>[p.participantId.toLowerCase(),p]));
  const digitalActors=new Set(value.participants.filter(p=>p.mode==='digital').map(p=>p.profileId.toLowerCase()));
  assert.equal(digitalActors.size,6);
  const seenGames=new Set(),seenReceipts=new Set();
  let paperReviews=0,hybridReviews=0;
  for(const game of value.games){
    const key=game.gameId.toLowerCase(),expected=matches.get(key);
    assert.ok(expected&&!seenGames.has(key));seenGames.add(key);
    assert.ok(same(game.sideAId,expected.sideA.participantId)&&same(game.sideBId,expected.sideB.participantId));
    assert.equal(game.state,'verified');assert.equal(game.scorelines,2);
    const provenance=value.provenance.filter(p=>same(p.gameId,key));
    if(expected.pairing==='digital-digital'){
      assert.equal(provenance.length,0);assert.equal(game.submissions,2);assert.equal(game.confirmations,2);
      assert.equal(game.syntheticArtifactCount,0);
      continue;
    }
    const pair=expected.pairing==='paper-paper'?'PP':'PD';
    assert.equal(provenance.length,2);assert.equal(game.syntheticArtifactCount,1);
    const capture=provenance.find(p=>p.phase==='capture'),review=provenance.find(p=>p.phase==='review');
    assert.ok(capture&&review);assert.ok(!same(capture.actorId,review.actorId),'Capture and review require distinct accounts');
    assert.ok(same(capture.artifactId,review.artifactId));
    const ownActors=[people.get(expected.sideA.participantId).profileId,people.get(expected.sideB.participantId).profileId].filter(Boolean);
    for(const p of provenance){
      assert.equal(p.pairing,pair);assert.equal(p.receiptAccepted,true);assert.equal(p.nativeBinding,true);
      assert.ok(digitalActors.has(p.actorId.toLowerCase()),'Mock officials must be among its six digital participants');
      assert.ok(!ownActors.some(actor=>same(actor,p.actorId)),'No participant captures or reviews their own game');
      assert.equal(p.physicalOriginal,false);assert.equal(p.fictionalOpponentPlayed,false);assert.equal(p.independentHumanPlayClaimed,false);
      assert.ok(!seenReceipts.has(p.receiptId));seenReceipts.add(p.receiptId);
    }
    assert.equal(game.submissions,pair==='PD'?1:0);assert.equal(game.confirmations,0);
    if(pair==='PP')paperReviews++;else hybridReviews++;
  }
  assert.equal(value.provenance.length,(paperReviews+hybridReviews)*2);
  return {normalStartBound:true,fixedTournamentIdsRetained:true,verifiedMatches:108,scorelines:216,
    paperReviews,hybridReviews,distinctNonselfReview:true,syntheticProvenance:true,
    actualHumanSessions:false,qualificationFinalized:false,payoutsCalculated:false};
}

export function captureMixedQualifyingFinishEvidence(read,scope,manifest,normalStart){
  const {tid,eid}=scope;
  // The same exact scope was UUID-validated by the Start capture, not input from a user.
  assert.equal(normalStart.capture.start.tournament_id,tid);assert.equal(normalStart.capture.start.event_id,eid);
  const value=read(`select jsonb_build_object(
   'startId',(select id from app.event_play_starts where tournament_id='${tid}'and event_id='${eid}'),
   'schedulePublicationId',(select schedule_publication_id from app.event_play_starts where tournament_id='${tid}'and event_id='${eid}'),
   'participants',(select jsonb_agg(jsonb_build_object('participantId',ep.id,'tournamentPlayerId',i.verification_id,'mode',r.scorecard_type,'profileId',ep.profile_id)order by ep.id)from app.event_participants ep join app.tournament_roster_entries r on r.id=ep.roster_entry_id and r.tournament_id=ep.tournament_id join app.initial_seating_assignments i on i.tournament_id=ep.tournament_id and i.roster_entry_id=ep.roster_entry_id where ep.tournament_id='${tid}'and ep.event_id='${eid}'),
   'games',(select jsonb_agg(jsonb_build_object('gameId',g.id,'sideAId',g.side_a_participant_id,'sideBId',g.side_b_participant_id,'state',g.state,
    'scorelines',(select count(*)from app.card_scorelines c where c.canonical_game_id=g.id),
    'submissions',(select count(*)from app.score_submissions s where s.canonical_game_id=g.id),
    'confirmations',(select count(*)from app.score_confirmations c where c.canonical_game_id=g.id),
    'syntheticArtifactCount',(select count(*)from app.synthetic_mixed_artifacts_v1 a where a.game_id=g.id))order by g.id)from app.canonical_games g where g.tournament_id='${tid}'and g.event_id='${eid}'),
   'provenance',(select coalesce(jsonb_agg(jsonb_build_object('gameId',p.game_id,'pairing',p.pairing,'phase',p.phase,'actorId',p.actor_id,'artifactId',p.artifact_id,'receiptId',p.operation_receipt_id,'receiptAccepted',o.outcome='accepted',
    'nativeBinding',exists(select 1 from app.synthetic_mixed_contexts_v1 c join app.synthetic_mixed_requests_v1 rq on rq.context_id=c.id and rq.actor_id=c.actor_id and rq.operation_id=c.operation_id
     where c.id=p.context_id and c.actor_id=p.actor_id and c.artifact_id=p.artifact_id and c.phase=p.phase
     and o.actor_profile_id=p.actor_id and o.client_operation_id=c.operation_id and o.target_id=c.target_id
     and rq.native_receipt_id=o.id and rq.response=o.response_payload
     and o.operation_type=case when p.pairing='PP'and p.phase='capture'then'complete_paper_vs_paper_game_v1'when p.pairing='PP'then'review_paper_vs_paper_game_v1'when p.phase='capture'then'create_hybrid_digital_paper_case_v1'else'review_hybrid_digital_paper_case_v1'end
     and o.request_hash~'^[a-f0-9]{64}$'and c.request_hash~'^[a-f0-9]{64}$'
     and((p.pairing='PP'and exists(select 1 from app.paper_game_completions pc where pc.id=c.target_id and pc.canonical_game_id=p.game_id and pc.tournament_id=p.tournament_id and pc.event_id=p.event_id))
      or(p.pairing='PD'and exists(select 1 from app.hybrid_game_cases hc where hc.id=c.target_id and hc.canonical_game_id=p.game_id and hc.tournament_id=p.tournament_id and hc.event_id=p.event_id)))
     and 1=(select count(*)from app.audit_events a where a.tournament_id=p.tournament_id and a.actor_profile_id=p.actor_id and a.canonical_game_id=p.game_id and a.operation_receipt_id=o.id and a.entity_type='synthetic_mixed_provenance'and a.entity_id=c.target_id and a.action='synthetic_mixed_'||p.phase and a.after_state=jsonb_build_object('artifactId',p.artifact_id,'pairing',p.pairing,'physicalOriginal',false,'fictionalOpponentPlayed',false,'independentHumanPlayClaimed',false))),
    'physicalOriginal',p.physical_original,'fictionalOpponentPlayed',p.fictional_opponent_played,'independentHumanPlayClaimed',p.independent_human_play_claimed)order by p.game_id,p.phase),'[]'::jsonb)from app.synthetic_mixed_provenance_v1 p join app.operation_receipts o on o.id=p.operation_receipt_id and o.tournament_id=p.tournament_id where p.tournament_id='${tid}'and p.event_id='${eid}'));`);
  return {capture:value,proof:assertMixedQualifyingFinishEvidence(value,manifest,normalStart)};
}
