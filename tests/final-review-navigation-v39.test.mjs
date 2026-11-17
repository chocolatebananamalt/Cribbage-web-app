import test from 'node:test';
import assert from 'node:assert/strict';
import {regularPrizeV3WiringFixture as fixture,renderedNodes} from './helpers/regular-prize-v3-wiring-fixture.mjs';
const links=tree=>renderedNodes(tree).filter(n=>typeof n.props?.href==='string');
const final=tree=>links(tree).filter(n=>n.props.href.endsWith('/final-review'));
test('finalized Main and Consolation Results reach exact-event final review without any writer',async()=>{
 for(const kind of ['main','consolation']){const f=fixture(kind);f.state.finalReviewGate=true;f.state.gate=false;const tree=await f.page();assert.equal(final(tree).length,1);assert.equal(final(tree)[0].props.href,`/tournament/${f.state.tournamentId}/finance/${f.state.eventId}/final-review`);assert.equal(final(tree)[0].props.prefetch,false);assert(!f.state.calls.some(c=>c.name&&/^(record|save|finalize|execute|send)_/.test(c.name)));}
});
test('closed gate, nonprimary actor, synthetic or unsupported Results do not advertise final review',async()=>{
 for(const mode of ['closed','co_director','synthetic','satellite','manual','imported','custom']){const f=fixture();f.state.gate=false;f.state.finalReviewGate=mode!=='closed';if(mode==='co_director')f.state.role=mode;if(mode==='synthetic')f.state.synthetic={eventIds:[f.state.eventId]};if(mode==='satellite'||mode==='custom')f.state.kind=mode;if(mode==='manual'||mode==='imported')f.state.scoringMethod=mode;assert.equal(final(await f.page()).length,0,mode);}
});
test('pool review reaches same-event final review only with existing closeout gate',async()=>{
 for(const enabled of [false,true]){const f=fixture();f.state.finalReviewGate=enabled;const tree=await f.poolPage();assert.equal(final(tree).length,Number(enabled));if(enabled)assert.equal(final(tree)[0].props.href,`/tournament/${f.state.tournamentId}/finance/${f.state.eventId}/final-review`);}
});
test('final review keeps existing primary-Director gate and never advertises an unverified pool lane',async()=>{
 for(const kind of ['main','consolation']){const f=fixture(kind);await assert.rejects(f.finalPage,/NOT_FOUND/);f.state.finalReviewGate=true;f.state.role='co_director';await assert.rejects(f.finalPage,/NOT_FOUND/);f.state.role='director';const tree=await f.finalPage();assert.equal(links(tree).length,1);assert.equal(links(tree)[0].props.href,`/tournament/${f.state.tournamentId}/results?event=${f.state.eventId}`);assert.equal(links(tree)[0].props.prefetch,false);const section=renderedNodes(tree).find(n=>n.props?.scope);assert.deepEqual({...section.props.scope},{actorId:f.state.actorId,tournamentId:f.state.tournamentId,eventId:f.state.eventId});assert.equal(section.props.writesVerified,false);assert.equal(f.state.calls.length,0);}
});
test('same-named concurrent events never use display names for destination binding',async()=>{
 for(const kind of ['main','consolation']){const f=fixture(kind);f.state.eventName='Same Event Name';f.state.finalReviewGate=true;f.state.gate=false;f.state.eventId=kind==='main'?'ab130000-0000-4000-8000-000000000091':'ab130000-0000-4000-8000-000000000092';f.state.summaryEventId=f.state.eventId;f.state.qualification.eventId=f.state.eventId;const tree=await f.page();assert.equal(final(tree)[0].props.href,`/tournament/${f.state.tournamentId}/finance/${f.state.eventId}/final-review`);}
});
