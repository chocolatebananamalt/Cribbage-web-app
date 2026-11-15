// PREPARED exact two-connection barriers; not executed by the serial runner.
// Both connections must first pass its same socket/database/container guards.
// Harness must wait for literal LOCK_HELD from A stdout, not a time delay, then
// invoke B; release A with ROLLBACK only after B returns. Never terminate peers.
export function customQDraftConcurrencyPlan({actorId,tournamentId,operationId,envelopeLiteral}){
 if(![actorId,tournamentId,operationId].every(v=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v)))throw Error('Canonical fixture IDs required');
 return [
  {name:'same-operation busy',connectionA:`begin;select pg_advisory_xact_lock(hashtextextended('${actorId}:${operationId}',0));select 'LOCK_HELD';`,connectionB:`select app.save_custom_q_setup_draft_v2('${tournamentId}',${envelopeLiteral});`,expected:{status:'retry_exact',code:'operation_busy'}},
  {name:'tournament source busy',connectionA:`begin;select id from app.tournaments where id='${tournamentId}'for update;select 'LOCK_HELD';`,connectionB:`select app.save_custom_q_setup_draft_v2('${tournamentId}',${envelopeLiteral});`,expected:{status:'retry_exact',code:'source_busy'}},
  {name:'role source busy',connectionA:`begin;select profile_id from app.tournament_roles where tournament_id='${tournamentId}'and profile_id='${actorId}'for update;select 'LOCK_HELD';`,connectionB:`select app.save_custom_q_setup_draft_v2('${tournamentId}',${envelopeLiteral});`,expected:{status:'retry_exact',code:'source_busy'}},
 ].map(plan=>({...plan,connectionARelease:'rollback;',assertAfterB:'No reservation/outcome/global receipt for this new operation; reconciliation null. After A rollback, exact original B request must succeed once and replay without extra rows.'}));
}
