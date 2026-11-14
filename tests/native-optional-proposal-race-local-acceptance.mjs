// Two owned local DB sessions only; caller supplies verified disposable backend.
import assert from'node:assert/strict';
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
export async function verifyNativeOptionalProposalRaceV2({q,read,withHeldLock,fixture,request,nextOperationId,checkpoint}){
 const actor=fixture.actor,tid=fixture.tournamentId,eid=fixture.eventId;
 const firstOp=nextOperationId(),secondOp=nextOperationId();
 const context=`set app.fixture_native_optional_finance='approved-local-only';set request.jwt.claim.role='service_role';set request.jwt.claim.sub='${actor}';set request.jwt.claims='{"role":"service_role","sub":"${actor}"}';`;
 const call=op=>`app.save_native_optional_finance_proposal_v2('${actor}','${tid}','${eid}','${op}',${literal(request)})`;
 const count=()=>read(`select jsonb_build_object('version',(select max(version)from app.native_optional_finance_revisions_v2 where tournament_id='${tid}'and event_id='${eid}'),'first',(select count(*)from app.native_optional_finance_operations_v2 where actor_id='${actor}'and operation_id='${firstOp}'),'second',(select count(*)from app.native_optional_finance_operations_v2 where actor_id='${actor}'and operation_id='${secondOp}'));`);
 let sameBusy,distinctBusy;
 await withHeldLock(`begin;${context}do $save$declare r jsonb;begin r:=${call(firstOp)};if r->>'status'is distinct from'optional_finance_proposal_saved_v2'then raise exception'first proposal save failed %',r;end if;end$save$;select 'LOCK_HELD';`,async()=>{
  sameBusy=read(`${context}select ${call(firstOp)};`);assert.deepEqual(sameBusy,{status:'retry_exact',code:'operation_busy'});
  distinctBusy=read(`${context}select ${call(secondOp)};`);assert.deepEqual(distinctBusy,{status:'retry_exact',code:'source_busy'});
  assert.equal(count().version,request.expectedVersion,'Uncommitted revision must be invisible to peer');
 },'commit');
 const accepted=read(`${context}select ${call(firstOp)};`);assert.equal(accepted.status,'optional_finance_proposal_saved_v2');assert.equal(accepted.version,request.expectedVersion+1);
 assert.deepEqual(read(`${context}select ${call(firstOp)};`),accepted);
 assert.deepEqual(read(`${context}select ${call(secondOp)};`),{status:'rejected',code:'stale_version'});
 assert.deepEqual(count(),{version:request.expectedVersion+1,first:1,second:0});
 // Current-role authorization is required even for exact historical replay.
 q(`begin;delete from app.tournament_roles where tournament_id='${tid}'and profile_id='${actor}'and role='director';${context}do $role$declare r jsonb;begin r:=${call(firstOp)};if r is not null then raise exception'revoked role replay returned data %',r;end if;end$role$;rollback;`);
 const result={firstOp,secondOp,accepted,sameBusy,distinctBusy,exactReplay:true,oneRevision:true,stalePeerRejected:true,revokedReplayDenied:true,counts:count(),providerVerified:false,moneyMoved:false};
 checkpoint('native_proposal_concurrency_v2',result);return result;
}
