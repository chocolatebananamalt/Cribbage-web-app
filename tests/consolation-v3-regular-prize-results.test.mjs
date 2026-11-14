// Unit-only execution of actual page and route with fictional transport ports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {regularPrizeV3WiringFixture as fixture,renderedNodes} from './helpers/regular-prize-v3-wiring-fixture.mjs';

for(const kind of ['main','consolation']){
  test(`${kind} Results renders the V3 generic award DTO and current CSV link`,async()=>{
    const f=fixture(kind),nodes=renderedNodes(await f.page()),award=nodes.find(n=>n.type===f.ModernPrizeResultsV2);
    assert.equal(award?.props.view,f.state.view);assert(nodes.some(n=>n.props?.href?.endsWith('/regular-prize-report')));
    const call=f.state.calls.find(c=>c.kind==='transport');assert.equal(call.writes,false);assert.equal(call.sameNormal,true);assert.deepEqual({...call.scope},{actorId:f.state.actorId,tournamentId:f.state.tournamentId,eventId:f.state.eventId});
    assert.equal(f.state.calls.find(c=>c.kind==='results').qid,f.state.qualification.resultVersionId);
  });
  test(`${kind} CSV uses only the current V3 read and existing unpaid formatter`,async()=>{
    const f=fixture(kind),r=await f.csv();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('content-disposition'),/unpaid-regular-prize-awards\.csv/);
    const csv=await r.text();assert(csv.includes(`"Event Type","${kind}"`));assert(csv.includes('No payment, bank settlement, MRP award or ACC acceptance established'));assert(csv.includes('Q-Pool and Side Pool amounts are not included'));
    assert.equal(f.state.calls.filter(c=>c.kind==='transport').length,1);assert.equal(f.state.calls.find(c=>c.kind==='transport').writes,false);
    assert.equal(f.state.calls.filter(c=>c.kind==='adminRpc'&&c.name.includes('selected_step_award')).length,1);
  });
}

test('event-kind mismatch cannot render or export another event kind',async()=>{
  const page=fixture('consolation');page.state.view.eventKind='main';const nodes=renderedNodes(await page.page());assert.equal(nodes.find(n=>n.type===page.ModernPrizeResultsV2)?.props.view,null);assert(!nodes.some(n=>n.props?.href?.endsWith('/regular-prize-report')));
  const csv=fixture('consolation');csv.state.view.eventKind='main';assert.equal((await csv.csv()).status,409);
});

test('held current V3 evidence stays unavailable and cannot become a zero award or CSV',async()=>{
  const page=fixture('consolation');page.state.view=null;const nodes=renderedNodes(await page.page());assert.equal(nodes.find(n=>n.type===page.ModernPrizeResultsV2)?.props.view,null);assert(!nodes.some(n=>n.props?.href?.endsWith('/regular-prize-report')));
  const csv=fixture('consolation');csv.state.view=null;assert.equal((await csv.csv()).status,409);
});

for(const role of ['co_director','player','cross_checker'])test(`${role} does not acquire primary-Director V3 Results/export authority`,async()=>{
  const page=fixture('consolation');page.state.role=role;const nodes=renderedNodes(await page.page());assert(!nodes.some(n=>n.type===page.ModernPrizeResultsV2));assert(!page.state.calls.some(c=>c.kind==='transport'));
  const csv=fixture('consolation');csv.state.role=role;assert.equal((await csv.csv()).status,403);assert.equal(csv.state.adminConstructed,0);assert(!csv.state.calls.some(c=>c.kind==='transport'));
});

test('export gate denies before normal or privileged client construction',async()=>{
  for(const key of ['gate','exportGate']){const f=fixture('consolation');f.state[key]=false;assert.equal((await f.csv()).status,404);assert.equal(f.state.normalConstructed,0);assert.equal(f.state.adminConstructed,0);}
});

test('unverified normal user cannot cause privileged report reads',async()=>{
  const f=fixture('consolation');f.state.userId='00000000-0000-4000-8000-000000000099';assert.equal((await f.csv()).status,403);assert.equal(f.state.adminConstructed,0);
});

test('foreign tournament/event summaries and duplicate event scope reject before V3 transport',async()=>{
  for(const mutate of [s=>s.summaryTournamentId='00000000-0000-4000-8000-000000000099',s=>s.summaryEventId='00000000-0000-4000-8000-000000000099',s=>s.duplicateEvent=true]){const f=fixture('consolation');mutate(f.state);assert.equal((await f.csv()).status,409);assert(!f.state.calls.some(c=>c.kind==='transport'));}
});

test('qualification drift, session switch, role withdrawal and gate withdrawal reject after the V3 read',async()=>{
  for(const mutate of [s=>s.qualificationAfter={...s.qualification,resultVersionId:'00000000-0000-4000-8000-000000000099'},s=>s.sessionId='00000000-0000-4000-8000-000000000099',s=>s.role='co_director',s=>s.gate=false,s=>s.exportGate=false]){const f=fixture('consolation');f.state.afterRead=mutate;assert.equal((await f.csv()).status,409);}
});

test('synthetic, already finalized and unsupported-format reports do not call the V3 transport',async()=>{
  for(const mutate of [s=>s.synthetic={eventIds:[s.eventId]},s=>s.final={},s=>s.format='custom']){const f=fixture('consolation');mutate(f.state);assert.equal((await f.csv()).status,409);assert(!f.state.calls.some(c=>c.kind==='transport'));}
});

test('invalid route identifiers reject before any client and provider failure produces no CSV',async()=>{
  const invalid=fixture('consolation');assert.equal((await invalid.csv({id:'invalid',eventId:invalid.state.eventId})).status,400);assert.equal(invalid.state.normalConstructed,0);assert.equal(invalid.state.adminConstructed,0);
  const failed=fixture('consolation');failed.state.throwRead=true;const response=await failed.csv();assert.equal(response.status,503);assert.match(response.headers.get('content-type'),/application\/json/);
});
