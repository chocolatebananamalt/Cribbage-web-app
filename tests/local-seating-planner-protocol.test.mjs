import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildFacingGeometry,planLocalRandomSeating} from '../src/lib/seating/local-random-plan.ts';
import {canonicalLocalPlan,isAnonymousLocalPlanInput,isLocalSeatingRequest,isLocalPlanResult,isLocalSeatingReceipt} from '../src/lib/api/local-seating-planner.ts';
import {createLocalPlannerHandlers} from '../src/lib/seating/local-planner-handler.ts';
import {anonymousPlannerStorageKey,readAnonymousPlannerState,saveAnonymousPlannerState,isAnonymousPlannerState} from '../src/lib/seating/anonymous-planner-storage.ts';
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const digest=s=>createHash('sha256').update(s).digest('hex');
function input(){const tables=['A','B','C','D','E'].map(tableId=>({tableId,seatCount:4}));return {source:{version:1,sha256:'a'.repeat(64)},registration:'closed',seating:'unpublished',existingTournamentIds:[],participants:Array.from({length:18},(_,i)=>({participantId:`entry-${String(i+1).padStart(2,'0')}`,stationaryPreference:'none'})),tables,activePairIds:buildFacingGeometry(tables).pairs.slice(0,9).map(p=>p.pairId),anchor:{participantId:null,seatId:'A-1',directorApproved:true},stationaryDecisions:[],constraints:[]};}
function request(i=input(),op=2,epoch=3){return {kind:'local-seating-preview-v1',plannerId:uuid(1),operationId:uuid(op),epochId:uuid(epoch),inputDigest:digest(canonicalLocalPlan(i)),input:i};}
function handlers(extra={}){let draws=0;const h=createLocalPlannerHandlers({env:{NODE_ENV:'test',CRIBBAGE_LOCAL_SEATING_PLANNER:'1'},epochId:uuid(3),digest,draw:i=>{draws++;return planLocalRandomSeating(i,()=>0);},readJson:r=>r.json(),sameOrigin:()=>true,json:(body,init)=>({body,status:init?.status??200}),boundary:run=>run(),...extra});return {...h,draws:()=>draws};}
const post=(body,url='http://localhost:3000/api/plan')=>new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const get=(r,epoch=r.epochId)=>new Request(`http://localhost:3000/api/plan?epochId=${epoch}&operationId=${r.operationId}&plannerId=${r.plannerId}`);
const clone=v=>JSON.parse(JSON.stringify(v));
test('anonymous exact codecs reject personal fields and independently reject corrupted candidate authority/geometry',()=>{
  const r=request(), result=planLocalRandomSeating(r.input,()=>0);assert(isLocalSeatingRequest(r));assert(isLocalPlanResult(result,r.input));
  for(const mutate of [x=>x.participants[0].name='Personal',x=>x.participants[0].participantId=uuid(90),x=>x.anchor.extra=true,x=>x.constraints=[{kind:'avoid-pair-in-round',participantIds:['entry-01','entry-02'],round:1,verified:true,sourceReference:'Someone Family'}]]){const i=clone(r.input);mutate(i);assert.equal(isAnonymousLocalPlanInput(i),false);}
  for(const mutate of [x=>x.publishable=true,x=>x.hashVerified=true,x=>x.assignments[0].tournamentId='Z-1',x=>x.matches[1]=clone(x.matches[0]),x=>x.anchor.participantId='entry-18']){const bad=clone(result);mutate(bad);assert.equal(isLocalPlanResult(bad,r.input),false);}
  assert.equal(canonicalLocalPlan({b:2,a:1}),canonicalLocalPlan({a:1,b:2}));
});
test('concurrent same operation shares one entropy draw; conflicts and readback never redraw',async()=>{
  let release;const wait=new Promise(r=>release=r);let draws=0;const h=handlers({draw:async i=>{draws++;await wait;return planLocalRandomSeating(i,()=>0);}}),r=request();
  const a=h.POST(post(r)),b=h.POST(post(r));await new Promise(r=>setImmediate(r));assert.equal(draws,1);release();
  const [ra,rb]=await Promise.all([a,b]);assert.equal(ra.status,200);assert.deepEqual(ra,rb);assert(isLocalSeatingReceipt(ra.body,r));
  assert.deepEqual(await h.GET(get(r)),ra);assert.equal(draws,1);
  const changed=clone(r);changed.input.source.version=2;changed.inputDigest=digest(canonicalLocalPlan(changed.input));assert.equal((await h.POST(post(changed))).status,409);assert.equal(draws,1);
  assert.equal((await h.GET(new Request('http://localhost:3000/api/plan'))).status,200);assert.equal(draws,1);
});
test('lost epoch, unknown outcome, and rejected draw remain unknown without resampling',async()=>{
  let draws=0;const h=handlers({draw:()=>{draws++;throw Error('entropy unavailable');}}),r=request();
  for(let n=0;n<2;n++)assert.equal((await h.POST(post(r))).status,503);
  assert.equal((await h.GET(get(r))).status,503);assert.equal(draws,1);
  const fresh=handlers();assert.equal((await fresh.GET(get(r))).status,503);assert.equal(fresh.draws(),0);
  assert.equal((await fresh.GET(get(r,uuid(4)))).status,503);assert.equal((await fresh.POST(post({...r,epochId:uuid(4)}))).status,409);assert.equal(fresh.draws(),0);
});
test('known blocked and malformed outcomes are reserved, never silently redrawn',async()=>{
  const r=request(),h=handlers({draw:()=>({status:'blocked',reasons:['Bounded search exhausted'],attempts:128})});
  const first=await h.POST(post(r));assert.equal(first.status,200);assert.equal(first.body.result.status,'blocked');assert.deepEqual(await h.POST(post(r)),first);
  let calls=0;const malformed=handlers({draw:()=>{calls++;return {status:'candidate',publishable:true};}});
  assert.equal((await malformed.POST(post(r))).status,503);assert.equal((await malformed.POST(post(r))).status,503);assert.equal(calls,1);
});
test('gates, origin, digest, malformed request and cache limits fail before extra entropy',async()=>{
  const r=request();for(const extra of [{env:{NODE_ENV:'production',CRIBBAGE_LOCAL_SEATING_PLANNER:'1'}},{env:{NODE_ENV:'test'}},{env:{NODE_ENV:'test',CRIBBAGE_LOCAL_SEATING_PLANNER:'1',VERCEL_ENV:'preview'}}]){const h=handlers(extra);assert.equal((await h.POST(post(r))).status,404);assert.equal(h.draws(),0);}
  const h=handlers({maxEntries:1});assert.equal((await h.POST(post(r,'https://example.com/api/plan'))).status,404);
  assert.equal((await handlers({sameOrigin:()=>false}).POST(post(r))).status,403);
  assert.equal((await h.POST(post({...r,inputDigest:'b'.repeat(64)}))).status,400);assert.equal((await h.POST(post({...r,name:'not allowed'}))).status,400);assert.equal(h.draws(),0);
  assert.equal((await h.POST(post(r))).status,200);assert.equal((await h.POST(post(request(input(),5)))).status,503);assert.equal(h.draws(),1);
});
function memory(initial=null){let raw=initial;return {getItem:key=>(assert.equal(key,anonymousPlannerStorageKey),raw),setItem:(key,value)=>{assert.equal(key,anonymousPlannerStorageKey);raw=value;},raw:()=>raw};}
test('anonymous storage CAS preserves malformed/changed data and exact reason history',async()=>{
  const r=request(),reply=await handlers().POST(post(r));const state={kind:'anonymous-seating-draft-v1',plannerId:r.plannerId,draft:r.input,current:{request:r,receipt:reply.body},history:[]};
  const s=memory();assert.equal(readAnonymousPlannerState(s).status,'empty');const raw=saveAnonymousPlannerState(s,state,null);assert(raw);assert.equal(readAnonymousPlannerState(s).status,'saved');
  assert.equal(saveAnonymousPlannerState(s,state,null),null);assert.equal(s.raw(),raw);
  const next=clone(state);next.history=[{...next.current,reason:'compare-another-draw'}];next.current={request:request(input(),7),receipt:null};assert(isAnonymousPlannerState(next));const saved=saveAnonymousPlannerState(s,next,raw);assert(saved);assert.equal(readAnonymousPlannerState(s).value.history[0].reason,'compare-another-draw');
  const bad=clone(next);bad.history[0].reason='free personal text';assert.equal(saveAnonymousPlannerState(s,bad,saved),null);assert.equal(s.raw(),saved);
  for(const malformed of ['{broken',JSON.stringify({...state,email:'private@example.com'})]){const corrupt=memory(malformed);assert.equal(readAnonymousPlannerState(corrupt).status,'blocked');assert.equal(saveAnonymousPlannerState(corrupt,state,malformed),null);assert.equal(corrupt.raw(),malformed);}
  const duplicate=clone(next);duplicate.current.request.operationId=r.operationId;assert.equal(isAnonymousPlannerState(duplicate),false);
});

test('normalized loopback URL cannot conceal a non-loopback HTTP Host',async()=>{
 const h=handlers(),r=request();
 for(const host of ['evil.example:3334','localhost.evil.example','127.0.0.1@evil.example']){
  const request=post(r);request.headers.set('host',host);assert.equal((await h.POST(request)).status,404);
  const read=get(r);read.headers.set('host',host);assert.equal((await h.GET(read)).status,404);
 }assert.equal(h.draws(),0);
});

test('duplicate table or participant identities cannot restore a crashing anonymous draft',()=>{
 for(const mutate of [i=>i.tables[1].tableId=i.tables[0].tableId,i=>i.participants[1].participantId=i.participants[0].participantId]){
  const i=input();mutate(i);assert.equal(isAnonymousLocalPlanInput(i),false);
  const value={kind:'anonymous-seating-draft-v1',plannerId:uuid(1),draft:i,current:null,history:[]};
  const text=JSON.stringify(value),data=new Map([[anonymousPlannerStorageKey,text]]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  assert.equal(readAnonymousPlannerState(storage).status,'blocked');assert.equal(saveAnonymousPlannerState(storage,value,text),null);assert.equal(data.get(anonymousPlannerStorageKey),text);
 }
});
