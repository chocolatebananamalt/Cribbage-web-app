import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{isPlayoffV4Request,isPlayoffV4Workspace,isPlayoffV4Result,playoffV4ResultMatches,isPlayoffV4Reconciliation,isPlayoffV4ReconciliationRequest}from'../src/lib/api/playoff-outcome-v4.ts';
import{workspace,recorded,receipt,request,tid,eid,id}from'./fixtures/five-playoff-workspace.mjs';
test('five-playoff workspace independently verifies real wins, separate byes, bands and published MRP',()=>{
 for(const w of[workspace,recorded])assert.equal(isPlayoffV4Workspace(w,tid,eid),true);
 const jsonbOrder=structuredClone(recorded);jsonbOrder.result.request.series=jsonbOrder.result.request.series.map(s=>({evidenceNote:s.evidenceNote,loserId:s.loserId,winnerId:s.winnerId}));assert.equal(isPlayoffV4Workspace(jsonbOrder,tid,eid),true);
 const uppercase=structuredClone(recorded);uppercase.result.request.qualificationResultVersionId=uppercase.result.request.qualificationResultVersionId.toUpperCase();assert.equal(isPlayoffV4Workspace(uppercase,tid.toUpperCase(),eid.toUpperCase()),true);
 for(const change of[w=>w.result.outcomes[0].playedMatchWins++,w=>w.result.outcomes[3].byeWins=1,w=>w.result.outcomes[4].bandStart=3,w=>w.result.outcomes[0].playoffMrp=42,w=>w.result.series.push(w.result.series[0]),w=>w.result.outcomes[0].totalMrp++,w=>w.result.request.expectedVersion=2,w=>w.result.sourceDigest='b'.repeat(64),w=>w.qualifiers[0].byeWins=0,w=>w.result.outcomes[0].moneyPaid=true]){const w=structuredClone(recorded);change(w);assert.equal(isPlayoffV4Workspace(w,tid,eid),false);}
 assert.equal(isPlayoffV4Workspace({...workspace,automaticPayment:true},tid,eid),false);assert.equal(isPlayoffV4Workspace(workspace,id(90),eid),false);
});
test('five-playoff request carries exact source, reviewed reason, four actual series and no client MRP/bye fields',()=>{
 assert.equal(isPlayoffV4Request(request),true);
 for(const change of[r=>r.series[0].byeWins=1,r=>r.series[0].evidenceNote='bad\nreference',r=>r.series.pop(),r=>r.series.push(r.series[0]),r=>r.expectedVersion=-1,r=>r.sourceDigest='x',r=>r.reason=' ',r=>r.reviewed=false,r=>r.moneyMinor=1]){const r=structuredClone(request);change(r);assert.equal(isPlayoffV4Request(r),false);}
 assert.equal(isPlayoffV4ReconciliationRequest({operationId:id(99),request}),true);assert.equal(isPlayoffV4ReconciliationRequest({operationId:id(99)}),false);
});
test('five-playoff result and reconciliation cannot clear work for another event, source, version or operation payload',()=>{
 assert.equal(isPlayoffV4Result(receipt,tid,eid),true);assert.equal(playoffV4ResultMatches(receipt,request),true);
 assert.equal(isPlayoffV4Result(receipt,tid,id(90)),false);assert.equal(playoffV4ResultMatches({...receipt,version:2},request),false);assert.equal(playoffV4ResultMatches({...receipt,sourceDigest:'b'.repeat(64)},request),false);
 assert.equal(isPlayoffV4Reconciliation({authorized:true,result:receipt},tid,eid),true);assert.equal(isPlayoffV4Reconciliation({authorized:true,result:null},tid,eid),true);
 assert.equal(isPlayoffV4Reconciliation({authorized:false,result:receipt},tid,eid),false);assert.equal(isPlayoffV4Reconciliation({authorized:true,result:{...receipt,paid:true}},tid,eid),false);
});
test('five-playoff API and recovery enforce origin, verified subject, exact request, retained identity and inactive-effect safety',()=>{
 const base='src/app/api/v1/tournaments/[id]/events/[eventId]/playoff-v4';
 for(const f of['route.ts','reconciliation/route.ts']){const source=readFileSync(`${base}/${f}`,'utf8');assert.match(source,/isSameOriginRequest/);assert.match(source,/requireVerifiedSubject/);assert.match(source,/createServerOnlyAdminClient/);assert.match(source,/readMediumJson/);assert.doesNotMatch(source,/request\.json\(\)/);}
 const reconcile=readFileSync(`${base}/reconciliation/route.ts`,'utf8');assert.match(reconcile,/p_request: body.request/);
 const client=readFileSync('src/app/tournament/[tournamentId]/events/[eventId]/playoff-v4/playoff-client.tsx','utf8');
 assert.match(client,/payment-obligation:playoff-v4/);assert.match(client,/setAppRecoveryItem/);assert.match(client,/sessionStorage.getItem\(key\) !== raw/);assert.match(client,/if \(!isActive\(\)\) return true/);assert.match(client,/reconcile\(operation, raw, \(\) => active\)/);assert.match(client,/idempotency_conflict/);assert.match(client,/await reconcile\(operation, raw\)/);
});
