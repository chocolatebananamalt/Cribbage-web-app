// Acceptance harness only. Reads an already-started disposable fixture; never
// creates a fixture, a Start row, a sanctioning snapshot or a role.
import assert from 'node:assert/strict';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const digest = /^[a-f0-9]{64}$/;
const same = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

export function assertMixedNormalStartEvidence(value, scope) {
  for (const key of ['actor','tid','eid']) assert.match(scope[key],uuid);
  assert.equal(value.startCount,1); assert.equal(value.sanctionCount,1);
  const {start,schedule,receipt,sanction,participants,games} = value;
  assert.ok(start && schedule && receipt && sanction);
  assert.equal(start.start_source,'official');
  assert.ok(same(start.tournament_id,scope.tid) && same(start.event_id,scope.eid));
  assert.ok(same(start.started_by_profile_id,scope.actor));
  assert.ok(same(start.schedule_publication_id,schedule.id));
  assert.ok(same(schedule.tournament_id,scope.tid) && same(schedule.event_id,scope.eid));
  assert.deepEqual([start.participant_count,start.game_count,start.schedule_match_count],[18,12,108]);
  assert.deepEqual([schedule.participant_count,schedule.game_count,schedule.match_count],[18,12,108]);
  assert.match(start.participant_snapshot_digest,digest);
  assert.equal(start.participant_snapshot_digest,value.currentParticipantDigest);
  assert.ok(same(start.operation_receipt_id,receipt.id));
  assert.equal(receipt.operation_type,'start_event_play_v1');
  assert.equal(receipt.outcome,'accepted');
  assert.ok(same(receipt.actor_profile_id,scope.actor) && same(receipt.tournament_id,scope.tid));
  assert.ok(same(receipt.target_id,start.id)); assert.match(receipt.client_operation_id,uuid);
  assert.equal(value.receiptHashValid,true); assert.equal(value.matchingAuditCount,1);
  assert.deepEqual(receipt.response_payload,{status:'event_started',eventId:scope.eid,startId:start.id,
    participantCount:18,gameCount:12,scheduleMatchCount:108,playState:'in_progress'});
  assert.ok(same(sanction.event_play_start_id,start.id));
  assert.ok(same(sanction.tournament_id,scope.tid) && same(sanction.event_id,scope.eid));
  assert.equal(sanction.event_kind,'main'); assert.equal(sanction.eligible_participant_count,18);
  assert.ok(Number.isSafeInteger(sanction.rate_cents) && sanction.rate_cents >= 0);
  assert.ok(Number.isSafeInteger(sanction.total_cents));
  assert.equal(sanction.total_cents,sanction.rate_cents*18);
  assert.equal(participants.length,18); assert.equal(games.length,108);
  assert.equal(new Set(participants.map(p=>p.participantId.toLowerCase())).size,18);
  assert.equal(new Set(participants.map(p=>p.tournamentPlayerId)).size,18);
  assert.equal(participants.filter(p=>p.mode==='digital' && uuid.test(p.profileId)).length,6);
  assert.equal(participants.filter(p=>p.mode==='paper' && p.profileId===null).length,12);
  assert.ok(participants.every(p=>uuid.test(p.participantId) && p.status==='checked_in'));
  assert.equal(games.filter(g=>g.state!=='pending' || g.winnerSide!==null || g.margin!==null).length,0);
  assert.equal(value.scoreActivityCount,0);
  return {normalStartReceiptVerified:true,automaticAssessmentBound:true,participants:18,games:108,
    startId:start.id,schedulePublicationId:schedule.id,operationId:receipt.client_operation_id,
    providerVerified:false,actualHumanSessions:false,physicalMovementCertified:false};
}

export function captureMixedNormalStartEvidence(read,scope) {
  for (const key of ['actor','tid','eid']) assert.match(scope[key],uuid);
  const {actor,tid,eid}=scope;
  const value=read(`select jsonb_build_object(
    'startCount',(select count(*)from app.event_play_starts where tournament_id='${tid}'and event_id='${eid}'),
    'sanctionCount',(select count(*)from app.event_sanctioning_fee_snapshots where tournament_id='${tid}'and event_id='${eid}'),
    'start',to_jsonb(s),'schedule',to_jsonb(p),'receipt',to_jsonb(o),'sanction',to_jsonb(f),
    'currentParticipantDigest',app.event_participant_snapshot_digest_v1('${eid}'),
    'receiptHashValid',o.request_hash=encode(extensions.digest(convert_to(jsonb_build_array('start_event_play_v1','${actor}','${tid}','${eid}',s.schedule_publication_id::text,s.participant_snapshot_digest,s.participant_count,s.game_count,true)::text,'utf8'),'sha256'),'hex'),
    'matchingAuditCount',(select count(*)from app.audit_events a where a.tournament_id='${tid}'and a.actor_profile_id='${actor}'and a.operation_receipt_id=o.id and a.entity_type='event_play_start'and a.entity_id=s.id and a.action='event_play_started'and a.after_state=o.response_payload),
    'participants',(select jsonb_agg(jsonb_build_object('participantId',ep.id,'tournamentPlayerId',i.verification_id,'mode',r.scorecard_type,'profileId',ep.profile_id,'status',ep.status)order by ep.id)from app.event_participants ep join app.tournament_roster_entries r on r.id=ep.roster_entry_id and r.tournament_id=ep.tournament_id join app.initial_seating_assignments i on i.tournament_id=ep.tournament_id and i.roster_entry_id=ep.roster_entry_id where ep.tournament_id='${tid}'and ep.event_id='${eid}'),
    'games',(select jsonb_agg(jsonb_build_object('gameId',g.id,'state',g.state,'winnerSide',g.winner_side,'margin',g.margin)order by g.id)from app.canonical_games g where g.tournament_id='${tid}'and g.event_id='${eid}'),
    'scoreActivityCount',(select count(*)from app.score_submissions where event_id='${eid}')+(select count(*)from app.card_scorelines where event_id='${eid}')+(select count(*)from app.paper_game_completions where event_id='${eid}')+(select count(*)from app.hybrid_game_cases where event_id='${eid}'))
    from app.event_play_starts s join app.event_schedule_publications p on p.id=s.schedule_publication_id and p.tournament_id=s.tournament_id and p.event_id=s.event_id
    join app.operation_receipts o on o.id=s.operation_receipt_id and o.tournament_id=s.tournament_id
    join app.event_sanctioning_fee_snapshots f on f.event_play_start_id=s.id and f.tournament_id=s.tournament_id and f.event_id=s.event_id
    where s.tournament_id='${tid}'and s.event_id='${eid}';`);
  assert.ok(value,'An actual Start/receipt/automatic snapshot is required');
  const proof=assertMixedNormalStartEvidence(value,scope);
  const s=value.start;
  const replay=read(`select public.start_event_play_v1('${actor}','${tid}','${eid}','${s.schedule_publication_id}','${s.participant_snapshot_digest}',18,12,true,'${value.receipt.client_operation_id}');`);
  assert.deepEqual(replay,value.receipt.response_payload);
  const after=read(`select jsonb_build_object('starts',(select count(*)from app.event_play_starts where tournament_id='${tid}'and event_id='${eid}'),'snapshots',(select count(*)from app.event_sanctioning_fee_snapshots where tournament_id='${tid}'and event_id='${eid}'));`);
  assert.deepEqual(after,{starts:1,snapshots:1});
  return {capture:value,proof:{...proof,exactReplay:true}};
}
