import test from 'node:test';import assert from 'node:assert/strict';
import {qSetupPrizeWorkspace} from './fixtures/q-setup-prize-workspace.mjs';
import {runtime,id,actor,tournament,foreign,seed,seedKey,settle,find,text} from './helpers/creation-seed-component-runtime.mjs';
const setupEntry='src/app/tournament/[tournamentId]/setup/setup-client.tsx',props={actorId:actor,tournamentId:tournament};
function setup(){
 const saved=qSetupPrizeWorkspace(tournament);saved.current.revisionId=id(10);saved.current.officials[0].profileId=actor;saved.current.events[0].gameCount=12;
 const f={saved,workspace:structuredClone(saved),mode:'ok',requests:[],getHook:null};
 const {revisionId:unusedRevision,version:unusedVersion,createdAt:unusedAt,...payload}=structuredClone(saved.current);void unusedRevision;void unusedVersion;void unusedAt;
 for(const event of payload.events){delete event.sourceStatus;for(const pool of [...event.qPools,...event.sidePools]){delete pool.slot;delete pool.sourceStatus;}}
 f.request={expectedVersion:0,idempotencyKey:id(20),payload};f.envelope={kind:'tournament-setup',request:f.request,stage:'all'};
 f.rt=runtime(setupEntry,async(url,options={})=>{
  if(options.method==='POST'){
   f.requests.push(options.body);if(f.mode==='throw')throw Error('fictional outcome unavailable');
   if(f.mode==='http')return{ok:false,status:503,json:async()=>({error:'unavailable'})};
   if(f.mode==='malformed-ack')return{ok:true,status:200,json:async()=>({status:'setup_draft_saved'})};
   f.workspace=structuredClone(f.saved);if(f.mode==='wrong-revision')f.workspace.current.revisionId=id(99);if(f.mode==='wrong-fee')f.workspace.current.events[0].entryFeeCents+=500;
   return{ok:true,status:200,json:async()=>({status:'setup_draft_saved',revisionId:f.saved.current.revisionId,version:1,eventCount:payload.events.length,...Object.fromEntries(['operationalEventsCreated','rulesetApproved','seatingUpdated','financeUpdated','resultsUpdated','payoutsCalculated','qualifiersCalculated','accSubmissionCreated'].map(k=>[k,false]))})};
  }
  if(url.endsWith('/setup/linked'))return{ok:false,status:404,json:async()=>null};
  if(url.endsWith('/setup/activation'))return{ok:true,status:200,json:async()=>({status:'not_activated'})};
  if(url.endsWith('/setup')){
   if(f.getHook)return f.getHook();
   return{ok:f.mode!=='read-http',status:f.mode==='read-http'?503:200,json:async()=>f.mode==='read-malformed'?{}:{workspace:f.workspace,officialChoices:{directorProfileId:actor,directorDisplayName:'Fictional Director',coDirectorProfileIds:[]},sidePoolTypesReady:true}};
  }
  return{ok:false,status:503,json:async()=>null};
 });
 f.rt.render(props);f.load=()=>f.rt.loadSetup()();f.mount=async()=>{f.rt.runEffects(source=>source.includes('loadSequence.current + 1'));await settle();return f.rt.render(props);};
 f.pendingKey=`tournament-setup:${actor}:${tournament}`;return f;
}
const put=(f,value=seed())=>{const raw=typeof value==='string'?value:JSON.stringify(value);f.rt.values.set(seedKey(),raw);return raw;};

test('actual NewTournament retains uncertain exact request, then stores only validated creation seed before navigation',async()=>{
 const requests=[];let answer='unknown';const rt=runtime('src/app/director/tournaments/new/new-tournament-client.tsx',async(_url,options)=>{requests.push(options.body);if(answer==='unknown')throw Error('synthetic lost response');return{ok:true,status:200,json:async()=>answer==='malformed'?{status:'tournament_created'}:answer==='extra'?{...seed(),roleGranted:true}:seed()};});
 rt.values.set(seedKey(foreign), 'foreign fictional seed');rt.render({actorId:actor});rt.runEffects(()=>true);rt.timers.splice(0).forEach(fn=>fn());rt.render({actorId:actor});
 find(rt.tree,n=>n.type==='input'&&n.props.placeholder).props.onChange({target:{value:'Fictional Seed'}});rt.render({actorId:actor});find(rt.tree,n=>n.type==='input'&&n.props.type==='date').props.onChange({target:{value:'2027-02-03'}});rt.render({actorId:actor});
 await rt.tree.props.onSubmit({preventDefault(){}});rt.render({actorId:actor});const key=`director-new-tournament-pending:${actor}`,raw=rt.values.get(key);assert(raw);assert.equal(rt.values.has(seedKey()),false);assert.equal(rt.pushes.length,0);
 for(answer of ['malformed','extra']){await rt.tree.props.onSubmit({preventDefault(){}});rt.render({actorId:actor});assert.equal(rt.values.get(key),raw);assert.equal(rt.values.has(seedKey()),false);assert.equal(rt.pushes.length,0);}
 answer='accepted';await rt.tree.props.onSubmit({preventDefault(){}});assert.equal(requests.length,4);assert(requests.every(request=>request===requests[0]));assert.equal(rt.values.has(key),false);assert.deepEqual(JSON.parse(rt.values.get(seedKey())),seed());assert.deepEqual(rt.pushes,[`/tournament/${tournament}/setup`]);assert.equal(rt.values.get(seedKey(foreign)),'foreign fictional seed');
});

test('actual saved Setup clears only strict tournament-created DTO for this tournament and preserves malformed/foreign/unknown bytes',async()=>{
 const draft=setup(),draftRaw=put(draft);draft.workspace.current=null;draft.workspace.history=[];await draft.load();draft.rt.render(props);assert.equal(draft.rt.values.get(seedKey()),draftRaw);assert(find(draft.rt.tree,n=>n.type==='input'&&n.props.value===seed().tournamentName));
 for(const value of ['{',JSON.stringify(null),JSON.stringify({status:'unknown'}),seed(foreign),{...seed(),unrecognized:true},{...seed(),tournamentDate:'unknown'}]){const f=setup(),raw=put(f,value);await f.load();assert.equal(f.rt.values.get(seedKey()),raw);assert(!f.rt.removed.includes(seedKey()));}
 const f=setup();put(f);await f.load();assert.equal(f.rt.values.has(seedKey()),false);assert.equal(f.rt.removed.filter(k=>k===seedKey()).length,1);
});

test('actual cleanup rechecks exact raw bytes and preserves replacement and storage-denied data',async()=>{
 for(const replacement of [JSON.stringify({...seed(),tournamentName:'Replacement'}),JSON.stringify(seed(),null,2),'{replacement']){
  const f=setup(),original=put(f),get=f.rt.storage.getItem;let reads=0;f.rt.storage.getItem=key=>{if(key===seedKey()&&++reads===1){f.rt.values.set(key,replacement);return original;}return get(key);};await f.load();assert.equal(f.rt.values.get(seedKey()),replacement);assert(!f.rt.removed.includes(seedKey()));
 }
 for(const deny of ['first-read','second-read','remove']){const f=setup(),raw=put(f),get=f.rt.storage.getItem,remove=f.rt.storage.removeItem;let reads=0;f.rt.storage.getItem=key=>{if(key===seedKey()&&++reads===(deny==='first-read'?1:deny==='second-read'?2:-1))throw Error('fictional storage denied');return get(key);};f.rt.storage.removeItem=key=>{if(key===seedKey()&&deny==='remove')throw Error('fictional storage denied');remove(key);};const loaded=await f.load();assert.equal(loaded.currentVersion,1);assert.equal(f.rt.values.get(seedKey()),raw);}
});

test('actual pending Setup save preserves creation seed and exact request across uncertain/malformed or wrong persisted revision/fees',async()=>{
 for(const mode of ['http','throw','malformed-ack','wrong-revision','wrong-fee']){
  const f=setup();f.workspace.current=null;f.workspace.history=[];const seedRaw=put(f),pendingRaw=JSON.stringify(f.envelope);f.rt.values.set(f.pendingKey,pendingRaw);await f.mount();f.mode=mode;
  const retry=find(f.rt.tree,n=>n.type==='button'&&['Retry exact saved request','Retry Save Tournament Details'].includes(text(n)));assert(retry,mode+': '+text(f.rt.tree).slice(-800));retry.props.onClick();await settle();assert.equal(f.requests.length,1,mode);assert.equal(f.requests[0],JSON.stringify(f.request),mode);assert.equal(f.rt.values.get(seedKey()),seedRaw,mode);assert.equal(f.rt.values.get(f.pendingKey),pendingRaw,mode);
 }
 for(const mode of ['read-http','read-malformed']){const f=setup(),raw=put(f);f.mode=mode;await assert.rejects(f.load());assert.equal(f.rt.values.get(seedKey()),raw);}
});

test('actual load owner and epoch guards prevent stale saved readback from cleaning any seed',async()=>{
 for(const mode of ['owner','epoch']){const f=setup(),raw=put(f);let release,reads=0;f.getHook=()=>{if(++reads===1)return new Promise(resolve=>{release=resolve;});return Promise.resolve({ok:false,status:503,json:async()=>({})});};const old=f.load();assert(release);
  if(mode==='owner')f.rt.render({...props,actorId:foreign});else await assert.rejects(f.load());
  release({ok:true,status:200,json:async()=>({workspace:f.workspace,officialChoices:{directorProfileId:actor,directorDisplayName:'Fictional Director',coDirectorProfileIds:[]},sidePoolTypesReady:true})});await assert.rejects(old,/setup-load-superseded/);assert.equal(f.rt.values.get(seedKey()),raw);assert(!f.rt.removed.includes(seedKey()));
 }
});

test('actual verified save lifecycle removes scoped seed only after persisted revision/financial match and preserves other recovery',async()=>{
 const f=setup();f.workspace.current=null;f.workspace.history=[];put(f);const pendingRaw=JSON.stringify(f.envelope);f.rt.values.set(f.pendingKey,pendingRaw);
 const untouched=new Map([[seedKey(foreign),'foreign actor seed'],[seedKey(actor,foreign),'foreign tournament seed'],[`tournament-setup:${foreign}:${tournament}`,'foreign exact pending']]);for(const pair of untouched)f.rt.values.set(...pair);
 await f.mount();assert(f.rt.values.has(seedKey()));const retry=find(f.rt.tree,n=>n.type==='button'&&['Retry exact saved request','Retry Save Tournament Details'].includes(text(n)));assert(retry,text(f.rt.tree).slice(-800));retry.props.onClick();await settle();assert.equal(f.requests.length,1);assert.equal(f.rt.values.has(seedKey()),false);assert.equal(f.rt.values.has(f.pendingKey),false);assert.equal(f.rt.removed.filter(k=>k===seedKey()).length,1);for(const [key,raw]of untouched)assert.equal(f.rt.values.get(key),raw);
});
