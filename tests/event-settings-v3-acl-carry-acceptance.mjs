// PREPARED ONLY. Must be called inside a separately approved disposable local
// DB after the configured V3 save. Never creates a container/database/fixture.
import assert from'node:assert/strict';
import{isSetupCustomPayoutsV2}from'../src/lib/api/custom-payout-setup-v2.ts';
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
export function verifyEventSettingsAclAndOldWriterCarryV3({q,read,actorId,tournamentId,nextOperationId}){
 const owner=sql=>read(sql,actorId,'ownerAuthenticated');
 const snapshot=owner(`select to_jsonb(s)from app.event_settings_snapshots_v3 s join app.tournament_setup_revisions r on r.id=s.setup_revision_id where s.tournament_id='${tournamentId}'order by r.version desc limit 1;`);assert(snapshot.effective_settings.some(s=>s.mode==='configured'));
 const base=owner(`select app.get_custom_q_setup_base_v2('${tournamentId}');`).base;
 // Use the accepted immutable REQUEST, not display projection timestamps with
 // added seconds, so the attempt uses the same known-valid payload bytes.
 const payload=owner(`select r.request_payload#>'{setup,request,payload}'from app.event_settings_save_reservations_v3 r join app.event_settings_snapshots_v3 s on s.actor_id=r.actor_id and s.operation_id=r.operation_id and s.tournament_id=r.tournament_id where s.id='${snapshot.id}';`);
 const raw={kind:'setup-custom-payouts-v2',base,request:{expectedVersion:base.setupVersion,idempotencyKey:nextOperationId(),payload},choices:payload.events.filter(e=>e.eventKind==='main').map(e=>({mainClientRowId:e.clientRowId,consolationClientRowIds:[]})),customPayouts:[]};
 assert(payload.events.every(e=>e.eventKind==='main'&&e.qPools.length===0&&e.sidePools.length===0),'Use the prepared configured Main-only local acceptance revision');assert.equal(isSetupCustomPayoutsV2(raw,base),true,'Old writer must pass envelope checks before testing carry guard');
 const fingerprint=()=>owner(`select jsonb_build_object('revisions',(select count(*)from app.tournament_setup_revisions where tournament_id='${tournamentId}'),'snapshots',(select jsonb_agg(to_jsonb(s)order by s.id)from app.event_settings_snapshots_v3 s where tournament_id='${tournamentId}'),'reservations',(select count(*)from app.event_settings_save_reservations_v3 where tournament_id='${tournamentId}'));`);
 const before=fingerprint();
 // The preserved old core normalizes P0001 guard errors to invalid_setup_payload.
 // Assert rejection and no revision loss, then independently prove the exact
 // trigger below without weakening/disabling it or committing a probe receipt.
 assert.deepEqual(owner(`select app.save_custom_q_setup_draft_v2('${tournamentId}',${literal(raw)});`),{status:'rejected',code:'invalid_setup_payload'});assert.deepEqual(fingerprint(),before);
 const probeOperation=nextOperationId();
 const probe=owner(`begin;create function pg_temp.probe_v3_carry()returns jsonb language plpgsql as $$declare r app.tournament_setup_revisions%rowtype;receipt uuid:=extensions.gen_random_uuid();begin
 select*into r from app.tournament_setup_revisions where tournament_id='${tournamentId}'order by version desc limit 1;
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,'${actorId}','${tournamentId}','save_tournament_setup_version','${tournamentId}',repeat('f',64),'${probeOperation}','accepted','{}',clock_timestamp());
 insert into app.tournament_setup_revisions select(jsonb_populate_record(null::app.tournament_setup_revisions,to_jsonb(r)||jsonb_build_object('id',extensions.gen_random_uuid(),'version',r.version+1,'actor_profile_id','${actorId}','operation_receipt_id',receipt))).*;
 return jsonb_build_object('status','unexpected_accept');exception when raise_exception then return jsonb_build_object('status','guard_blocked','message',sqlerrm);end$$;select pg_temp.probe_v3_carry();rollback;`);
 assert.deepEqual(probe,{status:'guard_blocked',message:'event_settings_require_versioned_save'});assert.deepEqual(fingerprint(),before);
 assert.equal(owner(`select to_jsonb((select count(*)from app.operation_receipts where actor_profile_id='${actorId}'and client_operation_id='${probeOperation}'));`),0);
 for(const role of['anon','authenticated','service_role']){
  assert.throws(()=>q(`select app.save_event_settings_draft_v3('${tournamentId}','{}');`,actorId,role),/permission denied/);
  assert.throws(()=>q(`select app.reconcile_event_settings_draft_v3('${tournamentId}','{}');`,actorId,role),/permission denied/);
  for(const table of['event_settings_save_reservations_v3','event_settings_snapshots_v3','event_settings_save_outcomes_v3'])assert.throws(()=>q(`select*from app.${table} limit 1;`,actorId,role),/permission denied/);
 }
 assert.deepEqual(fingerprint(),before);
 return{privateV3AclDenied:true,oldQWriterCarryGuardRejected:true,directCarryTriggerVerifiedInRollback:true,configuredSettingsUnchanged:true,publicProvider:false,money:false};
}
