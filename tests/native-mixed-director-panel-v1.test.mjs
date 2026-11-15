import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {nativeMixedDirectorUiExample} from './helpers/native-mixed-director-ui-example.mjs';
import {readNativeMixedDirectorReviewMaterialsV1 as read,readNativeMixedDirectorPreparedOperationV1 as prepared} from '../src/lib/seating/native-mixed-director-review-materials-v1.ts';
import {NativeMixedDirectorSessionV1,nativeMixedDirectorPendingKeyV1} from '../src/lib/seating/native-mixed-director-session-v1.ts';
test('review and publish display only exact own historical plan/draw/review chain and valid movement',()=>{
 const x=nativeMixedDirectorUiExample();for(const action of ['review','publish'])assert.ok(read(x.materials,x.scope,x.operations[action]));
 const cases=[x=>x.materials.draw.actorId=x.scope.eventId,x=>x.materials.draw.receipt.currentSourceVerified=true,x=>x.materials.draw.receipt.drawId=x.scope.actorId,x=>x.materials.draw.request.expectedPlanDigest='0'.repeat(64),x=>x.materials.review.request.drawId=x.scope.actorId,x=>x.materials.draw.receipt.candidate.matches.pop()];
 for(const mutate of cases){const v=nativeMixedDirectorUiExample();mutate(v);assert.equal(read(v.materials,v.scope,v.operations.publish),null);}
 assert.equal(read(x.materials,x.scope,x.operations.draw),null);
 const cyclic=nativeMixedDirectorUiExample();cyclic.materials.draw.receipt.candidate.self=cyclic.materials;assert.equal(read(cyclic.materials,cyclic.scope,cyclic.operations.review),null);
 assert.equal(read({...x.materials,oversized:'x'.repeat(131073)},x.scope,x.operations.review),null);
 const cyclicOp=structuredClone(x.operations.plan);cyclicOp.request.config.tables[0].self=cyclicOp.request.config.tables[0];assert.equal(prepared(cyclicOp),null);
 assert.equal(prepared({...x.operations.plan,oversized:'x'.repeat(131073)}),null);const captured=prepared(x.operations.plan);assert.deepEqual(captured,x.operations.plan);captured.request.reason='Changed copied host props';assert.notEqual(captured.request.reason,x.operations.plan.request.reason);
});
test('closed accepted hint is scoped and display-only; terminal or malformed records offer no next action',async()=>{
 const x=nativeMixedDirectorUiExample(),rows=new Map(),key=nativeMixedDirectorPendingKeyV1(x.context),retained={read:async k=>rows.get(k)??null,transition:async()=>{throw Error('must not write');}},controller=new NativeMixedDirectorSessionV1({retained,currentContext:()=>x.context,canRead:()=>true});
 for(const [action,hint]of[['plan','draw'],['draw','review'],['review','publish']]){
  rows.set(key,JSON.stringify({kind:'native-mixed-director-closed-v1',pending:{kind:'native-mixed-director-pending-v1',projectRef:x.context.projectRef,scope:x.scope,operation:x.operations[action]},receipt:x.histories[action].receipt}));await controller.activate(x.context);assert.equal(controller.getSnapshot().nextActionHint,hint);assert.equal(await controller.advance(x.operations[hint]),false);
 }
 const bad=JSON.parse(rows.get(key));bad.receipt.actorId=x.scope.eventId;rows.set(key,JSON.stringify(bad));await controller.activate(x.context);assert.equal(controller.getSnapshot().nextActionHint,undefined);
});
test('panel is a default-off client-host seam with no real route, fetch, IDs or retry shortcut',async()=>{
 const s=await fs.readFile('src/components/native-mixed-director-panel-v1.tsx','utf8');
 for(const text of ['props.enabled!==true','props.canRead!==true','controller.activate(null)','controller.check()','controller.cancelPending(reason.trim())','controller.archiveResolved()','controller.advance(offered)','nextActionHint','readNativeMixedDirectorReviewMaterialsV1','signature=JSON.stringify({prepared,materials})','pendingSignature=JSON.stringify(view.operation)'])assert.ok(s.includes(text),text);
 assert.doesNotMatch(s,/fetch\(|randomUUID|Math\.random|localStorage|sessionStorage|\.retry\(/u);
});
