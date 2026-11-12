import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
import {projectNativeMixedPaperEntryV1 as project,buildNativeMixedPaperEntryRequestV1 as build,isNativeMixedPaperEntryBindingV1 as valid} from '../src/lib/seating/native-mixed-paper-entry-view-v1.ts';
import {isNativeMixedGameWriteRequestV1 as requestValid} from '../src/lib/seating/native-mixed-game-evidence-v1.ts';
import {NativeMixedGamePendingControllerV1 as Controller,parseNativeMixedGamePendingV1 as parse,nativeMixedGamePendingKeyV1 as key} from '../src/lib/seating/native-mixed-game-pending-v1.ts';
import {nativeMixedPaperScreenExample as example} from './helpers/native-mixed-paper-screen-example.mjs';import {screenId as id} from './helpers/native-mixed-digital-screen-example.mjs';
test('PP requires two separate fictional card claims; PD never derives paper score from hidden Digital',()=>{
 const x=example(),v=project(x.binding,x.state);assert.equal(v.phase,'capture');assert.deepEqual(v.paperSides,['a','b']);assert.equal(v.permissionVerified,false);
 const r=build(x.binding,x.state,id(70),id(60),x.claims());assert.equal(r.action,'paper-capture');assert.equal(r.payload.physicalOriginal,false);assert.equal(r.payload.independentHumanPlayClaimed,false);assert.equal(build(x.binding,x.state,id(70),id(60),x.claims().slice(0,1)),null);assert.equal(build(x.binding,x.state,id(70),id(60),[x.claims()[0],x.claims()[0]]),null);
 const y=example('PD');y.state.revision=1;assert.equal(project(y.binding,y.state).phase,'capture');assert.equal(project(y.binding,y.state).capture,null);assert.deepEqual(project(y.binding,y.state).state.entries,[]);assert.equal(build(y.binding,y.state,id(70),id(60),y.claims()).payload.claims.length,1);
});
test('separate nonself reviewer must independently re-enter exactly the captured claims',()=>{
 const x=example();x.capture();assert.equal(project(x.binding,x.state).phase,'waiting');x.binding.target.actorId=id(51);x.state.actorId=id(51);x.binding.official.roles=['co_director'];assert.equal(project(x.binding,x.state).phase,'review');
 const claims=x.claims().reverse().map(c=>({result:{margin:c.result.margin,winnerSide:c.result.winnerSide},side:c.side}));const request=build(x.binding,x.state,id(71),null,claims);assert.equal(request.action,'paper-review');assert.deepEqual(request.payload.reenteredClaims,claims);assert.equal(requestValid(request),true);
 for(const invalid of [null,[],[null],x.claims().slice(0,1),x.claims().map(c=>({...c,result:{...c.result,margin:39}}))])assert.equal(build(x.binding,x.state,id(71),null,invalid),null);
 const missing=structuredClone(request);delete missing.payload.reenteredClaims;assert.equal(requestValid(missing),false);
 x.review();assert.equal(project(x.binding,x.state).phase,'complete');x.state.entries[1].reenteredClaims[0].result.margin=39;assert.equal(project(x.binding,x.state),null);
});
test('role, game-side identity and source failures block controls; only cross-checker captures',()=>{
 const x=example('PD');for(const mutate of [b=>b.target.actorId=b.sideB.actorRef,b=>b.official.nonselfChecked=false,b=>b.official.identityBindingId='bad',b=>b.official.roles=['judge'],b=>b.sideA.fixedTournamentId=b.sideB.fixedTournamentId]){const b=structuredClone(x.binding);mutate(b);assert.equal(valid(b),false);assert.equal(project(b,x.state),null);}
 x.binding.official.roles=['director'];assert.equal(project(x.binding,x.state).phase,'waiting');assert.equal(build(x.binding,x.state,id(70),id(60),x.claims()),null);assert.equal(project(x.binding,{...x.state,startSourceDigest:'b'.repeat(64)}),null);
});
test('PD requires own Digital confirmation after review; mismatched PP cards remain blocked',()=>{
 const x=example('PD');x.capture();x.submit();x.binding.target.actorId=id(51);x.state.actorId=id(51);assert.equal(project(x.binding,x.state).phase,'review');x.review();assert.equal(project(x.binding,x.state).phase,'waiting');x.confirm();assert.equal(project(x.binding,x.state).phase,'complete');
 const y=example();y.capture();y.state.entries[0].claims[1].result.margin=39;assert.equal(project(y.binding,y.state).phase,'mismatch');assert.equal(build(y.binding,y.state,id(70),null,y.claims()),null);
});
test('Paper pending uses its own channel, same transactional CAS and no unknown resend',async()=>{
 const x=example(),request=build(x.binding,x.state,id(70),id(60),x.claims()),rows=new Map();let sends=0;
 const retained={read:async k=>rows.get(k)??null,transition:async(k,expected,next)=>{if((rows.get(k)??null)!==expected)return false;if(next===null)rows.delete(k);else rows.set(k,next);return true;}},transport={write:async()=>{sends++;return{data:null,error:'operation_outcome_unknown'};},recover:async()=>({data:null,error:'operation_outcome_unknown'}),state:async()=>({data:null,error:'invalid_response'})};
 const options={target:x.binding.target,ownParticipantId:null,retained,transport,enabled:()=>true,online:()=>true};const a=new Controller(options);await a.initialize();assert.equal(await a.save(request,x.state),true);await a.sendExact();assert.equal(parse(rows.get(key(x.binding.target))).phase,'attempted');a.dispose();const b=new Controller(options);await b.initialize();await b.sendExact();await b.checkOutcome();assert.equal(sends,1);assert.deepEqual(parse(rows.get(key(x.binding.target))).request,request);
 const record=JSON.parse(rows.get(key(x.binding.target)));record.ownParticipantId=x.binding.sideA.participantId;assert.equal(parse(JSON.stringify(record)),null);
});
test('SQL source retains and compares re-entered claims in writer and historical binding',()=>{
 const sql=fs.readFileSync('database/proposals/native-mixed-simulation-game-evidence-v1.sql','utf8');assert.match(sql,/array\['captureId','artifactId','artifactDigest','reenteredClaims','decision','statement'\]/);assert.match(sql,/jsonb_array_elements\(payload->'reenteredClaims'\)/);assert.match(sql,/jsonb_array_elements\(e.entry->'reenteredClaims'\)/);assert.match(sql,/capture_entry.actor_id=e.actor_id/);assert.doesNotMatch(sql,/\bGRANT\s+EXECUTE/i);
 // Evidence has no action column; audit_events legitimately does.
 assert.doesNotMatch(sql.slice(sql.indexOf('create function app.get_native_mixed_simulation_game_state_v1'),sql.indexOf('-- Explicit own-operation resolution')),/\band action='/);assert.match(sql,/actor_id=actor and entry->>'action'='digital-submit'/);
 const ui=fs.readFileSync('src/components/native-mixed-paper-entry-v1.tsx','utf8');assert.ok(ui.includes('p.enabled!==true'));assert.ok(ui.includes('ownParticipantId:null'));assert.ok(ui.includes('controller.dispose()'));assert.doesNotMatch(ui,/fetch\(|randomUUID|sessionStorage|localStorage|\.retry\(/);assert.ok(ui.includes("view.phase==='capture'?runtime.makeArtifactId():null"));
});
test('real Paper TSX SSR has separate blank cards, fixed IDs and review/recovery states without browser',()=>{
 const r=spawnSync(process.execPath,['--experimental-strip-types','tests/helpers/render-native-mixed-paper-screen.mjs'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);assert.match(r.stdout,/paper screen SSR cases passed/);
});
