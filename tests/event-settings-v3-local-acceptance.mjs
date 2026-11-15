// PREPARED / NOT RUN. No container or fixture creation. The future separately
// approved isolated runner must supply a preverified disposable DB and people.
import assert from 'node:assert/strict';
import {qSetupPrizeWorkspace} from './fixtures/q-setup-prize-workspace.mjs';
import {newEventPlayoffParametersDraftV1} from '../src/lib/playoffs/event-playoff-parameters-v1.ts';
import {isEventSettingsDraftSavedV3} from '../src/lib/api/event-settings-setup-v3.ts';
const literal=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
export async function verifyEventSettingsV3({q,read,actorId,outsiderId,tournamentId,nextOperationId,withHeldLock}){
 const owner=(sql,who=actorId)=>read(sql,who,'ownerAuthenticated'); // NOT public API acceptance.
 const base=()=>owner(`select app.get_custom_q_setup_base_v2('${tournamentId}');`).base;
 function envelope(){const b=base(),{revisionId,version,createdAt,...payload}=structuredClone(qSetupPrizeWorkspace(actorId).current);void revisionId;void version;void createdAt;for(const e of payload.events){delete e.sourceStatus;e.qPools=[];e.sidePools=[];}return{kind:'event-settings-setup-v3',setup:{kind:'setup-custom-payouts-v2',base:b,request:{expectedVersion:b.setupVersion,idempotencyKey:nextOperationId(),payload},choices:[{mainClientRowId:payload.events[0].clientRowId,consolationClientRowIds:[]}],customPayouts:[]},eventSettings:payload.events.map(e=>({eventClientRowId:e.clientRowId,mode:'configured',draft:newEventPlayoffParametersDraftV1(e.eventKind)}))};}
 const save=(e,who=actorId)=>owner(`select app.save_event_settings_draft_v3('${tournamentId}',${literal(e)});`,who);
 const reconcile=e=>owner(`select app.reconcile_event_settings_draft_v3('${tournamentId}',${literal(e)});`);
 const counts=()=>owner(`select jsonb_build_object('revisions',(select count(*)from app.tournament_setup_revisions where tournament_id='${tournamentId}'),'snapshots',(select count(*)from app.event_settings_snapshots_v3 where tournament_id='${tournamentId}'));`);
 const first=envelope(),firstBase=structuredClone(first.setup.base),accepted=save(first);assert(isEventSettingsDraftSavedV3(accepted,first,firstBase));assert.deepEqual(save(first),accepted);assert.deepEqual(reconcile(first),accepted);
 const changed=structuredClone(first);changed.eventSettings[0].draft.incrementFactorText='2';assert.equal(save(changed).code,'idempotency_conflict');assert.equal(reconcile(changed).code,'idempotency_conflict');
 assert.equal(save(envelope(),outsiderId).code,'not_director');
 const incomplete=envelope();incomplete.eventSettings[0].draft.series.final={choice:'custom',winsText:'',gamesText:''};incomplete.eventSettings[0].draft.payoutMode='top';const incompleteAck=save(incomplete);assert.equal(incompleteAck.status,'event_settings_draft_saved');assert.deepEqual(incompleteAck.envelope,incomplete);
 const carry=envelope();carry.eventSettings=carry.eventSettings.map(s=>({eventClientRowId:s.eventClientRowId,mode:'preserve_historical'}));const carried=save(carry);assert.equal(carried.status,'event_settings_draft_saved');assert.deepEqual(owner(`select effective_settings from app.event_settings_snapshots_v3 where id='${carried.settingsSnapshotId}';`),incomplete.eventSettings);
 const before=counts(),rollback=envelope();
 q(`create function app.test_fail_settings_snapshot_v3()returns trigger language plpgsql as $$begin raise exception 'injected post-core settings failure';end$$;create trigger test_fail_settings_snapshot_v3 before insert on app.event_settings_snapshots_v3 for each row execute function app.test_fail_settings_snapshot_v3();`);
 let failed=false;try{save(rollback);}catch{failed=true;}finally{q('drop trigger test_fail_settings_snapshot_v3 on app.event_settings_snapshots_v3;drop function app.test_fail_settings_snapshot_v3();');}assert(failed);assert.deepEqual(counts(),before);assert.equal(reconcile(rollback),null);assert.equal(save(rollback).status,'event_settings_draft_saved');
 for(const lock of[`select pg_advisory_xact_lock(hashtextextended('${actorId}:${nextOperationId()}',0));`,`select 1 from app.tournaments where id='${tournamentId}'for update;`,`select 1 from app.tournament_roles where tournament_id='${tournamentId}'and profile_id='${actorId}'and role='director'for update;`]){
  const e=envelope(),snapshot=counts();let sql=lock;if(sql.includes('pg_advisory'))sql=`select pg_advisory_xact_lock(hashtextextended('${actorId}:${e.setup.request.idempotencyKey}',0));`;
  await withHeldLock(`begin;${sql}select 'LOCK_HELD';`,async()=>{const r=save(e);assert.equal(r.status,'retry_exact');assert.deepEqual(counts(),snapshot);});assert.equal(save(e).status,'event_settings_draft_saved');assert.deepEqual(save(e),reconcile(e));
 }
 const empty=envelope();empty.setup.request.payload.events=[];empty.setup.choices=[];empty.eventSettings=[];const cleared=save(empty);assert.equal(cleared.status,'event_settings_draft_saved');assert.deepEqual(owner(`select effective_settings from app.event_settings_snapshots_v3 where id='${cleared.settingsSnapshotId}';`),[]);
 // Leave a configured current revision for the same approved fixture's Finance
 // draft checks. This restores only synthetic local test data after empty clear.
 const restored=save(envelope());assert.equal(restored.status,'event_settings_draft_saved');
 const setupEventVersionId=owner(`select to_jsonb(id)from app.tournament_setup_event_versions where tournament_id='${tournamentId}'and setup_revision_id='${restored.linked.result.revisionId}'order by client_row_id limit 1;`);
 return{passed:true,scope:'private owner-authenticated candidate only',provider:false,activation:false,money:false,settingsSnapshotId:restored.settingsSnapshotId,setupEventVersionId};
}
