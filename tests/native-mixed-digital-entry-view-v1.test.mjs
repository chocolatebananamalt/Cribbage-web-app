import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
import {loadNativeMixedOwnEntryV1,projectNativeMixedDigitalEntryV1 as project,buildNativeMixedDigitalEntryRequestV1 as build,isNativeMixedDigitalEntryBindingV1 as bindingValid} from '../src/lib/seating/native-mixed-digital-entry-view-v1.ts';
import {nativeMixedDigitalScreenExample as example,screenId as id} from './helpers/native-mixed-digital-screen-example.mjs';
test('DD screen preserves independent hidden entry, separate confirmations and simulation-only completion',()=>{
 const x=example();assert.equal(project(x.binding,x.state).phase,'entry');const r=build(x.binding,x.state,'digital-submit',id(80),x.result);assert.equal(r.payload.result.winnerSide,'b');assert.equal(r.payload.participantId,x.binding.player.participantId);
 x.submit();assert.equal(project(x.binding,x.state).phase,'waiting');assert.equal(build(x.binding,x.state,'digital-submit',id(81),x.result),null);
 x.submit(x.binding.opponent);const ready=project(x.binding,x.state);assert.equal(ready.phase,'confirm');const confirm=build(x.binding,x.state,'digital-confirm',id(82),{winnerSide:'a',margin:1});assert.deepEqual(confirm.payload.result,x.result);assert.deepEqual(confirm.payload.references,ready.references);x.confirm();assert.equal(project(x.binding,x.state).phase,'waiting');x.confirm(x.binding.opponent);const complete=project(x.binding,x.state);assert.equal(complete.phase,'complete');assert.equal(complete.state.officialResultVerified,false);assert.equal(complete.state.moneyMoved,false);assert.equal(build(x.binding,x.state,'digital-confirm',id(83),null),null);
});
test('PD screen requires distinct bound paper review and own confirmation; mismatch cannot confirm',()=>{
 const x=example('paper');x.capture();x.submit();assert.equal(project(x.binding,x.state).phase,'waiting');x.review();assert.equal(project(x.binding,x.state).phase,'confirm');assert.equal(build(x.binding,x.state,'digital-confirm',id(80),null).payload.references.length,3);x.confirm();assert.equal(project(x.binding,x.state).phase,'complete');
 const y=example();y.submit();y.submit(y.binding.opponent,{winnerSide:'a',margin:10});assert.equal(project(y.binding,y.state).phase,'mismatch');assert.equal(build(y.binding,y.state,'digital-confirm',id(80),null),null);
});
test('source, actor and fixed identity mistakes fail closed without replacing Tournament ID with location',()=>{
 const x=example();assert.equal(bindingValid(x.binding),true);assert.notEqual(x.binding.player.fixedTournamentId,x.binding.player.currentSeat);
 for(const mutate of [b=>b.player.profileId=id(99),b=>b.ownSide='c',b=>b.player.fixedTournamentId=b.opponent.fixedTournamentId,b=>b.player.currentSeat='ACC 123',b=>b.opponent.participantId=b.player.participantId,b=>b.gameNumber=13]){const b=structuredClone(x.binding);mutate(b);assert.equal(bindingValid(b),false);assert.equal(project(b,x.state),null);}
 assert.equal(project(x.binding,{...x.state,startSourceDigest:'b'.repeat(64)}),null);assert.equal(project(x.binding,null),null);assert.equal(build(x.binding,x.state,'digital-submit',id(80),{winnerSide:'b',margin:0}),null);
});
test('unsubmitted players cannot use revealed evidence; malformed phase/ref/preparer chains block controls',()=>{
 const x=example();x.submit(x.binding.opponent);assert.equal(project(x.binding,x.state),null);const blind={...x.state,entries:[],evidenceVisibility:'metadata-only'};assert.equal(project(x.binding,blind).phase,'entry');
 for(const mutate of [x=>x.state.entries[1].actorId=x.binding.player.profileId,x=>x.state.entries[1].claims[0].side='b',x=>x.state.entries[2].captureId=id(99),x=>x.state.entries[2].actorId=x.state.entries[1].actorId,x=>x.state.entries[3].references=[id(99),id(98)]]){const v=example('paper');v.submit();v.capture();v.review();v.confirm();mutate(v);assert.equal(project(v.binding,v.state),null);}
});
test('screen is default-off and only uses injected private controller/transport',()=>{
 const s=fs.readFileSync('src/components/native-mixed-digital-score-entry-v1.tsx','utf8');for(const t of ['props.enabled!==true','controller.dispose()','controller.save(request,loaded)','controller.sendExact()','c.checkOutcome()','PlayerPageFrame','GamePlayerLocation','deriveScore','fixedTournamentId','Submit result','Confirm My Entry','if(flight.current||busy||dirty)','setWinner(null)'])assert.ok(s.includes(t),t);
 assert.doesNotMatch(s,/fetch\(|randomUUID|createClient|sessionStorage|localStorage|\/api\/v1\/games|\.retry/u);
 const routes=fs.readdirSync('src/app',{recursive:true}).filter(p=>/\.(tsx?|jsx?)$/.test(p));for(const p of routes)assert.ok(!fs.readFileSync('src/app/'+p,'utf8').includes('native-mixed-digital-score-entry-v1'),p);
});
test('real TSX renders approved controls and pending/confirmation states offline without browser or network',()=>{
 const result=spawnSync(process.execPath,['--experimental-strip-types','tests/helpers/render-native-mixed-digital-screen.mjs'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);assert.match(result.stdout,/screen SSR cases passed/);
});

test('own entry loader selects only authenticated assigned game and drops stale account outcomes',async()=>{
 const x=example();let current=true,calls=0;const transport={bindings:async()=>({data:[x.binding],error:null}),state:async()=>{calls++;return{data:x.state,error:null};}};
 const loaded=await loadNativeMixedOwnEntryV1({target:x.binding.target,transport,enabled:()=>true,current:()=>current});assert.equal(loaded.binding.player.profileId,x.binding.target.actorId);assert.equal(calls,1);
 const changed=await loadNativeMixedOwnEntryV1({target:x.binding.target,transport:{...transport,state:async()=>{current=false;return{data:x.state,error:null};}},enabled:()=>true,current:()=>current});assert.equal(changed,null);
 const foreign=await loadNativeMixedOwnEntryV1({target:{...x.binding.target,gameId:id(99)},transport,enabled:()=>true,current:()=>true});assert.equal(foreign,null);
});

test('private null-peer binding correlates peer confirmation without revealing account identity',()=>{
 const x=example();x.submit();x.submit(x.binding.opponent);x.confirm();x.confirm(x.binding.opponent);const peer=x.binding.opponent.profileId;x.binding.opponent.profileId=null;
 const alias=id(700);for(const e of x.state.entries)if(e.actorId===peer)e.actorId=alias;
 assert.equal(project(x.binding,x.state).phase,'complete');x.state.entries[3].actorId=id(701);assert.equal(project(x.binding,x.state),null);x.state.entries[3].actorId=alias;x.state.entries[1].actorId=x.binding.target.actorId;assert.equal(project(x.binding,x.state),null);
 const y=example();y.binding.player.profileId=null;assert.equal(bindingValid(y.binding),false);
});

test('authoritative upcoming blocks submit and confirm; absent or official play order fails closed',()=>{const x=example();x.state.playOrder='upcoming';assert.equal(project(x.binding,x.state).phase,'upcoming');assert.equal(build(x.binding,x.state,'digital-submit',id(90),x.result),null);assert.equal(build(x.binding,x.state,'digital-confirm',id(91),null),null);x.state.playOrder='complete';assert.equal(project(x.binding,x.state),null);x.state.playOrder='official';assert.equal(project(x.binding,x.state),null);delete x.state.playOrder;assert.equal(project(x.binding,x.state),null);});
