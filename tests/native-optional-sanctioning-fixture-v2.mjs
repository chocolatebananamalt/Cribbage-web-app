// Explicit synthetic assessment fixture, not proof of the normal Start RPC.
// Matches the already disclosed raw synthetic Start and current setup rate.
import assert from'node:assert/strict';
export function prepareNativeOptionalSanctioningFixtureV2({sql,fixture,checkpoint}){
 const tid=fixture.tournamentId,eid=fixture.eventId;
 const result=JSON.parse(sql(`insert into app.event_sanctioning_fee_snapshots(tournament_id,event_id,event_play_start_id,event_kind,rate_cents,eligible_participant_count,total_cents,rate_source,rate_override_id,setup_revision_id)
 select s.tournament_id,s.event_id,s.id,e.event_type,r.rate_cents,s.participant_count,r.rate_cents*s.participant_count,r.rate_source,r.rate_override_id,r.setup_revision_id
 from app.event_play_starts s join app.events e on e.id=s.event_id and e.tournament_id=s.tournament_id cross join lateral app.current_sanctioning_fee_rate_v1(s.tournament_id,e.event_type)r
 where s.tournament_id='${tid}'and s.event_id='${eid}';
 select jsonb_build_object('snapshotId',f.id,'eventPlayStartId',f.event_play_start_id,'rateMinor',f.rate_cents,'participantCount',f.eligible_participant_count,'totalMinor',f.total_cents,'setupRevisionId',f.setup_revision_id,'syntheticAssessment',true,'normalStartRpcVerified',false)from app.event_sanctioning_fee_snapshots f where f.tournament_id='${tid}'and f.event_id='${eid}';`));
 assert.equal(result.rateMinor,300);assert.equal(result.participantCount,16);assert.equal(result.totalMinor,4800);assert.equal(result.setupRevisionId,fixture.ids.revisionId);
 checkpoint('synthetic_sanctioning_assessment_v2',result);return result;
}
